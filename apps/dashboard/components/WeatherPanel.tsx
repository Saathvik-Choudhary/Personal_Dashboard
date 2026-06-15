"use client";

import { useEffect, useState } from "react";
import { fetchWeather, WCODE, hourLabel, type WeatherData } from "@/lib/weather";
import { Panel } from "./Panel";

export function WeatherPanel() {
  const [w, setW] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  async function load() {
    setStatus("loading");
    try {
      setW(await fetchWeather());
      setStatus("ok");
    } catch {
      setStatus("denied");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const meta = w ? WCODE[w.code] ?? { e: "🌡️", t: "—" } : null;

  return (
    <Panel
      title="Weather"
      action={
        <button
          onClick={load}
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-orbit-muted transition hover:bg-white/10 hover:text-orbit-text"
        >
          ↻
        </button>
      }
    >
      {status === "loading" ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">Locating…</p>
      ) : status === "denied" || !w || !meta ? (
        <p className="px-1 py-6 text-center text-sm text-orbit-muted">
          Allow location access to see the forecast.
        </p>
      ) : (
        <>
          {/* current */}
          <div className="flex items-center gap-4">
            <span className="text-5xl leading-none">{meta.e}</span>
            <div>
              <div className="font-display text-4xl font-bold leading-none">{w.temp}°</div>
              <div className="mt-1 text-xs text-orbit-muted">
                {meta.t} · feels {w.feels}° · {w.wind} km/h
                {w.humidity != null ? ` · ${w.humidity}% hum` : ""}
              </div>
            </div>
          </div>

          {/* rain banner */}
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
              w.nextRain
                ? "border-orbit-cyan/30 bg-orbit-cyan/10 text-orbit-cyan"
                : "border-white/10 bg-white/5 text-orbit-muted"
            }`}
          >
            {w.nextRain
              ? `☔ Rain likely around ${hourLabel(w.nextRain.time)} (${w.nextRain.precip}% chance)`
              : "☀️ No rain expected in the next several hours"}
          </div>

          {/* hourly strip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {w.hourly.slice(0, 12).map((h) => {
              const hm = WCODE[h.code] ?? { e: "·", t: "" };
              const wet = h.precip >= 50;
              return (
                <div
                  key={h.time}
                  className="flex min-w-[44px] flex-col items-center gap-1 rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-2"
                >
                  <span className="text-[10px] text-orbit-muted">{hourLabel(h.time)}</span>
                  <span className="text-base">{hm.e}</span>
                  <span className="text-xs font-medium">{h.temp}°</span>
                  <span className={`text-[9px] ${wet ? "text-orbit-cyan" : "text-orbit-muted/50"}`}>
                    {h.precip}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
