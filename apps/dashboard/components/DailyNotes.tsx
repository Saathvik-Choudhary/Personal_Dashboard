"use client";

import { useDailyNotes } from "@/lib/useNotes";
import { Panel } from "./Panel";

export function DailyNotes({ uid }: { uid: string }) {
  const { text, update, saved } = useDailyNotes(uid);
  return (
    <Panel
      title="Today’s notes"
      action={
        <span className="text-[10px] text-orbit-muted">{saved ? "saved" : "saving…"}</span>
      }
    >
      <textarea
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder="Brain-dump, intentions, anything for today…"
        className="h-40 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed outline-none transition placeholder:text-orbit-muted/50 focus:border-orbit-cyan/50"
      />
    </Panel>
  );
}
