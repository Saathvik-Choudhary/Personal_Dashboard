import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        "3xl": "1920px", // 1080p TVs / large monitors
        "4xl": "2560px", // 34" ultrawide / 1440p+
        "5xl": "3200px", // 4K TVs / superwide
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        orbit: {
          bg: "#05060f",
          panel: "rgba(255,255,255,0.045)",
          edge: "rgba(255,255,255,0.10)",
          text: "#eef2ff",
          muted: "#9aa6c8",
          cyan: "#38e1ff",
          violet: "#a78bfa",
          blue: "#5b8cff",
        },
      },
      boxShadow: {
        glass:
          "0 10px 40px -12px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 30px -10px rgba(120,160,255,0.18)",
        glow: "0 0 0 1px rgba(120,160,255,0.25), 0 8px 40px -8px rgba(91,140,255,0.55)",
      },
      keyframes: {
        spin3d: {
          from: { transform: "rotateZ(0deg)" },
          to: { transform: "rotateZ(360deg)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        aurora: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%,-3%,0) scale(1.08)" },
        },
        pulse: {
          "0%,100%": { opacity: "0.85", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
        pulse: "pulse 5s ease-in-out infinite",
        rise: "rise 0.6s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
