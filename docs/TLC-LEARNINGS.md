# Learnings adopted from The Luxury Club mobile

> Memora is being built alongside an earlier, near-finished Expo+Supabase app
> in the same studio. TLC has battle-tested patterns we want to inherit
> instead of rediscovering. This doc captures what we took, what we adapted,
> and what we deliberately left behind.

Reference codebase: `C:\Users\Angelo\Desktop\IoTerra\Consulenze\The Luxury Club\theluxuryclub-mobile\` (read-only — not a dependency).

## Adopted as-is

- **Single-chokepoint API layer** (`lib/api.ts`). Components never import
  the Supabase client directly. Every read passes through a mapper, every
  write through a typed function. Adding logging / retry / cache later is
  one file. TLC's `src/lib/api.js` is the same idea.
- **DB-row → frontend-model mappers** (`lib/mappers.ts`). camelCase happens
  at the boundary, not at use sites. Numeric strings (Postgres `numeric`
  type) are parsed in the mapper, not the consumer.
- **Bootstrap timeout** in the root layout (`app/_layout.tsx`, 15 s). If
  hydrate or font load hangs on a dead network, we force-hydrate so the
  user doesn't sit on the splash forever. TLC arrived at this after a
  production incident — we get it free.
- **Auth state subscription** (`supabase.auth.onAuthStateChange`) wired in
  `lib/auth-store.ts`. Token revocations and `SIGNED_OUT` events from
  other devices clear local state instead of leaving a broken half-auth.
- **SecureStore-backed session storage**. The Supabase JWT lives in
  Keychain / Keystore, not plaintext AsyncStorage. Implementation in
  `lib/supabase.ts`. TLC pattern.
- **User-facing auth error mapping** (`lib/auth-errors.ts`). The raw
  Supabase SDK string never reaches the UI; it gets translated to a stable
  message we control.
- **Per-entity loading flags in stores** (planned, Phase 2). TLC uses
  `isLoading: { articles: bool, requests: bool, ... }` to avoid global
  loading spinners that flicker on every action.
- **EAS Build profiles** (`eas.json`) — development / preview / production.
  Demo-mode env var explicitly OFF on preview and production so a
  misconfigured build can't ship the offline-auth backdoor.

## Adapted

- **Stack split**: TLC uses 5 Zustand stores by domain (auth, data, admin,
  logistics, notifications). Memora starts smaller — currently just
  `auth-store`. We'll grow into more stores as Phase 2 features land, but
  the pattern (one store per domain, no kitchen-sink store) is identical.
- **Styling**: TLC uses React Native `StyleSheet`. Memora uses NativeWind
  v4 (Tailwind for RN). Same intent (centralized tokens), better
  ergonomics. We keep TLC's *taxonomy* (color tokens, spacing scale) but
  not its implementation.
- **Deep linking**: TLC has `lib/deepLinks.js` for `theluxuryclub://`
  scheme handling. Memora will need the same for email confirmation /
  password reset, scheme will be `memora://`. Deferred to Phase 4 (Wix
  Payments + push + builds).
- **Biometric login**: TLC uses `expo-local-authentication` +
  `expo-secure-store` for stored credentials. Useful UX, deferred until
  there's something worth biometrically protecting (i.e., after Phase 3
  has real memory content).

## Not adopted (and why)

- **Wix CRM webhook** (`supabase/functions/wix-webhook/`). TLC syncs with
  a Wix CRM table. Memora has a different Wix integration (Payments only,
  not CRM) — see `docs/PAYMENTS.md`.
- **Guest day** auth mode. TLC-specific feature (first of the month free
  preview). Memora won't have this.
- **Role-specific groups** beyond `(app)` and `(admin)`. TLC has
  `(client)` `(admin)` `(logistics)` with deep role logic. Memora is
  user / admin only.
- **JS over TS**. TLC is `.jsx`/`.js`. Memora is `.tsx`/`.ts` strict from
  day one. Worth the cost; catches the kind of bugs TLC found in prod.
- **Inline-styled components**. TLC has some heavyweight cards built with
  StyleSheet + inline overrides. Memora uses NativeWind classes for
  static styling per AGENTS.md.

## What Memora does that TLC doesn't (yet)

- **TypeScript strict** end-to-end.
- **NativeWind v4** with a typed token system in `tailwind.config.js` +
  `theme/tokens.ts`. TLC will probably migrate eventually.
- **Centralized auth-gate hook** (`useAuthGate(surface)`). TLC duplicates
  the redirect logic across multiple `_layout` files. Memora encodes it
  once.
- **Server-side admin allowlist** (Supabase `admin_emails` table). TLC
  infers role from a profile column the trigger sets at signup; Memora
  goes one step further and keeps the role-granting decision *out* of the
  signup path entirely.

## When the divergence becomes a problem

We may eventually want to share code between TLC and Memora — a shared
design-system package, common auth utilities, or a reusable `api`
template. When (if) that happens, the obvious extraction targets are:

- `lib/auth-errors.ts` → could become a shared package
- `lib/mappers.ts` row→model boilerplate → a code generator from Supabase
  types would beat hand-written mappers
- Onboarding mascot animation pattern (when built) → likely Memora-only

Not worth pre-extracting today. Documented so future-us doesn't redo the
analysis.
