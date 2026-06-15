"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";

type Mode = "focus" | "break";
const DURATIONS: Record<Mode, number> = { focus: 25 * 60, break: 5 * 60 };

/** A Pomodoro focus timer — pure client state. Counts completed focus sessions. */
export function FocusTimer() {
  const [mode, setMode] = useState<Mode>("focus");
  const [left, setLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          // session finished
          if (mode === "focus") setSessions((s) => s + 1);
          const next: Mode = mode === "focus" ? "break" : "focus";
          setMode(next);
          setRunning(false);
          return DURATIONS[next];
        }
        return l - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running, mode]);

  function reset() {
    setRunning(false);
    setLeft(DURATIONS[mode]);
  }
  function switchMode(m: Mode) {
    setMode(m);
    setRunning(false);
    setLeft(DURATIONS[m]);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = 100 - (left / DURATIONS[mode]) * 100;
  const R = 52;
  const circ = 2 * Math.PI * R;

  return (
    <Panel
      title="Focus timer"
      action={
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted">
          {sessions} done
        </span>
      }
    >
      <div className="flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={mode === "focus" ? "#38e1ff" : "#34d399"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (pct / 100) * circ}
              style={{ transition: "stroke-dashoffset 0.5s linear" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-display text-3xl font-bold tabular-nums">
                {mm}:{ss}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-orbit-muted">{mode}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-xl bg-gradient-to-br from-orbit-blue to-orbit-violet px-5 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-full border border-white/10 bg-black/20 p-1 text-xs">
          {(["focus", "break"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                mode === m ? "bg-white/10 text-orbit-text" : "text-orbit-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
