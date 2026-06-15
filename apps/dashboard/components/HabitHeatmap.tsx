"use client";

import type { Habit } from "@/lib/types";
import { dateKey, isHabitDone } from "@/lib/useHabits";
import { Panel } from "./Panel";

const DAYS = 14;

/** A last-14-days completion grid per habit — the "don't break the chain" view. */
export function HabitHeatmap({
  habits,
  logs,
}: {
  habits: Habit[];
  logs: Record<string, Record<string, number | boolean>>;
}) {
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000);
    return dateKey(d);
  });

  return (
    <Panel title="Consistency" action={<span className="text-[10px] text-orbit-muted">last {DAYS} days</span>}>
      {habits.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">No habits yet.</p>
      ) : (
        <div className="space-y-2.5">
          {habits.map((h) => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="w-7 text-center text-base" title={h.name}>
                {h.emoji}
              </span>
              <div className="flex flex-1 gap-1">
                {days.map((day) => {
                  const done = isHabitDone(h, logs[day]?.[h.id]);
                  return (
                    <span
                      key={day}
                      title={`${h.name} · ${day}`}
                      className={`h-4 flex-1 rounded-[3px] ${
                        done
                          ? "bg-gradient-to-br from-orbit-cyan to-orbit-blue"
                          : "bg-white/[0.06]"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
