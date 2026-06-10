/**
 * WhatsApp delivery via Twilio (spec §11). Credentials come from the environment.
 */
import twilio from "twilio";
import { config } from "../config.js";

let _client: ReturnType<typeof twilio> | undefined;
function client() {
  if (!_client) {
    _client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return _client;
}

export interface WhatsAppMessage {
  /** Recipient in E.164, e.g. "+15551234567". The "whatsapp:" prefix is added here. */
  to: string;
  body: string;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<void> {
  await client().messages.create({
    from: config.twilio.whatsappFrom,
    to: `whatsapp:${msg.to}`,
    body: msg.body,
  });
}
