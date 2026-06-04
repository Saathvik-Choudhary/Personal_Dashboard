/**
 * Shared domain types (spec §5). These mirror the Firestore document shapes and are
 * imported by every runtime. All data is namespaced under `users/{uid}/…`.
 *
 * Timestamps are modeled as ISO-8601 strings at the domain boundary so the same
 * type is usable on the client (no firebase-admin import) and the server. The
 * repositories convert to/from Firestore `Timestamp` at the edge.
 */

export type ISODateTime = string; // e.g. "2026-06-13T14:30:00.000Z"
export type ISODate = string; // e.g. "2026-06-13"

export type ReminderChannel = "whatsapp" | "push";
export type TaskStatus = "todo" | "doing" | "done";
export type EventSource = "google" | "orbit";
export type EventType = "meeting" | "block" | "focus";
export type EventStatus = "proposed" | "confirmed" | "synced";
export type ReminderRefType = "event" | "task" | "digest";
export type ReminderStatus = "pending" | "sent" | "failed";
export type JobStatus = "success" | "failed";
export type ProposalStatus = "pending" | "approved" | "rejected";

/** A configurable news source for the digest (lives in user config, editable without a deploy). */
export interface NewsSource {
  /** Display name, e.g. "Hacker News". */
  name: string;
  /** RSS/Atom feed URL. */
  feedUrl: string;
}

/** `users/{uid}` */
export interface UserProfile {
  timezone: string; // IANA, e.g. "America/Los_Angeles"
  workingHours: { start: string; end: string }; // "09:00" / "17:00", in `timezone`
  reminderChannels: ReminderChannel[];
  newsTopics: string[];
  newsSources?: NewsSource[];
  whatsappNumber?: string; // E.164, e.g. "+15551234567"
  pushTokens: string[];
  calendar?: CalendarLinkState;
}

/** OAuth link state for Google Calendar. The refresh token is stored encrypted/out-of-band — never here. */
export interface CalendarLinkState {
  connected: boolean;
  googleAccountEmail?: string;
  /** Calendar id approved blocks are written to. Defaults to "primary". */
  targetCalendarId?: string;
  connectedAt?: ISODateTime;
}

/** `users/{uid}/tasks/{taskId}` */
export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: number; // 1 (low) … 5 (high)
  estimatedMinutes?: number;
  dueDate?: ISODate;
  project: string; // reserves room for the multi-project future (spec §5)
  tags: string[];
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

/** `users/{uid}/events/{eventId}` */
export interface CalendarEvent {
  id: string;
  title: string;
  start: ISODateTime;
  end: ISODateTime;
  source: EventSource;
  googleEventId?: string;
  type: EventType;
  taskId?: string;
  status: EventStatus;
  project?: string;
}

/** `users/{uid}/reminders/{reminderId}` */
export interface Reminder {
  id: string;
  refType: ReminderRefType;
  refId: string;
  fireAt: ISODateTime;
  channels: ReminderChannel[];
  message: string;
  status: ReminderStatus;
  sentAt?: ISODateTime;
  /** Delivery retry counter for the cloud scan. */
  attempts?: number;
}

/** One ranked item in a daily digest. This is the structured output of the newsDigest job. */
export interface DigestItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  rank: number; // 1 = most important
}

/** `users/{uid}/digests/{YYYY-MM-DD}` */
export interface Digest {
  date: ISODate;
  items: DigestItem[];
  generatedAt: ISODateTime;
  status: JobStatus;
}

/** A single proposed calendar block (structured output of the planDay job). */
export interface ProposedBlock {
  taskId: string;
  start: ISODateTime;
  end: ISODateTime;
  reason: string;
}

/** `users/{uid}/proposals/{YYYY-MM-DD}` */
export interface Proposal {
  date: ISODate;
  blocks: ProposedBlock[];
  status: ProposalStatus;
  generatedAt: ISODateTime;
}

export type JobName = "newsDigest" | "dailyPlan";

export interface JobRunRecord {
  status: JobStatus;
  attempts: number;
  lastAttemptAt: ISODateTime;
}

/** `users/{uid}/jobRuns/{YYYY-MM-DD}` — the idempotency ledger (spec §5, §9). */
export interface JobRuns {
  newsDigest?: JobRunRecord;
  dailyPlan?: JobRunRecord;
  daemonHeartbeat?: ISODateTime;
}
