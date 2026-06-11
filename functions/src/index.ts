/**
 * Cloud Functions entrypoint (spec §10). All 2nd-gen, Node 20, importing @orbit/core.
 * Functions are thin: orchestration + persistence only. All reasoning is in @orbit/core/jobs.
 */
import { initializeApp, getApps } from "firebase-admin/app";

// Ensure the Admin SDK app exists before any function module touches Firestore.
if (!getApps().length) {
  initializeApp();
}

export { scanReminders } from "./scanReminders.js";
export { morningBundle } from "./morningBundle.js";
export { onEventConfirmed } from "./onEventConfirmed.js";
export { approveProposal } from "./approveProposal.js";
export { refreshCalendar } from "./refreshCalendar.js";
export { voiceParse } from "./voiceParse.js";
export { generateDigest } from "./generateDigest.js";
export { scheduledDigest } from "./scheduledDigest.js";
