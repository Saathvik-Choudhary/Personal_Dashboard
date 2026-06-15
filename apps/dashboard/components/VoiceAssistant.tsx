"use client";

import { useEffect, useRef, useState } from "react";
import type { Task, CalendarEvent, Habit } from "@/lib/types";
import {
  parseRuleIntent,
  parseLLMIntents,
  executeIntent,
  executeIntents,
  intentSystemPrompt,
  type VoiceContext,
  type Intent,
} from "@/lib/voiceCommands";
import {
  askVoiceLLM,
  preloadVoiceLLM,
  webgpuAvailable,
  setVoiceModel,
  VOICE_MODELS,
  type ModelTier,
} from "@/lib/useVoiceLLM";
import { askGemini, type CloudModel } from "@/lib/cloudBrain";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

const WAKE_RE = /\b(steve|steven|stephen|steph|stevie)\b/i;
// Spoken "end of command" phrases. Recording keeps going until you say one of these,
// tap stop, or pause long enough.
const STOP_RE = /\s*\b(send it|send|that'?s (it|all|everything)|go ahead|that is all|over and out|i'?m done|finish(ed)?)\b[.!?]*\s*$/i;
const SILENCE_MS = 6000; // generous pause before auto-finishing (was an instant cutoff before)

export function VoiceAssistant({
  uid,
  tasks,
  events,
  habits,
  habitToday,
  digestTitles,
  notes,
}: {
  uid: string;
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  habitToday: Record<string, number | boolean>;
  digestTitles?: string[];
  notes?: string;
}) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [thinking, setThinking] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [tier, setTier] = useState<ModelTier>("balanced");
  const [useCloud, setUseCloud] = useState(false);
  const [cloudModel, setCloudModel] = useState<CloudModel>("flash");
  const [handsFree, setHandsFree] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");

  const recRef = useRef<SR | null>(null);
  const wakeRef = useRef<SR | null>(null);
  const handsFreeRef = useRef(false);
  const awaitingRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const srClassRef = useRef<any>(null);
  const pendingRef = useRef<{ original: string; question: string } | null>(null);
  const bufferRef = useRef("");
  const listeningRef = useRef(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hfBufferRef = useRef("");
  const hfCapturingRef = useRef(false);
  const hfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctxRef = useRef<VoiceContext>({ uid, tasks, events, habits, habitToday, digestTitles, notes });
  ctxRef.current = { uid, tasks, events, habits, habitToday, digestTitles, notes };

  // ---------- speech synthesis (smoother, selectable voice) ----------
  function pickDefaultVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const en = list.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    const prefer = [
      "Google UK English Female",
      "Google UK English Male",
      "Google US English",
      "Samantha",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Daniel",
    ];
    for (const name of prefer) {
      const f = en.find((v) => v.name === name);
      if (f) return f;
    }
    return en.find((v) => /natural|google/i.test(v.name)) ?? en[0] ?? list[0] ?? null;
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }

  function respond(text: string) {
    setReply(text);
    speak(text);
  }

  /** Run the parsed intents: ask a clarifying question if needed, else execute them all. */
  async function dispatch(intents: Intent[], ctx: VoiceContext, original: string): Promise<boolean> {
    if (!intents.length) return false;
    const ask = intents.find((i) => i.kind === "ask");
    if (ask && ask.kind === "ask") {
      pendingRef.current = { original, question: ask.question };
      respond(ask.question);
      return true;
    }
    pendingRef.current = null;
    respond(await executeIntents(intents, ctx));
    return true;
  }

  // ---------- the brain ----------
  async function handle(text: string) {
    setThinking(true);
    setReply("");
    const ctx = ctxRef.current;
    // If we asked a clarifying question, fold the answer back into the original request.
    const pending = pendingRef.current;
    const original = pending?.original ?? text;
    const userMessage = pending
      ? `The user's original request was: "${pending.original}". You asked: "${pending.question}". Their answer: "${text}". Now carry out the full request.`
      : text;
    try {
      if (useCloud) {
        // Cloud (Gemini) is the primary brain — it handles every feature, including compound requests.
        try {
          const raw = await askGemini(intentSystemPrompt(ctx), userMessage, cloudModel);
          if (await dispatch(parseLLMIntents(raw), ctx, original)) return;
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? "";
          if (/credit|exhausted|depleted|billing/i.test(msg)) {
            respond("Gemini credits are depleted — add billing in AI Studio.");
            return;
          }
          // otherwise fall through to the rule fallback
        }
        pendingRef.current = null;
        const ruled = parseRuleIntent(text);
        respond(ruled ? await executeIntent(ruled, ctx) : "Sorry, I couldn’t do that one.");
        return;
      }

      // On-device path: rules first for single commands, then the local model.
      if (!pending) {
        const ruled = parseRuleIntent(text);
        if (ruled) {
          respond(await executeIntent(ruled, ctx));
          return;
        }
      }
      if (llmEnabled && webgpuAvailable()) {
        setModelStatus((s) => (s === "ready" ? "ready" : "loading"));
        const raw = await askVoiceLLM(userMessage, intentSystemPrompt(ctx), (r) => {
          setProgress(r.progress);
          setModelStatus(r.progress >= 1 ? "ready" : "loading");
        });
        setModelStatus("ready");
        if (await dispatch(parseLLMIntents(raw), ctx, original)) return;
        respond("I didn’t catch that — try rephrasing.");
        return;
      }
      respond(
        "Turn on Gemini (cloud) or the on-device AI brain for full control. Rules cover tasks, habits, water, and schedule.",
      );
    } catch (err) {
      respond("Something went wrong handling that.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setThinking(false);
    }
  }

  const handleRef = useRef(handle);
  handleRef.current = handle;

  // ---------- wake word ("Steve") continuous listener ----------
  function startWake() {
    const SRClass = srClassRef.current;
    if (!SRClass) return;
    try {
      wakeRef.current?.abort?.();
    } catch {
      /* noop */
    }
    const rec: SR = new SRClass();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) continue;
        const text: string = r[0].transcript.trim();

        if (hfCapturingRef.current) {
          // already woken — accumulate the command until a stop-word or a pause
          hfBufferRef.current += " " + text;
          setTranscript(hfBufferRef.current.trim());
          if (STOP_RE.test(hfBufferRef.current.trim())) finalizeHF();
          else armHF();
          continue;
        }

        const m = text.match(WAKE_RE);
        if (m && m.index !== undefined) {
          const after = text.slice(m.index + m[0].length).replace(/^[,\s]+/, "").trim();
          setTranscript(text);
          hfCapturingRef.current = true;
          hfBufferRef.current = after;
          if (STOP_RE.test(after)) finalizeHF();
          else if (after.length < 1) respond("Yes?"), armHF();
          else armHF();
        }
      }
    };
    rec.onend = () => {
      if (handsFreeRef.current) {
        try {
          rec.start();
        } catch {
          /* will be restarted by toggle */
        }
      }
    };
    rec.onerror = () => {
      /* onend handles restart */
    };
    wakeRef.current = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  function toggleHandsFree() {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    if (typeof localStorage !== "undefined") localStorage.setItem("orbit.voice.handsfree", next ? "1" : "0");
    if (next) {
      setOpen(true);
      startWake();
    } else {
      awaitingRef.current = false;
      hfCapturingRef.current = false;
      hfBufferRef.current = "";
      clearHF();
      try {
        wakeRef.current?.stop?.();
      } catch {
        /* noop */
      }
    }
  }

  // ---------- setup ----------
  useEffect(() => {
    const SRClass =
      (typeof window !== "undefined" &&
        ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)) ||
      null;
    srClassRef.current = SRClass;
    if (!SRClass) {
      setSupported(false);
      return;
    }
    // Manual mic: keep listening (continuous) and only finish on a stop-word, a tap, or a
    // long pause — so it no longer cuts off mid-sentence.
    const rec: SR = new SRClass();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) bufferRef.current += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setTranscript((bufferRef.current + interim).trim());
      if (STOP_RE.test(bufferRef.current.trim())) {
        finalizeManual();
        return;
      }
      armSilence();
    };
    rec.onend = () => {
      // ended on its own (browser timeout) while we were still listening → finish with what we have
      if (listeningRef.current) finalizeManual();
      else setListening(false);
    };
    rec.onerror = () => {
      /* onend follows */
    };
    recRef.current = rec;

    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem("orbit.voice.llm") === "1") setLlmEnabled(true);
      if (localStorage.getItem("orbit.voice.cloud") === "1") setUseCloud(true);
      const gm = localStorage.getItem("orbit.voice.gmodel");
      if (gm === "pro" || gm === "flash") setCloudModel(gm);
      const savedTier = localStorage.getItem("orbit.voice.tier") as ModelTier | null;
      if (savedTier && VOICE_MODELS[savedTier]) {
        setTier(savedTier);
        setVoiceModel(VOICE_MODELS[savedTier].id);
      }
    }

    // load TTS voices
    function loadVoices() {
      const vs = window.speechSynthesis?.getVoices?.() ?? [];
      if (!vs.length) return;
      setVoices(vs.filter((v) => v.lang?.toLowerCase().startsWith("en")));
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("orbit.voice.tts") : null;
      const chosen = (saved && vs.find((v) => v.name === saved)) || pickDefaultVoice(vs);
      voiceRef.current = chosen ?? null;
      setVoiceName(chosen?.name ?? "");
    }
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      try {
        rec.abort?.();
        wakeRef.current?.abort?.();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTier(next: ModelTier) {
    setTier(next);
    setVoiceModel(VOICE_MODELS[next].id);
    setModelStatus("idle");
    setProgress(0);
    if (typeof localStorage !== "undefined") localStorage.setItem("orbit.voice.tier", next);
  }
  function toggleCloud() {
    setUseCloud((v) => {
      const n = !v;
      if (typeof localStorage !== "undefined") localStorage.setItem("orbit.voice.cloud", n ? "1" : "0");
      return n;
    });
  }
  function changeCloudModel(m: CloudModel) {
    setCloudModel(m);
    if (typeof localStorage !== "undefined") localStorage.setItem("orbit.voice.gmodel", m);
  }
  function changeVoice(name: string) {
    setVoiceName(name);
    const v = voices.find((x) => x.name === name) ?? null;
    voiceRef.current = v;
    if (typeof localStorage !== "undefined") localStorage.setItem("orbit.voice.tts", name);
    if (v) {
      const u = new SpeechSynthesisUtterance("Hi, I’m Steve — ready when you are.");
      u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function clearSilence() {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }
  function armSilence() {
    clearSilence();
    silenceTimer.current = setTimeout(() => finalizeManual(), SILENCE_MS);
  }
  function finalizeManual() {
    clearSilence();
    const text = bufferRef.current.trim().replace(STOP_RE, "").trim();
    bufferRef.current = "";
    listeningRef.current = false;
    setListening(false);
    try {
      recRef.current?.stop?.();
    } catch {
      /* noop */
    }
    if (text) handleRef.current(text);
  }

  function clearHF() {
    if (hfTimer.current) {
      clearTimeout(hfTimer.current);
      hfTimer.current = null;
    }
  }
  function armHF() {
    clearHF();
    hfTimer.current = setTimeout(() => finalizeHF(), 5000);
  }
  function finalizeHF() {
    clearHF();
    const text = hfBufferRef.current.trim().replace(STOP_RE, "").trim();
    hfBufferRef.current = "";
    hfCapturingRef.current = false;
    if (text) {
      setTranscript(text);
      handleRef.current(text);
    }
  }

  function toggleListen() {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      finalizeManual(); // tap to send what you've said so far
    } else {
      bufferRef.current = "";
      setTranscript("");
      setReply("");
      clearSilence();
      try {
        rec.start();
        listeningRef.current = true;
        setListening(true);
        armSilence();
      } catch {
        /* already started */
      }
    }
  }

  async function enableBrain() {
    setLlmEnabled(true);
    localStorage.setItem("orbit.voice.llm", "1");
    if (!webgpuAvailable()) return;
    setModelStatus("loading");
    try {
      await preloadVoiceLLM((r) => {
        setProgress(r.progress);
        if (r.progress >= 1) setModelStatus("ready");
      });
      setModelStatus("ready");
    } catch {
      setModelStatus("idle");
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="glass w-80 animate-rise p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-orbit-muted">
              Steve · voice assistant
            </span>
            <button onClick={() => setOpen(false)} className="text-orbit-muted hover:text-orbit-text">
              ✕
            </button>
          </div>

          {!supported ? (
            <p className="text-xs text-orbit-muted">
              Voice isn’t supported in this browser. Try Chrome or Edge.
            </p>
          ) : (
            <>
              <div className="min-h-[64px] rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                {transcript ? (
                  <p className="text-orbit-muted">
                    “{transcript}”
                    {listening && <span className="text-orbit-cyan/70"> ▌</span>}
                  </p>
                ) : (
                  <p className="text-orbit-muted/60">
                    {handsFree
                      ? "Listening… say “Steve, …” then your command, ending with “send”."
                      : "Tap Speak and talk as long as you like — finish by saying “send” or tapping Stop."}
                  </p>
                )}
                {reply && <p className="mt-2 text-orbit-text">{reply}</p>}
                {thinking && !reply && <p className="mt-2 text-orbit-muted">…</p>}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                {!handsFree ? (
                  <button
                    onClick={toggleListen}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      listening
                        ? "bg-red-500/80 text-white"
                        : "bg-gradient-to-br from-orbit-blue to-orbit-violet text-white shadow-glow hover:brightness-110"
                    }`}
                  >
                    <span className={listening ? "animate-pulse" : ""}>🎙️</span>
                    {listening ? "Stop & send" : "Speak"}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-emerald-300">
                    <span className="animate-pulse">🎧</span> Hands-free on
                  </span>
                )}

                <button
                  onClick={toggleHandsFree}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    handsFree
                      ? "bg-emerald-500/80 text-white"
                      : "border border-white/15 text-orbit-muted hover:text-orbit-text"
                  }`}
                >
                  {handsFree ? "Stop “Steve”" : "Hands-free"}
                </button>
              </div>

              {/* Cloud toggle */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-orbit-muted">Brain</span>
                <button
                  onClick={toggleCloud}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    useCloud
                      ? "bg-gradient-to-br from-orbit-blue to-orbit-violet text-white"
                      : "border border-white/15 text-orbit-muted hover:text-orbit-text"
                  }`}
                >
                  {useCloud ? "Gemini ✓" : "Use Gemini"}
                </button>
              </div>

              {useCloud ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-orbit-muted">Model</span>
                  <div className="flex gap-0.5 rounded-full border border-white/10 bg-black/20 p-0.5 text-[10px]">
                    {(["flash", "pro"] as CloudModel[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => changeCloudModel(m)}
                        className={`rounded-full px-2.5 py-1 transition ${
                          cloudModel === m ? "bg-white/10 text-orbit-text" : "text-orbit-muted"
                        }`}
                      >
                        {m === "flash" ? "2.5 Flash · cheap" : "2.5 Pro · smart"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {!llmEnabled ? (
                      <button
                        onClick={enableBrain}
                        className="text-[11px] text-orbit-muted underline-offset-2 hover:text-orbit-text hover:underline"
                      >
                        Enable on-device AI brain
                      </button>
                    ) : (
                      <span className="text-[11px] text-orbit-muted">
                        {modelStatus === "loading"
                          ? `AI ${Math.round(progress * 100)}%`
                          : modelStatus === "ready"
                            ? "AI ready"
                            : webgpuAvailable()
                              ? "AI on"
                              : "needs WebGPU"}
                      </span>
                    )}
                    {llmEnabled && (
                      <select
                        value={tier}
                        onChange={(e) => changeTier(e.target.value as ModelTier)}
                        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-orbit-text outline-none"
                      >
                        {(Object.keys(VOICE_MODELS) as ModelTier[]).map((k) => (
                          <option key={k} value={k} className="bg-orbit-bg">
                            {VOICE_MODELS[k].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {llmEnabled && modelStatus === "loading" && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orbit-cyan to-orbit-blue transition-all"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Voice selector */}
              {voices.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-orbit-muted">Voice</span>
                  <select
                    value={voiceName}
                    onChange={(e) => changeVoice(e.target.value)}
                    className="max-w-[180px] truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-orbit-text outline-none"
                  >
                    {voices.map((v) => (
                      <option key={v.name} value={v.name} className="bg-orbit-bg">
                        {v.name.replace(/ Online \(Natural\).*/, "")} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Voice assistant"
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-orbit-blue to-orbit-violet text-2xl shadow-glow transition hover:-translate-y-0.5 hover:brightness-110"
      >
        🎙️
      </button>
    </div>
  );
}
