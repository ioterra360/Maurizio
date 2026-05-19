# Memora

> Spaced repetition app — calm, editorial. Your memory, well taken care of.

Memora helps you keep what you've already learned alive, in three rhythms:
**Scan → Reinforcement → Focus**. A few minutes a day. No streaks. No noise.

> **Naming note.** "Memora" is a working codename. The final consumer-facing
> name is not yet chosen. See [`docs/PRODUCT.md`](docs/PRODUCT.md).

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
| Auth & DB | Supabase — Auth + Postgres + Storage + Edge Functions |
| Payments | Wix Payments (web checkout, Spotify-style pattern) |
| Push | Expo Notifications (Phase 4) |
| Monitoring | Sentry (Phase 4) |

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
> `maurizio.cocco@memora.app` admin) work locally with any password. Set the
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
- [`docs/PAYMENTS.md`](docs/PAYMENTS.md) — Wix Payments flow, Spotify pattern
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase-by-phase scope and acceptance
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — branches, commits, code style
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — EAS Build, TestFlight, Play Internal
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common issues

## Project layout

```
app/                       Expo Router routes (file-based)
  _layout.tsx              Root: font loading + auth hydrate + splash gate
  index.tsx                Smart redirect (login / today / admin home)
  (auth)/login.tsx         Sign-in screen
  (app)/                   User shell with bottom tab bar
    today.tsx              Today's review (Phase 2)
    knowledge.tsx          Folders list (Phase 2)
    health.tsx             Memory health (Phase 2)
    settings.tsx           Settings + sign out
  (admin)/home.tsx         Admin panel home (Phase 4)

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
| 2 | User screens — onboarding, Today, Knowledge, folder details, Add, Health, Settings | Next |
| 3 | Review engine — SRS scheduler + Scan / Reinforcement / Focus + Complete | After Phase 2 |
| 4 | Admin panel + Wix Payments + push + store builds | After Phase 3 |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for acceptance criteria per phase.

## License

Proprietary. © Tailor App Studio. All rights reserved.
