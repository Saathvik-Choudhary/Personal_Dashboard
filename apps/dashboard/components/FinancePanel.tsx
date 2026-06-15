"use client";

import { useEffect, useState } from "react";
import { Panel } from "./Panel";
import { Sparkline, seededSeries } from "./Sparkline";

type Finance = {
  currency: string;
  balance: number;
  expenseLabel: string;
  expense: number;
};

const DEFAULTS: Finance = {
  currency: "USD",
  balance: 135956,
  expenseLabel: "Rent",
  expense: 2400,
};

const KEY = "orbit.finance";

function load(): Finance {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

/**
 * Finance snapshot — current balance + a key recurring expense, each with a sparkline.
 * Placeholder data persisted to localStorage (click "Edit" to set your own). Swap `load`/`save`
 * for a Firestore hook when you wire a real source.
 */
export function FinancePanel() {
  const [data, setData] = useState<Finance>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Finance>(DEFAULTS);

  useEffect(() => {
    setData(load());
  }, []);

  function save() {
    setData(draft);
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    setEditing(false);
  }

  return (
    <Panel
      title="Finance"
      action={
        <button
          onClick={() => {
            setDraft(data);
            setEditing((v) => !v);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted transition hover:bg-white/10 hover:text-orbit-text"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      }
    >
      {editing ? (
        <div className="space-y-2.5 text-sm">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-orbit-muted">Balance</span>
            <input
              type="number"
              value={draft.balance}
              onChange={(e) => setDraft({ ...draft, balance: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orbit-cyan/40"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-orbit-muted">
              Key expense label
            </span>
            <input
              value={draft.expenseLabel}
              onChange={(e) => setDraft({ ...draft, expenseLabel: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orbit-cyan/40"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-orbit-muted">
              Key expense amount
            </span>
            <input
              type="number"
              value={draft.expense}
              onChange={(e) => setDraft({ ...draft, expense: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orbit-cyan/40"
            />
          </label>
          <button
            onClick={save}
            className="w-full rounded-lg bg-gradient-to-r from-orbit-blue to-orbit-violet px-3 py-2 text-sm font-medium transition hover:opacity-90"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-orbit-muted">
                Current balance
              </div>
              <div className="mt-1 font-display text-3xl font-bold leading-none text-emerald-300">
                {money(data.balance, data.currency)}
              </div>
              <div className="mt-1 text-[11px] text-orbit-muted">{data.currency}</div>
            </div>
            <Sparkline data={seededSeries(`bal-${data.balance}`, 14, 60, 30)} color="#34d399" width={104} height={36} />
          </div>

          <div className="flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-orbit-muted">
                Key expense · {data.expenseLabel}
              </div>
              <div className="mt-1 font-display text-2xl font-bold leading-none text-orbit-blue">
                {money(data.expense, data.currency)}
              </div>
            </div>
            <Sparkline data={seededSeries(`exp-${data.expense}`, 14, 50, 22)} color="#5b8cff" width={104} height={32} />
          </div>
        </div>
      )}
    </Panel>
  );
}
