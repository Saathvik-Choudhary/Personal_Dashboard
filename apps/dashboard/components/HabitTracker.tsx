"use client";

import { useState } from "react";
import type { Habit } from "@/lib/types";
import { computeStreak, dateKey, isHabitDone } from "@/lib/useHabits";
import { addHabit, removeHabit, setHabitValue } from "@/lib/habitMutations";
import { Panel } from "./Panel";

function CounterRow({
  uid,
  habit,
  value,
  streak,
  onRemove,
}: {
  uid: string;
  habit: Habit;
  value: number;
  streak: number;
  onRemove: () => void;
}) {
  const target = habit.target ?? 1;
  const pct = Math.min(100, (value / target) * 100);
  const done = value >= target;
  return (
    <li className="group rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-lg">{habit.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${done ? "text-emerald-300" : ""}`}>{habit.name}</span>
            {streak > 0 && (
              <span className="rounded-full bg-orange-400/10 px-1.5 text-[10px] text-orange-300">
                🔥 {streak}
              </span>
            )}
            <RemoveBtn onClick={onRemove} />
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orbit-cyan to-orbit-blue transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHabitValue(uid, habit.id, Math.max(0, value - 1))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm transition hover:bg-white/10"
            aria-label="decrease"
          >
            −
          </button>
          <span className="w-12 text-center font-display text-sm tabular-nums">
            {value}/{target}
          </span>
          <button
            onClick={() => setHabitValue(uid, habit.id, value + 1)}
            className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-orbit-blue to-orbit-violet text-sm text-white transition hover:brightness-110"
            aria-label="increase"
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}

function CheckRow({
  uid,
  habit,
  done,
  streak,
  onRemove,
}: {
  uid: string;
  habit: Habit;
  done: boolean;
  streak: number;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <span className="text-lg">{habit.emoji}</span>
      <span className={`flex-1 text-sm ${done ? "text-emerald-300" : ""}`}>{habit.name}</span>
      {streak > 0 && (
        <span className="rounded-full bg-orange-400/10 px-1.5 text-[10px] text-orange-300">
          🔥 {streak}
        </span>
      )}
      <RemoveBtn onClick={onRemove} />
      <button
        onClick={() => setHabitValue(uid, habit.id, !done)}
        aria-label={`Toggle ${habit.name}`}
        className={`grid h-7 w-7 place-items-center rounded-lg border text-sm transition ${
          done
            ? "border-transparent bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
            : "border-white/25 text-transparent hover:border-orbit-cyan"
        }`}
      >
        ✓
      </button>
    </li>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Remove habit"
      className="opacity-0 transition group-hover:opacity-100 text-xs text-orbit-muted hover:text-red-400"
    >
      ✕
    </button>
  );
}

export function HabitTracker({
  uid,
  habits,
  logs,
}: {
  uid: string;
  habits: Habit[];
  logs: Record<string, Record<string, number | boolean>>;
}) {
  const [name, setName] = useState("");
  const today = logs[dateKey()] ?? {};

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setName("");
    await addHabit(uid, { name: trimmed }, habits.length);
  }

  const doneCount = habits.filter((h) => isHabitDone(h, today[h.id])).length;

  return (
    <Panel
      title="Daily habits"
      action={
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted">
          {doneCount}/{habits.length} today
        </span>
      }
    >
      <ul className="space-y-2">
        {habits.map((h) => {
          const streak = computeStreak(h, logs);
          if (h.type === "counter") {
            return (
              <CounterRow
                key={h.id}
                uid={uid}
                habit={h}
                value={Number(today[h.id] ?? 0)}
                streak={streak}
                onRemove={() => removeHabit(uid, h.id)}
              />
            );
          }
          return (
            <CheckRow
              key={h.id}
              uid={uid}
              habit={h}
              done={Boolean(today[h.id])}
              streak={streak}
              onRemove={() => removeHabit(uid, h.id)}
            />
          );
        })}
        {habits.length === 0 && (
          <li className="px-1 py-4 text-center text-sm text-orbit-muted">Setting up your habits…</li>
        )}
      </ul>

      <form onSubmit={add} className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a habit…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition placeholder:text-orbit-muted/60 focus:border-orbit-cyan/60"
        />
        <button
          type="submit"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
        >
          Add
        </button>
      </form>
    </Panel>
  );
}
