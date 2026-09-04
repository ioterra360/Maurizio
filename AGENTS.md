# AGENTS.md

> Operating manual for AI coding agents working in this repository.
> If you are a human, the README and `docs/` are friendlier — start there.

---

## 1. What this project is

**Memika** (final brand name) is a calm, editorial spaced-repetition
mobile app. Three review rhythms in a fixed order: **Scan → Reinforcement →
Focus**. It runs on Expo SDK 54 + React Native 0.81 + TypeScript with Supabase
as the backend. Payments are **in-app purchases via RevenueCat** (decided
2026-07-25, confirmed 2026-08-25, built 2026-09-03; inert until the store
products and the keys exist). There is no marketing site and no web
checkout for Memika.

Owner and publisher: Maurizio Cocco (product; ditta individuale, Tresnuraghes;
Apple Individual + Play Personal developer accounts; support
memikaapp@gmail.com). Developer: Angelo Casula / Tailor App Studio
(implementation). See `docs/PRODUCT.md` for full domain context.

Freemium: tre piani **Free / Plus / Pro** (fasce fissate 2026-09-02,
RINOMINATE il 2026-09-04 sul listino di Maurizio: la fascia intermedia si
chiamava `pro` e l'alta `premium`, quindi in un documento precedente a quella
data "pro" significa l'INTERMEDIA). Free = 10 ricordi TOTALI, 1 cartella,
0 sezioni; Plus = ricordi illimitati, 5 cartelle, 3 sezioni;
Pro = tutto illimitato più le foto sui ricordi. I limiti sono applicati da
quattro trigger Postgres (`20260903100000_plans.sql`), non dal client.
Pagamenti: abbonamenti in-app via RevenueCat, paywall `app/paywall.tsx`. Vedi
`docs/PAYMENTS.md`.

**`profiles.plan` nasce `default 'pro'`, non `'free'`** (attivazione
2026-09-04, migrazione `20260903100000_plans.sql`). Google non ha approvato il
profilo pagamenti e Apple non ha il contratto per le app a pagamento: le
`EXPO_PUBLIC_REVENUECAT_*_KEY` sono vuote, `purchasesAvailable` è falso e chi
incontrasse un tetto non avrebbe via d'uscita dal client. Un tetto senza via
d'uscita è peggio di nessun tetto. Vale per tutti — anche per i tester che si
iscrivono DOPO il push, che il seed di due email non può raggiungere. I quattro
trigger restano accesi: cambia solo da quale fascia si parte. Da invertire con
una migrazione NUOVA quando le chiavi arrivano.

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
- **Folder identity is `folders.id`, and folders come from the TAXONOMY**
  (2026-09-02, migration 20260902130000): four macrocategories — Lingue,
  Materie, Lavoro, Interessi — with ~44 subcategories in
  `lib/folder-taxonomy.ts`, picked in `/choose-topic` ("Cosa vuoi
  ricordare?"). `unique(user_id, kind)` is GONE; duplicates are legal; the
  route is `/folder/[id]`; order/sort stores key by id. `folders.kind` is a
  LEGACY bridge column written via `legacyKindFor()` for pre-OTA clients —
  do not build new logic on it; it goes away with a future migration. The
  old 4-template constants (`FOLDER_TEMPLATES` in `lib/constants.ts`) now
  serve DEMO MODE ONLY. Nothing is auto-seeded: a user starts with ONE
  folder chosen at onboarding. Freemium gating is now server-side: three
  plans Free/Plus/Pro enforced by the triggers of
  `20260903100000_plans.sql` (free = 1 folder, plus = 5, pro unlimited),
  counting the user's **live** folders — the trash does not count, and the
  "trash → create → restore" loop is closed on the restore instead
  (`folders_enforce_plan_limit_on_restore`). The client mirrors the caps with
  `PLAN_LIMITS` in `lib/plan.ts`; `FOLDER_LIMIT_ENFORCED` and
  `FREE_FOLDER_LIMIT` were removed on 2026-09-03.
- **Demo accounts are: `angelo.casula@gmail.com` (user) and
  `memikaapp@gmail.com` (admin).** Admin role is granted ONLY by the
  `public.admin_emails` allowlist (seeded with `memikaapp@gmail.com`, migration
  20260825181500) inside the `handle_new_user()` trigger — never inferred from
  the email shape. To add an admin, insert into `admin_emails` via a migration.
- **`.env` is gitignored — including the un-suffixed form.** Never commit
  secrets. The PAT (`SUPABASE_ACCESS_TOKEN`) lives only there.
- **The `service_role` Supabase key has not been wired into this repo and
  must not be.** If you need server-side privileged ops, write an Edge Function
  and call it from the client. Account deletion is the one privileged op that
  exists today and it is a `security definer` RPC (`delete_own_account()`),
  not a client-side delete.
- **The `memory-photos` bucket is private and stays private.** Never set
  `public = true`, never call `getPublicUrl`: photos are read through signed
  URLs only. `lib/photos.ts` is the single Storage access point (tables stay
  in `lib/api.ts`). Never `delete from storage.objects` in SQL — it orphans
  the file and hides it from the API; file cleanup is `remove()` via the
  Storage API (`docs/DATA-MODEL.md` § Storage).
- **Release builds never run demo mode; store profiles carry the Supabase
  env.** `lib/demo-mode.ts` returns `demo: false` whenever `__DEV__` is false,
  so a `preview`/`production` build without `EXPO_PUBLIC_SUPABASE_URL` /
  `_ANON_KEY` in `eas.json` `build.<profile>.env` fails fast instead of
  shipping the seed accounts. Never add `EXPO_PUBLIC_DEMO_MODE=true` to a
  store profile; never make the demo branch reachable in release.
- **Every user-facing string goes through `lib/i18n`** (`useT()` in
  components, `t()` in non-React code, `tp()` for plurals). Italian catalog
  `lib/i18n/it.ts` is the key source; `en.ts` must carry every key (compile
  error otherwise). Never keep translated text in module-level constants —
  resolve at render/call time so the Settings language switch applies at
  once. No Italian literals in TSX (2026-08-27, Angelo: app in more languages).
- **Every caught error goes through `reportError(tag, err)`**
  (`lib/report-error.ts`); no bare `console.warn` in a `catch`. Never put
  personal data in the `extra` payload.
- **`profiles.plan`, `plan_until` e `rc_app_user_id` non entrano MAI nella
  grant di UPDATE per `authenticated`**
  (`20260825121500_lock_profiles_columns.sql`). L'unico scrittore è la Edge
  Function `revenuecat-sync`, che gira con il `service_role` iniettato dalla
  piattaforma. Un piano scrivibile dal client è un piano regalato. La stessa
  funzione non declassa a `free` una concessione di cortesia (`plan <> 'free'`
  + `plan_until is null` + `rc_app_user_id is null`): è così che il seed
  `pro` dei due tester sopravvive alla prima apertura dell'app.
- **I limiti si mappano per errcode, mai per il testo dell'errore.**
  `P0004` ricordi, `P0005` cartelle (creazione **e** ripristino dal cestino),
  `P0003` sezioni; `P0001` sono le guardie di integrità e NON è un limite di
  piano. Il solo posto che li conosce è `planLimitFromCode()` in
  `lib/plan.ts`. Un `msg.includes("limit")` si rompe alla prima traduzione —
  è già successo.
- **Il client rispecchia i limiti, non li decide.** `lib/plan.ts` esiste per
  disabilitare e spiegare prima del rifiuto; se diverge dai trigger, il bug è
  nel client. Ogni superficie che può ricevere un errcode di piano monta
  `PlanLimitDialog` — Add, Conoscenza, `/choose-topic`, `/folder/[id]`,
  Impostazioni cartella, Cestino: un toast "riprova" su un limite di piano è
  un bug, perché riprovare non può funzionare.

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
  plan.ts           PURE: plan limits, effectivePlan, canAdd*, errcode → limit. No React, no Supabase. Mirrors the DB triggers.
  purchases.ts      RevenueCat SDK behind `purchasesAvailable` (false in Expo Go, demo mode, or without keys).
  use-plan.ts       usePlan() + startPlanSync() — the glue between the auth store, the SDK and the edge function.
theme/              Design tokens mirroring tailwind.config.js for non-NW consumers.
supabase/           Versioned database (config.toml + migrations/) + functions/ (Deno edge functions, outside the app's tsconfig) + verify/ (read-only smoke SQL).
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
  Apple 3.1.1 / Play Payments policy — the old external-checkout screen was
  deleted on 2026-08-29 and replaced on 2026-09-03 by the in-app paywall
  `app/paywall.tsx` (RevenueCat). `docs/PAYMENTS.md` describes the model and
  the enforcement.
- **Auto-seeding folders at signup.** Replaced (2026-08-25) by the one-folder
  pick in `/choose-topic`. Do not reintroduce `seedDefaultFolders`.
- **Fake numbers in loading / error states.** Health, Today and the review
  screens show honest empty/error states (`ErrorCard`, `DeckErrorScreen`).
  No placeholder statistics, no "planning…" spinner that never resolves.
- **Server-side auth roles set from the client.** Roles come from the
  `handle_new_user` trigger, period.
- **Static light-only styling.** Light AND dark ship since 2026-09-02
  (`theme/theme-store.ts`, `theme/palettes.ts`; `userInterfaceStyle` is
  `automatic` from build 3). Never read `colors` from `@/theme/tokens` at
  module scope — call `useColors()` / `useThemeTokens()` inside the render.

## 7. When to ask a human

Don't ask if you can grep or read the docs. Do ask when:

- A task seems to contradict a hard rule above.
- You'd need to spend tokens / hit external paid APIs to proceed.
- Store listing text, pricing, or the legal pages under `docs/legal/` (they
  are the source of the public pages on GitHub Pages, repo ioterra360/memika-legal).
- You'd commit something that touches billing, payments, GDPR, or the deal
  terms with Maurizio.

## 8. Specific tool entrypoints

| Tool | Entry | Auth |
|---|---|---|
| GitHub | `gh ...` | Already logged in as `ioterra360`. |
| Supabase | `npx supabase ...` | Reads `SUPABASE_ACCESS_TOKEN` from `.env`. |
| Expo / EAS | `npm start` / `eas build --profile <p> -p <platform>` | Logged in as `ioterra`; project `@ioterra/memika` (`extra.eas.projectId` in `app.json`). Store profiles carry the Supabase env in `eas.json`. Agents do not run `eas build` / `eas submit` unless the task says so. |
| Sentry | `EXPO_PUBLIC_SENTRY_DSN` (env) + `@sentry/react-native/expo` plugin in `app.json` | No org yet — placeholders `memika` / `memika-app` on `https://de.sentry.io/`; `eas.json` preview/production carry an EMPTY `EXPO_PUBLIC_SENTRY_DSN` slot (Sentry stays off). Source-map upload needs `SENTRY_AUTH_TOKEN` as an EAS secret, or `SENTRY_DISABLE_AUTO_UPLOAD=true` in the profile env, otherwise the build fails. Order of operations: `docs/DEPLOY.md` § "Build 3" → Sentry checklist. |
| Pre-build sanity | `npx expo export --platform android --no-bytecode` then `hermesc -emit-binary` (recipe in `docs/TROUBLESHOOTING.md` § Hermes compile check); `npx expo config --type introspect --json` → `node scripts/native-config/check-introspect.cjs <file.json>`; `npx expo-doctor` (18/18) | Run before any EAS build after touching deps, `metro.config.js` or `app.json` plugins. ~1 min locally vs 20 min of failed native build. |
| Supabase Management API | `curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/taekvxxljtgzsjrlmumo/...` | PAT from `.env`. Read config (`/config/auth`), run SQL (`/database/query`). PATCH only what the task asks; hosted Auth values are recorded in `docs/DEPLOY.md`. |

End of AGENTS.md. Skipping any of section 2 is a fail — read the linked docs.
