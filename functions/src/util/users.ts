/**
 * Iterate over all users. Multi-tenant from day one (spec §5) even though there's one user now —
 * the scheduled functions fan out over every `users/{uid}` document.
 */
import { db, type UserProfile } from "@orbit/core";

export async function forEachUser(
  fn: (uid: string, profile: UserProfile) => Promise<void>,
): Promise<void> {
  const snap = await db().collection("users").get();
  for (const doc of snap.docs) {
    await fn(doc.id, doc.data() as UserProfile);
  }
}
