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

> **Status 2026-07-25:** sostanzialmente consegnata dal ciclo "core loop"
> (spec + piano in `docs/superpowers/`): Add persiste su `memories`, i mazzi
> arrivano da `fetchDueMemoriesByLayer` col budget-tempo, il flusso fluido
> Scan→Reinforcement→Focus è automatico, il recap e Progressi usano dati
> veri, le cartelle hanno stats/pausa/eliminazione. Fuori dal ciclo:
> nudge "long absence", notifiche (Fase 4).

**Goal:** the SRS works end-to-end. Memories you save show up in the right
review layer at the right time, and recall outcomes update the schedule.

**Scope:**
- `features/srs/scheduler.ts` pure function (SM-2 adapted) with unit tests
- Persistence: hook Add → `memories` table, Settings → `profiles` table,
  ~~default folders auto-seeded at signup~~ → replaced (2026-08-25) by the
  one-folder topic pick at onboarding (`/choose-topic`)
- Scan screen — large term, two-button reveal pattern
- Reinforcement screen — three-state (pre → hint → answer) with Review-again
  / Continue buttons
- Focus screen — three-button recall (Forgot / Struggled / Remembered);
  reduced to two on 2026-08-29 (Struggled removed, binary answers)
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

**Out of scope:** push notifications (Phase 4), Premium gating (Phase 4),
admin tools (Phase 4).

**Estimate:** 1-2 weeks part-time.

---

## Phase 4 — Store readiness, Premium, store builds (IN PROGRESS)

> **Status 2026-08-25.** Maurizio opened the Apple Developer (Individual) and
> Google Play (Personal) accounts today. The app will be published
> unadvertised and tested live, so everything App Review / Play review checks
> must be real. Two batches landed on `main` today:
>
> **Batch 1** — `7ec6467` EAS project `@ioterra/memika`, remote versioning,
> Supabase env in the `preview`/`production` profiles; `713093a` `.npmrc`
> legacy-peer-deps for `npm ci` on EAS; `d014aff` supabase-js 2.106.2 (2.106.0
> broke the Hermes release bundle); `lib/demo-mode.ts` (release builds never run
> demo); migration `20260825121500` column grants on `profiles`;
> `PREMIUM_ENABLED=false` kill-switch.
>
> **Batch 2** — `1a8cecb` Italian legal drafts (`docs/legal/` privacy, terms,
> account-deletion, md + html); `a7394bd` + `862d017` real icon / adaptive icon
> / splash / store icons; `4ef680f` `delete_own_account()` RPC (migrations
> `20260825152550`, `20260825153500`); `886a3d7` one-folder topic pick at
> onboarding (`/choose-topic`, templates localized, no auto-seed, no silent
> no-op without folders); `8184f5b` Settings → Elimina account with live
> counts; `394f4e9` password reset end-to-end via `memika://reset-password` +
> hosted Auth URL config (site_url ioterra360.github.io/memika-legal, allow-list, autoconfirm on,
> min password 8); `9565d3f` legal links + consent line, honest copy, real
> version row, admin "view as user"; `9ab550f` Sentry ~7.2 + error boundary +
> 15 s network timeout + honest error states; this docs sync.

**Goal:** the app passes App Review and Play review as a real product, then
gets Premium.

**Scope (done):**
- [x] Store developer accounts (Apple Individual, Play Personal — Maurizio)
- [x] EAS Build profiles (`development`, `preview`, `production`) with remote
      versioning and the Supabase env in the store profiles
- [x] Release builds can never fall into demo mode
- [x] Privacy / terms / account-deletion pages drafted in Italian
      (`docs/legal/`), legal constants in `lib/constants.ts`, consent line on
      signup, links in Settings
- [x] In-app account deletion (Apple 5.1.1(v), Play) — RPC + Settings flow
- [x] Password reset that actually works on a device (deep link + hosted Auth
      URL configuration)
- [x] One-folder freemium onboarding; the four-folder auto-seed is gone
- [x] Sentry wired (init, error boundary, `reportError`), honest error states
- [x] Real icon / adaptive icon / splash; store icons in `docs/store-assets/`
- [x] Admin can open the app as a user (`viewAsUser`) for review-style testing
- [x] Mobile admin shell (Home / Users / Moderation / Insights / More) — built
      in the earlier admin pass, unchanged today

**Scope (left):**
- [ ] **RevenueCat Premium** — `react-native-purchases`, rewrite
      `app/(app)/subscribe.tsx` as the IAP paywall, second-folder sheet,
      `profiles.premium_until` + webhook Edge Function + insert trigger, then
      flip `PREMIUM_ENABLED`. Owner prerequisites first (Paid Apps Agreement,
      W-8BEN, banking; Play payments profile). See `docs/PAYMENTS.md`.
- [ ] Free-tier **word quota** (number / period undecided — do not implement
      before the owner decides)
- [ ] **Play closed test**: Personal developer accounts must run a closed test
      with **at least 12 testers opted-in for 14 continuous days** before
      production access is granted — recruit testers (Angelo, Maurizio, friends)
      and start the clock as early as the first working build.
- [ ] **App Review** (iOS): TestFlight build, App Store Connect record (Italian
      listing, screenshots, privacy nutrition labels: email + user content,
      no tracking), review notes with a test account, demo of account
      deletion and password reset.
- [ ] Legal pages published on GitHub Pages (ioterra360/memika-legal) — DONE 2026-08-25; custom domain later (`/privacy`, `/terms`,
      `/account-deletion`) — Maurizio, from `docs/legal/*.html`
- [ ] Sentry org in the EU region: real slugs in `app.json`, DSN in
      `eas.json`, `SENTRY_AUTH_TOKEN` as an EAS secret (or
      `SENTRY_DISABLE_AUTO_UPLOAD=true` per profile until then — a build
      without either fails)
- [ ] Local notifications via `expo-notifications` — CODE READY (2026-09-03,
      plan `docs/superpowers/plans/2026-09-03-notifiche-locali.md`):
      first-review alert at T0+20h + one daily reminder. Inert until the
      build-3 native plan adds the config plugin and flips
      `NOTIFICATIONS_ENABLED`
- [ ] Custom SMTP (e.g. Resend on a future custom domain, or Gmail app password) + Italian auth email templates,
      then re-enable email confirmation — optional for launch, the built-in
      sender is capped at 2 emails/hour
- [ ] Remove the `exp://**` / `exp+memika://**` entries from the Supabase
      redirect allow-list before public marketing

**Done when:**
- A new user can sign up, pick a topic, add memories, review them, reset a
  forgotten password and delete the account — all from a store build, no
  demo data
- A free user cannot obtain a second folder; a Premium sandbox purchase on
  both stores unlocks it end-to-end
- An admin (`memikaapp@gmail.com`) sees the admin shell on login and
  can open the app as a user
- The Sentry dashboard receives a deliberate test event from a TestFlight /
  Play build with symbolicated stack traces
- Play closed test has 12 testers for 14 days; App Review has approved a build

**Out of scope:** marketing, public launch push (Phase 5+).

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

The deal terms (see memory: `[[memika-deal-terms]]`) include €490/month +
40% of revenue while Maurizio is on a forfettario VAT regime, then a 40%
equity stake when an SRL is incorporated. None of those terms gate the
phases above. The product engineering work and the legal/business work run
in parallel.

What does gate phases:
- **Premium needs the store payment prerequisites** under Maurizio: Apple
  Paid Apps Agreement + W-8BEN + banking, Play payments (merchant) profile,
  then a RevenueCat project. Without them there is nothing to sandbox-test.
- ~~Apple Developer + Google Play developer accounts~~ — opened 2026-08-25
  (Apple Individual, Play Personal, both under Maurizio Cocco).
- ~~The real product name~~ — **Memika**, decided 2026-05-22. Bundle ID /
  package stay `studio.tailor.memika`.
- **Play production access needs the 12 × 14-day closed test** — a calendar
  gate, not an engineering one. Start it with the first working build.
