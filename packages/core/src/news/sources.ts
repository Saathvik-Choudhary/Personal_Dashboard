/**
 * RSS/Atom fetching for the news digest (spec §7.1, step 1). The source list lives in user
 * config so it's editable without a deploy. This module only fetches + normalizes candidate
 * articles; Claude does the selection/ranking/dedupe in the job.
 */
import { XMLParser } from "fast-xml-parser";
import type { NewsSource } from "../types/index.js";

export interface CandidateArticle {
  title: string;
  source: string;
  url: string;
  body: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/** A few sensible defaults; the user's configured `newsSources` override these. */
export const DEFAULT_SOURCES: NewsSource[] = [
  { name: "Hacker News", feedUrl: "https://hnrss.org/frontpage" },
  { name: "Ars Technica", feedUrl: "https://feeds.arstechnica.com/arstechnica/index" },
];

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function parseFeed(xml: string, source: NewsSource): CandidateArticle[] {
  const doc = parser.parse(xml) as Record<string, any>;

  // RSS 2.0: rss.channel.item[]
  const rssItems = asArray(doc?.rss?.channel?.item);
  if (rssItems.length) {
    return rssItems.map((item) => ({
      title: textOf(item.title),
      source: source.name,
      url: textOf(item.link),
      body: textOf(item.description ?? item["content:encoded"]),
    }));
  }

  // Atom: feed.entry[]
  const atomEntries = asArray(doc?.feed?.entry);
  return atomEntries.map((entry) => {
    const link = asArray(entry.link).find((l: any) => l?.["@_rel"] !== "self") ?? entry.link;
    return {
      title: textOf(entry.title),
      source: source.name,
      url: typeof link === "object" ? String(link?.["@_href"] ?? "") : textOf(link),
      body: textOf(entry.summary ?? entry.content),
    };
  });
}

/** Fetch all sources, tolerating individual feed failures. Caps total articles to bound tokens. */
export async function fetchCandidateArticles(
  sources: NewsSource[],
  opts: { perSource?: number; total?: number } = {},
): Promise<CandidateArticle[]> {
  const perSource = opts.perSource ?? 15;
  const total = opts.total ?? 60;

  const batches = await Promise.allSettled(
    sources.map(async (source) => {
      const res = await fetch(source.feedUrl, {
        headers: { "user-agent": "OrbitNewsDigest/0.1" },
      });
      if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
      return parseFeed(await res.text(), source).slice(0, perSource);
    }),
  );

  const articles: CandidateArticle[] = [];
  for (const batch of batches) {
    if (batch.status === "fulfilled") articles.push(...batch.value);
  }
  return articles.filter((a) => a.title && a.url).slice(0, total);
}
