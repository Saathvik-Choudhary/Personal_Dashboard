/**
 * Mac M1 daemon entrypoint (spec §9). Started by launchd at 4,5,6,7,8am and on login/unlock.
 *
 *   wake → inside 4–9am window?  ── no ──▶ exit
 *        │ yes
 *        ▼
 *   for each job (newsDigest, dailyPlan):
 *      status == success ──▶ skip   (idempotency: don't redo)
 *      otherwise:
 *        call Claude (via @orbit/core)
 *          success ──▶ write results + mark success
 *          failure:
 *            before 9am ──▶ exit; next hourly wake retries
 *            after  9am ──▶ mark failed (dashboard falls back)
 *   write daemonHeartbeat
 *
 * The system degrades; it never breaks. If the Mac is off all morning the cloud still serves
 * yesterday's digest and all reminder delivery still works.
 */
import "dotenv/config";
import { config, repositories, type JobName, type UserProfile } from "@orbit/core";
import { evaluateWindow } from "./window.js";
import { runNewsDigest } from "./jobs/runNewsDigest.js";
import { runDailyPlan } from "./jobs/runDailyPlan.js";

const FORCE = process.argv.includes("--force"); // bypass the window for local testing

function log(msg: string, extra?: Record<string, unknown>): void {
  const line = { ts: new Date().toISOString(), msg, ...extra };
  console.log(JSON.stringify(line));
}

/** Run one job with the idempotency + retry/ceiling semantics of §9. */
async function attemptJob(
  uid: string,
  dateKey: string,
  job: JobName,
  pastCeiling: boolean,
  run: () => Promise<{ inputTokens: number; outputTokens: number }>,
): Promise<void> {
  if (await repositories.jobRuns.isJobDone(uid, dateKey, job)) {
    log("job.skip", { job, reason: "already-success" });
    return;
  }

  const prior = await repositories.jobRuns.getJobRuns(uid, dateKey);
  const attempts = (prior?.[job]?.attempts ?? 0) + 1;

  try {
    const usage = await run();
    await repositories.jobRuns.recordJobResult(uid, dateKey, job, "success", attempts);
    log("job.success", { job, attempts, ...usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (pastCeiling) {
      // Past the 9am ceiling: stop retrying, mark failed, let the dashboard fall back.
      await repositories.jobRuns.recordJobResult(uid, dateKey, job, "failed", attempts);
      log("job.failed.ceiling", { job, attempts, error: message });
    } else {
      // Before the ceiling: record the attempt count but leave status non-success so the
      // next hourly wake retries. We don't write status here (it stays pending/absent).
      await recordAttemptOnly(uid, dateKey, job, attempts);
      log("job.failed.willRetry", { job, attempts, error: message });
    }
  }
}

/** Bump the attempt counter without marking success/failed, so retries continue. */
async function recordAttemptOnly(
  uid: string,
  dateKey: string,
  job: JobName,
  attempts: number,
): Promise<void> {
  const { db } = await import("@orbit/core");
  await db()
    .collection("users")
    .doc(uid)
    .collection("jobRuns")
    .doc(dateKey)
    .set(
      { [job]: { status: "failed", attempts, lastAttemptAt: new Date().toISOString() } },
      { merge: true },
    );
  // Note: status is written "failed" transiently; isJobDone() only treats "success" as done,
  // so the next wake still retries. The ceiling path is what makes a failure terminal.
}

async function main(): Promise<void> {
  const uid = config.userUid;
  if (!uid) {
    log("daemon.exit", { reason: "ORBIT_USER_UID not set" });
    process.exit(1);
  }

  const profile = (await repositories.users.getUserProfile(uid)) as UserProfile | null;
  if (!profile) {
    log("daemon.exit", { reason: "user profile not found", uid });
    process.exit(1);
  }

  const now = new Date();
  const win = evaluateWindow(now, profile.timezone);
  log("daemon.wake", { hour: win.hour, inWindow: win.inWindow, pastCeiling: win.pastCeiling, force: FORCE });

  if (!win.inWindow && !FORCE) {
    log("daemon.exit", { reason: "outside 4–9am window" });
    return;
  }

  await attemptJob(uid, win.dateKey, "newsDigest", win.pastCeiling, () =>
    runNewsDigest(uid, profile, win.dateKey),
  );

  await attemptJob(uid, win.dateKey, "dailyPlan", win.pastCeiling, () =>
    runDailyPlan(uid, profile, now),
  );

  await repositories.jobRuns.writeHeartbeat(uid, win.dateKey);
  log("daemon.done");
}

main().catch((err) => {
  log("daemon.crash", { error: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
