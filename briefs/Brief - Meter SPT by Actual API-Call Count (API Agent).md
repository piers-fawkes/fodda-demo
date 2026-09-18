# Brief — Meter SPT by Actual API-Call Count  (owning repo: **fodda-api-v4** · agent: **api-agent**)

> Route: drop this in the API repo's `briefs/` and run `/build-from-brief "briefs/Brief - Meter SPT by Actual API-Call Count (API Agent).md"`. Targets the API, not the App — staged in the App repo only because that's where the payment audit happened. Pairs with `Brief - SPT Settlement Slack Alert (API Agent).md`.

## Context
Pricing is settled: **50¢ per API call**, everywhere (`SPT_RATE_CENTS = 50`). The Airtable "price" fields and the OpenAPI `Price:` descriptions are **stale — ignore them**.

The SPT `402` amount is currently `TOKEN_COSTS[endpoint] × 50¢`, where `TOKEN_COSTS` are **flat per-operation weights, not the real number of API calls a request consumes**. Live evidence (2026-09-18):
- `GET /v1/graphs` → `amount=50` → 1 call → $0.50 ✅ sensible
- `GET /v1/supplemental/earnings/snapshot?ticker=NKE` → `amount=4500` → **90 calls → $45.00** ❌ a single light GET metering as 90 calls is wrong and will scare agents off. (The stale OpenAPI even says "$2.50" for the same endpoint — neither figure is trustworthy.)

**Intent (Piers, 2026-09-18):** the agent pays for the **actual number of API calls the request consumes × 50¢**. No flat/marketing numbers — neither $45 nor $2.50; the true call count.

## What to build
Meter each request as `charge = (real number of API calls it consumes) × SPT_RATE_CENTS`. Either implementation is acceptable:
- **(a) Dynamic** — count the actual downstream/sub-calls a request makes at runtime and meter that count; or
- **(b) Static-but-true** — set every endpoint's `TOKEN_COSTS` to its genuine underlying call count. Audit the whole map and correct inflated entries — especially `/v1/supplemental/earnings/*` (currently 90).

The `402` discovery amount and the amount actually settled must come from the **same source** so quote == charge.

## Where to register
The metering module + the `TOKEN_COSTS` map (or the dynamic call-counter) + the `402` challenge builder (must read the same source as settlement).

## Definition of Done
- For a representative set of endpoints, the `402` `amount` equals (true API-call count × 50¢) — a light single-fetch GET meters as a small count, not 90.
- Discovery `amount` == amount actually charged on settlement.
- No flat/hardcoded inflated weights remain; earnings endpoints reflect real cost.
- `CHANGELOG.md` lists every endpoint's before/after call count, with real verification (paste the live `402` amounts before and after).

## Do Not
- Do NOT change the rate — 50¢/call is fixed.
- Do NOT show "SPT"/"tokens"/"MPP" wording on any customer-facing surface (house rule).
- Do NOT read prices from the stale Airtable "price" fields or the OpenAPI `Price:` descriptions.

## Files-changed (expected)
Metering module, `TOKEN_COSTS` definition, the `402` challenge builder, `CHANGELOG.md`.
