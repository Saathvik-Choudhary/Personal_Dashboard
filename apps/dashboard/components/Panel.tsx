"use client";

import { useRef } from "react";

/** Stable 0–6s delay from the title so panels float out of phase (no hydration mismatch). */
function delayFor(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return (h % 60) / 10;
}

/**
 * Glassmorphic panel with real 3D depth: a perspective scene, a subtle always-on idle float
 * (so panels look 3D even with no cursor — TVs/wall displays), and a mouse-tracked tilt that
 * composes on top. Content is pushed toward the viewer for parallax.
 */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Track the cursor only to move the glow highlight — no rotation, so click/input targets never
  // shift under the pointer. Hover lift is handled in CSS.
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  return (
    <div className="tilt-scene">
      <div className="tilt-idle" style={{ animationDelay: `-${delayFor(title)}s` }}>
        <div ref={ref} onMouseMove={onMove} className={`glass tilt p-5 ${className}`}>
          <div className="tilt-glow" />
          <div className="tilt-pop">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-orbit-muted">
                {title}
              </h2>
              {action}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
