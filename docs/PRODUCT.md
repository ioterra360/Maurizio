# Product

> What we are building, for whom, and why.

## Codename

The app is referred to internally as **Memora**. This is a **codename** — the
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

We pre-seed four folders to make onboarding fast:

| Slug | Display | Item types |
|---|---|---|
| `jp` | Japanese | Word · Kanji · Grammar · Phrase |
| `medicine` | Medicine | Term · Concept · Drug · Fact |
| `es` | Spanish | Word · Verb · Grammar · Phrase |
| `law` | Law | Doctrine · Case · Statute · Term |

Users can later create their own folders. The seed list is a starting point,
not a content commitment — we do not edit user folders.

## What it is NOT

- ❌ Not a course / curriculum. We do not teach. We protect existing learning.
- ❌ Not a flashcard import tool. We are not Anki. We design our own intake.
- ❌ Not gamified. No streaks, no XP, no leaderboards. Editorial calm.
- ❌ Not social. No sharing, follows, comments. Memora is a quiet place.
- ❌ Not free forever. Subscription model from day one (Wix Payments).

## Value proposition

> "I won't push you to study more. I'll watch over what you've already learned."

This line, from the onboarding speech, is the north star. Every product decision
gets weighed against it. If a feature pushes the user to *do more*, it does not
belong. If it surfaces *what is fading*, it does.

## Mascot

Memora has a brand mascot (see `assets/brand/mascot.png`). It is not decorative
— it is the personality of the app. It appears as:

- The hero of onboarding (animated)
- Contextual coach bubbles on Today / Knowledge / Health / Settings / Complete
  (dismissible, single sentence, never a wall of text)

The mascot **never breaks character**. No corporate copy. Tone: gentle, succinct,
slightly Studio-Ghibli-via-Stripe. See `docs/DESIGN-SYSTEM.md` for visual specs.

## Subscription model

Single tier at launch. Pricing TBD. Payment runs entirely on Wix Payments
(Maurizio's Italian P.IVA, then later Memora SRL). The app never embeds a
payment SDK — it asks the user to subscribe on the web, then a Wix webhook
flips a flag on the user's Supabase profile.

This is the Spotify pattern: avoids Apple/Google's 15-30% cut. See
`docs/PAYMENTS.md`.

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
