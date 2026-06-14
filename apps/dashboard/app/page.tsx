"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  useTasks,
  useTodayEvents,
  useDigest,
  useTomorrowProposal,
} from "@/lib/useCollection";
import { useHabits, useHabitLogs } from "@/lib/useHabits";
import { useNotesText } from "@/lib/useNotes";
import { ensureDefaultHabits } from "@/lib/habitMutations";
import { TopBar } from "@/components/TopBar";
import { QuoteBanner } from "@/components/QuoteBanner";
import { WeatherPanel } from "@/components/WeatherPanel";
import { KpiStrip } from "@/components/KpiStrip";
import { ensureCommuteBlocks } from "@/lib/commute";
import { autoSchedule, clearAutoBlocks } from "@/lib/autoSchedule";
import { SectionHeader } from "@/components/SectionHeader";
import { FocusTimer } from "@/components/FocusTimer";
import { Schedule } from "@/components/Schedule";
import { Deadlines } from "@/components/Deadlines";
import { HabitTracker } from "@/components/HabitTracker";
import { HabitHeatmap } from "@/components/HabitHeatmap";
import { TaskList } from "@/components/TaskList";
import { Proposals } from "@/components/Proposals";
import { NewsPanel } from "@/components/NewsPanel";
import { SavedPanel } from "@/components/SavedPanel";
import { useSavedArticles } from "@/lib/saved";
import { ensureMorningDigest } from "@/lib/digest";
import { DailyNotes } from "@/components/DailyNotes";
import { FinancePanel } from "@/components/FinancePanel";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { dateKey } from "@/lib/useHabits";

function Loading() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-orbit-cyan" />
    </main>
  );
}

function SetupNeeded({ error, onGoogle }: { error: string; onGoogle: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="glass max-w-md p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orbit-blue to-orbit-violet shadow-glow">
          <span className="font-display text-2xl font-bold">O</span>
        </div>
        <h1 className="font-display text-2xl font-bold">One quick switch</h1>
        <p className="mt-3 text-sm leading-relaxed text-orbit-muted">{error}</p>
        <button
          onClick={onGoogle}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-bold text-black">
            G
          </span>
          Or sign in with Google
        </button>
      </div>
    </main>
  );
}

export default function Home() {
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();
  const uid = user?.uid;

  const tasks = useTasks(uid);
  const events = useTodayEvents(uid);
  const { digest, stale } = useDigest(uid);
  const proposal = useTomorrowProposal(uid);
  const habits = useHabits(uid);
  const habitLogs = useHabitLogs(uid);
  const notesText = useNotesText(uid);
  const saved = useSavedArticles(uid);

  const [autoPlan, setAutoPlan] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSig = useRef("");

  useEffect(() => {
    if (typeof localStorage !== "undefined") setAutoPlan(localStorage.getItem("orbit.autoplan") === "1");
  }, []);

  function toggleAutoPlan() {
    setAutoPlan((v) => {
      const n = !v;
      if (typeof localStorage !== "undefined") localStorage.setItem("orbit.autoplan", n ? "1" : "0");
      if (!n && uid) clearAutoBlocks(uid, events).catch(() => {});
      return n;
    });
  }

  // Auto-plan: replan (debounced) whenever open tasks or fixed events change.
  useEffect(() => {
    if (!uid || !autoPlan) return;
    const fixed = events.filter((e) => !e.auto);
    const sig = JSON.stringify([
      tasks
        .filter((t) => t.status !== "done")
        .map((t) => [t.id, t.estimatedMinutes ?? null, t.priority ?? 3, t.dueDate ?? null]),
      fixed.map((e) => [e.id, e.start, e.end, e.title]),
    ]);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      autoSchedule(uid, tasks, events).catch(() => {});
    }, 1500);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, autoPlan, tasks, events]);

  useEffect(() => {
    if (uid) ensureDefaultHabits(uid).catch(() => {});
  }, [uid]);

  // Each day, auto-block the commute (weather-aware). Idempotent per day.
  useEffect(() => {
    if (uid) ensureCommuteBlocks(uid, events).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, events.length]);

  // Each morning, ensure today's categorized news digest exists (always-on screen).
  useEffect(() => {
    if (uid) ensureMorningDigest(uid, !!digest && !stale && !!digest.categories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, stale, digest]);

  if (loading) return <Loading />;
  if (!user) return <SetupNeeded error={error ?? "Sign-in unavailable."} onGoogle={signInWithGoogle} />;

  return (
    <main className="mx-auto w-full max-w-[3000px] px-4 py-6 sm:px-6 lg:px-10 4xl:px-16">
      <TopBar user={user} onSignOut={signOut} onUpgrade={signInWithGoogle} />

      {/* Quote */}
      <div className="animate-rise mb-6">
        <QuoteBanner />
      </div>

      {/* Overview KPIs */}
      <div className="animate-rise mb-8" style={{ animationDelay: "0.08s" }}>
        <KpiStrip tasks={tasks} events={events} habits={habits} logs={habitLogs} />
      </div>

      {/* FOCUS */}
      <SectionHeader label="Focus" hint="what matters right now" />
      <div className="mb-8 grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <WeatherPanel />
        <Schedule events={events} autoPlan={autoPlan} onToggleAutoPlan={toggleAutoPlan} />
        <Deadlines tasks={tasks} />
        <FocusTimer />
      </div>

      {/* WELLNESS */}
      <SectionHeader label="Wellness" hint="drink · sleep · move" />
      <div className="mb-8 grid items-start gap-5 lg:grid-cols-3 4xl:grid-cols-4">
        <div className="lg:col-span-2 4xl:col-span-3">
          <HabitTracker uid={user.uid} habits={habits} logs={habitLogs} />
        </div>
        <HabitHeatmap habits={habits} logs={habitLogs} />
      </div>

      {/* PLAN */}
      <SectionHeader label="Plan" hint="tasks · calendar · notes · money" />
      <div className="mb-8 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
        <TaskList uid={user.uid} tasks={tasks} />
        <Proposals proposal={proposal} tasks={tasks} />
        <DailyNotes uid={user.uid} />
        <FinancePanel />
      </div>

      {/* NEWS */}
      <SectionHeader label="News" hint="robotics · ai · tech · refreshed each morning" />
      <div className="grid items-start gap-5 lg:grid-cols-3 4xl:grid-cols-4">
        <div className="lg:col-span-2 4xl:col-span-3">
          <NewsPanel uid={user.uid} digest={digest} stale={stale} saved={saved} />
        </div>
        <SavedPanel uid={user.uid} saved={saved} />
      </div>

      <footer className="mt-10 text-center text-[11px] text-orbit-muted/60">
        Orbit · your personal command center
      </footer>

      <VoiceAssistant
        uid={user.uid}
        tasks={tasks}
        events={events}
        habits={habits}
        habitToday={habitLogs[dateKey()] ?? {}}
        digestTitles={
          digest?.categories
            ? [
                ...(digest.categories.robotics ?? []),
                ...(digest.categories.ai ?? []),
                ...(digest.categories.tech ?? []),
              ].map((i) => i.title)
            : digest?.items?.map((i) => i.title)
        }
        notes={notesText}
      />
    </main>
  );
}
