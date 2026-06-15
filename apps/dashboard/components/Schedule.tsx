"use client";

import type { CalendarEvent } from "@/lib/types";
import { Panel } from "./Panel";

function time(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function Schedule({
  events,
  autoPlan,
  onToggleAutoPlan,
}: {
  events: CalendarEvent[];
  autoPlan?: boolean;
  onToggleAutoPlan?: () => void;
}) {
  const sorted = [...events].sort((a, b) => (a.start < b.start ? -1 : 1));
  return (
    <Panel
      title="Today"
      action={
        onToggleAutoPlan ? (
          <button
            onClick={onToggleAutoPlan}
            title="Auto-plan the day from your tasks"
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
              autoPlan
                ? "bg-gradient-to-br from-orbit-blue to-orbit-violet text-white"
                : "border border-white/15 text-orbit-muted hover:text-orbit-text"
            }`}
          >
            {autoPlan ? "Auto-plan ✓" : "Auto-plan"}
          </button>
        ) : null
      }
    >
      {sorted.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">
          No events scheduled. A clear orbit.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => {
            const focus = e.type === "focus";
            const auto = e.auto;
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full ${
                      auto ? "bg-orbit-violet" : focus ? "bg-orbit-cyan" : "bg-orbit-muted"
                    } ${focus && !auto ? "animate-ping opacity-60" : ""}`}
                  />
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      auto ? "bg-orbit-violet" : focus ? "bg-orbit-cyan" : "bg-orbit-muted/70"
                    }`}
                  />
                </span>
                <span className="w-28 shrink-0 font-display text-xs text-orbit-muted">
                  {time(e.start)}–{time(e.end)}
                </span>
                <span className="text-sm">{e.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
