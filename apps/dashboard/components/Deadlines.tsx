"use client";

import type { Task } from "@/lib/types";
import { Panel } from "./Panel";

function relative(dateStr: string): { label: string; tone: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "text-red-400" };
  if (days === 0) return { label: "Today", tone: "text-orbit-cyan" };
  if (days === 1) return { label: "Tomorrow", tone: "text-amber-300" };
  if (days <= 7) return { label: `in ${days}d`, tone: "text-orbit-muted" };
  return { label: `in ${days}d`, tone: "text-orbit-muted/70" };
}

export function Deadlines({ tasks }: { tasks: Task[] }) {
  const upcoming = tasks
    .filter((t) => t.status !== "done" && t.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 6);

  return (
    <Panel title="Deadlines">
      {upcoming.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">No upcoming due dates.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((t) => {
            const r = relative(t.dueDate!);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{t.title}</span>
                <span className={`shrink-0 font-display text-xs font-medium ${r.tone}`}>
                  {r.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
