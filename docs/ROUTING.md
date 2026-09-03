# Routing

> Expo Router 6 with typed routes. File-based, three groups, auth-gated.

## File map

```
app/
├── _layout.tsx                  ROOT — fonts, splash, auth hydrate, Stack screenOptions
├── index.tsx                    Smart redirect (login / today / admin)
├── add.tsx                      Aggiungi ricordo — root-level (modal su iOS, card su Android)
├── auth-callback.tsx            Landing dei link email NON di recovery (conferma signup) — root-level
├── choose-topic.tsx             Scegli il tuo argomento — crea l'UNICA cartella (root-level, vedi sotto)
├── folder-settings.tsx          Impostazioni cartella (`?kind=`) — push root-level sopra i tab
├── paywall.tsx                  Piani Free/Pro/Premium — root-level (foglio dal basso), fuori dai tab
│
├── (auth)/
│   ├── _layout.tsx              Redirects out if user already signed in
│   ├── login.tsx · signup.tsx · forgot-password.tsx · onboarding.tsx
│   └── reset-password.tsx       "Nuova password" — landing di memika://reset-password#… (vedi Deep links)
│
├── (app)/
│   ├── _layout.tsx              Tabs nav (backBehavior "history"). Auth gate.
│   ├── today.tsx · knowledge.tsx · health.tsx · settings.tsx
│   ├── folder/[id].tsx          Dettaglio cartella — tab nascosto (href: null)
│   ├── notifications.tsx        Notifiche (spec F3) — tab nascosto (href: null), push da Impostazioni
│
├── review/
│   ├── _layout.tsx              Stack, auth-gated
│   ├── scan.tsx · reinforcement.tsx · focus.tsx
│   ├── handoff.tsx              Interstitial automatico tra i livelli (flow)
│   └── complete.tsx             Recap di fine sessione (mascotte + esiti)
│
└── (admin)/
    ├── _layout.tsx              Redirects to user shell if not admin
    └── home.tsx · users.tsx · moderation.tsx · insights.tsx · more.tsx
```

## Route table

| Path | File | Who can reach it |
|---|---|---|
| `/` | `app/index.tsx` | Anyone — redirects immediately based on auth |
| `/add` | `app/add.tsx` | Signed-in users (gated da add-gate; 0 cartelle → redirect a `/choose-topic`) |
| `/choose-topic` | `app/choose-topic.tsx` | Signed-in users con 0 cartelle (≥1 → redirect a Today) |
| `/folder-settings?kind=` | `app/folder-settings.tsx` | Signed-in users |
| `/paywall` | `app/paywall.tsx` | Signed-in users — da Impostazioni, da `/folder/[id]` o da un limite di piano |
| `/(auth)/login` | `app/(auth)/login.tsx` | Only when signed out |
| `/(auth)/reset-password` | `app/(auth)/reset-password.tsx` | Chi apre il link di recovery (gate: `pendingPasswordReset`) |
| `/auth-callback` | `app/auth-callback.tsx` | Chi apre un link email di conferma (root-level, con o senza sessione) |
| `/(app)/today` | `app/(app)/today.tsx` | Signed-in users |
| `/(app)/knowledge` | `app/(app)/knowledge.tsx` | Signed-in users |
| `/(app)/health` | `app/(app)/health.tsx` | Signed-in users |
| `/(app)/settings` | `app/(app)/settings.tsx` | Signed-in users |
| `/(app)/notifications` | `app/(app)/notifications.tsx` | Signed-in users (riga visibile solo con `NOTIFICATIONS_ENABLED`) |
| `/(app)/folder/[id]` | `app/(app)/folder/[id].tsx` | Signed-in users |
| `/memory/[id]` | `app/memory/[id].tsx` | Signed-in users (destinazione del tocco su una notifica di primo ripasso; guardia auth propria, Task 7) |
| `/review/scan · reinforcement · focus · handoff · complete` | `app/review/*` | Signed-in users |
| `/(admin)/home` | `app/(admin)/home.tsx` | Signed-in admins |

## Onboarding → one folder

`signup` → `/(auth)/onboarding` (carousel) → `/choose-topic` → `/(app)/today`.
`choose-topic` lives in the ROOT stack, not in `(auth)`: the `(auth)` gate
redirects any signed-in user to Today, but the same screen must also be
reachable from `(app)` surfaces. Add redirects there when the user owns zero
folders; Knowledge's empty state links there; a user who already has ≥1
folder is bounced to Today on mount. No other route creates folders
(freemium = one folder; the Premium sheet comes with RevenueCat).

## Why three route groups

Groups (parentheses in the folder name) don't add a URL segment but DO add a
`_layout.tsx` boundary. Each layout gates auth at that boundary, so:

- A signed-out user hitting `/(app)/health` sees the redirect from
  `(app)/_layout.tsx` → `/(auth)/login`. They never render the protected tree.
- A regular user hitting `/(admin)/home` gets bounced to `/(app)/today`.
- A signed-in admin user hitting `/(auth)/login` gets bounced to
  `/(admin)/home`.

### Admin "Apri l'app come utente"

The admin shell has no consumer screens, so the (only) admin could never
see Today/Cartelle/Progressi/Impostazioni with his own account. The row
**Altro → Account → "Apri l'app come utente"** sets `viewAsUser` in
`lib/auth-store.ts` (memory-only, cleared on sign-out and on reload) and
replaces to `/(app)/today`. While the flag is set, `useAuthGate` and
`app/index.tsx` treat the admin like a regular user for the `(auth)` and
`(app)` surfaces, and `/choose-topic` lets him create a folder. The `(admin)`
surface never bounces an admin, so **Impostazioni → Informazioni → "Torna al
pannello admin"** just clears the flag and replaces to `/(admin)/home`.

The redirects compose at the layout boundary instead of being scattered across
every screen. Don't replicate them in individual screen files.

## Typed routes

`app.json` has `experiments.typedRoutes: true`. That means every `router.push`
/ `router.replace` / `<Link href=...>` gets autocomplete and type-checking
against the actual file tree. You should not need to ever string-build a path.

If you see a typed-route error, the underlying cause is almost always:
1. A typo in a file name (group folder names included).
2. A new screen you forgot to save in the editor.
3. The dev-server cache. Restart Metro.

## Deep links

The Expo `scheme` is `memika` (in `app.json`). Universal links / app links on
a custom domain comes later; today only the custom scheme (and Expo Go's
`exp://<lan-ip>:<port>/--/<path>`) works. The two auth links:

| Link | Sent by | Lands in |
|---|---|---|
| `memika://reset-password?code=…` | `resetPasswordForEmail(email, { redirectTo: Linking.createURL("reset-password") })` in `forgot-password.tsx` | `app/(auth)/reset-password.tsx` |
| `memika://auth-callback?code=…` | `signUp({ options.emailRedirectTo: Linking.createURL("auth-callback") })` in `signup.tsx` (only if email confirmation is ever re-enabled — hosted Auth has it OFF) | `app/auth-callback.tsx` |

Expired / already-used links arrive as
`memika://reset-password#error=access_denied&error_code=otp_expired` and are
shown as "Link non utilizzabile" with a "Richiedi un nuovo link" button.

### How the password-reset flow is wired

1. **Supabase PKCE flow** (`lib/supabase.ts`: `flowType: "pkce"`,
   `detectSessionInUrl: false`): the link carries a one-time `?code=` that
   only this device can exchange (the `code_verifier` was written to
   SecureStore by `resetPasswordForEmail`). `lib/auth-links.ts` (pure,
   vitest-covered) parses query + fragment out of any URL shape
   (`memika://`, `exp://…/--/`, `https://<custom-domain>/…` (future universal links)); implicit
   `#access_token=` links are still recognised but `applyAuthLink` refuses
   them (login-CSRF vector).
2. **`app/_layout.tsx`** reads `Linking.getInitialURL()` (cold start, BEFORE
   `hydrate()`, so the gate never renders without the flag) and
   `Linking.addEventListener("url")` (warm start) and hands the URL to
   `useAuthStore().receiveAuthLink(url)`. That stores the parsed link in
   `authLink`, raises `pendingPasswordReset` for recovery links and dedupes
   by fingerprint in AsyncStorage so Expo Go reloads (which re-deliver the
   initial URL) don't replay a consumed link.
3. **Gate** (`lib/auth-gate.tsx`): while `pendingPasswordReset` is set the
   `(auth)` surface renders even with a user, and `(app)`/`(admin)` redirect
   to `/(auth)/reset-password`. The root layout also `router.replace`s there
   whenever the flag turns on — unless `usePathname()` already says
   `/reset-password` (Expo Router navigates by PATH on its own, and a
   REPLACE onto the same route would mount a second instance and re-run the
   code exchange).
4. **`reset-password.tsx`** calls `applyAuthLink` (drops `authLink` from the
   store, then `exchangeCodeForSession(code)`), then `updateUser({ password })`
   via `updatePassword`, clears the flag with `endPasswordReset()` and
   replaces to `/`. "Annulla" signs out with `scope: "local"` — the recovery
   link IS a login and must not survive an abandoned reset, but the user's
   other devices stay signed in.
5. `PASSWORD_RECOVERY` in `onAuthStateChange` (emitted by
   `exchangeCodeForSession` for a recovery code) also raises the flag.
   The event → store decision table is `lib/auth-events.ts` (vitest):
   `INITIAL_SESSION(null)`, which auth-js emits for every new subscription,
   must NOT clear a queued link — it races the initial-URL handling on cold
   start.

Signing in from `login`, signing out, and an explicit `SIGNED_OUT` all clear
the flag so a stale one can never pin a user inside `(auth)`.

### DEV-only sign-out link

`exp://<lan-ip>:<port>/--/?dev-signout=<token>` (legacy alias `?reset=<token>`,
kept so existing QR codes still work) signs out once per distinct token so a
tester always lands on Login. `handleDevSignOutLink` in `app/_layout.tsx` is
compiled out of release builds (`__DEV__`); it only looks at the query string,
never at a `#fragment`, so it cannot collide with a real recovery link.

## Adding a new screen

1. Decide which group it belongs to. If it should be guarded by auth, it goes
   in `(app)` or `(admin)`.
2. Create the file: `app/(app)/folder.tsx`.
3. Add a `Tabs.Screen name="folder"` entry to `app/(app)/_layout.tsx` only if
   it's a top-level tab. Otherwise it's accessed via push/Link from another
   screen.
4. For typed-route autocomplete: save the file and let Metro re-emit.
5. Update this doc's route table.

## Adding a tab

The tab bar config lives in `app/(app)/_layout.tsx` as `<Tabs.Screen>` entries.
Order in the file = order on screen. Each entry needs:
- `name`: matches the route file's base name
- `title`: label under the icon
- `tabBarIcon`: Lucide icon, stroke 1.75, color from `({ color })`

The custom tab bar styling (height, background, border) is shared via
`screenOptions={{ tabBarStyle: ... }}` on the `<Tabs>` root.

## Modals / sheets

Phase 2 adds: Add to memory (full-screen modal), Delete account confirmation
(bottom sheet). Both will use Expo Router's `presentation: "modal"` /
`presentation: "transparentModal"` for the route, NOT a separate stack.

Pattern:

```tsx
<Stack.Screen
  name="add"
  options={{ presentation: "modal", headerShown: false }}
/>
```

## What we deliberately don't have

- **No `(public)` group** with a marketing landing inside the app. The only
  public web pages are the legal ones on GitHub Pages (ioterra360/memika-legal) (privacy / terms /
  account-deletion); there is no web checkout.
- **No nested tab navigators.** Memika is shallow — one tab bar, push from
  there. If you find yourself needing a sub-tab bar, refactor the screen instead.
- **No drawer.** The mockup uses a side panel for the screen-share demo only.
  Production app uses tabs + push.

- `app/memory/[id].tsx` — memory detail sheet (term, reading, meaning, example, dates, notes). Root stack, presented like `/add`. Opened by tapping a row in `/folder/[kind]` (2026-08-27).
