/**
 * News digest job (spec §7.1). Pure: input → Claude → structured DigestItem[].
 * The caller (daemon) owns persistence — no Firestore writes here.
 */
import { runClaudeJob, type ClaudeRun, DEFAULT_MODEL } from "../claude/client.js";
import { NEWS_DIGEST_SYSTEM } from "../claude/prompts/newsDigest.js";
import type { DigestItem } from "../types/index.js";

export interface NewsDigestInput {
  topics: string[];
  articles: { title: string; source: string; url: string; body: string }[];
}

function parseDigest(raw: string): DigestItem[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("newsDigest: expected a JSON array from Claude.");
  }
  return parsed.map((item, i): DigestItem => {
    const o = item as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.url !== "string") {
      throw new Error(`newsDigest: malformed item at index ${i}.`);
    }
    return {
      title: o.title,
      source: typeof o.source === "string" ? o.source : "",
      url: o.url,
      summary: typeof o.summary === "string" ? o.summary : "",
      rank: typeof o.rank === "number" ? o.rank : i + 1,
    };
  });
}

export function generateNewsDigest(input: NewsDigestInput): Promise<ClaudeRun<DigestItem[]>> {
  return runClaudeJob<DigestItem[]>({
    model: DEFAULT_MODEL, // routine summarization — the cheaper/faster model
    system: NEWS_DIGEST_SYSTEM,
    user: JSON.stringify(input),
    parse: parseDigest,
    maxTokens: 4000,
  });
}
