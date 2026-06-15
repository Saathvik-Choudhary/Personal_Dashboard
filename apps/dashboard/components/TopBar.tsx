"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

/** Live clock, date, and a day-progress bar (how much of the day is left). Always-on header. */
export function TopBar({
  user,
  onSignOut,
  onUpgrade,
}: {
  user: User;
  onSignOut: () => void;
  onUpgrade: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dayPct = (secondsIntoDay / 86400) * 100;
  const minsLeft = Math.floor((86400 - secondsIntoDay) / 60);
  const hLeft = Math.floor(minsLeft / 60);
  const mLeft = minsLeft % 60;

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <header className="glass mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orbit-blue to-orbit-violet shadow-glow">
          <span className="font-display text-lg font-bold">O</span>
        </div>
        <div>
          <div className="font-display text-2xl font-bold leading-none tabular-nums tracking-tight">
            {time}
          </div>
          <div className="mt-1 text-xs text-orbit-muted">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(now)}
          </div>
        </div>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5 px-2 sm:max-w-xs">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-orbit-muted">
          <span>Day progress</span>
          <span>
            {hLeft}h {mLeft}m left
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orbit-cyan via-orbit-blue to-orbit-violet"
            style={{ width: `${dayPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user.isAnonymous && (
          <button
            onClick={onUpgrade}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-orbit-muted transition hover:bg-white/10 hover:text-orbit-text"
          >
            Link Google
          </button>
        )}
        <button
          onClick={onSignOut}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-orbit-muted transition hover:bg-white/10 hover:text-orbit-text"
        >
          {user.isAnonymous ? "Guest" : user.email} · Sign out
        </button>
      </div>
    </header>
  );
}
