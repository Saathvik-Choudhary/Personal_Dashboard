/**
 * Web push via Firebase Cloud Messaging (spec §11). Prunes stale tokens on failure.
 */
import { getMessaging } from "firebase-admin/messaging";
import { adminApp } from "../firestore/admin.js";

export interface PushMessage {
  title: string;
  body: string;
  /** Optional deep link opened when the notification is clicked. */
  link?: string;
}

/**
 * Send a push to every token, returning the tokens that failed (stale/unregistered) so the
 * caller can prune them from `users/{uid}.pushTokens`.
 */
export async function sendPush(tokens: string[], msg: PushMessage): Promise<string[]> {
  if (tokens.length === 0) return [];
  const messaging = getMessaging(adminApp());
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    webpush: msg.link ? { fcmOptions: { link: msg.link } } : undefined,
  });

  const staleTokens: string[] = [];
  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        staleTokens.push(tokens[i]!);
      }
    }
  });
  return staleTokens;
}
