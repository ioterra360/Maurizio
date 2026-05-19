# Design system

> The visual rules. Source of truth: `_design_drop/memora/project/Memora App.html`
> ("Editorial" direction). Where this doc and that HTML disagree, the HTML wins
> (and this doc gets updated).

## Direction

**Editorial calm.** Warm canvas, sparse layout, generous breathing room. The
app should feel like reading a Moleskine — not like using a productivity tool.

Three alternative directions were explored on Claude Design (Bento, Aurora,
Sumi). We picked Editorial. Don't borrow from the other three without an
explicit product decision.

## Palette

All colors live in `tailwind.config.js` and are mirrored in `theme/tokens.ts`.

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F5F3EF` | Page background — the "paper" |
| `warm-white` | `#FBF9F4` | Card-adjacent surfaces, sticky headers |
| `surface` | `#FFFFFF` | Card backgrounds, inputs |
| `navy` | `#1A2C4F` | Primary text, primary CTA, Focus layer |
| `mid-grey` | `#8A8A88` | Secondary text, captions, deactivated tabs |
| `hairline` | `rgba(26,44,79,0.08)` | Default 1px border between surfaces |
| `hairline-strong` | `rgba(26,44,79,0.16)` | Border that needs to read at a glance |

### Layer colors

These three colors **mean** something — they ARE the layer identity. Don't use
them for unrelated UI.

| Layer | Token | Hex | Used for |
|---|---|---|---|
| Scan | `scan` | `#6DA8E5` | Radar icon, Scan CTA, Scan progress dots |
| Reinforcement | `reinforcement` | `#9B8CE8` | Loop icon, Reinforcement CTA, hints |
| Focus | `focus` | `#1A2C4F` | Target icon, Focus CTA (same as navy by design) |

### Memory states

| State | Token | Hex | Used for |
|---|---|---|---|
| Active | `active` | `#3EC07B` | Healthy, recall is strong |
| Fading | `fading` | `#F5A89C` | Needs attention soon |
| Archived | `archived` | `#C5C3BE` | Set aside intentionally |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `danger` | `#B04A38` | Delete account, destructive copy |

## Typography

**Inter** — single font family, four weights:

| Weight | Family name (literal) | Use |
|---|---|---|
| 400 | `Inter_400Regular` | Body, captions |
| 500 | `Inter_500Medium` | Field values, mid-emphasis |
| 600 | `Inter_600SemiBold` | CTAs, field labels, demo card names |
| 700 | `Inter_700Bold` | Display titles, brand wordmark, ALL-CAPS micro labels |

### Type scale

Values calibrated from the HTML mockup. Use these instead of Tailwind defaults.

| Token | Size / line-height / tracking | Use |
|---|---|---|
| `xs-tight` | 10.5 / 14 / 0.16em | ALL-CAPS micro labels ("DEMO ACCOUNTS") |
| `micro` | 11 / 15 | Side panel, hints |
| `caption` | 12 / 16 | Secondary text under a value |
| `body` | 13.5 / 20 | Default body |
| `body-lg` | 14.5 / 22 | Card body, input value |
| `cta` | 16 / 22 / -0.01em | Primary CTA |
| `h2` | 19 / 24 / -0.02em | Section heads inside cards |
| `h1` | 30 / 33 / -0.03em | Screen titles ("Today", "Knowledge") |
| `display` | 44 / 48 / -0.035em | Onboarding wordmark only |

### Number style

All numerics use **tabular figures** (`fontVariantNumeric: "tabular-nums"` in
RN, `font-variant-numeric: tabular-nums` in web equivalents). This keeps
counters from jittering as values change. Critical on the Memory Health screen.

## Spacing

Base unit 4px. Layout uses Tailwind's default scale (1 = 4px, 2 = 8px, 4 = 16px).

Specific recurring values from the mockup:

- Card padding: `p-5` (20px) or `p-4` (16px) for tighter cards
- Card-to-card gap: `gap-2` (8px) or `gap-3` (12px)
- Screen-edge padding: `px-6` (24px) for headers, `px-4` (16px) for card stacks
- Header top padding: `pt-4` (16px) after the safe area

## Radii

| Token | Px | Use |
|---|---|---|
| `chip` | 10 | Chips, toggle buttons, type pills |
| `card` | 14 | Cards, inputs, primary CTA |
| `pill` | 999 | Profile avatar, tab indicator |

## Borders & shadows

- **Default border**: 1px `hairline` (`rgba(26,44,79,0.08)`). Use on every
  card. The visual rhythm of the editorial direction depends on these
  near-invisible separators.
- **Focused input border**: 1px `navy` (#1A2C4F). Mid-grey on blur.
- **Shadows** are restrained. The mockup uses:
  - `shadow-cta` — `0 6px 18px -8px rgba(26,44,79,0.4)` on the primary CTA
  - `shadow-card` — `0 14px 32px -16px rgba(26,44,79,0.22)` on coach bubbles
  - `shadow-toast` — `0 16px 40px -12px rgba(26,44,79,0.4)` on toasts

No drop shadow on default surfaces. Resist the temptation.

## Icons

Lucide via `lucide-react-native`. Defaults:

- Stroke width **1.75** (the mockup is consistent on this — not 1.5, not 2)
- Size **20-22** for tab bar, **16** for inline chips, **36** for hero check
- Color from the layer or state semantics, never an arbitrary hex

## Components — the eight that matter

These are the building blocks the screens are made of. Add new components in
`components/` only when something repeats three or more times.

1. **TabBar** — bottom nav. 4 tabs. Custom in Phase 1, may move to a styled
   wrapper around `expo-router/Tabs` later.
2. **ScreenStub** — editorial header + note card. Used during Phase 1 only.
   Delete when each screen has its real implementation.
3. **Mascot** — image wrapper. `size` prop in px.
4. **Coach bubble** — Phase 2. Mascot avatar + one sentence + dismiss × button.
5. **Time chip** — used on Today (5 / 15 / 30 / 1 hr). Two states: idle / selected.
6. **Layer card** — Scan / Reinforcement / Focus rows on Today. Color stripe
   on the left, icon, label, sub-line.
7. **Folder row** — Knowledge list item: dot, name, priority pill, retention
   bar inline.
8. **Recall button** — Forgot / Struggled / Remembered. Used in Focus review.

## Animation rules

- **Movement**: short (200-360 ms), eased (`cubic-bezier(0.34, 1.56, 0.64, 1)`
  for entrances with overshoot, default ease for opacity).
- **Onboarding mascot**: enters with a spring, then idle-bobs every 3.4 s.
  Pulse rings expand on a 2.6 s loop, staggered 0.9 s and 1.8 s.
- **Speech bubble**: fades up (8 → 0 px) over 320 ms. Replaces, never accumulates.
- **No springy bounces on every interaction.** Editorial calm. Touch feedback
  is `opacity: 0.85` on `Pressable`.

## Hard "do not" list

These are mistakes you'd otherwise default to. Don't.

- ❌ **No gradients in the user surface.** The mockup explicitly avoids them.
  Only the onboarding pulse rings use a subtle radial mascot-shadow.
- ❌ **No big drop shadows.** This isn't Material Design.
- ❌ **No emoji in body copy.** Mascot expressions are the only character work.
- ❌ **No more than three colors per screen** besides neutrals. Each screen
  has one or two "anchor" colors max (e.g. Today: navy + the recommended-flow
  layer color).
- ❌ **No light/dark toggle.** Editorial is a single mood. Dark mode is a
  later, separate, expensive decision.
- ❌ **No animated route transitions.** Expo Router default transitions are
  fine. We are not Material You.
