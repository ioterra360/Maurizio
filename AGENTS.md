# AGENTS.md

> Operating manual for AI coding agents working in this repository.
> If you are a human, the README and `docs/` are friendlier — start there.

---

## 1. What this project is

**Memora** (codename — final name TBD) is a calm, editorial spaced-repetition
mobile app. Three review rhythms in a fixed order: **Scan → Reinforcement →
Focus**. It runs on Expo SDK 54 + React Native 0.81 + TypeScript with Supabase
as the backend. Marketing site + payments live on Wix (Spotify-style pattern —
in-app signup, web checkout) and are NOT part of this repo.

Owner: Maurizio Cocco (product). Developer: Angelo Casula / Tailor App Studio
(implementation). See `docs/PRODUCT.md` for full domain context.

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

If the task involves UI, also read `_design_drop/memora/project/Memora App.html`
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
- **The four seed folders are: Japanese · Medicine · Spanish · Law.** Their
  `kind` slugs are `jp`, `medicine`, `es`, `law` (database) — these are the
  identifiers; UI labels can localize but slugs do not change.
- **Demo accounts are: `angelo.casula@gmail.com` (user) and
  `maurizio.cocco@memora.app` (admin).** Role inferred from email: admin if it
  contains `admin` or ends with `@memora.app`. Server-side mirror of this logic
  lives in the `handle_new_user()` trigger — change in both places or neither.
- **`.env` is gitignored — including the un-suffixed form.** Never commit
  secrets. The PAT (`SUPABASE_ACCESS_TOKEN`) lives only there.
- **The `service_role` Supabase key has not been wired into this repo and
  must not be.** If you need server-side privileged ops, write an Edge Function
  and call it from the client.

## 4. Conventions you must follow

### Commits

Conventional Commits with a scope when relevant:

```
feat(today): add time-budget chip row
fix(login): handle empty email submission
chore(deps): bump expo-router to 6.0.24
refactor(srs): extract scheduler from review-store
docs(architecture): document Wix payments flow
```

Trailer required when an AI agent authored or co-authored:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
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
lib/                Infrastructure (supabase client, stores, utilities).
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
- **A monorepo / Nx setup.** Memora is one app. Premature.
- **In-app payments (IAP).** Spotify pattern is locked in. See `docs/PAYMENTS.md`.
- **Server-side auth roles set from the client.** Roles come from the
  `handle_new_user` trigger, period.
- **Light/dark mode toggle now.** The editorial design assumes light. Dark
  comes in a later phase if at all.

## 7. When to ask a human

Don't ask if you can grep or read the docs. Do ask when:

- A task seems to contradict a hard rule above.
- You'd need to spend tokens / hit external paid APIs to proceed.
- The final product **name** is involved (currently codename Memora — see
  `docs/PRODUCT.md`).
- You'd commit something that touches billing, payments, GDPR, or the deal
  terms with Maurizio.

## 8. Specific tool entrypoints

| Tool | Entry | Auth |
|---|---|---|
| GitHub | `gh ...` | Already logged in as `ioterra360`. |
| Supabase | `npx supabase ...` | Reads `SUPABASE_ACCESS_TOKEN` from `.env`. |
| Expo | `npm start` / `npx expo ...` | EAS account not yet linked (Phase 4). |

End of AGENTS.md. Skipping any of section 2 is a fail — read the linked docs.
