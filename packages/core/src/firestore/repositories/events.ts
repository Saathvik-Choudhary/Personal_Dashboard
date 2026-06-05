import { userDoc } from "../admin.js";
import type { CalendarEvent, ISODateTime } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("events");
}

/** Events overlapping a window, ordered by start. Used to feed planDay and the today view. */
export async function listEventsInRange(
  uid: string,
  startISO: ISODateTime,
  endISO: ISODateTime,
): Promise<CalendarEvent[]> {
  const snap = await col(uid)
    .where("start", ">=", startISO)
    .where("start", "<", endISO)
    .orderBy("start", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CalendarEvent, "id">) }));
}

export async function createEvent(uid: string, event: Omit<CalendarEvent, "id">): Promise<string> {
  const ref = await col(uid).add(event);
  return ref.id;
}

export async function setEventStatus(
  uid: string,
  eventId: string,
  status: CalendarEvent["status"],
): Promise<void> {
  await col(uid).doc(eventId).update({ status });
}
