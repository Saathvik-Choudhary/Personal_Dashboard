/**
 * Google Calendar integration (spec §8). Read events for the planning window; write only on
 * approval, tagging Orbit-created events so they are easy to identify and bulk-revoke.
 *
 * The OAuth refresh token is held encrypted at rest and passed in by the caller (functions),
 * never stored here. This module is a thin typed wrapper over the googleapis client.
 */
import { google, type calendar_v3 } from "googleapis";
import { config } from "../config.js";

/** Extended property marking an event as Orbit-created (distinguishable + revocable). */
export const ORBIT_TAG = { key: "orbitCreated", value: "true" } as const;

function calendarClient(refreshToken: string): calendar_v3.Calendar {
  const auth = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

export interface ExistingEvent {
  title: string;
  start: string; // ISO-8601
  end: string; // ISO-8601
  googleEventId: string;
}

/** Read events in [startISO, endISO) so planDay knows what is already booked. */
export async function listEvents(
  refreshToken: string,
  calendarId: string,
  startISO: string,
  endISO: string,
): Promise<ExistingEvent[]> {
  const cal = calendarClient(refreshToken);
  const res = await cal.events.list({
    calendarId,
    timeMin: startISO,
    timeMax: endISO,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      title: e.summary ?? "(busy)",
      start: e.start!.dateTime!,
      end: e.end!.dateTime!,
      googleEventId: e.id!,
    }));
}

export interface BlockToWrite {
  title: string;
  start: string; // ISO-8601
  end: string; // ISO-8601
}

/** Write an approved focus block, tagged + colored so it's clearly Orbit-created. Returns its id. */
export async function writeBlock(
  refreshToken: string,
  calendarId: string,
  block: BlockToWrite,
): Promise<string> {
  const cal = calendarClient(refreshToken);
  const res = await cal.events.insert({
    calendarId,
    requestBody: {
      summary: block.title,
      start: { dateTime: block.start },
      end: { dateTime: block.end },
      colorId: "9", // distinct color for Orbit blocks
      extendedProperties: { private: { [ORBIT_TAG.key]: ORBIT_TAG.value } },
    },
  });
  return res.data.id!;
}
