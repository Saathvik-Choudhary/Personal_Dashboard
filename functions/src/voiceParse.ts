/**
 * voiceParse — callable Cloud Function backing the voice assistant's cloud brain.
 * The Gemini API key lives in Secret Manager and is used only here, server-side; the browser
 * calls this authenticated callable and never sees the key. The client sends the system prompt
 * (with the live dashboard context) + the user's transcript; we return Gemini's raw text, which
 * the client parses into a dashboard action.
 *
 * Model is selectable: `flash` (gemini-2.5-flash, thinking off — fast + ~20-50x cheaper) or
 * `pro` (gemini-2.5-pro, bounded thinking — strongest reasoning). Prompt caching is intentionally
 * not used: the prompt is ~700 tokens, below Gemini's 2048-token cache minimum, so it can't engage.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { GEMINI_API_KEY } from "./secrets.js";

interface VoiceParseData {
  system: string;
  user: string;
  model?: "pro" | "flash";
}

export const voiceParse = onCall<VoiceParseData>(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

    const system = String(request.data?.system ?? "");
    const user = String(request.data?.user ?? "").slice(0, 2000);
    if (!user) throw new HttpsError("invalid-argument", "Missing user text.");

    const usePro = request.data?.model === "pro";
    const model = usePro ? "gemini-2.5-pro" : "gemini-2.5-flash";
    const generationConfig = usePro
      ? { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 512 } }
      : { temperature: 0.2, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } };

    const key = GEMINI_API_KEY.value();
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig,
          }),
        },
      );
    } catch (err) {
      logger.error("voiceParse.network", { err });
      throw new HttpsError("unavailable", "Couldn’t reach Gemini.");
    }

    const json = (await res.json()) as {
      error?: { message?: string; status?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: Record<string, number>;
    };

    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `Gemini error ${res.status}`;
      logger.error("voiceParse.gemini", { status: res.status, msg, model });
      if (res.status === 429) {
        throw new HttpsError("resource-exhausted", "Gemini credits are depleted — add billing in AI Studio.");
      }
      throw new HttpsError("internal", msg);
    }

    logger.info("voiceParse.ok", { model, usage: json.usageMetadata });
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return { text };
  },
);
