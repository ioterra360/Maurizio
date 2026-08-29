# Payments

> Freemium + one Premium tier, sold as **in-app subscriptions through
> RevenueCat**. Decided 2026-07-25, confirmed 2026-08-25. This doc replaces the
> earlier Wix / web-checkout ("Spotify pattern") plan, which is dead: a store
> build that links out to an external checkout is rejected under Apple
> Guideline 3.1.1 and the Google Play Payments policy.

## Status (2026-08-25)

🚧 **Not implemented.** Nothing in the app talks to RevenueCat yet.

What exists today:

| Piece | State |
|---|---|
| `PREMIUM_ENABLED` in `lib/constants.ts` | `false` — kill-switch. The Premium row in Settings and the future RevenueCat paywall stay hidden until it flips. |
| (deleted 2026-08-29) | The old external-checkout screen `app/(app)/subscribe.tsx` and its catalog keys were removed before the first iOS build (Guideline 3.1.1 hygiene). The IAP paywall will be a new screen. |
| `FREE_FOLDER_LIMIT = 1` in `lib/constants.ts` | The freemium rule. Onboarding creates exactly one folder (`/choose-topic`); no create-folder affordance exists anywhere else. |
| `profiles` entitlement column | Does not exist yet (see "Data model" below). |
| Store prerequisites | Apple Developer (Individual) and Google Play (Personal) accounts opened 2026-08-25 under Maurizio Cocco. Paid Apps Agreement / merchant profile not yet completed. |

Do NOT build the paywall or wire RevenueCat until the owner says go. Do build
everything else so that it does not get in the way (this doc says how).

## The model

**Free** (default for every account):

- Exactly **one folder** (topic). The user picks it at onboarding: one of the
  four templates (Giapponese / Medicina / Spagnolo / Diritto) or a custom name.
- Later: a **word quota** per day or per month (number and period NOT decided).
  Not implemented; nothing may block it.
- Everything else — the three review rhythms, Health, Settings — is free.

**Premium** (auto-renewing subscription, monthly and/or yearly — pricing TBD):

- **Unlimited folders.**
- No word quota (or a much higher one — decided together with the quota).
- No other feature is gated. Premium buys *breadth*, not the core loop.

When a free user tries to open or create a second folder, the app shows the
**subscription sheet** (the RevenueCat paywall). Until it exists, the affordance
simply does not exist: no "+" for folders, no "create folder" route.

Copy is Italian and honest: no fake "limited-time" claims, no invented user
counts, no benefits the app does not deliver. The current `BENEFITS` list in
The old paywall promised "Ricordi illimitati" and "Insight personalizzati" —
both must be re-checked against what Premium actually unlocks before reuse.

## Why RevenueCat (and not a webhook of our own)

- Apple and Google each need their own IAP integration (StoreKit 2 / Play
  Billing Library). RevenueCat wraps both behind one SDK (`react-native-purchases`)
  and one "entitlement" concept.
- Receipt validation, renewal, grace period, refund and cancellation events
  are handled server-side by RevenueCat — we never parse a receipt.
- Free tier up to $2.5k MTR; no fixed cost while the app is unadvertised.
- Their Expo docs cover SDK 54 with a config plugin (`react-native-purchases`
  needs a development build — Expo Go cannot run it).

The store cut (15 % with Apple's Small Business Program once enrolled, 15 % on
Play for the first $1 M/year, 30 % otherwise) is accepted. It is the price of being allowed in the store at all.

## Prerequisites (owner side — Maurizio)

Nothing here can be done from this repo.

**Apple**

1. Apple Developer Program (Individual) — opened 2026-08-25.
2. App Store Connect → Agreements, Tax, and Banking → **Paid Apps Agreement**
   accepted.
3. Tax forms: as a non-US person, **W-8BEN** (individual). Italian tax
   residency; no US TIN needed.
4. Banking: an IBAN under Maurizio's name (the ditta individuale is not a
   separate legal person).
5. Create the subscription group + products in App Store Connect
   (e.g. `memika_premium_monthly`, `memika_premium_yearly`) with Italian
   localized names and descriptions, and a **sandbox tester** Apple ID.
6. Generate the **In-App Purchase Key** (App Store Connect → Users and Access →
   Integrations → In-App Purchase) for RevenueCat's server-to-server
   validation, and the **App Store Server Notifications** URL from RevenueCat
   pasted into App Store Connect.

**Google Play**

1. Google Play Console (Personal) — opened 2026-08-25.
2. Play Console → Setup → **Payments profile** (merchant account) — required
   before any in-app product can be created. Personal accounts must also pass
   the **12 testers × 14 days closed test** before production access (see
   `docs/DEPLOY.md`).
3. Create the subscription + base plans (monthly / yearly) under
   Monetize → Products → Subscriptions, Italian listing.
4. Google Cloud service account with the "Financial data" permission linked
   to the Play developer account, its JSON key pasted into RevenueCat.
5. Add Angelo and Maurizio as **license testers** (Play Console → Setup →
   License testing) so test purchases are free.

**RevenueCat**

1. Account under memikaapp@gmail.com, project "Memika", one app per platform
   (`studio.tailor.memika` both).
2. One **entitlement**: `premium`. One **offering** ("default") with the two
   packages (`$rc_monthly`, `$rc_annual`).
3. Public SDK keys per platform → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in `eas.json` `env` (they are public,
   same category as the Supabase anon key).
4. Webhook → Supabase Edge Function (see below); the webhook **authorization
   header** value is a secret stored only in the Edge Function's env.

## Data model (future migration)

Entitlement state lives on `profiles`, written only server-side:

```sql
-- future migration, not written yet
alter table public.profiles
  add column premium_until timestamptz,          -- null = free
  add column rc_app_user_id text;                 -- RevenueCat app user id (= auth.users.id)
-- authenticated may SELECT these columns; UPDATE is NOT granted
-- (20260825121500_lock_profiles_columns.sql grants update on an explicit
-- column list — the new columns must not be added to it).
```

`premium_until > now()` is the single source of truth for "is Premium". A
column rather than a `subscriptions` table because the app only needs a
boolean-with-expiry; RevenueCat keeps the full history. If we ever need the
history locally, add a table then.

The app user id passed to RevenueCat (`Purchases.logIn(userId)`) is the
Supabase `auth.users.id`, so the webhook can address the profile directly.

## Server-side enforcement plan

The client-side flag is UX, not security. Enforce in Postgres:

1. **Edge Function `revenuecat-webhook`** (service_role, never in the client —
   AGENTS.md hard rule): verifies the `Authorization` header, reads
   `event.type` (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`,
   `BILLING_ISSUE`, `PRODUCT_CHANGE`, …) and `event.app_user_id`, and upserts
   `profiles.premium_until = event.expiration_at_ms`. Idempotent: the same
   event id applied twice yields the same row.
2. **RLS / trigger on `folders` insert**: a `before insert` trigger (security
   definer) that raises `P0001 'folder_limit'` when the user has
   `premium_until` null/past and already owns `FREE_FOLDER_LIMIT` folders.
   `lib/api.ts createFolder` maps that code to the Italian "Serve Premium"
   message and opens the sheet. Belt and braces: the client never shows the
   affordance, the server never accepts the row.
3. **Word quota** (later): same shape — a counter query in a trigger on
   `memories` insert, period and number from a `profiles` column or a
   constant, decided with the owner.
4. **Restore purchases**: `Purchases.restorePurchases()` on the paywall and in
   Settings; the webhook `TRANSFER` event moves the entitlement to the new
   app user id.
5. **Account deletion** (`delete_own_account()` RPC, live): cascades the
   profile; RevenueCat keeps the store subscription record (the user cancels
   it in the store — `docs/legal/account-deletion.md` says so).

Client refresh: `CustomerInfo` from the RevenueCat SDK is the *fast path* for
the paywall UI; `profiles.premium_until` (fetched with the profile in
`auth-store`) is what gates folder creation. The two agree after the webhook
lands (seconds); until then the client trusts the SDK for the current session.

## What the client will need (when the owner says go)

- `npx expo install react-native-purchases` (+ `react-native-purchases-ui` if
  we use RevenueCat's hosted paywall templates). Development build required.
- `Purchases.configure({ apiKey, appUserID: user.id })` in `auth-store` after
  sign-in; `Purchases.logOut()` on sign-out. Demo mode branches before any
  SDK call.
- Build the paywall screen (new `app/(app)/subscribe.tsx`): offerings → package list → `purchasePackage`
  → on `entitlements.active.premium` navigate back with a toast. Handle
  `userCancelled`, `PURCHASE_NOT_ALLOWED`, `PAYMENT_PENDING` with Italian copy.
  Terms + Privacy links (`TERMS_URL`, `PRIVACY_URL`) are mandatory on an
  auto-renewing subscription screen (Apple 3.1.2), plus the price, period and
  "si rinnova automaticamente, disdici dalle impostazioni dello store" line.
- `PREMIUM_ENABLED` becomes `true` only in the commit that ships the rewritten
  screen. The Settings row and the second-folder sheet hang off the same flag.
- Sandbox purchase end-to-end on both stores is a release-checklist item
  (`docs/DEPLOY.md`).

## Tax / fiscal context (Italy)

Maurizio operates as a **ditta individuale** (forfettario regime). Apple and
Google act as merchant of record for in-app purchases: they collect VAT from
the buyer, keep their commission and pay out the net. Maurizio invoices /
records the payout, not each sale. The 40 % revenue share to Angelo (deal
terms, memory `[[memika-deal-terms]]`) is computed on the **net store payout**
unless the deal is renegotiated — flag this with Maurizio before the first
payout, because the previous Wix plan computed it on gross.

Above the forfettario ceiling (€85k/year) Maurizio must exit the regime and
incorporate; the store accounts (Individual / Personal) would then need to be
migrated to an organization — that is a store-side procedure, not a code
change.
