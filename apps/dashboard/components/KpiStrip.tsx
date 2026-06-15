"use client";

import type { Task, CalendarEvent, Habit } from "@/lib/types";
import { computeStreak, dateKey, isHabitDone } from "@/lib/useHabits";
import { Sparkline, seededSeries } from "./Sparkline";

function isToday(iso?: string): boolean {
  if (!iso) return false;
  return new Intl.DateTimeFormat("en-CA").format(new Date(iso)) === dateKey();
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="glass relative overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orbit-muted">
          {label}
        </span>
        <span className="text-base" style={{ filter: "saturate(1.2)" }}>
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display text-3xl font-bold leading-none"
            style={{ color: accent }}
          >
            {value}
          </span>
          {sub && <span className="text-xs text-orbit-muted">{sub}</span>}
        </div>
        <div className="opacity-80">
          <Sparkline data={seededSeries(label)} color={accent} width={72} height={26} />
        </div>
      </div>
    </div>
  );
}

export function KpiStrip({
  tasks,
  events,
  habits,
  logs,
}: {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  logs: Record<string, Record<string, number | boolean>>;
}) {
  const doneToday = tasks.filter((t) => t.status === "done" && isToday(t.completedAt)).length;
  const open = tasks.filter((t) => t.status !== "done").length;

  const focusMins = events
    .filter((e) => e.type === "focus")
    .reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0);
  const focusH = Math.floor(focusMins / 60);
  const focusM = Math.round(focusMins % 60);

  const today = logs[dateKey()] ?? {};
  const habitsDone = habits.filter((h) => isHabitDone(h, today[h.id])).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, computeStreak(h, logs)), 0);

  const completion =
    doneToday + open > 0 ? Math.round((doneToday / (doneToday + open)) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Done today" value={String(doneToday)} icon="✅" accent="#34d399" />
      <StatCard label="Open tasks" value={String(open)} icon="🗒️" accent="#5b8cff" />
      <StatCard
        label="Focus time"
        value={focusMins ? `${focusH}h` : "0h"}
        sub={focusMins && focusM ? `${focusM}m` : undefined}
        icon="🎯"
        accent="#38e1ff"
      />
      <StatCard
        label="Habits"
        value={`${habitsDone}/${habits.length}`}
        icon="🌱"
        accent="#a78bfa"
      />
      <StatCard
        label="Best streak"
        value={String(bestStreak)}
        sub="days"
        icon="🔥"
        accent="#fb923c"
      />
    </div>
  );
}
