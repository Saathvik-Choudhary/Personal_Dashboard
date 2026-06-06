import { userDoc } from "../admin.js";
import type { Reminder, ISODateTime } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("reminders");
}

export async function createReminder(uid: string, reminder: Omit<Reminder, "id">): Promise<string> {
  const ref = await col(uid).add(reminder);
  return ref.id;
}

/** The delivery scan query (spec §7.2): pending reminders due at or before `now`. */
export async function listDueReminders(uid: string, nowISO: ISODateTime): Promise<Reminder[]> {
  const snap = await col(uid)
    .where("status", "==", "pending")
    .where("fireAt", "<=", nowISO)
    .orderBy("fireAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reminder, "id">) }));
}

export async function markReminderSent(uid: string, reminderId: string): Promise<void> {
  await col(uid)
    .doc(reminderId)
    .update({ status: "sent", sentAt: new Date().toISOString() });
}

export async function markReminderFailed(
  uid: string,
  reminderId: string,
  attempts: number,
): Promise<void> {
  await col(uid).doc(reminderId).update({ status: "failed", attempts });
}
