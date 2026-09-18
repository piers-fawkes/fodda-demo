# Fodda — Payment Testing Runbook

How to actually test each payment rail end-to-end. Written 2026-09-18.

## What we already proved live (production)

| Rail | Discovery / checkout | Settlement (money actually moves + account credited) |
|---|---|---|
| **Base upgrade (Stripe)** | ✅ `/api/account/plans` correct; Studio = **$2,500** (link + price match); crediting webhook configured (both Stripe secrets set) | ❌ never confirmed — no card has completed → webhook → plan flip |
| **Agentic / SPT (bot path)** | ✅ unpaid API call returns `402` + `WWW-Authenticate: stripe-spt amount=50`; `/v1/spt/validate` live against Stripe; **receive-funds profile `@fodda` now enabled** | ❌ never confirmed — needs a real `spt_xxx` presented and charged 50¢ |
| **$100 top-up** | ✅ `/checkout/agent-session` mints live `cs_live_…` ($100/200 calls); Base's designated upsell | ❌ never confirmed |
| **Lava** | ✅ API mints live sessions; still wired in Upgrade modal | ❌ never confirmed; UI entry half-removed |

**Pricing is a flat $0.50/call across every tier.** Bots use SPT (50¢/call, no account) or the $100 top-up — never the $2,500 tier.

---

## Part A — Base upgrade & top-up, in Stripe TEST mode (no real money)

Tests the full flow: **checkout → webhook → account credited**, using Stripe test cards.
Production is untouched: the price-override code is a hard no-op unless `NODE_ENV !== 'production'` **and** `STRIPE_TEST_PRICE_MAP` is set.

### One-time setup
1. Install the Stripe CLI and log in: `stripe login`.
2. Create test-mode prices + get the map:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-test-setup.mjs
   ```
   Copy the printed `STRIPE_TEST_PRICE_MAP=...` line.
3. Create a **local `.env`** (gitignored) with at least:
   ```
   NODE_ENV=development
   STRIPE_SECRET_KEY=sk_test_xxx
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx        # printed by `stripe listen` below
   STRIPE_TEST_PRICE_MAP={"5":"...","6":"...","7":"..."}
   # plus the normal app envs so plan/account lookups work:
   AIRTABLE_PAT=... AIRTABLE_BASE_ID=... GEMINI_API_KEY=... APP_URL=http://localhost:8080
   ```

### ⚠️ Airtable is LIVE even in Stripe test mode
The app reads/writes the **live Airtable** for plan + account records. A successful test payment will really credit whatever account matches the checkout email. **Do not use a real customer email.**
- **Stage 1 (no Airtable writes):** verify checkout only — the write happens in the webhook, so if you *don't* run `stripe listen`, nothing is credited.
- **Stage 2 (Airtable writes):** to test crediting, first create a **throwaway** Airtable User+Account (e.g. email `paytest+local@fodda.ai`, linked to a test Account row), use that email at checkout, verify, then delete both rows. This keeps real accounts untouched. (Emails are suppressed locally unless `FORCE_EMAIL` is set.)

### Run it
```bash
# terminal 1
stripe listen --forward-to localhost:8080/api/account/stripe/webhook   # copy the whsec_ into .env
# terminal 2
npm run dev
```
- **Studio upgrade:** `POST http://localhost:8080/api/account/checkout/subscribe` with `{"planCode":5,"email":"paytest+local@fodda.ai"}` → open the `checkout_url` → pay with test card `4242 4242 4242 4242`, any future expiry/CVC.
- **$100 top-up:** `POST .../api/account/checkout/agent-session` with `{"email":"paytest+local@fodda.ai"}`.

### Pass criteria
- `stripe listen` shows `checkout.session.completed` → your server logs `[Stripe Webhook] Event: checkout.session.completed` and `[StripeTestMode] …`.
- Subscribe: the test Account's plan flips to Studio (planCode 5). Top-up: its `bonusTokens` increases by 200.
- Clean up: delete the throwaway Airtable rows; test-mode Stripe data can be left as-is.

---

## Part B — Stripe SPT (the agentic / Grok-bot path)

**What SPT is:** a **Shared Payment Token** (`spt_xxx`) the *buyer's* agent obtains from **Stripe Link**, then presents to a merchant as `Authorization: Bearer spt_xxx`. Fodda (the merchant) validates it and charges per call (50¢). Fodda's `@fodda` receive profile (just enabled) is the money-in side.

**Two sides:**
- Merchant/receive (Fodda) — ✅ live: `402` discovery, `/v1/spt/validate`, receive profile enabled.
- Buyer/agent — needs a real `spt_xxx` from Stripe Link to actually pay.

### Step 1 — Discovery (no charge)
```bash
node scripts/spt-probe.mjs discover
```
Expect `HTTP 402` + `www-authenticate: stripe-spt amount=50` + a JSON body telling the agent how to pay. This is what a Grok bot sees.

### Step 2 — Validate a token (free, $0)
Once you have an `spt_xxx` from Stripe Link:
```bash
node scripts/spt-probe.mjs validate spt_xxx
```
Confirms the token is active and has balance, without charging.

### Step 3 — Full settlement (SPENDS ~$0.50)
```bash
node scripts/spt-probe.mjs settle spt_xxx --yes-charge-50-cents
```
Expect `HTTP 200` + graph data, and a ~$0.50 charge that lands in the `@fodda` profile. Reconcile/refund in Stripe. This is the only step that proves an agent can truly pay end-to-end.

### Getting an `spt_xxx` (buyer/agent side)
An SPT is **scoped to ONE seller** — it must be minted against **Fodda's own Stripe profile**
(`network_business_profile` = the live `@fodda` profile enabled 2026-09-18):

```
FODDA_PROFILE_ID = profile_61UkOZHFXofghS82UA6UkOZH2JSQENHoH2ygQe0sSBJw   (live; a seller id, shareable)
```

Mint via the Stripe API (preview):

```bash
curl https://api.stripe.com/v1/shared_payment/issued_tokens \
  -u "$STRIPE_SECRET_KEY:" \
  -H "Stripe-Version: 2026-04-22.preview" \
  -d "payment_method=pm_xxx" \
  -d "seller_details[network_business_profile]=profile_61UkOZHFXofghS82UA6UkOZH2JSQENHoH2ygQe0sSBJw" \
  -d "usage_limits[currency]=usd" \
  -d "usage_limits[max_amount]=200" \
  -d "usage_limits[expires_at]=<unix+1h>" \
  --data-urlencode "return_url=https://app.fodda.ai?checkout=return"
```
Returns `spt_...`. The `pm_xxx` PaymentMethod comes from the buyer's card via Stripe.js
Payment Element (browser).

**One-click local mint (easiest):**
```bash
STRIPE_SECRET_KEY=sk_live_xxx VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx node scripts/spt-mint/server.mjs
```
Open http://localhost:4242, enter a card → it mints the SPT (scoped to the `@fodda` profile,
$2 cap by default) and prints the `spt_…` plus the exact `settle` command. Use matching **live**
keys for a live settlement, or `sk_test_`/`pk_test_` to mint a test SPT. (Shortcut alternative:
`npm i -g @stripe/cli && stripe agent setup`.)

- **Test mode:** use test seller profile `profile_test_61TU90nIeGjU7NNVXA6TU90m7ISQWsBxpcx9lASWWXTk`
  + a test pm — BUT a test SPT only validates against a TEST-mode API, so it needs `fodda-api-v4`
  running locally with test keys (not this repo). This is the ONLY no-real-money way to settle.
- **Live settlement (the real proof):** mint a LIVE SPT scoped to Fodda's live profile with a small
  cap (`max_amount=200` = $2) using a real card, then:
  `node scripts/spt-probe.mjs settle spt_xxx --yes-charge-50-cents` → ~50¢ lands in `@fodda`.
  Reconcile/refund; revoke leftover cap: `POST /v1/shared_payment/issued_tokens/spt_xxx/revoke`.

**Key gotcha:** the SPT must carry Fodda's profile id, and `api.fodda.ai` runs LIVE keys — so a
live settlement needs a live SPT. There is no way to settle against the live API for free.

---

## Safety rules (house)
- Test emails go ONLY to `nathan@searchshop.ai` or `piers.fawkes@psfk.com`; for Airtable-crediting tests use a throwaway `paytest+…` account you delete after.
- Never enter real card/bank details on a live checkout during testing — use Stripe **test** cards, or a Fodda-owned card + immediate refund for a live test.
- Never commit `.env`, `sk_*`, `pk_*`, `whsec_`, or any `spt_`/`css_live_` token.

## Known gaps found during this audit
- `402` docs link `https://fodda.ai/llms.txt` is **fine** — it 301-redirects to `www.fodda.ai/llms.txt`, a complete 105-line agent doc that documents the SPT/402 handshake. (Earlier "empty" claim was a mistake — the 301 wasn't followed.) Optional micro-nit: point the 402 `docs` field at the final `www.` URL to save a redirect hop.
- In-app agent-payment nudge is disabled in prod (`DISABLE_AGENT_PAYMENT_NUDGE=true`) and `AgentPaymentBanner` isn't rendered — the only "you must pay" signal for agents is the API `402`.
- Lava is half-removed (Upgrade modal + API still live; Billing page button gone). Decide: fully remove or re-surface.
