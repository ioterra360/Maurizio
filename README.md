# Memika

> Spaced repetition app — calm, editorial. Your memory, well taken care of.

Memika helps you keep what you've already learned alive, in three rhythms:
**Scan → Reinforcement → Focus**. A few minutes a day. No streaks. No noise.

> **Publisher.** Memika is published by Maurizio Cocco (ditta individuale,
> Tresnuraghes, Italy — support: memikaapp@gmail.com) on Apple Developer
> (Individual) and Google Play (Personal) accounts opened 2026-08-25. Angelo
> Casula / Tailor App Studio builds it. See [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Stack

| Layer | Tech |
|---|---|
| Mobile app | Expo SDK 54 · React Native 0.81 · React 19 · TypeScript |
| Routing | Expo Router 6 (file-based, typed routes) |
| State | Zustand |
| Styling | NativeWind v4 (Tailwind CSS for RN) |
| Animations | Reanimated 4 + Moti |
| Icons | lucide-react-native |
| Fonts | Inter (400/500/600/700) via `@expo-google-fonts/inter` |
| Auth & DB | Supabase — Auth + Postgres (EU, Frankfurt) + Storage (private `memory-photos` bucket) + Edge Function `revenuecat-sync` |
| Payments | RevenueCat in-app subscriptions — three plans (free = 10 memories + 1 folder; plus; pro + photos), enforced by Postgres triggers; paywall `app/paywall.tsx` |
| Push | Expo Notifications (local reminders, not installed yet) |
| Monitoring | Sentry (`@sentry/react-native` ~7.2, wired; DSN / org placeholders to fill — see `docs/DEPLOY.md`) |

## Getting started

```bash
# Install deps
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env
# then edit .env with your Supabase Project URL + anon key
# (Supabase dashboard → Settings → API)

# Run the dev server
npm start
```

Open the QR code with **Expo Go** on iOS or Android.

> Without a `.env`, the app boots in **offline demo mode**: the two demo accounts
> from the login screen (`angelo.casula@gmail.com` user ·
> `memikaapp@gmail.com` admin) work locally with any password. Set the
> Supabase env vars to switch to real auth. You can also force demo mode with
> `EXPO_PUBLIC_DEMO_MODE=true` even when creds are present.

## Where to read next

- [`AGENTS.md`](AGENTS.md) — operating manual for AI agents working in this repo
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — what we're building, for whom, and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, layering, data flow
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — Supabase schema and RLS
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — colors, type, components
- [`docs/ROUTING.md`](docs/ROUTING.md) — Expo Router file map
- [`docs/SRS.md`](docs/SRS.md) — the spaced-repetition algorithm
- [`docs/PAYMENTS.md`](docs/PAYMENTS.md) — RevenueCat IAP model, freemium rules, enforcement plan
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase-by-phase scope and acceptance
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — branches, commits, code style
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — EAS Build, TestFlight, Play Internal
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common issues

## Project layout

```
app/                       Expo Router routes (file-based)
  _layout.tsx              Root: font loading + auth hydrate + splash gate
  index.tsx                Smart redirect (login / today / admin home)
  (auth)/                  login, signup, forgot-password, reset-password, onboarding
  choose-topic.tsx         One-folder topic pick after onboarding (freemium)
  auth-callback.tsx        Landing for signup-confirmation deep links
  (app)/                   User shell with bottom tab bar
    today.tsx              Today's review (Phase 2)
    knowledge.tsx          Folders list (Phase 2)
    health.tsx             Memory health (Phase 2)
    settings.tsx           Settings, legal links, sign out, delete account
  (admin)/home.tsx         Admin panel home

components/                Cross-screen UI primitives
lib/                       Supabase client, Zustand stores, infra
theme/tokens.ts            Color / radius / layer tokens (mirrors Tailwind)
tailwind.config.js         Design system colors + type scale + radii
global.css                 NativeWind entry
supabase/                  Versioned database (config + migrations)
docs/                      Architectural documentation
assets/brand/              Mascot, icon, logo
```

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation — Expo + Supabase wiring, login with demo accounts, tab bar shell, schema | ✅ Done |
| 2 | User screens — onboarding, Today, Knowledge, folder details, Add, Health, Settings | ✅ Done |
| 3 | Review engine — SRS scheduler + Scan / Reinforcement / Focus + Complete | ✅ Done (core loop, 2026-07-25) |
| 4 | Store readiness — accounts, legal, account deletion, password reset, Sentry, icons, EAS | 🚧 In progress (batch 1 + 2 done 2026-08-25; left: RevenueCat, Play closed test, App Review) |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for acceptance criteria per phase.

## License

Proprietary. © Tailor App Studio. All rights reserved.
