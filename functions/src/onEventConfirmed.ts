/**
 * onEventConfirmed (spec §7.2, §10) — Firestore trigger. When an event becomes `confirmed`,
 * generate its reminder(s): default one 15 minutes before (configurable later).
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { repositories, type CalendarEvent, type UserProfile } from "@orbit/core";

const DEFAULT_LEAD_MINUTES = 15;

export const onEventConfirmed = onDocumentWritten(
  "users/{uid}/events/{eventId}",
  async (event) => {
    const before = event.data?.before.data() as CalendarEvent | undefined;
    const after = event.data?.after.data() as CalendarEvent | undefined;
    if (!after) return; // deleted

    const becameConfirmed =
      after.status === "confirmed" && before?.status !== "confirmed";
    if (!becameConfirmed) return;

    const uid = event.params.uid;
    const profile = await repositories.users.getUserProfile(uid);
    if (!profile) return;

    const fireAt = new Date(new Date(after.start).getTime() - DEFAULT_LEAD_MINUTES * 60_000);
    await repositories.reminders.createReminder(uid, {
      refType: "event",
      refId: event.params.eventId,
      fireAt: fireAt.toISOString(),
      channels: (profile as UserProfile).reminderChannels,
      message: `Starting at ${formatTime(after.start, profile.timezone)}: ${after.title}`,
      status: "pending",
    });

    logger.info("reminder.generated", { uid, eventId: event.params.eventId, fireAt });
  },
);

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
