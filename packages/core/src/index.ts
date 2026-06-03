/**
 * @orbit/core — the shared intelligence layer (spec §6).
 *
 * Both the Cloud Functions and the Mac daemon import from here for all Claude calls,
 * Firestore access, delivery, and domain types. Project #2 (later) imports this same
 * package and points it at new collections — the intelligence layer is never rebuilt
 * per project. Protect this boundary above all else.
 */

// Domain types
export * from "./types/index.js";

// Config (server-side only)
export { config } from "./config.js";

// Claude
export {
  runClaudeJob,
  DEFAULT_MODEL,
  PLANNING_MODEL,
  type ClaudeRun,
  type ClaudeUsage,
  type RunClaudeJobOptions,
} from "./claude/client.js";

// Jobs (pure: input → Claude → structured output)
export { generateNewsDigest, type NewsDigestInput } from "./jobs/newsDigest.js";
export { planDay, type PlanDayInput } from "./jobs/planDay.js";

// News source fetching
export {
  fetchCandidateArticles,
  DEFAULT_SOURCES,
  type CandidateArticle,
} from "./news/sources.js";

// Firestore (Admin SDK — server/daemon only)
export { db, userDoc } from "./firestore/admin.js";
export * as repositories from "./firestore/repositories/index.js";

// Delivery
export { sendWhatsApp, type WhatsAppMessage } from "./delivery/whatsapp.js";
export { sendPush, type PushMessage } from "./delivery/push.js";

// Google Calendar
export {
  listEvents,
  writeBlock,
  ORBIT_TAG,
  type ExistingEvent,
  type BlockToWrite,
} from "./calendar/google.js";
