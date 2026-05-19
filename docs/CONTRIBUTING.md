# Contributing

> How we work on this codebase. Solo project today, but writing this down keeps
> our future selves and future contributors honest.

## Branching

**Push directly to `main`.** No `develop`, no feature branches by default.
This is a one-person project at the codebase level; review-via-PR overhead
buys us nothing today.

When to branch instead:
- Experimental work where you want to discard cleanly if it doesn't pan out
  → `experiment/<short-name>`
- A risky refactor that should be reviewable as a diff → `refactor/<area>`
- Anything you explicitly want a second pair of eyes on

Branches that get merged use `--no-ff` to preserve a merge commit. Branches
that get discarded just get deleted.

## Commits

Format: **Conventional Commits**. Scope when relevant.

```
<type>(<scope>): <imperative summary>

<body — optional, wrap at 72 chars, explain *why* not what>

<footer — trailers like Co-Authored-By>
```

Types we use:

| Type | When |
|---|---|
| `feat` | A user-visible change or new capability |
| `fix` | A bug fix |
| `refactor` | Code restructuring with no behavior change |
| `chore` | Tooling, deps, build, configuration |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance with no behavior change |
| `style` | Formatting, no code change |

Scopes are loose. Examples we've used: `today`, `login`, `db`, `srs`,
`design-system`.

### AI co-authorship

Every commit primarily written by an AI agent must have the trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

This isn't legal — it's bookkeeping. We want to be able to tell the difference
later.

### Examples

Good:
```
feat(today): wire time-budget chips to recommended-flow CTA

Tapping a chip caps the upcoming session at the chosen budget. The CTA's
label now reflects the cap ("Start 15 min review").

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Bad:
```
updated some stuff
fixed bug
WIP
```

## Pull requests

Only created when explicitly needed (see Branching). Template lives at
`.github/PULL_REQUEST_TEMPLATE.md`.

## Code style

Nothing custom; defaults of the toolchain:

- **TypeScript strict mode.** No `any` outside of typed third-party gaps.
- **Prettier** with `prettier-plugin-tailwindcss` will be added in Phase 2.
  For now, format on save in your editor matches.
- **Import order**: external → `@/` aliased → relative. Empty line between
  groups.
- **No default exports** for components — name them. Exception: route files
  in `app/` need a default export (Expo Router requirement).
- **No barrel index files.** Direct imports from the file that owns the type
  or component.

## Testing

Phase 1 has zero tests. Intentional — the surface is plumbing, the cost of
mocking Supabase/Expo for stub screens isn't worth it.

Tests become mandatory starting Phase 3 for the SRS scheduler. See
`docs/SRS.md`. Tooling: Vitest (because we want fast pure-TS tests for
scheduler logic), not Jest. UI tests (Maestro flows) come in Phase 4.

## Adding a dependency

Two paths depending on whether the dep has native code:

```bash
# Expo-managed (has a native module or config plugin)
npx expo install <package>

# Pure JS
npm install <package> --legacy-peer-deps
```

`--legacy-peer-deps` is required throughout the project because
`lucide-react-native` over-declares `react-dom` as a peer.

Before adding, ask:
- Is this in the design? (If not, sceptical.)
- Does Expo already provide it? (`expo-*` packages first.)
- Will it survive an Expo SDK bump? (Check the last release date.)
- Does it bring native code? (Adds maintenance burden.)

## Modifying the database

Schema changes go through migrations only.

```bash
npx supabase migration new <descriptive_name>
# Edit supabase/migrations/<timestamp>_<name>.sql
npx supabase db push
```

Never edit a migration that has already been applied to the remote. If you
need to fix one, write a new migration that corrects it.

Commit migration SQL + updated `docs/DATA-MODEL.md` in the same commit.

## Environment variables

- Anything the **client** needs: prefix with `EXPO_PUBLIC_*`. These end up in
  the bundle. Treat them as visible.
- Anything **server-side / CLI-only** (PATs, service-role keys, webhook
  secrets): plain name (e.g. `SUPABASE_ACCESS_TOKEN`). Never read these from
  the client app.
- `.env` is gitignored. `.env.example` documents the contract and IS
  committed.

If you add a new var: update `.env.example` AND mention it where it's consumed.

## Don't commit

Stuff that should never be in a commit:

- `node_modules/`
- `.env` (any form)
- `dist/`, `web-build/`, `.expo/`
- iOS / Android native project directories (`/ios`, `/android`) — we use
  managed workflow; if `expo prebuild` is ever run, the output is gitignored
- Anything > 1MB binary that isn't a design asset
- Real user data, even for testing
- Screenshots into the repo root (use `docs/screenshots/` if needed)
