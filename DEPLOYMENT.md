# Orbit — Deployment Details

## 🌐 Live website

**https://travel-like-ap.web.app**

Open it, sign in with Google, and you can run your day against Firestore. (Enable the Google
sign-in provider first — see "Remaining setup" below.)

---

## Firebase project

| | |
|---|---|
| Display name | **Personal** |
| Project ID | `travel-like-ap` |
| Project number | `12978131601` |
| Account | saathvikchoudhary@gmail.com |
| Plan | Blaze (pay-as-you-go) |
| Console | https://console.firebase.google.com/project/travel-like-ap/overview |

---

## What's deployed

### Hosting (the dashboard) ✅
- Next.js 14 static export → Firebase Hosting.
- Live at https://travel-like-ap.web.app (HTTP 200).

### Firestore ✅
- **Security rules** — user-scoped (`users/{uid}` only); clients can touch only their own subtree.
- **Indexes** — reminder-delivery scan (`status` + `fireAt`), plus two task views (`status` + `dueDate`, `status` + `priority`).
- Database: `(default)`, native mode, region **asia-south1**.

### Cloud Functions (2nd gen, Node 20) ✅
| Function | Region | Trigger |
|---|---|---|
| `scanReminders` | us-central1 | Scheduled, every 5 min — delivers due reminders (WhatsApp + push) |
| `morningBundle` | us-central1 | Scheduled, 7:00 daily — builds the morning digest reminder |
| `refreshCalendar` | us-central1 | Scheduled, every 15 min — mirrors Google Calendar into Firestore |
| `approveProposal` | us-central1 | Callable — writes approved focus blocks to Google Calendar |
| `onEventConfirmed` | asia-south1 | Firestore trigger — generates reminders when an event is confirmed |

> `onEventConfirmed` lives in `asia-south1` because a Firestore trigger must run in the database's
> region. The rest default to `us-central1`.

### Secrets (Google Secret Manager) ✅
Seven secrets are stored and bound to the functions' runtime service account
(`12978131601-compute@developer.gserviceaccount.com`): `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`. Values are **not** stored in this repo.

---

## ⚠️ Coexisting app on this project

This project already hosts a separate **travel/rides** app with six functions
(`bulkUpdateRides`, `cleanupData`, `dailyAnalyticsUpdate`, `getAnalytics`, `onRideStatusChange`,
`sendNotification`). The Orbit deploy **left those untouched** (deployed only Orbit's five functions
by name). Note the earlier Hosting deploy replaced whatever was previously served at
`travel-like-ap.web.app` — the prior version is still in Hosting's version history if you need to roll back.

---

## Remaining setup

1. **Enable Google sign-in** — Console → Authentication → Sign-in method → Google → Enable.
   The `travel-like-ap.web.app` domain is already authorized. Sign-in works immediately after.
2. **WhatsApp sender** — `TWILIO_WHATSAPP_FROM` is currently Twilio's **sandbox** number
   (`whatsapp:+14155238886`); recipients must join the sandbox. Replace it with your approved
   sender when you have one: `firebase functions:secrets:set TWILIO_WHATSAPP_FROM`.
3. **Google Calendar refresh token** — complete the OAuth consent flow once to obtain an offline
   refresh token, then store it (see `functions/src/calendarAuth.ts` — the single swap point).
4. **Mac daemon** (4–9am Claude jobs) — not a Firebase deploy; runs locally via launchd. Needs a
   service-account JSON + `ANTHROPIC_API_KEY` + your `ORBIT_USER_UID`. See `README.md` step 6.
5. **Seed your user profile** — create the `users/{uid}` doc (shape in `README.md`).

## 🔐 Rotate exposed credentials

The Anthropic key, Twilio auth token, and Google OAuth client secret were shared in chat during
setup and should be rotated:
- Anthropic: console.anthropic.com → API Keys → revoke + recreate.
- Twilio: Console → regenerate auth token.
- Google: Cloud Console → Credentials → reset the OAuth client secret.

After rotating, re-run the matching `firebase functions:secrets:set <NAME>` command and update local `.env`.

---

## Redeploying

```bash
# from repo root, using the arm64 Node CLI
firebase deploy --only firestore:rules,firestore:indexes --project travel-like-ap
firebase deploy --only hosting --project travel-like-ap        # rebuild: pnpm --filter @orbit/dashboard build
firebase deploy --only "functions:scanReminders,functions:morningBundle,functions:onEventConfirmed,functions:approveProposal,functions:refreshCalendar" --project travel-like-ap
```

> Deploy Orbit's functions **by name** so you never delete the coexisting travel/rides functions.
