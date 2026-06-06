/**
 * The idempotency ledger (spec §5, §9). `jobRuns/{YYYY-MM-DD}` records per-day status for
 * each job so repeated daemon wakes never redo completed work.
 */
import { userDoc } from "../admin.js";
import type { JobName, JobRuns, JobStatus, ISODate } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("jobRuns");
}

export async function getJobRuns(uid: string, date: ISODate): Promise<JobRuns | null> {
  const snap = await col(uid).doc(date).get();
  return snap.exists ? (snap.data() as JobRuns) : null;
}

/** True when the named job already succeeded today — the idempotency check at the top of §9. */
export async function isJobDone(uid: string, date: ISODate, job: JobName): Promise<boolean> {
  const runs = await getJobRuns(uid, date);
  return runs?.[job]?.status === "success";
}

export async function recordJobResult(
  uid: string,
  date: ISODate,
  job: JobName,
  status: JobStatus,
  attempts: number,
): Promise<void> {
  await col(uid)
    .doc(date)
    .set(
      {
        [job]: {
          status,
          attempts,
          lastAttemptAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
}

export async function writeHeartbeat(uid: string, date: ISODate): Promise<void> {
  await col(uid).doc(date).set({ daemonHeartbeat: new Date().toISOString() }, { merge: true });
}
