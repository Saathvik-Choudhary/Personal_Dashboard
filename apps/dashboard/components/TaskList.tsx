"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { createTask, setTaskStatus } from "@/lib/mutations";
import { Panel } from "./Panel";

export function TaskList({ uid, tasks }: { uid: string; tasks: Task[] }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    const previous = title;
    setTitle("");
    try {
      await createTask(uid, { title: trimmed });
    } catch (err: unknown) {
      // Surface the real reason instead of silently failing.
      const code = (err as { code?: string })?.code ?? "";
      setTitle(previous);
      if (code === "permission-denied") {
        setError("Write denied by Firestore rules. (Check Authentication is enabled.)");
      } else {
        setError((err as { message?: string })?.message ?? "Couldn’t save task.");
      }
    }
  }

  return (
    <Panel title="Tasks">
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none transition placeholder:text-orbit-muted/60 focus:border-orbit-cyan/60 focus:bg-black/40"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-br from-orbit-blue to-orbit-violet px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-1.5">
        {open.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-white/10 hover:bg-white/5"
          >
            <button
              onClick={() => setTaskStatus(uid, t.id, "done")}
              aria-label={`Complete ${t.title}`}
              className="grid h-5 w-5 place-items-center rounded-full border border-white/25 text-transparent transition hover:border-orbit-cyan hover:text-orbit-cyan"
            >
              ✓
            </button>
            <span className="flex-1 text-sm">{t.title}</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-orbit-muted">
              P{t.priority}
            </span>
          </li>
        ))}
        {open.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-orbit-muted">
            All clear. Nothing open ✨
          </li>
        )}
      </ul>

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer select-none text-xs text-orbit-muted transition hover:text-orbit-text">
            {done.length} completed
          </summary>
          <ul className="mt-2 space-y-1">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm text-orbit-muted">
                <button
                  onClick={() => setTaskStatus(uid, t.id, "todo")}
                  className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-orbit-blue to-orbit-violet text-[11px] text-white"
                  aria-label={`Reopen ${t.title}`}
                >
                  ✓
                </button>
                <span className="flex-1 line-through">{t.title}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
