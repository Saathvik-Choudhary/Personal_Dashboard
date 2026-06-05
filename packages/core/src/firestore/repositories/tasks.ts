import { userDoc } from "../admin.js";
import type { Task } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("tasks");
}

export async function listOpenTasks(uid: string): Promise<Task[]> {
  // Open = not done. Ordered by priority desc for the planner.
  const snap = await col(uid)
    .where("status", "in", ["todo", "doing"])
    .orderBy("priority", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) }));
}

export async function getTask(uid: string, taskId: string): Promise<Task | null> {
  const snap = await col(uid).doc(taskId).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Task, "id">) }) : null;
}
