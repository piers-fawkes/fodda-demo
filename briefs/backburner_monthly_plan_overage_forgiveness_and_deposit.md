# Backburner — Monthly Plan: 10% overage forgiveness + 4-month deposit (App + API)

> **Status**: BACKBURNER. Do not build until the trigger fires.
> **Trigger**: the first customer subscribes to a Monthly Plan (Airtable Plan 5 Studio $2,500 or Plan 6 Business $4,600). The day that happens, pick this up before their first cycle ends.
> **Created**: 2026-09-04 (Piers). Decision: ship the copy on the website now, defer the billing work.
> **Owners**: App agent (this repo: overage subscription + cycle reset) and `api-agent` (metering / credit check).

## What the website now promises (copy is live once the "Pricing Cards v3" website brief ships)

Monthly Plan card bullets:
- 10% overage forgiveness, then overage at 50¢ per call
- 4 month deposit required for new users

Neither is enforced by code today.

## What billing does today

- Overage: once `queriesUsedThisCycle` passes `Monthly API Limit`, every extra call is metered to Stripe at the `STRIPE_OVERAGE_PRICE_ID` price ($0.50) from the first call over. No forgiveness band.
- Deposit: the Stripe payment links for Plans 5 and 6 charge one month. No deposit is collected or tracked.

## What has to change when the trigger fires

1. **Forgiveness band.** Overage metering for Monthly Plan accounts starts at `Monthly API Limit × 1.10` (5,500 for Studio, 10,120 for Business), not at the limit. Implement as a per-plan Airtable field (e.g. `Overage Forgiveness Pct`) read by both the App gating (`helpers.ts` effective-limit calc) and the API credit check, so the number is not hardcoded in two repos. Base stays at 0%.
2. **Deposit.** No deposit exists in Stripe or Airtable today. Decide and record: what "4 month deposit" means in dollars, whether it is held or applied to the first months, and how it is collected (Stripe invoice, payment link, manual). Then a Stripe setup or a manual runbook, plus an Airtable field marking the deposit as received so the App can show it.
3. **Reset path.** The six cycle-reset sites in `accountRouter.ts` already zero `overageTokensThisCycle`; confirm the forgiveness band does not need its own counter.
4. **Copy check.** Once built, make sure the website bullet, the app billing page and the Stripe invoice description all say the same thing.

## Do Not
- Do not silently change what Base or Pay-as-they-go accounts are charged.
- Do not derive any price from `TOKEN_COSTS × SPT_RATE_CENTS`. Airtable is the source of truth.
