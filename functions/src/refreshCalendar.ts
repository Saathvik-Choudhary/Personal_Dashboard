/**
 * refreshCalendar (spec §8, §10) — scheduled periodic pull of Google Calendar into the `events`
 * mirror (v1 sync; watch channels for real-time are a v2 improvement). Mirrors today + the next
 * few days so the planner and today view see what's already booked.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import {
  db,
  listEvents,
  repositories,
  type CalendarEvent,
  type UserProfile,
} from "@orbit/core";
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI,
} from "./secrets.js";
import { getCalendarCredentials } from "./calendarAuth.js";
import { forEachUser } from "./util/users.js";

const MIRROR_DAYS = 3;

async function refreshForUser(uid: string, profile: UserProfile): Promise<void> {
  const creds = await getCalendarCredentials(uid, profile);
  if (!creds) return;

  const now = new Date();
  const end = new Date(now.getTime() + MIRROR_DAYS * 24 * 60 * 60 * 1000);
  const remote = await listEvents(
    creds.refreshToken,
    creds.calendarId,
    now.toISOString(),
    end.toISOString(),
  );

  // Upsert each remote event into the mirror keyed by googleEventId. Idempotent: re-running
  // updates in place rather than duplicating.
  const eventsCol = db().collection("users").doc(uid).collection("events");
  for (const remoteEvent of remote) {
    const existing = await eventsCol
      .where("googleEventId", "==", remoteEvent.googleEventId)
      .limit(1)
      .get();

    const mirrored: Omit<CalendarEvent, "id"> = {
      title: remoteEvent.title,
      start: remoteEvent.start,
      end: remoteEvent.end,
      source: "google",
      googleEventId: remoteEvent.googleEventId,
      type: "meeting",
      status: "synced",
    };

    if (existing.empty) {
      await repositories.events.createEvent(uid, mirrored);
    } else {
      await existing.docs[0]!.ref.set(mirrored, { merge: true });
    }
  }

  logger.info("calendar.refreshed", { uid, count: remote.length });
}

export const refreshCalendar = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async () => {
    await forEachUser(refreshForUser);
  },
);
