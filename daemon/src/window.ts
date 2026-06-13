/**
 * The 4–9am window logic (spec §9). The daemon wakes hourly (4,5,6,7,8am) plus on login/unlock.
 * Inside the window it attempts pending jobs; after the 9am ceiling a still-failed job is marked
 * failed and the dashboard falls back to yesterday's data.
 */

export const WINDOW_START_HOUR = 4;
export const WINDOW_CEILING_HOUR = 9;

/** Local-time hour helper, in the user's timezone. */
export function hourInTimezone(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return Number(fmt.format(date));
}

/** YYYY-MM-DD for a date in the given timezone (the per-day marker key). */
export function dateKeyInTimezone(date: Date, timezone: string): string {
  // en-CA yields ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

export interface WindowState {
  /** Inside [4am, 9am) — jobs may run and retry on failure. */
  inWindow: boolean;
  /** At/after the 9am ceiling — a still-failed job should be marked failed, not retried. */
  pastCeiling: boolean;
  hour: number;
  dateKey: string;
}

export function evaluateWindow(now: Date, timezone: string): WindowState {
  const hour = hourInTimezone(now, timezone);
  return {
    inWindow: hour >= WINDOW_START_HOUR && hour < WINDOW_CEILING_HOUR,
    pastCeiling: hour >= WINDOW_CEILING_HOUR,
    hour,
    dateKey: dateKeyInTimezone(now, timezone),
  };
}
