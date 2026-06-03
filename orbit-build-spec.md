# Orbit — Build Specification

*A personal command center: one place for daily tasks, an automated AI news digest, schedule-based reminders, and to-do-driven calendar blocking. Built to extend into many future projects.*

> **"Orbit" is a working name** (everything in the system orbits a single Firestore core). Rename freely.

This document is the single source of truth for building the platform end to end. It is written for an engineering team and assumes working familiarity with TypeScript, Firebase, and Next.js. Read the Context section first — several decisions are non-obvious and the rest of the document depends on them.

---

## 1. Context & key decisions

The product is a personal dashboard, accessible from anywhere, that does four things: shows the day's tasks and schedule, generates a daily AI-news digest automatically, sends reminders through the day, and proposes calendar time-blocks based on the to-do list. Claude (Anthropic API) is the intelligence layer behind the automations.

The following decisions are already made. Do not relitigate them mid-build without raising it explicitly.

**Firestore is the single source of truth — not Notion.** Notion was considered and rejected. It cannot push events (no webhooks, polling only, 3 req/sec limit), and putting a tool we don't control in the critical path works against the primary goal of a clean, extensible platform. We build our own dashboard against Firestore. If a Notion-style editing experience is ever wanted, it is added later as a one-way export, never as a dependency.

**Google Calendar is in the loop only for time-blocking.** It is where the user's *time* lives and where approved focus-blocks get written. It is not the task store and not the reminder store.

**The intelligence layer is a shared module, and it is the actual product.** The dashboard is just the first surface that reads it. Both the cloud functions and the local Mac daemon call Claude through one shared package — same prompt templates, same key handling, same Firestore helpers. Project #2 (later) imports this package and points it at new collections. The intelligence layer is never rebuilt per project. This is the highest-leverage decision in the build; protect it.

**The client never holds the Anthropic API key and never calls Claude directly.** All Claude calls happen server-side (cloud functions) or on the Mac daemon. No exceptions.

**Heavy Claude work runs on the Mac M1 between 4–9am.** That window is when Claude usage is free-form for the user, so all token-heavy jobs (the news digest, the overnight calendar-block planning) run locally on the Mac in that window — paying API tokens but no cloud compute. The cloud handles only cheap, time-sensitive delivery (reminders) that must fire whether or not the laptop is awake.

**The 4–9am window has an hourly retry budget.** The daemon wakes around 4am and attempts the jobs. On API failure it retries every hour (5, 6, 7, 8am) until success or until the 9am ceiling. Jobs are idempotent via per-day markers so repeated wakes never redo completed work. After 9am, a still-failed job is marked failed and the dashboard shows the previous day's data with a quiet notice. The system degrades; it never breaks. Local compute is an optimization, never a hard dependency — if the Mac is off all morning, the cloud still serves yesterday's digest and all delivery still works.

**Calendar writes are propose-then-approve.** Claude never writes to the real Google Calendar autonomously. Overnight it drafts proposed blocks into Firestore. In the morning the user approves, edits, or rejects them in the dashboard, and only then are the approved blocks written to Google Calendar. Autonomous calendar writing is explicitly a future (v2) consideration, gated on the user trusting the system's judgment.

**Build priority order (set by the product owner):** (1) clean architecture that extends to many projects, (2) polished, intuitive UI, (3) minimize Claude API + hosting cost, (4) ship fast. Speed is explicitly last. When trading off, favor the cleaner abstraction over the quicker hack.

---

## 2. Architecture

```
                          ┌──────────────────────┐
                          │   Next.js dashboard   │
                          │  Firebase Hosting,PWA │
                          └───────────┬───────────┘
                                      │ read / write
                                      ▼
   ┌────────────────┐        ┌────────────────┐        ┌────────────────┐
   │ Cloud Functions │◀──────▶│   FIRESTORE    │◀──────▶│  Mac M1 daemon  │
   │ scheduled,      │  r/w   │ source of truth │  r/w   │ local, 4–9am,   │
   │ always-on,cheap │        └───────┬────────┘        │ heavy jobs      │
   └───────┬─────────┘                │                 └────────┬────────┘
           │                          │                          │
           │         both runtimes call Claude through           │
           │              packages/core (shared)                 │
           ▼                          ▼                          ▼
   ┌──────────────────┐      ┌────────────────┐        ┌──────────────────┐
   │ WhatsApp (Twilio)│      │   Claude API   │        │ Google Calendar  │
   │  + Web Push (FCM)│      │ (intelligence) │        │ (time-blocking)  │
   └──────────────────┘      └────────────────┘        └──────────────────┘
```

Everything reads and writes Firestore. Two compute layers act on it:

- **Cloud Functions (Firebase, 2nd gen)** — always-on, scheduled, and event-triggered. Handles reminder delivery and anything that must fire on a fixed clock regardless of the Mac's state. Stays comfortably inside the free tier for a single user.
- **Mac M1 daemon** — a local Node process managed by `launchd`, awake 4–9am, running the token-heavy Claude jobs (news digest, overnight planning).

Both layers import `packages/core` for all Claude calls, Firestore access, and shared domain types. The dashboard is a thin client over Firestore; it triggers server work (e.g. "approve these blocks") via callable functions, never by calling Claude or external APIs itself.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | Deployed to Firebase Hosting; PWA for installability + web push |
| PWA / push | `next-pwa` (or a hand-rolled service worker) + FCM | Service worker required for web push |
| Cloud compute | Firebase Cloud Functions, 2nd gen, Node 20, TypeScript | Cloud Scheduler drives cron triggers |
| Local compute | Node 20 + TypeScript daemon, `launchd`-managed | Runs on the Mac M1 |
| Database | Cloud Firestore (native mode) | Single source of truth |
| Auth | Firebase Auth (Google sign-in) | Single user now, multi-tenant data model from day one |
| Secrets | Google Secret Manager (cloud); macOS Keychain or gitignored `.env` (daemon) | API keys, OAuth secrets, Twilio creds |
| AI | `@anthropic-ai/sdk` | Claude as the intelligence layer |
| Messaging | Twilio WhatsApp API | Reminders + digests |
| Push | Firebase Cloud Messaging (FCM) | Browser/PWA notifications |
| Calendar | `googleapis` (Google Calendar API), OAuth2 | Read existing events; write approved blocks |
| Monorepo | pnpm workspaces + Turborepo | Enables the shared `core` package |

Pin exact versions in the lockfile at Phase 0 and record them; do not float majors mid-build.

---

## 4. Repository layout

A monorepo so the shared `core` package is imported by every runtime.

```
orbit/
├─ apps/
│  └─ dashboard/                 # Next.js PWA (the UI surface)
├─ functions/                    # Firebase Cloud Functions (always-on, scheduled)
├─ daemon/                       # Mac M1 local daemon (4–9am heavy jobs)
├─ packages/
│  └─ core/                      # THE shared module — the actual product
│     └─ src/
│        ├─ claude/
│        │  ├─ client.ts         # Anthropic wrapper, structured-output helper
│        │  └─ prompts/          # versioned prompt templates per job
│        ├─ firestore/
│        │  ├─ admin.ts          # Admin SDK init (server/daemon only)
│        │  └─ repositories/     # typed read/write per collection
│        ├─ jobs/
│        │  ├─ newsDigest.ts     # pure: input → Claude → structured digest
│        │  └─ planDay.ts        # pure: tasks+events → proposed blocks
│        ├─ delivery/
│        │  ├─ whatsapp.ts       # Twilio send
│        │  └─ push.ts           # FCM send
│        └─ types/               # shared domain types (Task, Event, Digest, …)
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

The `jobs/` definitions are pure functions — they take input, call Claude through `claude/client.ts`, and return parsed structured output. They are imported by both the daemon and (where relevant) the functions, with no copy-paste between runtimes.

---

## 5. Data model (Firestore)

All data is namespaced under a user from day one — `users/{uid}/…` — even though there is one user initially. This is what makes multi-tenant and project #2 cheap later. The `project` field on tasks/events reserves room for the multi-project future without a migration.

| Collection | Document shape (key fields) |
|---|---|
| `users/{uid}` | `timezone`, `workingHours`, `reminderChannels[]` (whatsapp/push), `newsTopics[]`, `whatsappNumber`, `pushTokens[]`, `calendar` (OAuth link state) |
| `users/{uid}/tasks/{taskId}` | `title`, `notes`, `status` (todo\|doing\|done), `priority`, `estimatedMinutes`, `dueDate`, `project`, `tags[]`, `createdAt`, `completedAt` |
| `users/{uid}/events/{eventId}` | `title`, `start`, `end`, `source` (google\|orbit), `googleEventId`, `type` (meeting\|block\|focus), `taskId?`, `status` (proposed\|confirmed\|synced) |
| `users/{uid}/reminders/{reminderId}` | `refType` (event\|task\|digest), `refId`, `fireAt`, `channels[]`, `message`, `status` (pending\|sent\|failed), `sentAt?` |
| `users/{uid}/digests/{YYYY-MM-DD}` | `date`, `items[]` ({title, source, url, summary, rank}), `generatedAt`, `status` (success\|failed) |
| `users/{uid}/proposals/{YYYY-MM-DD}` | `blocks[]` ({taskId, start, end, reason}), `status` (pending\|approved\|rejected), `generatedAt` |
| `users/{uid}/jobRuns/{YYYY-MM-DD}` | `newsDigest` ({status, attempts, lastAttemptAt}), `dailyPlan` ({status, attempts, lastAttemptAt}), `daemonHeartbeat` |

`jobRuns` is the idempotency ledger that makes the morning retry safe (Section 9). `digests` and `proposals` are keyed by date so "today's" data is a direct document read and "yesterday's" fallback is trivial.

### Security rules

Clients may only touch their own subtree. The daemon and functions use the Admin SDK and bypass rules entirely.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Add composite indexes (in `firestore.indexes.json`) for the reminder scan query (`status == pending` ordered by `fireAt`) and any task views that filter+sort.

---

## 6. The shared Claude module (`packages/core`)

This is the heart. Get the boundary right and everything else — including future projects — slots in cleanly.

**Rules of the module:**
- The Anthropic key is read from the environment (Secret Manager in cloud, Keychain/`.env` on the daemon). It is never passed from a caller and never reaches the client.
- Every job prompts Claude to return **JSON only** (no prose, no markdown fences) and parses it defensively.
- Each job is a pure function with a typed input and typed output. No Firestore writes inside a job — the caller (daemon/function) owns persistence. This keeps jobs reusable across runtimes and trivial to test.

A single entry point wraps the SDK and the parse step:

```typescript
// packages/core/src/claude/client.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export interface ClaudeRun<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number };
}

export async function runClaudeJob<T>(opts: {
  system: string;
  user: string;
  parse: (raw: string) => T;
  model?: string;
  maxTokens?: number;
}): Promise<ClaudeRun<T>> {
  const msg = await client.messages.create({
    model: opts.model ?? "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();
  return {
    data: opts.parse(text),
    usage: {
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    },
  };
}
```

Prompt templates live in `claude/prompts/`, are versioned (a comment header with a version number), and are the only place prompt text exists. A job composes a template with its input and a parser:

```typescript
// packages/core/src/jobs/newsDigest.ts
import { runClaudeJob } from "../claude/client";
import { NEWS_DIGEST_SYSTEM } from "../claude/prompts/newsDigest";
import type { DigestItem } from "../types";

export async function generateNewsDigest(input: {
  topics: string[];
  articles: { title: string; source: string; url: string; body: string }[];
}) {
  return runClaudeJob<DigestItem[]>({
    system: NEWS_DIGEST_SYSTEM,
    user: JSON.stringify(input),
    parse: (raw) => JSON.parse(raw) as DigestItem[],
  });
}
```

Pick the model per job to manage cost: a cheaper/faster model for routine summarization, a stronger model only where reasoning quality matters (e.g. calendar planning). Choosing the model is a one-line change per job, which is the point of the abstraction.

---

## 7. Feature specs

### 7.1 Daily AI news digest (Mac daemon, 4–9am)

1. Fetch candidate articles from a configurable source list (RSS feeds to start; the source list lives in `users/{uid}.newsTopics` / a sources config so it's editable without a deploy).
2. One Claude call via `generateNewsDigest` → summarize, rank, and dedupe into a structured `DigestItem[]`.
3. Write the result to `digests/{today}` and set `jobRuns/{today}.newsDigest = success`.
4. The dashboard reads `digests/{today}`. If it is missing or `failed`, it reads `digests/{yesterday}` and shows a quiet "couldn't refresh this morning" notice.

This is the single biggest token spender, which is exactly why it lives in the 4–9am local window.

### 7.2 Schedule-based reminders (Cloud Functions, always-on)

Reminders are *generated* from events and approved plans, then *delivered* by a scheduled scan:

- **Generation:** when an event becomes `confirmed` (e.g. an approved block, or a synced Google meeting), a function creates `reminders` docs (default: one 15 minutes before; configurable). A daily morning function (~7am) creates a digest reminder bundling today's schedule + the news digest.
- **Delivery:** a scheduled function runs every few minutes, queries `reminders` where `status == pending && fireAt <= now`, and for each sends to the user's `reminderChannels` (WhatsApp via Twilio, web push via FCM), then marks `sent` (or `failed` with a retry count).

Delivery is intentionally cheap and cloud-side so reminders fire whether or not the Mac is awake.

### 7.3 Calendar blocking from to-dos (propose-then-approve)

The hardest feature. Split across overnight proposal and morning approval:

1. **Overnight (Mac daemon, 4–9am):** read open tasks + tomorrow's existing Google Calendar events, call `planDay` (Claude reasons over priorities, durations, existing meetings, working hours) → write `proposals/{tomorrow}` with `status: pending`. **Nothing is written to Google Calendar at this stage.**
2. **Morning (dashboard):** the user sees the proposed blocks and approves, edits, or rejects them.
3. **On approval:** a callable Cloud Function writes the approved blocks to Google Calendar (tagged/colored as Orbit-created so they are distinguishable and revocable), creates `events` docs with `status: synced`, and generates their reminders.

This satisfies the rule that the system gets explicit human approval before writing to the real calendar, every time.

---

## 8. Google Calendar integration

- **OAuth2 with offline access** so we hold a refresh token. Store the refresh token encrypted at rest (Secret Manager, or an encrypted Firestore field — never plaintext, never client-readable).
- **Read** events for the planning window so `planDay` knows what is already booked.
- **Write** only on approval. Tag Orbit-created events (distinct color / extended property) so they are easy to identify and bulk-revoke.
- **Sync** for v1 is a periodic pull (a scheduled function refreshing the mirror every N minutes) — simple and good enough. Calendar push notifications (watch channels) for real-time sync are a v2 improvement.

---

## 9. The Mac daemon (4–9am, retry, idempotency)

A Node/TypeScript process started by `launchd`. Its morning logic:

```
wake (4,5,6,7,8am  +  on login/unlock)
  └─ inside 4–9am window?  ── no ──▶ exit
        │ yes
        ▼
  for each job (newsDigest, dailyPlan):
     read jobRuns/{today}.<job>
        ├─ status == success ──▶ skip   (idempotency: don't redo)
        └─ otherwise:
             call Claude (via packages/core)
                ├─ success ──▶ write results + mark success
                └─ failure:
                     ├─ before 9am ──▶ exit; next hourly wake retries
                     └─ after  9am ──▶ mark failed (dashboard falls back)
  write daemonHeartbeat
```

**Idempotency** is the marker check at the top: a job that already succeeded today is skipped, so waking five times never regenerates the digest five times — only genuinely failed/pending jobs re-run. **The 9am ceiling** is a hard stop, not a guarantee of success.

**Waking the Mac.** Use `launchd` with `StartCalendarInterval` entries for 4, 5, 6, 7, 8am, plus `RunAtLoad`. Because a closed-lid Mac may not honor a scheduled wake, *also* trigger the daemon on login/unlock, and pair the schedule with `pmset repeat wake` to request hardware wakes. Belt and suspenders: scheduled wakes plus an on-wake trigger means the job gets its shot as long as the user touches the machine before 9am.

Example `launchd` agent (`~/Library/LaunchAgents/com.orbit.daemon.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.orbit.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/USER/orbit/daemon/dist/index.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/Users/USER/orbit/daemon/daemon.log</string>
  <key>StandardErrorPath</key><string>/Users/USER/orbit/daemon/daemon.err.log</string>
</dict></plist>
```

The daemon logs locally and writes `daemonHeartbeat` to Firestore so the dashboard can surface "last successful run."

---

## 10. Cloud Functions

All 2nd-gen, Node 20, TypeScript, importing `packages/core`.

- `scanReminders` — scheduled every few minutes; delivers due reminders (Section 7.2).
- `morningBundle` — scheduled ~7am; builds the day's digest reminder.
- `onEventConfirmed` — Firestore trigger; generates reminders for newly confirmed events.
- `approveProposal` — callable; on user approval, writes blocks to Google Calendar, creates synced `events`, generates reminders.
- `refreshCalendar` — scheduled; periodic pull of Google Calendar into the `events` mirror (v1 sync).

Keep functions thin: orchestration + persistence only. All reasoning is in `packages/core/jobs`.

---

## 11. Delivery layer

- **WhatsApp (Twilio):** approved WhatsApp Business sender; pre-registered message templates for anything sent outside a 24-hour session window. Twilio credentials in Secret Manager. Send via `core/delivery/whatsapp.ts`.
- **Web push (FCM):** service worker registered by the PWA; store device tokens in `users/{uid}.pushTokens`. Send via `core/delivery/push.ts`. Prune stale/expired tokens on send failure.

---

## 12. Auth, secrets & security (non-negotiable)

- The client **never** holds the Anthropic key and **never** calls Claude directly. All Claude calls are server-side or on the daemon.
- **Cloud secrets** (Anthropic key, Twilio creds, Google OAuth client secret, FCM config) live in **Google Secret Manager**, injected into functions at deploy.
- **Daemon secrets** live in the **macOS Keychain** or a **gitignored `.env`** — never committed.
- **Firestore rules** are user-scoped (Section 5). Server runtimes use the Admin SDK.
- **OAuth refresh tokens** are encrypted at rest and never client-readable.
- Add `.env`, service-account JSON, and any credential files to `.gitignore` in Phase 0, before any secret exists.

---

## 13. Environment & configuration

| Variable | Used by | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | functions, daemon | Secret Manager / Keychain |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | functions | Secret Manager |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | functions | Secret Manager |
| `FCM_*` / service-account | functions, dashboard (public config only) | Secret Manager / Firebase config |
| `FIREBASE_*` web config | dashboard | public (safe to ship) |
| Google service-account JSON | daemon | local file, gitignored |

Firebase *web* config is public by design; everything in the table above that is a secret is not. Keep the two clearly separated.

---

## 14. Build phases & acceptance criteria

Sequenced to honor the priority order: architecture first, UI second, cost third, speed last. Each phase ends when its acceptance criteria pass.

**Phase 0 — Foundations.** Monorepo (pnpm + Turborepo); `packages/core` skeleton (claude/firestore/jobs/types stubs); Firebase project; Firebase Auth (Google sign-in); the full data model; security rules; `.gitignore` for all secrets.
*Done when:* a signed-in user can read/write their own Firestore subtree and no one else's, and `core` builds and is importable by all three runtimes.

**Phase 1 — Dashboard MVP.** The intuitive UI: list/create/edit tasks and events, view today, all reading and writing Firestore live. PWA installable. (This is where priority #2 is earned — invest in the UX here.)
*Done when:* the user can run their day from the dashboard on desktop and mobile, fully on Firestore.

**Phase 2 — Shared Claude module + news digest on the daemon.** Flesh out `claude/client.ts`, the `newsDigest` job and its prompt; build the daemon with the 4–9am window, idempotency markers, and hourly retry; wire `launchd`. Dashboard shows today's digest with yesterday-fallback.
*Done when:* the digest generates locally in the morning, survives a simulated API failure via retry, never double-generates, and degrades gracefully when the Mac is off. (This phase proves the cost model.)

**Phase 3 — Reminders.** `scanReminders`, `morningBundle`, `onEventConfirmed`; Twilio WhatsApp + FCM web push; reminder generation from events.
*Done when:* a reminder reliably arrives on both channels at `fireAt`, with cloud delivery independent of the Mac.

**Phase 4 — Calendar blocking.** `planDay` job + prompt; overnight proposal write; dashboard approve/edit/reject; `approveProposal` writing to Google Calendar (tagged); reminders generated for approved blocks; `refreshCalendar` periodic pull.
*Done when:* overnight proposals appear, approval writes correctly-tagged blocks to the real calendar, and nothing is ever written without explicit approval.

**Phase 5 — Hardening & extensibility.** Logging/heartbeat surfacing, error states, token-cost dashboard, and the project-#2 onboarding guide (Section 15).
*Done when:* failure modes are visible in the dashboard and a second project could be added without touching the intelligence layer.

---

## 15. Extending to future projects

This is the whole point of the architecture. To add project #2:

1. Add new collections under `users/{uid}/…` (or use the `project` field on existing tasks/events).
2. Add new job definitions in `packages/core/src/jobs/` — pure functions reusing `claude/client.ts`.
3. Reuse the existing Firestore repositories and the delivery layer (WhatsApp/push) unchanged.
4. Add a new view to the dashboard.

Nothing in the intelligence layer is rebuilt. New surfaces and new data plug into the same core. If a future project ever needs to call Claude from a brand-new runtime, it imports `packages/core` the same way the daemon and functions do.

---

## 16. Cost model (rough)

- **Cloud compute / hosting:** reminder scans, triggers, and the periodic calendar pull are small and stay within Firebase's free tier for a single user. Firestore usage at single-user scale is negligible. Hosting is cheap.
- **Anthropic tokens** are the real cost, and they are deliberately concentrated in the 4–9am local window: roughly one news-digest call and one calendar-planning call per day, plus occasional ad-hoc calls. Choosing a cheaper model for routine summarization (Section 6) keeps the daily spend low; reserve the stronger model for planning.

Track actual usage from the `usage` returned by `runClaudeJob` and surface a simple monthly token total in the Phase 5 dashboard.

---

## 17. Open questions

These are genuinely undecided and should be settled with the product owner before or during the relevant phase:

- **News sources:** which exact RSS feeds / topics for the digest. (Needed for Phase 2.)
- **Dashboard rendering:** static export vs SSR (Firebase Hosting vs App Hosting) — depends on how dynamic the home view needs to be. (Decide in Phase 1.)
- **Multi-user timeline:** the data model is multi-tenant from day one, but when (if ever) other users are onboarded affects auth/onboarding polish.
- **Inbound WhatsApp quick-capture:** letting the user add a task by texting the bot is an attractive future feature; out of scope for v1 but the delivery layer should not preclude it.
- **Autonomous calendar writing:** revisit only after the propose-then-approve flow has earned trust.

---

*End of specification. Build in phase order; protect the `packages/core` boundary above all else.*
