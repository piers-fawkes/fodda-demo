# Brief — App: Payment-Journey Failure Alerts to Slack (#fodda-sales)

**Execution handle:** `/build-from-brief briefs/Brief_App_Payment_Failure_Slack_Alerts.md`
**Source:** Piers' request 2026-07-30: payment journey failures/errors must be reported to the sales Slack channel rather than silently falling back.

## Context

Stripe purchase-flow failures in this repo are currently invisible or email-only:

- The Stripe webhook (`server/routers/accountRouter.ts`, `/api/account/stripe/webhook`) sends `PAYMENT_UNMATCHED_ADMIN` emails to `piers@psfk.com` (lines ~648, ~678, ~686) — **verify that alias actually delivers**; Piers' known address is `piers.fawkes@psfk.com`. All other failure paths (signature rejection, plan-lookup miss, Airtable update errors) are console-only.
- `POST /api/account/checkout/subscribe` failures (plan without `stripePriceId`, Stripe API errors) return JSON errors the user may never report.
- The pricing-page auto-checkout (`frontend/App.tsx`, pending-plan flow) falls back to the upgrade modal on failure with only a `console.warn`.

Slack plumbing already exists in this repo: `server/services/queryDigestService.ts` posts via `SLACK_BOT_TOKEN` (already in the Cloud Run deploy env via `deploy_gcp.sh`). Target channel: **#fodda-sales, ID `C0AV0HLSF24`**.

## What to build

1. **Shared helper** `notifyPaymentSlack(stage: string, detail: Record<string, any>)` in `server/services/` — reuse the Slack client pattern from `queryDigestService.ts`. Fire-and-forget, never throws, 10s timeout. In-memory dedupe: same `stage` + same error message at most once per 10 minutes.
2. **Wire into the Stripe webhook**: every path that today sends `PAYMENT_UNMATCHED_ADMIN` (mirror the email, don't replace it), signature-verification rejections (`constructEvent` failures — someone posting bad payloads or a misconfigured secret), plan-record lookup misses on `checkout.session.completed`, and any Airtable update failure after a confirmed payment (money taken, record not updated — highest severity, prefix the message accordingly).
3. **Wire into `POST /api/account/checkout/subscribe`**: alert on 5xx paths and on "plan has no stripePriceId". Do NOT alert on routine 401s (bots) or 429s.
4. **Client-side failure beacon (small)**: when the App.tsx auto-checkout fetch fails or returns no `checkout_url`, POST a beacon to a new lightweight endpoint (e.g. `/api/account/payment-event`) that forwards `{stage: 'auto_checkout_failed', planCode, error}` through the same helper. Endpoint must be rate-limited and accept no free-form spam (cap payload size, whitelist `stage` values).
5. **Message format**: one compact line per event — emoji severity, stage, buyer email (redact to `pi***@domain` for non-critical stages), plan/amount when known, and the error. Sales should be able to act on it (e.g., "💸 UNMATCHED STRIPE PAYMENT: st***@gmail.com paid $100 (plan 3) — no Fodda account matched. Session cs_xxx.").

## Where to register

- Helper: `server/services/paymentSlackService.ts` (new), imported by `accountRouter.ts`.
- Beacon endpoint: `server/routers/accountRouter.ts` alongside the other checkout routes.
- Channel ID: constant or `SLACK_SALES_CHANNEL_ID` env (default `C0AV0HLSF24`); token from existing `SLACK_BOT_TOKEN`.

## Definition of Done

- [ ] A simulated unmatched-buyer webhook event posts a message to #fodda-sales (screenshot or ts in CHANGELOG) AND still sends the existing admin email.
- [ ] A forced Airtable failure after a (test-mode) completed checkout posts a high-severity Slack alert.
- [ ] A subscribe call for a plan without `stripePriceId` posts an alert; a plain unauthenticated 401 does NOT.
- [ ] Dedupe verified: two identical failures within 10 minutes produce one message.
- [ ] Confirm whether `piers@psfk.com` is a live alias; if not, fix the three `PAYMENT_UNMATCHED_ADMIN` recipients to `piers.fawkes@psfk.com` in the same PR.
- [ ] `CHANGELOG.md` updated with real verification results.

## Do Not

- Do not let Slack calls block, delay, or fail any payment/webhook response path.
- Do not post full card/customer PII to Slack — email (redacted where noted), plan, amount, session id only.
- Do not remove or replace the existing admin emails — Slack is additive.
- Do not send test emails to anyone except `nathan@searchshop.ai` and `piers.fawkes@psfk.com`.
- Do not print or commit `SLACK_BOT_TOKEN`, `STRIPE_*`, or Airtable secrets.

## Files-changed (expected)

- `server/services/paymentSlackService.ts` (new)
- `server/routers/accountRouter.ts` — webhook + subscribe + beacon endpoint wiring
- `frontend/App.tsx` — failure beacon on auto-checkout
- `CHANGELOG.md`
