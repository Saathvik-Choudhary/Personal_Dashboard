import { userDoc } from "../admin.js";
import type { UserProfile } from "../../types/index.js";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await userDoc(uid).get();
  return snap.exists ? (snap.data() as UserProfile) : null;
}

export async function setUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  await userDoc(uid).set(profile, { merge: true });
}

export async function addPushToken(uid: string, token: string): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  await userDoc(uid).set({ pushTokens: FieldValue.arrayUnion(token) }, { merge: true });
}

export async function removePushTokens(uid: string, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const { FieldValue } = await import("firebase-admin/firestore");
  await userDoc(uid).update({ pushTokens: FieldValue.arrayRemove(...tokens) });
}
