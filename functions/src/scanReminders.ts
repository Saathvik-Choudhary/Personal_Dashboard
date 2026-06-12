/**
 * scanReminders (spec §7.2, §10) — scheduled every few minutes. Delivers due reminders to the
 * user's channels (WhatsApp + web push), then marks sent (or failed with a retry count).
 * Cloud-side and cheap so reminders fire whether or not the Mac is awake.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import {
  repositories,
  sendWhatsApp,
  sendPush,
  type Reminder,
  type UserProfile,
} from "@orbit/core";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } from "./secrets.js";
import { forEachUser } from "./util/users.js";

async function deliver(uid: string, profile: UserProfile, reminder: Reminder): Promise<void> {
  const channels = reminder.channels.length ? reminder.channels : profile.reminderChannels;
  const attempts = (reminder.attempts ?? 0) + 1;

  try {
    const tasks: Promise<unknown>[] = [];

    if (channels.includes("whatsapp") && profile.whatsappNumber) {
      tasks.push(sendWhatsApp({ to: profile.whatsappNumber, body: reminder.message }));
    }
    if (channels.includes("push") && profile.pushTokens?.length) {
      tasks.push(
        sendPush(profile.pushTokens, { title: "Orbit", body: reminder.message }).then(
          (stale) => repositories.users.removePushTokens(uid, stale),
        ),
      );
    }

    await Promise.all(tasks);
    await repositories.reminders.markReminderSent(uid, reminder.id);
  } catch (err) {
    logger.error("reminder.deliver.failed", { uid, reminderId: reminder.id, attempts, err });
    await repositories.reminders.markReminderFailed(uid, reminder.id, attempts);
  }
}

export const scanReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async () => {
    const nowISO = new Date().toISOString();
    await forEachUser(async (uid, profile) => {
      const due = await repositories.reminders.listDueReminders(uid, nowISO);
      for (const reminder of due) {
        await deliver(uid, profile, reminder);
      }
    });
  },
);
