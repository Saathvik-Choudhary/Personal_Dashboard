"use client";

import { useState } from "react";
import type { Proposal, Task } from "@/lib/types";
import { approveProposal } from "@/lib/mutations";
import { Panel } from "./Panel";

function time(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/**
 * Propose-then-approve (spec §7.3). Claude drafts blocks overnight; the user approves here, and
 * only then does a callable function write them to the real Google Calendar.
 */
export function Proposals({ proposal, tasks }: { proposal: Proposal | null; tasks: Task[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!proposal || proposal.blocks.length === 0) {
    return (
      <Panel title="Tomorrow’s plan">
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">
          No proposed blocks yet. Check back after the morning run.
        </p>
      </Panel>
    );
  }

  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Focus block";
  const approved = proposal.status === "approved";

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const indices = selected.size ? [...selected] : undefined;
      await approveProposal(proposal!.date, indices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Tomorrow’s plan"
      action={
        approved ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
            approved
          </span>
        ) : (
          <button
            onClick={approve}
            disabled={busy}
            className="rounded-full bg-gradient-to-br from-orbit-blue to-orbit-violet px-4 py-1.5 text-xs font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Writing…" : selected.size ? `Approve ${selected.size}` : "Approve all"}
          </button>
        )
      }
    >
      <ul className="space-y-2">
        {proposal.blocks.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/5"
          >
            {!approved && (
              <button
                onClick={() => toggle(i)}
                aria-label="Toggle block"
                className={`mt-0.5 grid h-5 w-5 place-items-center rounded-md border text-[11px] transition ${
                  selected.has(i)
                    ? "border-transparent bg-gradient-to-br from-orbit-blue to-orbit-violet text-white"
                    : "border-white/25 text-transparent hover:border-orbit-cyan"
                }`}
              >
                ✓
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{taskTitle(b.taskId)}</span>
                <span className="font-display text-xs text-orbit-muted">
                  {time(b.start)}–{time(b.end)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-orbit-muted">{b.reason}</p>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Panel>
  );
}
