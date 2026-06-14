/**
 * Daemon-side daily plan runner (spec §7.3, step 1). Reads open tasks + tomorrow's existing
 * events, calls the pure planDay job, and writes proposals/{tomorrow} as `pending`.
 * NOTHING is written to Google Calendar here — that happens only on approval (a Cloud Function).
 */
import {
  planDay,
  repositories,
  type Proposal,
  type UserProfile,
} from "@orbit/core";

/** Returns YYYY-MM-DD for "tomorrow" in the given timezone, plus the day's ISO bounds. */
function tomorrowBounds(now: Date, timezone: string): { dateKey: string; startISO: string; endISO: string } {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(tomorrow);
  // Day bounds in UTC are a close-enough window for the existing-events read; the planner
  // reasons in the user's timezone from the workingHours + ISO timestamps it receives.
  const startISO = `${dateKey}T00:00:00.000Z`;
  const endISO = `${dateKey}T23:59:59.999Z`;
  return { dateKey, startISO, endISO };
}

export async function runDailyPlan(
  uid: string,
  profile: UserProfile,
  now: Date,
): Promise<{ inputTokens: number; outputTokens: number; blockCount: number }> {
  const { dateKey, startISO, endISO } = tomorrowBounds(now, profile.timezone);

  const [openTasks, existingEvents] = await Promise.all([
    repositories.tasks.listOpenTasks(uid),
    repositories.events.listEventsInRange(uid, startISO, endISO),
  ]);

  const { data: blocks, usage } = await planDay({
    date: dateKey,
    timezone: profile.timezone,
    workingHours: profile.workingHours,
    tasks: openTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimatedMinutes: t.estimatedMinutes,
      dueDate: t.dueDate,
    })),
    events: existingEvents.map((e) => ({ title: e.title, start: e.start, end: e.end })),
  });

  const proposal: Proposal = {
    date: dateKey,
    blocks,
    status: "pending",
    generatedAt: new Date().toISOString(),
  };
  await repositories.proposals.writeProposal(uid, proposal);

  return { ...usage, blockCount: blocks.length };
}
