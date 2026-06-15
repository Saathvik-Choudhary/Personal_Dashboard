export function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-3 mt-2 flex items-center gap-3">
      <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-orbit-muted">
        {label}
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      {hint && <span className="text-[10px] text-orbit-muted/60">{hint}</span>}
    </div>
  );
}
