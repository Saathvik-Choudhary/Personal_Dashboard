/**
 * The single Claude entry point (spec §6). Every job in the system calls Claude through
 * this wrapper — same key handling, same defensive JSON parse, same usage reporting.
 *
 * Rules of the module:
 *  - The Anthropic key is read from the environment, never passed by a caller, never
 *    reaches the client.
 *  - Each job prompts Claude to return JSON only and parses it defensively.
 *  - Model is chosen per job to manage cost (cheaper/faster for routine summarization,
 *    a stronger model only where reasoning quality matters). That is a one-line change
 *    per job — the point of the abstraction.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

/** Default model for routine summarization work. Override per job for reasoning-heavy tasks. */
export const DEFAULT_MODEL = "claude-sonnet-4-6";
/** Stronger model reserved for reasoning-heavy jobs (e.g. overnight calendar planning). */
export const PLANNING_MODEL = "claude-opus-4-8";

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) {
    // Reads ANTHROPIC_API_KEY from the environment via config (Secret Manager / Keychain).
    _client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _client;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudeRun<T> {
  data: T;
  usage: ClaudeUsage;
}

export interface RunClaudeJobOptions<T> {
  system: string;
  user: string;
  parse: (raw: string) => T;
  model?: string;
  maxTokens?: number;
}

/**
 * Strip any accidental markdown fences and surrounding prose, then hand the raw text to
 * the job's parser. Jobs are instructed to return bare JSON; this is belt-and-suspenders.
 */
function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();
}

export async function runClaudeJob<T>(opts: RunClaudeJobOptions<T>): Promise<ClaudeRun<T>> {
  const message = await client().messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined the request (stop_reason: refusal).");
  }

  return {
    data: opts.parse(extractText(message)),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}
