# Architecture

> Stack, layering, data flow. The map for understanding how the pieces fit.

## Stack at a glance

| Layer | Tech |
|---|---|
| Client | Expo SDK 54 · React Native 0.81 · React 19 · TypeScript (strict) |
| Routing | Expo Router 6 (file-based, typed routes) |
| State | Zustand (one store per concern, no Redux) |
| Styling | NativeWind v4 (`className=...`) backed by Tailwind CSS 3 |
| Animations | Reanimated 4 (+ worklets) and Moti for declarative timing |
| Icons | `lucide-react-native` (1.75 stroke width by default) |
| Fonts | Inter 400/500/600/700 via `@expo-google-fonts/inter` |
| Local storage | `@react-native-async-storage/async-storage` + `expo-secure-store` |
| Backend | Supabase — Auth + Postgres + Storage + Edge Functions |
| Payments | Wix Payments (external — Spotify pattern, see `PAYMENTS.md`) |
| Push | Expo Notifications (Phase 4) |
| Monitoring | Sentry (Phase 4) |

## Project layout

```
memora-app/
├── app/                Expo Router routes — file-based, typed
│   ├── _layout.tsx     Root: fonts + splash + auth hydrate gate
│   ├── index.tsx       Smart redirect (login / today / admin)
│   ├── (auth)/         Unauthenticated routes — `login.tsx`
│   ├── (app)/          User-side routes — Today, Knowledge, Health, Settings
│   └── (admin)/        Admin-side routes — guarded by role check
├── components/         Cross-screen primitives — Mascot, ScreenStub, …
├── features/           Feature folders (review, folders, …) — grows in Phase 2+
├── lib/
│   ├── supabase.ts     Supabase JS client + demo-mode toggle
│   └── auth-store.ts   Zustand store: user + signIn/signOut/hydrate
├── theme/tokens.ts     Color/radius/layer tokens (mirrors tailwind.config.js)
├── tailwind.config.js  Full design token set as Tailwind theme
├── global.css          NativeWind entry — Tailwind base/components/utilities
├── supabase/           Versioned database
│   ├── config.toml     Local CLI config
│   └── migrations/     YYYYMMDDHHMMSS_*.sql files
├── assets/brand/       Mascot, icon, logo
├── docs/               This documentation
├── .env / .env.example Local secrets (gitignored)
├── app.json            Expo app config
├── babel.config.js     `babel-preset-expo` + nativewind/babel + reanimated/plugin
├── metro.config.js     `withNativeWind` wrapping default Expo config
└── tsconfig.json       Strict, `@/*` path alias to repo root
```

## Auth flow

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│  Login screen   │ →  │  auth-store      │ →  │  Supabase Auth       │
│  (email + pwd)  │    │  signIn()        │    │  signInWithPassword  │
└─────────────────┘    └──────────────────┘    └──────────────────────┘
                              │                          │
                              │                          ▼
                              │                  ┌──────────────────┐
                              │                  │  auth.users      │
                              │                  │  + trigger       │
                              │                  │  handle_new_user │
                              │                  └──────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌──────────────────┐
                       │ Zustand `user`   │ ←  │ profiles row     │
                       │ { email, name,   │    │ with role        │
                       │   role }         │    │ inferred from    │
                       └──────────────────┘    │ email shape      │
                              │                └──────────────────┘
                              ▼
                       ┌──────────────────┐
                       │ app/index.tsx    │
                       │ → /(app)/today   │
                       │   if user        │
                       │ → /(admin)/home  │
                       │   if admin       │
                       └──────────────────┘
```

**Demo mode**: when `EXPO_PUBLIC_DEMO_MODE=true` (or Supabase env vars are
missing), the store accepts the two seed emails locally without hitting
Supabase. Used for first visual test before real users exist. Flip to
`false` once you provision real auth.

## Data flow (user-facing)

```
┌─────────────┐  Zustand store   ┌──────────────────┐
│  Component  │ ─────────────→   │  feature store   │
└─────────────┘   read selector  │  (e.g. review)   │
       ▲                         └──────────────────┘
       │                                  │
       │ re-render on slice change        │ read/write
       │                                  ▼
       │                          ┌──────────────────┐
       │   Supabase realtime      │  Supabase client │
       └─── subscription ────────│  RLS-restricted  │
                                  └──────────────────┘
                                           │
                                           ▼
                                   Postgres (taekvxxljtgzsjrlmumo)
```

Stores own the *cache*. Components read selectors, never reach into Supabase
directly. This keeps RLS errors and network failures handled in one place per
feature.

## Routing model

See `docs/ROUTING.md` for the full file map. Three route groups, each with its
own `_layout.tsx` that gates on auth:

- `(auth)` — redirects to `/(app)/today` or `/(admin)/home` if a user is
  already signed in.
- `(app)` — redirects to `/(auth)/login` if no user, or to `/(admin)/home` if
  the user is an admin.
- `(admin)` — redirects to `/(app)/today` if the user is not an admin.

This keeps deep links safe: hitting any URL while signed out lands on login,
hitting an admin URL as a user lands on Today.

## Backend — Supabase

One project: `taekvxxljtgzsjrlmumo.supabase.co`.

Five tables, all RLS-enabled (see `docs/DATA-MODEL.md`):
- `profiles` (1:1 with `auth.users`)
- `folders`
- `memories`
- `review_sessions`
- `review_items`

Two triggers:
- `on_auth_user_created` — auto-creates a profile when someone signs up
- `*_set_updated_at` — touches `updated_at` on update

One helper function:
- `public.is_admin()` — `SECURITY DEFINER`, used by RLS policies to avoid
  recursive evaluation on the `profiles` table.

## What lives outside this repo

- **Wix site + Wix Payments** — Maurizio's account, managed via Wix dashboard.
- **Supabase project dashboard** — schema lives here in `supabase/migrations/`
  and is the source of truth; the dashboard is a viewer.
- **Apple App Store + Google Play listings** — created in Phase 4.
- **Sentry project** — created in Phase 4.
- **`_design_drop/memora/`** — the visual mockup from Claude Design. Sits at
  the repo root, ONE LEVEL UP from this app. It is reference material, not
  source — don't import from it.

## Why these choices

- **Expo over bare RN** — the SDK includes 80% of what we'd otherwise wire by
  hand (push, fonts, secure store, splash, EAS Build). Trade-off accepted:
  some libraries need a config plugin or a development build.
- **Supabase over Firebase** — Postgres + RLS lets us model the SRS schema
  properly. Firebase's NoSQL would be a fight on day one.
- **NativeWind over StyleSheet** — the visual contract is a Tailwind-ish web
  mockup. NativeWind lets us port the design tokens 1:1 without an interim
  translation layer.
- **Zustand over Redux/MobX/Recoil** — small surface, no boilerplate, plays
  nicely with React 19 selectors. We're a four-store app, not Reddit.
- **Wix Payments over Stripe** — Maurizio runs on Wix. Avoids dual-vendor
  reconciliation and lets him manage subs from the same dashboard as the site.
