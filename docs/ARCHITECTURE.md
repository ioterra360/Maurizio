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
| Backend | Supabase — Auth + Postgres (eu-central-1). Storage and Edge Functions not used yet |
| Payments | RevenueCat in-app subscriptions — not built, `PREMIUM_ENABLED=false` (see `PAYMENTS.md`) |
| Push | Expo Notifications for local reminders — not installed yet |
| Monitoring | Sentry `@sentry/react-native` ~7.2 — wired in `app/_layout.tsx` + `lib/report-error.ts`, active only in release builds with `EXPO_PUBLIC_SENTRY_DSN` |

## Project layout

```
memika-app/
├── app/                Expo Router routes — file-based, typed
│   ├── _layout.tsx     Root: fonts + splash + auth hydrate gate
│   ├── index.tsx       Smart redirect (login / today / admin)
│   ├── (auth)/         login, signup, forgot/reset-password, onboarding
│   ├── choose-topic.tsx  One-folder topic pick (freemium) after onboarding
│   ├── auth-callback.tsx Landing route for signup-confirmation deep links
│   ├── (app)/          User-side routes — Today, Knowledge, Health, Settings, review flow
│   └── (admin)/        Admin-side routes — guarded by role check
├── components/         Cross-screen primitives — Mascot, ScreenStub, …
├── features/           Feature folders (review, folders, …) — grows in Phase 2+
├── lib/
│   ├── api.ts          SINGLE point of Supabase access (mappers, demo branch)
│   ├── supabase.ts     Supabase JS client + SecureStore adapter + 15 s fetch timeout
│   ├── demo-mode.ts    resolveDemoMode() — release builds never run demo
│   ├── auth-store.ts   Zustand store: user + signIn/signOut/hydrate + auth deep links
│   ├── auth-links.ts   Parser for memika://reset-password / auth-callback links
│   ├── report-error.ts reportError(tag, err) → console.warn (dev) / Sentry (release)
│   └── network.ts      withRequestTimeout(fetch, ms)
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
├── metro.config.js     `withNativeWind(getSentryExpoConfig(__dirname))` — never add withSentryConfig on top
├── eas.json            Build profiles; preview/production carry the Supabase env
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

**Demo mode** (`lib/demo-mode.ts`): in dev, `EXPO_PUBLIC_DEMO_MODE=true` (or
missing Supabase env vars) makes the store accept the two seed emails locally
without hitting Supabase. **Release builds never run demo mode**: missing
credentials there are a build-configuration bug (`eas.json` `env`), the
client fails fast instead of shipping the seed accounts.

**Auth deep links**: `forgot-password` sends `redirectTo:
memika://reset-password`; the root layout feeds initial + runtime URLs through
`auth-store.receiveAuthLink`, which sets the session from the URL fragment
(implicit flow) and routes to `/(auth)/reset-password` while
`pendingPasswordReset` is true. Signup confirmation (currently OFF on the
hosted project) would land on `app/auth-callback.tsx`. See `docs/ROUTING.md`.

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

Two helper functions:
- `public.is_admin()` — `SECURITY DEFINER`, used by RLS policies to avoid
  recursive evaluation on the `profiles` table.
- `public.delete_own_account()` — `SECURITY DEFINER`, deletes the caller's
  `auth.users` row (cascade → profile, folders, memories, sessions). Called
  from Settings → "Elimina account" (Apple 5.1.1(v) / Play account deletion).

Column privileges on `profiles` (migration `20260825121500`): `authenticated`
can UPDATE only `name, daily_input_cap, calm_mode, weekly_digest,
morning_review_at, evening_review_at` — no insert/delete, `role` untouchable
from the client.

## Observability

- `Sentry.init` at module scope in `app/_layout.tsx`, enabled only when
  `!__DEV__` and `EXPO_PUBLIC_SENTRY_DSN` is set; `Sentry.wrap(RootLayout)` is
  the default export and a named `ErrorBoundary` (mascot + "Qualcosa è andato
  storto" + Riprova) is what Expo Router renders on a route crash.
- Every non-fatal `catch` calls `reportError("area/what", err)` from
  `lib/report-error.ts` — the only accepted way to log a caught error.
- `lib/network.ts` wraps the Supabase client's `fetch` with a 15 s timeout;
  timeouts surface as `RequestTimeoutError` and map to Italian copy.
- Error states are honest: `components/ErrorCard.tsx`, `DeckErrorScreen.tsx`,
  `review-store.deckError` — no fake numbers, no auto-advance on a failed load.

## What lives outside this repo

- **GitHub Pages (ioterra360/memika-legal)** — public pages hosting `/privacy`, `/terms` and
  `/account-deletion` (drafts in `docs/legal/`). No web checkout, no marketing
  landing inside the app.
- **RevenueCat** — subscription backend (to be created; `docs/PAYMENTS.md`).
- **Supabase project dashboard** — schema lives here in `supabase/migrations/`
  and is the source of truth; the dashboard is a viewer. Hosted Auth URL config
  is documented in `docs/DEPLOY.md`.
- **Apple App Store Connect + Google Play Console** — Maurizio's Individual /
  Personal developer accounts (opened 2026-08-25); listings not yet created.
- **Sentry org** — to be created in the EU region; `app.json` carries
  placeholder slugs until then.
- **`_design_drop/memika/`** — the visual mockup from Claude Design. Sits at
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
- **RevenueCat IAP over a web checkout** — an app that steers to an external
  checkout is rejected (Apple 3.1.1 / Play Payments policy). RevenueCat wraps
  StoreKit + Play Billing in one SDK and validates receipts server-side; the
  15–30 % store cut is the cost of being in the store at all. Details and the
  enforcement plan in `PAYMENTS.md`.

## Localisation (2026-08-27)

`lib/i18n/` is a dependency-free layer: `it.ts` is the key source (grouped by screen), `en.ts`, `fr.ts` and `es.ts` are typed against it so a missing key fails
`tsc`. Components call `useT()` (re-renders on language change); non-React
code calls `t()` / `tp()` at call time. Exported constants that carry text
expose getters so consumers keep reading plain strings. The locale store
follows the device (it/fr/es phones → that language, others → en) unless the user picks
one in Settings; the choice is persisted in AsyncStorage and hydrated before
auth in the root layout. No native module is involved, so translations ship
via EAS Update.
