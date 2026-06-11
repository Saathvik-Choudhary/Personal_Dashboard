/**
 * Resolves a user's Google Calendar refresh token. The token is held encrypted at rest and
 * never client-readable (spec §8, §12). For the single-user phase this reads it from Secret
 * Manager / env; swap this one function for a KMS-decrypt or encrypted-Firestore read without
 * touching the call sites.
 */
import type { UserProfile } from "@orbit/core";

export interface CalendarCredentials {
  refreshToken: string;
  calendarId: string;
}

export async function getCalendarCredentials(
  _uid: string,
  profile: UserProfile,
): Promise<CalendarCredentials | null> {
  // TODO(phase4): replace with a per-user encrypted token store (KMS or encrypted Firestore
  // field). During single-user bootstrap, the refresh token lives in a secret.
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken || !profile.calendar?.connected) return null;
  return {
    refreshToken,
    calendarId: profile.calendar.targetCalendarId ?? "primary",
  };
}
