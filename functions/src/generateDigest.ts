/**
 * generateDigest — builds a CATEGORIZED daily news digest (Robotics / AI / Tech) using Gemini.
 * Candidate articles come from the keyless Hacker News (Algolia) API; Gemini buckets them into the
 * three categories, dedupes, ranks, and writes a 1-line summary. Result is written to
 * users/{uid}/digests/{date} as { categories: { robotics, ai, tech } }.
 *
 * Callable (Refresh button + client morning-ensure) and reused by the scheduled job.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db } from "@orbit/core";
import { GEMINI_API_KEY } from "./secrets.js";

interface Candidate {
  title: string;
  url: string;
  points: number;
}

async function algolia(url: string): Promise<Candidate[]> {
  try {
    const j = (await (await fetch(url)).json()) as { hits?: Record<string, unknown>[] };
    return (j.hits ?? [])
      .filter((h) => h.title)
      .map((h) => ({
        title: String(h.title),
        url: h.url ? String(h.url) : `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: Number(h.points ?? 0),
      }));
  } catch {
    return [];
  }
}

async function gatherCandidates(): Promise<Candidate[]> {
  const [front, robotics, ai, ml] = await Promise.all([
    algolia("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30"),
    algolia("https://hn.algolia.com/api/v1/search_by_date?query=robotics&tags=story&hitsPerPage=20"),
    algolia("https://hn.algolia.com/api/v1/search_by_date?query=artificial%20intelligence&tags=story&hitsPerPage=20"),
    algolia("https://hn.algolia.com/api/v1/search_by_date?query=LLM&tags=story&hitsPerPage=15"),
  ]);
  const seen = new Set<string>();
  const all: Candidate[] = [];
  for (const c of [...front, ...robotics, ...ai, ...ml]) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    all.push(c);
  }
  return all.slice(0, 70);
}

type Item = { title: string; source: string; url: string; summary: string };

function cleanCategory(arr: unknown): Item[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((o) => {
      const r = o as Record<string, unknown>;
      return r && r.title && r.url
        ? {
            title: String(r.title),
            url: String(r.url),
            source: String(r.source ?? "Hacker News"),
            summary: String(r.summary ?? ""),
          }
        : null;
    })
    .filter((x): x is Item => x !== null)
    .slice(0, 6);
}

/** Core: fetch → categorize with Gemini → write the digest. Shared by the callable + scheduler. */
export async function buildAndStoreDigest(uid: string, date: string, key: string): Promise<number> {
  const candidates = await gatherCandidates();
  if (!candidates.length) throw new HttpsError("unavailable", "Couldn’t fetch news right now.");

    const system =
      "You are a tech news editor. Categorize the given articles into exactly three buckets: " +
      '"robotics" (robots, drones, automation, hardware), "ai" (AI, machine learning, LLMs, models), ' +
      'and "tech" (everything else tech/software/science). For EACH bucket select the 5 most important/interesting, ' +
      "write a tight one-sentence summary, and remove duplicates. Use the EXACT title and url from the input. " +
      'Return ONLY JSON: {"robotics":[{"title","url","summary"}],"ai":[...],"tech":[...]}. ' +
      "If a bucket has no clear matches, still include the closest 2-3 items.";
    const userMsg = JSON.stringify(candidates.map((c) => ({ title: c.title, url: c.url })));

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      );
    } catch (err) {
      logger.error("digest.gemini.network", { err });
      throw new HttpsError("unavailable", "Couldn’t reach Gemini.");
    }

    const json = (await res.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    if (!res.ok || json.error) {
      if (res.status === 429) throw new HttpsError("resource-exhausted", "Gemini credits are depleted.");
      throw new HttpsError("internal", json.error?.message ?? `Gemini error ${res.status}`);
    }

    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    let parsed: Record<string, unknown> = {};
    try {
      const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      parsed = m ? (JSON.parse(m[0]) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    const categories = {
      robotics: cleanCategory(parsed.robotics),
      ai: cleanCategory(parsed.ai),
      tech: cleanCategory(parsed.tech),
    };
    const total = categories.robotics.length + categories.ai.length + categories.tech.length;
    if (!total) throw new HttpsError("internal", "Couldn’t build the digest.");

    await db()
      .collection("users")
      .doc(uid)
      .collection("digests")
      .doc(date)
      .set({ date, categories, generatedAt: new Date().toISOString(), status: "success" });

    logger.info("digest.generated", { uid, date, total });
    return total;
}

export const generateDigest = onCall<{ date?: string }>(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const date = String(request.data?.date ?? new Date().toISOString().slice(0, 10));
    const total = await buildAndStoreDigest(uid, date, GEMINI_API_KEY.value());
    return { total };
  },
);
