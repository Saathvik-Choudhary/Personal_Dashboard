/**
 * Secret Manager bindings (spec §12, §13). Declared once and attached to the functions that
 * need them so they're injected at deploy. Functions list only the secrets they use, keeping
 * the blast radius small.
 */
import { defineSecret } from "firebase-functions/params";

export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
export const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
export const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
export const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
export const GOOGLE_OAUTH_REDIRECT_URI = defineSecret("GOOGLE_OAUTH_REDIRECT_URI");
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
