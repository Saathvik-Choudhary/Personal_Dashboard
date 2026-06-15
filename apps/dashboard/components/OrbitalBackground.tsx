/**
 * Calm ambient backdrop — a couple of very soft, slow-drifting color blooms over a faint starfield.
 * Toned down from the old deep-space scene so the panels stay the focus. Pure CSS/transform (no
 * WebGL) and decorative only (pointer-events: none via .scene).
 */
export function OrbitalBackground() {
  const nebulas = [
    { c: "#5b8cff", w: 760, h: 760, top: "-14%", left: "56%", delay: "0s" },
    { c: "#7c6bff", w: 680, h: 680, bottom: "-18%", left: "-6%", delay: "-9s" },
    { c: "#38c8ff", w: 560, h: 560, bottom: "0%", right: "-8%", delay: "-15s" },
  ] as const;

  return (
    <div className="scene" aria-hidden>
      <div className="stars twinkle" style={{ animationDuration: "6s" }} />
      <div className="stars stars-b twinkle" style={{ animationDuration: "9s", animationDelay: "-3s" }} />

      {nebulas.map((n, i) => (
        <div
          key={i}
          className="nebula-blob"
          style={{
            width: n.w,
            height: n.h,
            top: "top" in n ? n.top : undefined,
            bottom: "bottom" in n ? n.bottom : undefined,
            left: "left" in n ? n.left : undefined,
            right: "right" in n ? n.right : undefined,
            background: n.c,
            animationDelay: n.delay,
          }}
        />
      ))}
    </div>
  );
}
