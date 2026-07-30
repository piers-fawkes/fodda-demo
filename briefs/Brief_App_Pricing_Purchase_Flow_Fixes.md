# Brief — App: Pricing & Purchase Flow Fixes (Stripe plan intent, Airtable field typo, checkout auth)

**Execution handle:** `/build-from-brief briefs/Brief_App_Pricing_Purchase_Flow_Fixes.md`
**Source:** QA report `QA_Pricing_Purchase_Flow_2026-07-30.md` (website repo session). All file/line refs below re-verified against this repo's main tree on 2026-07-30.

## Context

Buyers of monthly plans hit dead ends in the app:

1. **Returning users can never complete a plan purchase started on the pricing page.** `frontend/App.tsx:560` gates pending-plan auto-checkout on `pendingPlanCode && auth.isFirstLogin && auth.user.email`. The website stores intent in `localStorage['fodda.pendingPlanCode']` (read at `App.tsx:559`, removed at `:564`), so a returning user who clicks "Subscribe" on www.fodda.ai/pricing logs in, the intent is never fired, and (depending on path) may be silently dropped.
2. **Purchase records log `amount: 0` because of an Airtable field-name typo.** The code reads `Monthly Query Limit` in **10 places in the main tree**: `server/routers/accountRouter.ts` (8), `server/routers/authRouter.ts` (1), `server/helpers.ts` (1 — note: this file was missed by the original QA count of 8). The Airtable Plans table field is `Monthly API Limit` (already read correctly in 4 other places). Result: plan limits resolve to `undefined`/0 downstream.
3. **`POST /api/account/checkout/subscribe` is unauthenticated** (`server/routers/accountRouter.ts:964` — no auth middleware on the route). Anyone can spam checkout-session creation / trial provisioning.
4. **Domain-match fallback can attach purchases to the wrong account.** `accountRouter.ts:539–546`: when a Stripe customer email has no exact user match, the code matches any single user sharing the email domain. For generic providers (gmail.com, outlook.com, etc.) this attaches a stranger's purchase to an existing account.

## What to build

1. **Pending-plan checkout for returning users.** In `frontend/App.tsx` (and the auth flow in `AuthGate.tsx` / session-start path at `App.tsx:326`), fire the pending-plan checkout whenever `fodda.pendingPlanCode` is present and the user is authenticated — drop the `isFirstLogin` condition (keep it only for any first-login-specific analytics). Ensure the key is removed only after a checkout session is successfully created (today `:564` removes it before the fetch resolves — a failed session loses the intent).
2. **Field-name fix.** Replace `Monthly Query Limit` → `Monthly API Limit` in all 10 read sites (`accountRouter.ts` ×8, `authRouter.ts` ×1, `helpers.ts` ×1). Before replacing, confirm against the live Airtable Plans table (base `appXUeeWN1uD9NdCW`) that `Monthly API Limit` is the real field and `Monthly Query Limit` does not exist as a legacy field still carrying data.
3. **Auth on subscribe endpoint.** Require an authenticated session on `POST /api/account/checkout/subscribe`; derive the email/account from the session, not the request body. Rate-limit as a backstop.
4. **Restrict domain-match fallback.** Skip the domain-match at `accountRouter.ts:539` when the domain is a public email provider (maintain a denylist: gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, yahoo.com, icloud.com, me.com, aol.com, proton.me, protonmail.com, gmx.*, mail.com, msn.com, pm.me, hey.com, yandex.*, zoho.com). Keep the existing `PAYMENT_UNMATCHED_ADMIN` email (`:582`) as the fallback outcome.

## Where to register

- No new routes. Changed behavior lives in `frontend/App.tsx`, `frontend/AuthGate.tsx` (if the session-start hook lives there), `server/routers/accountRouter.ts`, `server/routers/authRouter.ts`, `server/helpers.ts`.
- If the public-email denylist is reusable, put it in `server/helpers.ts` and import it.

## Definition of Done

- [ ] Returning (non-first-login) user with `fodda.pendingPlanCode` set in localStorage is redirected to Stripe checkout on login; the key survives a failed session-creation attempt.
- [ ] `grep -rn "Monthly Query Limit" server/ frontend/ shared/` returns 0 hits; plan-limit values are non-zero for a real plan account.
- [ ] Unauthenticated `POST /api/account/checkout/subscribe` returns 401; authenticated call still creates a session.
- [ ] Domain-match: a purchase from an unknown `@gmail.com` email does NOT attach to any account and triggers the `PAYMENT_UNMATCHED_ADMIN` email; an unknown `@somecompany.com` email with exactly one existing `@somecompany.com` user still matches.
- [ ] `CHANGELOG.md` updated with a real verification result for each of the four items.

## Do Not

- Do not send test emails to anyone except `nathan@searchshop.ai` and `piers.fawkes@psfk.com`.
- Do not change token/SPT pricing values — costs are canonical from the API repo's `metering.ts`.
- Do not blind-replace the Airtable field name without confirming the live schema first (see item 2).
- Do not remove the `PAYMENT_UNMATCHED_ADMIN` notification path.
- Do not touch the Lava/PAYG flow in this brief — that is the API repo's brief (`Brief_API_Lava_Webhook_Purchases_Fix.md`).

## Files-changed (expected)

- `frontend/App.tsx` — pending-plan checkout condition + intent-preservation
- `frontend/AuthGate.tsx` — only if session-start hook lives here
- `server/routers/accountRouter.ts` — field rename ×8, subscribe auth, domain-match denylist
- `server/routers/authRouter.ts` — field rename ×1
- `server/helpers.ts` — field rename ×1 (+ optional shared denylist)
- `CHANGELOG.md`
