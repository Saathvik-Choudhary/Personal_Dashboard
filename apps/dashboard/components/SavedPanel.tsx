"use client";

import { unsaveArticle, type SavedArticle } from "@/lib/saved";
import { Panel } from "./Panel";

export function SavedPanel({ uid, saved }: { uid: string; saved: SavedArticle[] }) {
  return (
    <Panel
      title="Saved articles"
      action={
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted">
          {saved.length}
        </span>
      }
    >
      {saved.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">
          Tap ☆ on any article to save it here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {saved.map((s) => (
            <li key={s.id} className="group flex items-start gap-2">
              <span className="mt-0.5 text-amber-300">★</span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-sm leading-snug transition hover:text-orbit-cyan"
              >
                {s.title}
                {s.category && (
                  <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-orbit-muted">
                    {s.category}
                  </span>
                )}
              </a>
              <button
                onClick={() => unsaveArticle(uid, s.id)}
                className="text-xs text-orbit-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
