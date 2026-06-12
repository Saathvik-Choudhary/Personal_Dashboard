/**
 * morningBundle (spec §7.2, §10) — scheduled ~7am. Creates a single digest reminder bundling
 * today's schedule + the news digest, to be delivered by scanReminders.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { repositories, type UserProfile } from "@orbit/core";
import { forEachUser } from "./util/users.js";

function todayKey(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

async function buildBundle(uid: string, profile: UserProfile): Promise<void> {
  const tz = profile.timezone;
  const dateKey = todayKey(tz);

  const digest = await repositories.digests.getDigest(uid, dateKey);
  const startISO = `${dateKey}T00:00:00.000Z`;
  const endISO = `${dateKey}T23:59:59.999Z`;
  const events = await repositories.events.listEventsInRange(uid, startISO, endISO);

  const topItems = (digest?.items ?? []).slice(0, 3).map((i) => `• ${i.title}`);
  const lines: string[] = [`Good morning. You have ${events.length} event(s) today.`];
  if (topItems.length) {
    lines.push("", "Top news:", ...topItems);
  } else {
    lines.push("", "(No fresh digest this morning — showing what we have.)");
  }

  await repositories.reminders.createReminder(uid, {
    refType: "digest",
    refId: dateKey,
    fireAt: new Date().toISOString(), // deliver on the next scan
    channels: profile.reminderChannels,
    message: lines.join("\n"),
    status: "pending",
  });
}

export const morningBundle = onSchedule({ schedule: "0 7 * * *" }, async () => {
  await forEachUser(buildBundle);
});
