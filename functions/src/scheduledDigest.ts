/**
 * scheduledDigest — runs every morning (before 8am) and generates the categorized news digest
 * for every user, so the dashboard is fresh when they look. Backstop to the client-side
 * morning-ensure. Timezone is configurable; default targets IST (07:00).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { GEMINI_API_KEY } from "./secrets.js";
import { buildAndStoreDigest } from "./generateDigest.js";
import { forEachUser } from "./util/users.js";

const TIMEZONE = "Asia/Kolkata";

export const scheduledDigest = onSchedule(
  { schedule: "0 7 * * *", timeZone: TIMEZONE, secrets: [GEMINI_API_KEY] },
  async () => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
    const key = GEMINI_API_KEY.value();
    await forEachUser(async (uid) => {
      try {
        const total = await buildAndStoreDigest(uid, date, key);
        logger.info("scheduledDigest.ok", { uid, date, total });
      } catch (err) {
        logger.error("scheduledDigest.fail", { uid, err });
      }
    });
  },
);
