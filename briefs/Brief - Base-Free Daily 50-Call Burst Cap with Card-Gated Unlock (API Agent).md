# Brief — Base-Free Daily 50-Call Burst Cap with Card-Gated Unlock & Overage (API Agent)

> **For**: API Agent (`/Fodda API`)  
> **Created**: 2026-09-05  
> **Decided by**: Piers — *"You know how we block people on Base using more than 50 calls in a day. Maybe, if they give us their credit card, they can continue using ??"*  
> **Depends on**: `Fodda/functions/index.ts` (credit check middleware ~L960–985), `Fodda/functions/tracking/airtable.ts` (`hasPaymentMethod`, `overageEnabled`), Firestore (daily account usage tracker / ledger), Airtable `Plan` (`Base - Free` = `recFePJbSswaTTmHX`, 100 calls/mo).

---

## 1. Context

Accounts on the **Base - Free** plan receive an allowance of **100 API calls per month ($50 value at $0.50/call)**. 

To prevent bot scraping and runaway query bursts, free accounts without a card on file are subject to a **daily burst ceiling of 50 calls/day**. Currently, hitting that ceiling blocks the user until the daily window resets.

### The Opportunity:
When a real user (or agency) is actively researching a client brief in Claude/Opus, hitting 50 calls in a single afternoon signals high intent. Stopping them dead with *"come back tomorrow"* loses that momentum. 

Instead, adding a payment card should immediately **lift the daily 50-call burst limit** and unlock uninterrupted querying:
1. **No card on file (`!hasPaymentMethod`)**: Hard daily ceiling at 50 calls. Block with HTTP 403 containing a one-click Stripe `setupUrl` to add a payment method.
2. **Card on file (`hasPaymentMethod === true`)**:
   * The daily 50-call burst cap is **completely bypassed**.
   * Queries continue drawing down from their 100/mo Base allowance.
   * Once their 100/mo allowance is exhausted, queries seamlessly flow into Stripe metered overage at **50¢ per API call** (`STRIPE_OVERAGE_METER_EVENT = 'fodda_overage_tokens'`).

---

## 2. What to Build

### 1. Daily Account Usage Counter (Firestore / In-Memory)
* Track `daily_calls` per `accountRecordId` keyed by UTC day (`YYYY-MM-DD`).
* Store in Firestore collection `daily_account_usage/{accountRecordId}_{YYYY-MM-DD}` (or transient fast-cache backed by Firestore increment), mirroring the existing `consult_log_YYYY-MM-DD` / `self_use_daily` convention.
* Increment on every billable API call served to that account.

### 2. Credit-Check Middleware Gate (`functions/index.ts` ~L960)
In the credit-check middleware before route execution:
* For accounts on **Base - Free** (`account.isFreeTier || account.planCode === '2'`):
  1. Check `dailyCallsToday`:
     * If `dailyCallsToday >= 50` AND `!account.hasPaymentMethod`:
       * Log: `[Daily Limit] Account ${account.accountRecordId} hit 50 calls/day without card on file. Blocking.`
       * Return HTTP 403 `DAILY_LIMIT_EXCEEDED`:
         ```json
         {
           "ok": false,
           "error": "DAILY_LIMIT_EXCEEDED",
           "code": "DAILY_LIMIT_EXCEEDED",
           "message": "Daily 50-call limit reached on free Base tier. Add a payment card to remove daily burst limits and continue querying without interruption at 50¢ per API call.",
           "setupUrl": "<Stripe Setup Checkout Link>",
           "upgradeUrl": "https://app.fodda.ai/billing",
           "daily_calls_used": 50,
           "daily_calls_limit": 50
         }
         ```
     * If `account.hasPaymentMethod === true`:
       * **Bypass the 50-call daily cap completely.**
       * If monthly credits > 0, decrement credits normally.
       * If monthly credits <= 0, flag `(foddaMeta as any).isOverage = true` and allow through to Stripe meter (existing overage path).

### 3. One-Click Setup URL Generation
* Use the existing `setupUrl` generator (Stripe Checkout Session in `setup` mode) so the user can add a card without needing to log in to the full dashboard.
* When Stripe webhook `setup_intent.succeeded` or customer payment method is added, Airtable `hasPaymentMethod` flips to `true` (already wired).
* On the next API call, the account is detected with `hasPaymentMethod: true` and queries immediately resume.

---

## 3. Definition of Done

1. **Without card on file**:
   * Calls 1–50 succeed on Base tier.
   * Call 51 receives HTTP 403 `DAILY_LIMIT_EXCEEDED` with `setupUrl`, honest 50¢/call messaging, and no leak of internal tokens.
2. **With card on file**:
   * Base account with card on file (`hasPaymentMethod: true`) can make 51+ calls in a single day without encountering the daily limit.
   * After 100 total monthly calls, call 101+ correctly records to Stripe overage meter.
3. **Paid Plans regression**:
   * Studio (Plan 5), Business (Plan 6), Enterprise (Plan 8), and Internal accounts are never subjected to the 50-call daily burst cap.
4. **Clean builds & docs**:
   * `npm run build` succeeds cleanly.
   * `docs/bibles/product_and_system_reference.md` updated under Section 12 (Billing rails & pricing rules).
   * `CHANGELOG.md` documented with manual verification step.

---

## 4. Do Not

* **Do NOT charge cardholders for calls 1–100**: The 100 calls per month remain free on Base. The card only acts as verification to lift the daily 50 burst ceiling and enable overage past call 100.
* **Do NOT use the word "tokens" or "SPT" in user-facing 403 messages**: Quote "50¢ per API call".
* **Do NOT break automated cron resets**: Monthly reset continues to respect the card-gate invariant (Base resets monthly queries to 0 only if a card is on file).

---

## 5. Files Expected to Change

- `Fodda/functions/index.ts` (middleware daily check + overage branch)
- `Fodda/functions/tracking/airtable.ts` (daily usage lookup / increment)
- `Fodda/functions/tracking/firestore.ts` (daily usage collection increment)
- `docs/bibles/product_and_system_reference.md`
- `CHANGELOG.md`

---

## 6. Execution Command

Run in the API agent workspace:
```bash
/build-from-brief "briefs/Brief - Base-Free Daily 50-Call Burst Cap with Card-Gated Unlock (API Agent).md"
```
