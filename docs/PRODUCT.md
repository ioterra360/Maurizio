# Product

> What we are building, for whom, and why.

## Codename

The app is referred to internally as **Memika**. This is a **codename** — the
final consumer-facing name has not been chosen yet (decision deferred until
shortly before soft-launch). When the real name is picked:

- `app.json` (name, slug, scheme, bundle ID)
- Login screen wordmark (`app/(auth)/login.tsx`)
- Onboarding speech bubbles (Phase 2)
- README + this file
- Marketing assets

…all need a coordinated rename. The GitHub repo (`ioterra360/Maurizio`) and the
local working directory can stay as they are — those are operational placeholders,
not consumer-facing.

## What it is

A spaced-repetition app for keeping what you have already learned alive. It does
not push you to study more — it watches over what you know and surfaces the right
thing at the right time.

Three rhythms, **always in this order**:

1. **Scan** — quick check, low cost. One-tap "Show me / Remember" pass.
2. **Reinforcement** — guided recall with a hint reveal, then full answer.
3. **Focus** — deep review with three-way recall (Forgot / Struggled / Remembered).

The order is a product decision and is locked. Do not reorder it.

## Who it is for

Self-learners building a long-term knowledge base in domains where things
**decay** if not revisited: language learners, medical students, law students,
people sitting professional exams.

At onboarding the user picks **one topic** (`/choose-topic`) — a template or
a custom name — and exactly one folder is created. Nothing is auto-seeded.

| Slug | Display (IT) | Item types (IT) |
|---|---|---|
| `jp` | Giapponese | Parola · Kanji · Grammatica · Frase |
| `medicine` | Medicina | Termine · Concetto · Farmaco · Nozione |
| `es` | Spagnolo | Parola · Verbo · Grammatica · Frase |
| `law` | Diritto | Dottrina · Caso · Norma · Termine |
| `custom` | *nome scelto dall'utente* | Termine · Concetto · Nozione · Frase |

Templates live in `lib/constants.ts` (`FOLDER_TEMPLATES`); the pick/validate
helpers in `lib/folder-templates.ts`. We do not edit user folders.

**Freemium:** a free account owns exactly ONE folder (`FREE_FOLDER_LIMIT`).
Opening/creating a second one will raise the Premium sheet once RevenueCat
in-app purchases land — until then there is simply no create-folder
affordance after onboarding. A daily/monthly word quota for free users comes
later (number/period undecided; not implemented, nothing blocks it).

## What it is NOT

- ❌ Not a course / curriculum. We do not teach. We protect existing learning.
- ❌ Not a flashcard import tool. We are not Anki. We design our own intake.
- ❌ Not gamified. No streaks, no XP, no leaderboards. Editorial calm.
- ❌ Not social. No sharing, follows, comments. Memika is a quiet place.
- ❌ Not free forever. Freemium (one folder) + Premium via in-app purchase.

## Value proposition

> "I won't push you to study more. I'll watch over what you've already learned."

This line, from the onboarding speech, is the north star. Every product decision
gets weighed against it. If a feature pushes the user to *do more*, it does not
belong. If it surfaces *what is fading*, it does.

## Mascot

Memika has a brand mascot (see `assets/brand/mascot.png`). It is not decorative
— it is the personality of the app. It appears as:

- The hero of onboarding (animated)
- Contextual coach bubbles on Today / Knowledge / Health / Settings / Complete
  (dismissible, single sentence, never a wall of text)

The mascot **never breaks character**. No corporate copy. Tone: gentle, succinct,
slightly Studio-Ghibli-via-Stripe. See `docs/DESIGN-SYSTEM.md` for visual specs.

## Subscription model

Freemium + one Premium tier, sold as **in-app purchases via RevenueCat**
(decided 2026-07-25, confirmed 2026-08-25). Pricing TBD. Not built yet —
`app/(app)/subscribe.tsx` is gated off by `PREMIUM_ENABLED=false`. The old
Wix/web-checkout plan in `docs/PAYMENTS.md` is stale and must not be
implemented (Apple 3.1.1 / Play Payments policy).

## Roadmap snapshot

See `docs/ROADMAP.md` for full phase-by-phase scope and acceptance criteria.
Short version:

- **Phase 1** ✅ — Foundation (login, tab bar shell, Supabase wiring)
- **Phase 2** — User screens (onboarding, Today, Knowledge, folders, Add, Health, Settings)
- **Phase 3** — Review engine (SRS algorithm + Scan/Reinforcement/Focus screens)
- **Phase 4** — Admin panel + Wix Payments + push + store builds

## Open questions

These are deferred decisions. Each one should be reopened only when a phase
forces an answer — don't pre-decide.

- The real product name
- Pricing tier(s) — single price vs. monthly/yearly toggle
- Whether AI-assisted memory generation belongs (mentioned in design but not
  scoped)
- Whether to localize to Italian at launch
- Whether to ship as universal (iPad/tablet) or phone-only initially
