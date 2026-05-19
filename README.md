# Memora

> Spaced repetition app — calm, editorial. Your memory, well taken care of.

Memora helps you keep what you've already learned alive, in three rhythms:
**Scan → Reinforcement → Focus**. A few minutes a day. No streaks. No noise.

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
| Auth & DB | Supabase (Auth + Postgres + Storage + Edge Functions) |
| Payments | Wix Payments (web checkout, Spotify-style pattern) |
| Push | Expo Notifications |
| Monitoring | Sentry |

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

> Without a `.env` the app boots in **offline demo mode**: the two demo accounts
> from the login screen (`angelo.casula@gmail.com` user · `maurizio.cocco@memora.app` admin)
> work locally with any password. Set the Supabase env vars to switch to real auth.

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
  (admin)/home.tsx         Admin panel (Phase 4)

components/                Cross-screen UI primitives
  Mascot.tsx               Brand mascot image wrapper
  ScreenStub.tsx           Editorial header shell for Phase 1 stubs

lib/
  supabase.ts              Supabase client (auto-falls-back to demo mode)
  auth-store.ts            Zustand auth store (Supabase + offline demo)

theme/tokens.ts            Color / radius / layer tokens (mirrors Tailwind)
tailwind.config.js         Design system colors + type scale + radii
global.css                 NativeWind entry
```

## Design contract

Visual design lives in the **Editorial direction** mocked up in Claude Design.
See the chat transcript and HTML mockup bundled under `_design_drop/memora/` in
the repo root (one level up from this app) for source-of-truth visuals.

**Design system finalised**
- Font: Inter 400 / 500 / 600 / 700, tabular figures on numbers
- Palette: navy `#1A2C4F`, scan `#6DA8E5`, reinforcement `#9B8CE8`, focus `#1A2C4F`, active `#3EC07B`, fading `#F5A89C`, archived `#C5C3BE`
- Card radius 14px, hairline borders `rgba(26,44,79,0.08)`
- Monochrome 1.75px stroke icons (Lucide)
- Layer order **Scan → Reinforcement → Focus** (do not reorder)

## Roadmap

| Phase | Scope |
|---|---|
| ✅ 1 | Foundation — Expo + Supabase wiring, login with demo accounts, tab bar shell |
| 2 | User screens — onboarding, Today, Knowledge, folder details, Add, Health, Settings |
| 3 | Review engine — SRS algorithm, Scan / Reinforcement / Focus, Complete |
| 4 | Admin panel + Wix Payments + push + store builds |

## License

Proprietary. © Memora / Tailor App Studio. All rights reserved.
