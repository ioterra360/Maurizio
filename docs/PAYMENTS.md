# Payments

> How the subscription flow works. Phase 4 deliverable, but the design is
> locked now so we don't have to redesign later.

## Status

🚧 **Not implemented yet.** Phase 4.

The app is intentionally payments-blind in Phases 1-3. Adding the gate later is
cheap. Designing the gate wrong now is expensive.

## The Spotify pattern, plain

> "You can sign up in the app. To use it past the free preview, subscribe on
> the web. Your subscription unlocks the app on every device."

That's it. No in-app purchase, no embedded checkout, no "Subscribe →" button
inside the app that opens a webview. Why:

- Avoids Apple's 15-30% in-app purchase cut
- Avoids Google Play's 15-30% cut
- Keeps the billing system on a single vendor (Wix), where Maurizio already
  runs his fiscal infrastructure
- Lets us issue refunds / change pricing without an app store review

The trade-off: mobile conversion is ~20-50% lower than IAP. We're accepting
that to keep margin and operational simplicity.

## What lives where

| Component | Where it runs | Owned by |
|---|---|---|
| Landing site + checkout | Wix (Maurizio's account) | Maurizio |
| Wix Payments | Wix gateway | Maurizio's P.IVA → SRL |
| User identity / Auth | Supabase Auth | This repo |
| Subscription state mirror | Supabase `subscriptions` table | This repo |
| Webhook listener (Wix → Supabase) | Supabase Edge Function | This repo |
| Billing-gate UI | Expo app | This repo |

## End-to-end flow

```
Phone                       Wix (browser)              Supabase
  │                              │                          │
  │ open app                     │                          │
  ├──────────────────────────────┼──────────────────────────►│
  │ signUp(email,password)       │                          │ create auth.users
  │ ← session                    │                          │ + trigger creates profile
  │                              │                          │
  │ check subscription           │                          │
  ├──────────────────────────────┼──────────────────────────►│
  │ ← subscription_active=false  │                          │
  │                              │                          │
  │ user taps                    │                          │
  │ "Already have access? Sign in.│                         │
  │  Otherwise visit our site to  │                         │
  │  subscribe."                  │                         │
  │                              │                          │
  │ user opens Wix in browser    │                          │
  │ ──────────────────────────►  │ subscribe page           │
  │                              │ ─► Wix Payments checkout │
  │                              │ user pays                │
  │                              │                          │
  │                              │ Wix fires webhook        │
  │                              │ ─────────────────────────►│ Edge Function:
  │                              │                          │ flip subscription_active
  │                              │                          │ for the matching email
  │                              │                          │
  │ user returns to app          │                          │
  │ ← subscription_active=true   │                          │
  ├──────────────────────────────┼──────────────────────────►│
  │ app unlocks                  │                          │
```

## App-store-rule compliance

We will be reviewed by Apple. Two rules to respect:

1. **No "subscribe" CTAs in the app** that hint at where to pay. Not even
   "Visit our website to subscribe." The Spotify ruling allows the *external*
   purchase but the app can't actively steer.
2. **Sign-in must exist** independently of subscription status — so users who
   already paid can authenticate. We already do this.

What we show when `subscription_active = false`:
- A calm screen saying "Your account doesn't have an active subscription right
  now." (No call-to-action, no link.)
- Sign out button.

The user knows how to get a subscription because they got to the app via
marketing on Wix. Apple won't let us tell them again.

## Webhook handler — design

Supabase Edge Function: `wix-subscription-webhook`. Endpoint:

```
POST https://taekvxxljtgzsjrlmumo.supabase.co/functions/v1/wix-subscription-webhook
```

What it does:
1. Verify the request signature against `WIX_WEBHOOK_SIGNING_SECRET`
2. Parse Wix payload (subscription created / updated / cancelled / expired)
3. Look up `profiles.id` by the email on the order
4. Insert or upsert a row in `public.subscriptions` (Phase 4 table —
   `user_id`, `status`, `period_end`, `wix_subscription_id`)
5. Return 200 + an idempotency key in case Wix retries

What it does NOT do:
- Create users (the user must have signed up in the app first)
- Send emails (Resend handles that separately)
- Touch app payments anywhere — there is no in-app payment to reconcile

## Edge cases the design must handle

- **User subscribed but with a different email than they signed up with.**
  We require email match. If they don't match, the webhook records the
  subscription but doesn't unlock anything. Phase 4 admin tool: search by
  Wix subscription ID and manually link.
- **Trial / refund / chargeback.** Wix fires the corresponding webhook;
  Edge Function flips status.
- **Subscription period_end passed without renewal.** Edge Function fires
  a periodic check (Phase 4 cron) and marks expired.
- **The user revokes consent / asks to delete data (GDPR).** Cascade delete
  from `auth.users` removes profile + folders + memories. The Wix-side
  subscription record is retained per Italian fiscal law.

## Tax / fiscal context (Italy)

Important context Maurizio and Angelo both need to know:

- Maurizio's P.IVA is forfettario (5% then 15% sostitutiva on revenue, no IVA
  collection, no detrazione di costi).
- Wix Payments commissions (~2.9% + €0.30) are operational costs — under
  forfettario they don't reduce his taxable base, but they do reduce his
  cash.
- The 40% revenue share to Angelo (per the deal) is calculated on **gross
  Wix Total Sales** — the lordo, before any commission. Documented in
  memory: `[[memora-deal-terms]]`.
- Above €85k/year Maurizio must exit forfettario and incorporate Memora SRL.
  Trigger documented in `[[memora-deal-terms]]`.

This doc captures product engineering only — see the memory file for full
business terms.
