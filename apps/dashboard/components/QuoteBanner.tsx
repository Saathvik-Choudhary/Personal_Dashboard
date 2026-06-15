"use client";

import { getDailyQuote } from "@/lib/quotes";

export function QuoteBanner() {
  const q = getDailyQuote();
  return (
    <div className="glass relative overflow-hidden px-6 py-5">
      <div className="tilt-glow" style={{ opacity: 0.5 }} />
      <div className="flex items-start gap-4">
        <span className="font-display text-4xl leading-none text-orbit-cyan/70">“</span>
        <div>
          <p className="font-display text-lg leading-snug text-orbit-text">{q.text}</p>
          <p className="mt-1.5 text-xs uppercase tracking-[0.18em] text-orbit-muted">— {q.author}</p>
        </div>
      </div>
    </div>
  );
}
