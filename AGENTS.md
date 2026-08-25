# AGENTS.md

> Operating manual for AI coding agents working in this repository.
> If you are a human, the README and `docs/` are friendlier — start there.

---

## 1. What this project is

**Memika** (final brand name) is a calm, editorial spaced-repetition
mobile app. Three review rhythms in a fixed order: **Scan → Reinforcement →
Focus**. It runs on Expo SDK 54 + React Native 0.81 + TypeScript with Supabase
as the backend. Payments will be **in-app purchases via RevenueCat** (not built yet — decided
2026-07-25, confirmed 2026-08-25). There is no marketing site and no web
checkout for Memika.

Owner and publisher: Maurizio Cocco (product; ditta individuale, Tresnuraghes;
Apple Individual + Play Personal developer accounts; support
memikaapp@gmail.com). Developer: Angelo Casula / Tailor App Studio
(implementation). See `docs/PRODUCT.md` for full domain context.

Freemium: a free account owns exactly ONE folder; Premium (RevenueCat, not
built) unlocks unlimited folders. `PREMIUM_ENABLED=false` in
`lib/constants.ts` keeps the old `app/(app)/subscribe.tsx` unreachable. See
`docs/PAYMENTS.md`.

## 2. Read these before touching code

Order matters — each step assumes the previous.

1. **`README.md`** — getting started, dev workflow.
2. **`docs/ARCHITECTURE.md`** — stack and layering at a glance.
3. **`docs/DATA-MODEL.md`** — Supabase schema, RLS, query patterns.
4. **`docs/DESIGN-SYSTEM.md`** — color, type, spacing rules. Non-negotiable.
5. **`docs/ROUTING.md`** — Expo Router file map and auth gating.
6. **`docs/ROADMAP.md`** — what phase we are in, what's next.
7. **`docs/CONTRIBUTING.md`** — branch/commit/PR conventions.
8. **The specific doc for what you're touching** (SRS / DEPLOY / etc.).

If the task involves UI, also read `_design_drop/memika/project/Memika App.html`
(it's a React/HTML mockup, not source — visual contract only).

## 3. Hard rules (do not break)

These exist because of past decisions documented elsewhere in `docs/`.

- **Expo SDK 54 only.** Don't blindly bump packages. Check
  https://docs.expo.dev/versions/v54.0.0/ for any API surface you touch.
  Reanimated is v4 with the worklets peer — its plugin is forwarded via
  `react-native-reanimated/plugin`.
- **TypeScript strict, no `any`.** If a third-party type is wrong, narrow with a
  cast at the boundary, never spread `any` through the codebase.
- **NativeWind classes for layout.** Inline `style` only for dynamic numeric
  values (animated heights, computed colors). Static styling goes in `className`.
- **Fonts are loaded at root.** Always use the literal family name (e.g.
  `fontFamily: "Inter_600SemiBold"`) — Tailwind's `font-bold` does not apply
  weight to RN text reliably.
- **Layer order is locked: Scan → Reinforcement → Focus.** Never reorder in
  copy, navigation, icons, or recommendation flow. This was a Phase-0 product
  decision and is in the design contract.
- **There are four folder TEMPLATES: Giapponese · Medicina · Spagnolo ·
  Diritto.** Their `kind` slugs are `jp`, `medicine`, `es`, `law` (database,
  unchanged); a user-named folder has kind `custom`. Nothing is auto-seeded:
  a user starts with **ONE folder chosen at onboarding** (`/choose-topic`,
  helpers in `lib/folder-templates.ts`). Freemium = one folder per free
  account; no create-folder affordance exists elsewhere until the Premium
  (RevenueCat) sheet lands. Demo mode still shows all four for UI review.
- **Demo accounts are: `angelo.casula@gmail.com` (user) and
  `maurizio.cocco@memika.app` (admin).** Role inferred from email: admin if it
  contains `admin` or ends with `@memika.app`. Server-side mirror of this logic
  lives in the `handle_new_user()` trigger — change in both places or neither.
- **`.env` is gitignored — including the un-suffixed form.** Never commit
  secrets. The PAT (`SUPABASE_ACCESS_TOKEN`) lives only there.
- **The `service_role` Supabase key has not been wired into this repo and
  must not be.** If you need server-side privileged ops, write an Edge Function
  and call it from the client. Account deletion is the one privileged op that
  exists today and it is a `security definer` RPC (`delete_own_account()`),
  not a client-side delete.
- **Release builds never run demo mode; store profiles carry the Supabase
  env.** `lib/demo-mode.ts` returns `demo: false` whenever `__DEV__` is false,
  so a `preview`/`production` build without `EXPO_PUBLIC_SUPABASE_URL` /
  `_ANON_KEY` in `eas.json` `build.<profile>.env` fails fast instead of
  shipping the seed accounts. Never add `EXPO_PUBLIC_DEMO_MODE=true` to a
  store profile; never make the demo branch reachable in release.
- **Every caught error goes through `reportError(tag, err)`**
  (`lib/report-error.ts`); no bare `console.warn` in a `catch`. Never put
  personal data in the `extra` payload.

## 4. Conventions you must follow

### Commits

Conventional Commits with a scope when relevant:

```
feat(today): add time-budget chip row
fix(login): handle empty email submission
chore(deps): bump expo-router to 6.0.24
refactor(srs): extract scheduler from review-store
docs(payments): describe the RevenueCat entitlement column
```

Trailer required when an AI agent authored or co-authored:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Pass the message via a HEREDOC so newlines survive shell escaping.

### Branches

Workflow chosen by the owner: **push directly to `main`**. Don't create
feature branches unless the task explicitly asks for a PR.

If you do create a branch: `feature/<area>-<short-desc>` or
`fix/<area>-<short-desc>`. No `develop` branch.

### File layout

```
app/                Expo Router routes (file-based). Groups: (auth) (app) (admin).
components/         Cross-screen primitives (Mascot, ScreenStub, …).
features/           Feature folders (review, folders, …) — add as needed in Phase 2+.
lib/
  api.ts            SINGLE point of Supabase access. Components import from here.
  mappers.ts        DB row → frontend model mappers (camelCase boundary).
  constants.ts      Domain constants (folder kinds, time budgets, etc.).
  supabase.ts       Supabase client + SecureStore adapter + demo-mode toggle.
  auth-store.ts     Zustand auth store with onAuthStateChange subscription.
  auth-gate.tsx     useAuthGate(surface) — single source of routing decisions.
  auth-errors.ts    Supabase-error → user-message mapping.
  auth-links.ts     Pure parser for memika://reset-password#… / auth-callback#… deep links.
  report-error.ts   reportError(tag, err, extra) — console.warn in dev, Sentry.captureException in release. Use it in every catch.
  network.ts        withRequestTimeout(fetch, ms) — the 15 s Supabase request timeout (no AbortSignal.timeout on Hermes).
theme/              Design tokens mirroring tailwind.config.js for non-NW consumers.
supabase/           Versioned database (config.toml + migrations/).
docs/               Architectural docs.
assets/brand/       Mascot, icon, logo — never inline base64 these.
_design_drop/       Source-of-truth visual mockup (HTML) — outside the app, do not import from it.
```

### TypeScript paths

`@/*` is mapped to repo root. Import using `@/lib/...` or `@/theme/tokens`,
not deep relative paths (`../../../lib/...`).

## 5. How to do common tasks

### Run the app

```bash
npm start                   # Metro + QR for Expo Go
npm run ios                 # also opens iOS simulator (macOS only)
npm run android             # also opens Android emulator
npm run lint                # tsc --noEmit
```

### Add a new screen

1. Drop a `.tsx` file in the appropriate `app/(group)/` directory.
2. Wrap with `<SafeAreaView edges={["top"]}>` if it owns the top of the screen.
3. Reuse `<ScreenStub>` for placeholders during Phase 2 stubbing.
4. Add it to `docs/ROUTING.md`.

### Talk to the database

NEVER import `@supabase/supabase-js` directly from a component. Always go
through `lib/api.ts`:

```ts
import { fetchDueMemories } from "@/lib/api";
const memories = await fetchDueMemories(userId);
```

The api module:
- Runs every read through a mapper in `lib/mappers.ts` so the rest of the
  app speaks camelCase
- Has an explicit demo-mode branch (returns mocks) so the UI works without
  a backend
- Is the single chokepoint for adding logging, retries, or caching later

### Modify the database schema

Never edit existing migrations. Always create a new one:

```bash
npx supabase migration new <descriptive_name>
# Edit the generated SQL file under supabase/migrations/
npx supabase db push
```

Then update `docs/DATA-MODEL.md` to reflect the new tables/columns.

### Run a one-off SQL query against the remote DB

```bash
# Read-only, via the Management API + PAT
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select count(*) from public.profiles"}' \
  https://api.supabase.com/v1/projects/taekvxxljtgzsjrlmumo/database/query
```

### Add a dependency

```bash
npx expo install <package>        # for anything that has Expo-managed native code
npm install <package> --legacy-peer-deps   # for pure JS deps (e.g. zustand, moti)
```

The `--legacy-peer-deps` flag is required because `lucide-react-native` over-declares
`react-dom` as a peer.

## 6. Anti-patterns we have already rejected

- **Web-style `<div>` + CSS inline.** The mockup uses these. RN does not.
- **`react-native-vector-icons`.** Use `lucide-react-native`. Same set as the
  mockup, no font registration step.
- **A monorepo / Nx setup.** Memika is one app. Premature.
- **Web checkout / external payment links.** Payments are in-app purchases via
  RevenueCat. A store build that links out to a web checkout is rejected under
  Apple 3.1.1 / Play Payments policy — `app/(app)/subscribe.tsx` is gated off by
  `PREMIUM_ENABLED` until the IAP paywall replaces it. `docs/PAYMENTS.md`
  describes the RevenueCat model and the enforcement plan.
- **Auto-seeding folders at signup.** Replaced (2026-08-25) by the one-folder
  pick in `/choose-topic`. Do not reintroduce `seedDefaultFolders`.
- **Fake numbers in loading / error states.** Health, Today and the review
  screens show honest empty/error states (`ErrorCard`, `DeckErrorScreen`).
  No placeholder statistics, no "planning…" spinner that never resolves.
- **Server-side auth roles set from the client.** Roles come from the
  `handle_new_user` trigger, period.
- **Light/dark mode toggle now.** The editorial design assumes light. Dark
  comes in a later phase if at all.

## 7. When to ask a human

Don't ask if you can grep or read the docs. Do ask when:

- A task seems to contradict a hard rule above.
- You'd need to spend tokens / hit external paid APIs to proceed.
- Store listing text, pricing, or the legal pages under `docs/legal/` (they
  are drafts for Maurizio to review and publish on memika.app).
- You'd commit something that touches billing, payments, GDPR, or the deal
  terms with Maurizio.

## 8. Specific tool entrypoints

| Tool | Entry | Auth |
|---|---|---|
| GitHub | `gh ...` | Already logged in as `ioterra360`. |
| Supabase | `npx supabase ...` | Reads `SUPABASE_ACCESS_TOKEN` from `.env`. |
| Expo / EAS | `npm start` / `eas build --profile <p> -p <platform>` | Logged in as `ioterra`; project `@ioterra/memika` (`extra.eas.projectId` in `app.json`). Store profiles carry the Supabase env in `eas.json`. Agents do not run `eas build` / `eas submit` unless the task says so. |
| Sentry | `EXPO_PUBLIC_SENTRY_DSN` (env) + `@sentry/react-native/expo` plugin in `app.json` | No org yet — placeholders `memika` / `memika-app` on `https://de.sentry.io/`. Source-map upload needs `SENTRY_AUTH_TOKEN` as an EAS secret, or `SENTRY_DISABLE_AUTO_UPLOAD=true` in the profile env, otherwise the build fails. `docs/DEPLOY.md` § Sentry. |
| Pre-build sanity | `npx expo export --platform android --no-bytecode` then `hermesc -emit-binary` (recipe in `docs/TROUBLESHOOTING.md` § Hermes compile check); `npx expo config --type introspect --json`; `npx expo-doctor` (18/18) | Run before any EAS build after touching deps, `metro.config.js` or `app.json` plugins. ~1 min locally vs 20 min of failed native build. |
| Supabase Management API | `curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/taekvxxljtgzsjrlmumo/...` | PAT from `.env`. Read config (`/config/auth`), run SQL (`/database/query`). PATCH only what the task asks; hosted Auth values are recorded in `docs/DEPLOY.md`. |

End of AGENTS.md. Skipping any of section 2 is a fail — read the linked docs.
