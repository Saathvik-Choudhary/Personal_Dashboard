/**
 * Server-side configuration. Reads from the environment only (Secret Manager in the
 * cloud, Keychain/.env on the daemon). Never imported by the client.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const config = {
  anthropic: {
    /** Read lazily so importing this module doesn't throw in contexts that don't call Claude. */
    get apiKey() {
      return required("ANTHROPIC_API_KEY");
    },
  },
  twilio: {
    get accountSid() {
      return required("TWILIO_ACCOUNT_SID");
    },
    get authToken() {
      return required("TWILIO_AUTH_TOKEN");
    },
    get whatsappFrom() {
      return required("TWILIO_WHATSAPP_FROM");
    },
  },
  google: {
    get clientId() {
      return required("GOOGLE_OAUTH_CLIENT_ID");
    },
    get clientSecret() {
      return required("GOOGLE_OAUTH_CLIENT_SECRET");
    },
    get redirectUri() {
      return required("GOOGLE_OAUTH_REDIRECT_URI");
    },
  },
  firebase: {
    projectId: optional("FIREBASE_PROJECT_ID"),
  },
  /** The single user the daemon operates on during the single-user phase. */
  userUid: optional("ORBIT_USER_UID"),
} as const;
