# Brief — SPT Settlement Slack Alert  (owning repo: **fodda-api-v4** · agent: **api-agent**)

> Route: drop this in the API repo's `briefs/` and run `/build-from-brief briefs/Brief - SPT Settlement Slack Alert (API Agent).md`. It targets the API, not the App — it's staged in the App repo only because that's where the payment audit happened.

## Context
Fodda's agentic (SPT) rail is live end-to-end on the merchant side: `api.fodda.ai` returns `402 stripe-spt amount=50` on unpaid private calls, `/v1/spt/validate` works, and the `@fodda` Stripe receive profile (`acct_17FpXyAYuoIyU8CG`, `profile_61UkOZHFXofghS82UA6UkOZH2JSQENHoH2ygQe0sSBJw`) is enabled. **No real SPT settlement has ever occurred.** Piers wants to be alerted the instant the first real external agent (e.g. a Grok bot) pays via SPT — and on every settlement after — so it can be caught live. SPT settlement (the seller-side PaymentIntent for an SPT-authenticated request) happens in THIS repo; metering uses `SPT_RATE_CENTS = 50`.

## What to build
1. On a **successful SPT-settled request** (where the SPT PaymentIntent succeeds / the metered charge confirms), post a Slack message to the ops channel (reuse the existing Slack notifier if one exists; else `SLACK_BOT_TOKEN` → `#fodda-research` `C0AU0403M3M`). Include: amount (USD), endpoint/path, truncated SPT id, agent/customer identifier if available, `requestId`, timestamp.
2. Add/confirm a Stripe webhook handler for **`shared_payment.issued_token.used`** (seller side) as a backstop notification in case the inline hook is missed.
3. Make the **first-ever settlement extra-visible** — prefix e.g. `🎉 FIRST SPT PAYMENT` (detect via a persisted flag or a count of prior SPT charges).
4. Optional: email the first settlement to `piers.fawkes@psfk.com` and `nathan@searchshop.ai` (the only allowed test/ops recipients per house rule).

## Where to register
- The SPT metering/settlement path (where the SPT PaymentIntent is created/confirmed).
- The Stripe webhook router — add the `shared_payment.issued_token.used` event (subscribe it in the Stripe Dashboard webhook config too).
- Env: reuse the API deploy's existing `SLACK_BOT_TOKEN` / channel config; ideally no new secrets.

## Definition of Done
- A real (or test-mode) SPT settlement produces a Slack message with the fields above within seconds.
- The first-ever settlement is clearly flagged.
- SPT id truncated; no card data or excess PII.
- `CHANGELOG.md` updated with a real verification (e.g. a test-mode SPT settlement log/screenshot).

## Do Not
- Do NOT put "SPT" / "tokens" / "MPP" wording on any customer-facing surface — internal ops alert only (house rule).
- Do NOT block or slow the paid request on Slack failure — fire-and-forget, catch errors.
- Do NOT compute the price from token math — use the actual Stripe charge / the `402` amount.

## Files-changed (expected)
The SPT settlement/metering module, the Stripe webhook router, `CHANGELOG.md`.
