"use client";

import { useState } from "react";
import type { Digest, DigestItem, NewsCategory } from "@/lib/types";
import { refreshDigest } from "@/lib/digest";
import { saveArticle, unsaveArticle, type SavedArticle } from "@/lib/saved";
import { Panel } from "./Panel";

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

const CATS: { key: NewsCategory; label: string; emoji: string; accent: string }[] = [
  { key: "robotics", label: "Robotics", emoji: "🤖", accent: "#38e1ff" },
  { key: "ai", label: "AI", emoji: "🧠", accent: "#a78bfa" },
  { key: "tech", label: "Tech", emoji: "💻", accent: "#5b8cff" },
];

function Article({
  item,
  uid,
  category,
  saved,
}: {
  item: DigestItem;
  uid: string;
  category: NewsCategory;
  saved?: SavedArticle;
}) {
  return (
    <li className="flex gap-2">
      <button
        onClick={() =>
          saved ? unsaveArticle(uid, saved.id) : saveArticle(uid, { ...item, category })
        }
        title={saved ? "Unsave" : "Save"}
        className={`mt-0.5 text-sm leading-none transition ${
          saved ? "text-amber-300" : "text-orbit-muted/50 hover:text-amber-300"
        }`}
      >
        {saved ? "★" : "☆"}
      </button>
      <div className="min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium leading-snug transition hover:text-orbit-cyan"
        >
          {item.title}
        </a>
        {item.summary && <p className="mt-0.5 text-xs leading-relaxed text-orbit-muted">{item.summary}</p>}
      </div>
    </li>
  );
}

export function NewsPanel({
  uid,
  digest,
  stale,
  saved,
}: {
  uid: string;
  digest: Digest | null;
  stale: boolean;
  saved: SavedArticle[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedByUrl = new Map(saved.map((s) => [s.url, s]));

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      await refreshDigest(todayKey());
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "Couldn’t refresh.";
      setError(/credit|exhausted|depleted/i.test(msg) ? "Gemini credits depleted." : msg);
    } finally {
      setBusy(false);
    }
  }

  const cats = digest?.categories;
  const empty = !cats || CATS.every((c) => (cats[c.key]?.length ?? 0) === 0);

  return (
    <Panel
      title="AI News"
      action={
        <div className="flex items-center gap-2">
          {stale && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-200">
              yesterday’s
            </span>
          )}
          <button
            onClick={refresh}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted transition hover:bg-white/10 hover:text-orbit-text disabled:opacity-50"
          >
            {busy ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {empty ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">
          {busy ? "Building today’s digest…" : "No digest yet. Tap ↻ Refresh."}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {CATS.map((c) => {
            const items = cats?.[c.key] ?? [];
            return (
              <div key={c.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span>{c.emoji}</span>
                  <span className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: c.accent }}>
                    {c.label}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-orbit-muted/60">Nothing today.</p>
                ) : (
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <Article
                        key={item.url}
                        item={item}
                        uid={uid}
                        category={c.key}
                        saved={savedByUrl.get(item.url)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
