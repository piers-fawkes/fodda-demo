# Brief — Website: Pricing Page Payment Flow & Modal Fixes

**Handoff to:** Website Agent (`fodda-website` / `www.fodda.ai`)
**Source:** Payment QA Report (2026-08-02), QA-verified against the live Airtable Plans table (base `appXUe…`, table `tblq2T5OUyrDFCda9`) on 2026-08-02.

> ⚠️ **The plan codes below are the authoritative values from the live Plans table.** An earlier draft of this brief used guessed plan codes (`plan=1/2/3`) that were all wrong — `plan=2` is the free plan, `plan=1` is an internal "Sandpit" test plan. Do **not** reintroduce those. When in doubt, the app exposes the source of truth at `GET https://app.fodda.ai/api/account/plans`.

## Context

A QA test of payment flows identified three issues on the public pricing page (`fodda.ai/pricing`):

1. **Monthly plan CTA buttons ($100, $1,500, $4,600) direct users to `app.fodda.ai` without initiating a plan checkout.** They redirect to `https://app.fodda.ai/` (or `/profile`) without the selected plan. The app auto-starts Stripe checkout on login **only if** the URL carries `?plan={planCode}` (optionally `&tier=` / `&price=`). Those params are what the app stores as `fodda.pendingPlanCode` and replays into `POST /api/account/checkout/subscribe`.

2. **The Lava Wallet popover is inescapable.** Clicking "Pay As You Go – Wallet Top Up Balance" opens a Lava Wallet flow that traps the user — the close ('x') and browser back do not dismiss it, forcing a hard refresh.

3. **"Setup Agent Wallet" on the Agent Pay-Per-Query card redirects to `/agents`** (an info page) instead of a payment/billing flow.

## Authoritative plan-code → price map (live Plans table)

| Price shown on pricing page | Plan name | **planCode** | billingMode | Has Stripe price? |
|---|---|---|---|---|
| **$100/mo** | Starter | **3** | subscription | ✅ |
| **$350/mo** (if shown) | Team | **4** | subscription | ✅ |
| **$1,500/mo** | Studio | **5** | subscription | ✅ |
| **$4,600/mo** | Business | **6** | subscription | ✅ |
| Pay-As-You-Go wallet | Pay As You Go | **12** | (Lava-hosted) | Lava link |
| Agent Pay-Per-Query | Agent Pay-Per-Query | **14** | n/a (no Stripe price yet) | ❌ |

Notes:
- `planCode` **1** = "Sandpit" ($0, internal), **2** = "Base – Free" ($0), **7** = "Top-Up – 200 API Calls" (one-time), **13** = "Trial". None of these are monthly subscription tiers — do not link the pricing CTAs to them.
- planCode **8** is **ambiguous in the data** (two records share it: "Enterprise" and "Lapsed from Free") — do **not** target `plan=8`.

## What to build

1. **Monthly Plan CTAs** — link each subscription button to `https://app.fodda.ai/?plan={planCode}&tier={tier}&price={price}`:
   - **$100 Starter:** `https://app.fodda.ai/?plan=3&tier=starter&price=100`
   - **$350 Team** (if the page shows it): `https://app.fodda.ai/?plan=4&tier=team&price=350`
   - **$1,500 Studio:** `https://app.fodda.ai/?plan=5&tier=studio&price=1500`
   - **$4,600 Business:** `https://app.fodda.ai/?plan=6&tier=business&price=4600`

   `tier`/`price` are cosmetic (used only for logging/labels); **`plan` is the value that drives checkout and must match the table above.** If a plan code has no Stripe price configured, checkout returns `400 "No Stripe price configured"` — verify each in `/api/account/plans` before shipping.

2. **Lava Wallet Modal Dismiss Handling** — add `onClose` handling to the Lava popover: close on the 'x' icon, on backdrop click, and on `Escape`, without a hard refresh. If the Lava flow is an embedded iframe, wrap it in a dismissible container the site controls.

3. **Agent / Pay-As-You-Go CTA** — the "Setup Agent Wallet" button currently lands on `/agents`. Route it to a real flow instead. Two options depending on product intent:
   - **Pay-As-You-Go wallet (Lava):** point to the Pay As You Go plan (`planCode 12`) checkout / Lava wallet link, **or**
   - **App billing page:** `https://app.fodda.ai/?view=billing`.
   Confirm with Piers which is intended before wiring — the Agent Pay-Per-Query plan (`planCode 14`) has **no Stripe price** yet, so it cannot check out on its own today.

## Definition of Done

- [ ] Monthly plan buttons link to `app.fodda.ai` with the **correct** `?plan=` codes: Starter=3, (Team=4), Studio=5, Business=6 — verified against `GET /api/account/plans`.
- [ ] No CTA links to planCode 1, 2, 7, 8, or 13.
- [ ] Lava Wallet modal dismisses cleanly via 'x', backdrop, and Escape — no hard refresh.
- [ ] "Setup Agent Wallet" CTA routes to the product-approved destination (Pay-As-You-Go `plan=12` or `?view=billing`), not `/agents`.

## App-side status (already implemented, for reference)

The app already parses `?plan=` on login and auto-launches Stripe checkout ([`frontend/App.tsx` handleSessionStart](../frontend/App.tsx)). No further app work is required for the monthly CTAs **once the website appends the correct `?plan=` codes above**.
