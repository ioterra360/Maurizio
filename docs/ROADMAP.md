# Roadmap

> What we build, in what order, with what we accept as "done".

Honest framing: nothing here is a deadline. The schedule is hours-of-work
estimates done by Angelo solo, part-time. Slippage is expected — what is NOT
expected is scope drift.

---

## ✅ Phase 1 — Foundation (DONE)

**Goal:** an app that boots, lets you sign in, and routes to the right shell.

**Done when:**
- [x] Expo SDK 54 + TS project initialized with the right deps
- [x] NativeWind v4 wired with the editorial token set
- [x] Inter font loaded, Lucide icons available
- [x] Supabase client + auth-store with offline-demo fallback
- [x] Login screen functionally rendered, demo accounts work
- [x] Tab bar shell (Today / Knowledge / Health / Settings) renders
- [x] Admin route gate redirects correctly
- [x] Supabase schema (5 tables + RLS) migrated to remote
- [x] Repo on GitHub (`ioterra360/Maurizio`), `main` tracking
- [x] `docs/` foundation written

**Out of scope:** any real product feature. Phase 1 is plumbing.

---

## Phase 2 — User screens (NEXT)

**Goal:** every screen the user touches is implemented, with mock data, on
the editorial design. No backend wiring yet beyond auth.

**Scope:**
- Onboarding (mascot + speech bubbles + pulse rings + step dots + CTA gate)
- Today (time-budget chips, recommended-flow rows, Coach bubble, primary CTA)
- Knowledge (folder list with priority + retention bar inline, FAB +)
- Folder detail × 4 (Japanese / Medicine / Spanish / Law) with seed content
- Add to memory (folder pills + type chips dynamic per folder + textarea +
  toast + daily cap)
- Memory Health (ring chart, Stable / At-risk, cognitive load 3-zone bar,
  2×2 folder grid with H/M/L health chips)
- Settings — full version (profile + schedule + limits + notifications +
  danger zone with delete account confirmation)

**Done when:**
- Every screen renders fully on iOS + Android via Expo Go without warnings
- Each screen passes a manual run-through on a 6.1" phone (iPhone 14 size)
- The mascot coach appears on the five screens it's supposed to (Today,
  Knowledge, Health, Settings, Complete) and is dismissible per-screen
- The daily input cap counter increments on Save
- The folder count updates on Save
- TypeScript clean (`npm run lint` exits 0)

**Out of scope:** the SRS algorithm (Phase 3), real persistence beyond auth
(also Phase 3), admin panel (Phase 4).

**Estimate:** 2-3 weeks part-time.

---

## Phase 3 — Review engine

**Goal:** the SRS works end-to-end. Memories you save show up in the right
review layer at the right time, and recall outcomes update the schedule.

**Scope:**
- `features/srs/scheduler.ts` pure function (SM-2 adapted) with unit tests
- Persistence: hook Add → `memories` table, Settings → `profiles` table,
  default folders auto-seeded at signup (DB trigger or app-side)
- Scan screen — large term, two-button reveal pattern
- Reinforcement screen — three-state (pre → hint → answer) with Review-again
  / Continue buttons
- Focus screen — three-button recall (Forgot / Struggled / Remembered)
- Layer handoff screen between Scan→Reinforcement and Reinforcement→Focus
- Complete screen with session stats
- Recommended-flow CTA on Today runs Scan→Reinforcement→Focus sequence

**Done when:**
- A user can add a memory, see it appear in the due queue, review it, and see
  the schedule advance
- The scheduler module has tests for: first review, success, partial, forget,
  ease floor, long-absence resilience
- Review counters in `review_sessions` reflect reality
- A folder's `active / fading / archived` distribution is correct on the
  Health screen
- The Mascot coach on the Complete screen congratulates appropriately

**Out of scope:** push notifications (Phase 4), Wix billing gating (Phase 4),
admin tools (Phase 4).

**Estimate:** 1-2 weeks part-time.

---

## Phase 4 — Admin, payments, store builds

**Goal:** the app is ready to ship to TestFlight and Google Play Internal.

**Scope:**
- Mobile admin shell inside the iPhone frame (Home / Users / Moderation /
  Insights / More + sub-pages Content / Notifications / System Health /
  Team & Billing)
- Wix Payments integration: webhook handler as a Supabase Edge Function,
  `subscriptions` table, billing-gate UI when subscription is inactive
- Push notifications via Expo Notifications: morning + evening nudges,
  Calm Mode toggle disables badges, Weekly Digest schedules a Sunday push
- Sentry wired with source maps via EAS Build
- EAS Build profiles (`development`, `preview`, `production`) configured
- iOS TestFlight + Google Play Internal Testing tracks live, with at least
  Angelo + Maurizio as testers

**Done when:**
- A new user can sign up in the app, get redirected to Wix Payments, complete
  a test purchase, and come back to a usable app
- An admin (`maurizio.cocco@memora.app`) sees the admin shell on login and
  can view the user table
- Push notifications fire at the configured times
- The Sentry dashboard receives a deliberate test event from a TestFlight build
- Both stores have an internal-test build that installs cleanly

**Out of scope:** real production launch (Phase 5+).

**Estimate:** 2 weeks part-time.

---

## Beyond Phase 4

Open backlog, not committed:

- Localization (Italian first)
- iPad / tablet layout pass
- Dark mode pass (only if usage data demands it)
- AI-assisted memory generation (LLM extracting candidates from pasted text)
- Folder template marketplace (admin-curated decks for common exams)
- FSRS migration from SM-2 once we have months of recall data
- Cohort analytics on the admin Insights tab
- Apple Sign-In + Google Sign-In as auth options

## How phases relate to the deal with Maurizio

The deal terms (see memory: `[[memora-deal-terms]]`) include €490/month +
40% of revenue while Maurizio is on a forfettario VAT regime, then a 40%
equity stake when an SRL is incorporated. None of those terms gate the
phases above. The product engineering work and the legal/business work run
in parallel.

What does gate phases:
- **Phase 4 needs a Wix Payments live account** under Maurizio's P.IVA.
  Without it, we can't end-to-end test the subscription flow.
- **Phase 4 needs an Apple Developer account** under Maurizio (or Tailor) and
  a Google Play developer account. ~$100 + $25 one-time.
- **Phase 4 needs the real product name decided.** Bundle ID, app name in
  the stores, marketing assets all depend on this. See `docs/PRODUCT.md`.
