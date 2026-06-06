import { userDoc } from "../admin.js";
import type { Digest, ISODate } from "../../types/index.js";

function col(uid: string) {
  return userDoc(uid).collection("digests");
}

/** Digests are keyed by date, so "today" is a direct doc read and "yesterday" fallback is trivial. */
export async function getDigest(uid: string, date: ISODate): Promise<Digest | null> {
  const snap = await col(uid).doc(date).get();
  return snap.exists ? (snap.data() as Digest) : null;
}

export async function writeDigest(uid: string, digest: Digest): Promise<void> {
  await col(uid).doc(digest.date).set(digest);
}
