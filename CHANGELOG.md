# Fodda App — Changelog

All notable changes to this project are documented in this file.
Format: newest entries at the top. Each entry should include the date, a short title, and bullet points describing what changed.


## [2026-09-18] — Fix OAuth Consent Allow Button Block for Grok & Desktop Clients (CSP form-action)

### Content Security Policy (`server/index.ts`)
- Added loopback addresses (`http://localhost:*`, `http://127.0.0.1:*`) and Grok/xAI web domains (`https://x.ai`, `https://*.x.ai`, `https://grok.com`, `https://*.grok.com`) to Helmet's CSP `formAction` directive.
- Fixed indefinite hang on OAuth consent screen (`/oauth-consent`) when authorizing bots via Grok or desktop/CLI OAuth agents redirecting to local callback servers (e.g., `http://localhost:8787/callback`).

### Dynamic Bot Logo Injection & Co-Branding (`frontend/components/OAuthConsentPage.tsx`)
- Added dynamic request detection for Grok / bot authorization requests (via `redirect_uri` port 8787/grok, `resource=earnings-intelligence`, and bot client IDs).
- Dynamically injects the purple bot avatar into Clerk's `<OAuthConsent />` left badge via MutationObserver, permanently resolving missing client logos without requiring manual Clerk dashboard application configuration.
- Added top header co-branding (`Fodda × [icon] Earnings Context · Authorization`) for recognized bot flows.
### Deployed
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00563-mbg` (100% traffic)
- **Deployment URL:** `https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app` (`https://app.fodda.ai`)
- **Preflight & Smoke:** `npm run preflight` and `npm run smoke:oauth` passed cleanly. Verified live CSP on `https://app.fodda.ai/oauth-consent` includes `http://localhost:*`, `http://127.0.0.1:*`, `https://x.ai`, `https://*.x.ai`, `https://grok.com`, and `https://*.grok.com`. Health check returned HTTP 200 `{"status":"ok","uptime":...,"queryLogFailures":0}`.

## [2026-09-18] — Payment audit + local Stripe test-mode harness (all 3 rails)

Audited Base upgrade / agentic-SPT / Lava end-to-end and added a way to test the full checkout→webhook→credit flow without real money or touching live Airtable pricing.

### New — dev-only test harness
- **`server/services/stripeTestMode.ts`**: in-memory Stripe TEST-mode price override. Hard no-op unless `NODE_ENV !== 'production'` AND `STRIPE_TEST_PRICE_MAP` is set (double-gated; prod deploy sets `NODE_ENV=production` and never sets the map). Lets local runs substitute test price ids so the webhook can credit without writing fake prices into the live Plans table.
- **`server/routers/accountRouter.ts`** (4 surgical edits): import the helpers; `POST /checkout/subscribe` and `POST /checkout/agent-session` now pass the price through `overridePriceForCheckout(planCode, livePriceId)`; the Stripe webhook resolves the plan via `planCodeForTestPrice()` (falls back to the normal `{stripePriceId}` Airtable lookup when null). All paths are identical to before in production.
- **`scripts/stripe-test-setup.mjs`**: creates/reuses TEST products+prices (Studio $2,500, Business $4,600, Top-Up $100) and prints a ready-to-paste `STRIPE_TEST_PRICE_MAP`. Refuses any key that isn't `sk_test_`.
- **`scripts/spt-probe.mjs`**: exercises the agentic SPT rail — `discover` (402 challenge, no charge), `validate <spt>` (free), `settle <spt> --yes-charge-50-cents` (real 50¢, guarded).
- **`PAYMENT_TESTING.md`**: full runbook (Part A local Stripe test-mode for Base/top-up; Part B Stripe SPT settlement), safety rules, and the Airtable-is-live caveat.

### Findings (live-verified against production)
- Base upgrade plumbing is live: `/plans` correct, **Studio now $2,500** (prior $1,500 link mismatch resolved), crediting webhook configured (both Stripe secrets set → unsigned POST returns 400, not 500).
- Agentic SPT is live on the merchant side: any unpaid private API call returns `402` + `WWW-Authenticate: stripe-spt amount=50`; `/v1/spt/validate` really validates against Stripe (dummy token → real `SPT_INVALID` from Stripe). OpenAPI documents the `stripeSPT` bearer scheme ("SPT obtained from Stripe Link").
- `POST /api/account/checkout/agent-session` mints a live `cs_live_…` $100/200-call checkout unauthenticated.
- **Lava is not fully dropped**: `api.fodda.ai/api/checkout/lava-session` still mints live `css_live_` sessions; still wired in `App.tsx` / `UpgradeModal.tsx` / `AgentPaymentBanner.tsx` (only BillingPage removed it).
- Never exercised on any rail: a real card/SPT actually settling and crediting an account (the "last mile").
- Gaps: `DISABLE_AGENT_PAYMENT_NUDGE=true` + unmounted `AgentPaymentBanner` mean the API `402` is the only agent pay signal. (Note: `fodda.ai/llms.txt` is NOT empty — it 301-redirects to `www.fodda.ai/llms.txt`, a full agent doc that documents the SPT/402 handshake.)

### Verification
- `node --check` passes on both new scripts.
- `tsc -p tsconfig.server.json`: 5 pre-existing errors, **0 new** — none reference `stripeTestMode`, the new helpers, or the edited lines.
- New module typechecks clean in isolation (strict).
- Not yet run end-to-end (requires Stripe test keys + a local `.env`, supplied by the operator per PAYMENT_TESTING.md).

## [2026-09-15] — Fix Gemini Schema Constraint Error in Web Chat Sandbox

### Agentic Calling Mode & Toolset Pruning (`server/services/mcpChatService.ts`)
- Configured `callingMode` to default to `'AUTO'` for toolsets with > 20 tools (or only use `'ANY'` if tool count is <= 20), preventing Gemini 2.5 Flash from exceeding internal `MAX_GRAMMAR_STATES` when constructing the grammar DFA.
- Pruned non-research tools (`begin_expert_onboarding`, `submit_basic_info`, `submit_mcp_source`, `finalize_byo_mcp_onboarding`, `verify_byo_mcp_token`, `update_user_profile`, `sign_up_free_account`, `draft_linkedin_post`, `draft_linkedin_article`, `manage_scheduled_reports`) via `EXCLUDED_SANDBOX_TOOLS` before passing declarations to Gemini, decreasing schema size from 52 to ~38 tools and saving latency and context budget.
- Broadened model generation error handling to catch schema constraint errors (`/too many states for serving|constraint|schema/i`) in addition to empty output errors, automatically retrying with `'AUTO'` mode.

### Error Sanitization in Web Chat (`frontend/App.tsx`)
- Sanitized raw Gemini schema compiler errors (`/too many states for serving|schema.*constraint/i`) to present a friendly user-facing notice ("We encountered a temporary processing error with the research model. Please try submitting your question again.") instead of exposing internal compiler details.

### Deployed
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00562-l86` (100% traffic)
- **Deployment URL:** `https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app` (`https://app.fodda.ai`)
- **Preflight & Smoke:** `npm run preflight` and `npm run smoke:oauth` passed cleanly. Health check returned HTTP 200 `{"status":"ok","uptime":...,"queryLogFailures":0}`.


## [2026-09-14] — Polar Agentic Accessibility & Headless Adoption Enhancements

### Invoices & Receipts Self-Service (`frontend/components/BillingPage.tsx`)
- Broadened Stripe Customer Portal access to accounts on Base tier with a credit card on file (`hasPaymentMethod` or `stripeCustomerId`), eliminating the limitation where only recurring subscriptions could access the billing portal.
- Added "Stripe Invoices Portal →" direct action button to the Invoices & Receipts section alongside "Export Invoices (CSV)" for instant self-serve receipt/invoice viewing and PDF downloads.

### 1-Click "Add to Claude" Promotion (`frontend/components/HomeDashboard.tsx`, `frontend/components/ConnectionsPage.tsx`)
- Added prominent 1-click "⚡ Add to Claude" deep link (`claude.ai/customize/connectors?...`) to the Home dashboard header and Personal MCP Endpoint card.
- Added a full-width 1-click "⚡ Add to Claude in One Click" action button directly on the "MCP (OAuth) — Claude" card on the Connections index overview.

### Accessibility Tree Optimization (`aria-label`s)
- Added explicit accessible labels to icon-only controls across the app to streamline autonomous agent navigation (Polar, Operator, etc.) and screen reader compliance:
  - `ChatInterface.tsx`: Added `aria-label="Open sidebar menu"` to mobile menu toggle and `aria-label="Send query"` to submit button.
  - `EvidenceDrawer.tsx`: Added `aria-label="Close evidence drawer"` to close `X` button.
  - `ConnectionsPage.tsx`: Added `aria-label="Back to connections overview"` and `aria-label="Close modal"`.
  - `ProfilePage.tsx`: Added `aria-label="Dismiss notification"` and `aria-label="Close modal"`.
  - `HomeDashboard.tsx`: Added `aria-label="Dismiss notification"` and `aria-label="Close modal"`.
  - `App.tsx`: Added `aria-label="Clear search query"` on graph filter search input.

## [2026-09-14] — Web Chat Sandbox Bearer Auth & Error Sanitization (Companion to MCP v1.46.67)

### MCP Client Transport Modernization (`server/services/mcpChatService.ts`, `server/services/svgConstellationService.ts`)
- Modernized `StreamableHTTPClientTransport` connections to pass `Authorization: Bearer <apiKey>`, `X-User-Email`, `X-User-Id`, and `X-Fodda-Session-Kind: internal-test` via `requestInit.headers` rather than legacy URL query parameters (`/mcp?api_key=...&user_id=...`).
- Aligned `mcpChat()`, `listMcpTools()`, and `callMcpVisualTool()` with `fodda-mcp` v1.46.67's deprecation bypass rules, preventing API keys from leaking into Cloud Run HTTP URL logs.

### Chat Error Bubble Sanitization (`frontend/App.tsx`)
- Updated research agent error handler to parse JSON-RPC error blobs (or raw `{...}` strings) and display clean, user-facing error messages instead of raw JSON-RPC structures in the assistant chat bubble.

## [2026-09-14] — Customer Bulk Exports (Usage, Invoices, Briefings) for App & Polar Agentic Compatibility

### Usage & Query History Export (`frontend/components/UsageMeter.tsx`, `frontend/components/ProfilePage.tsx`, `server/routers/accountRouter.ts`)
- Added `GET /api/account/usage/export?format=csv|json` (aliased under `/v1/user/usage/export` and `/api/user/usage/export`).
- Downloads query history from `LOGS_TABLE_QUESTIONS` with `Timestamp (UTC)`, `Request ID`, `Question / Query`, `Graph / Source ID`, `Channel`, `Status`, `API Calls Billed`.
- Honors enterprise zero query retention agreements: queries for contract accounts automatically render `[zero-retention contract]`.
- Mounted 1-step direct download buttons on Recent Executions in `UsageMeter.tsx` and `ProfilePage.tsx` with `data-testid="export-usage-csv"`, `data-testid="export-usage-json"`, and accessible `aria-label`s.

### Invoices & Billing Summary Export (`frontend/components/BillingPage.tsx`, `server/routers/accountRouter.ts`)
- Added `GET /api/account/invoices/export?format=csv` (aliased under `/v1/user/invoices/export` and `/api/user/invoices/export`).
- Aggregates Stripe customer invoice history via Stripe SDK and Airtable token purchases into a clean CSV with `Invoice / Charge ID`, `Date (UTC)`, `Description`, `Amount (USD)`, `Payment Rail`, `Status`, `Hosted Invoice URL`, `PDF Download URL`.
- Mounted "Export Invoices (CSV)" button under Invoices & Receipts on `BillingPage.tsx` with `data-testid="export-invoices-csv"` and `aria-label="Export invoice history as CSV"`.

### Briefings & Research Deliverables Export (`frontend/components/ProfilePage.tsx`, `server/routers/accountRouter.ts`)
- Added `GET /api/account/briefings/export?format=json` (aliased under `/v1/user/briefings/export` and `/api/user/briefings/export`).
- Packages archived research briefings, questions, citations, and answers formatted as Markdown with YAML frontmatter.
- Mounted "Export All Briefings" button on `ProfilePage.tsx` with `data-testid="export-briefings-all"` and `aria-label="Export all research briefings and deliverables"`.

### Agentic Browser & Polar Guarantees
- All export triggers are standard native `<a href="..." download>` elements without multi-step confirmation dialogs or blocking modals, allowing Polar Browser and headless agents to initiate instant file downloads in 1 step.

## [2026-09-14] — Fix OAuth Consent Allow Button Hang in Polar Browser (CSP form-action Redirect Block)

### Content Security Policy & Cross-Origin Opener Policy (`server/index.ts`)
- Added `https://polarbrowser.com`, `https://*.polarbrowser.com`, and wildcard scheme `"https:"` to Helmet's CSP `formAction` directive.
- Fixed indefinite hang on the OAuth consent screen (`/oauth-consent`) when connecting Fodda as an MCP connector in Polar Browser (`polarbrowser.com`). Per W3C CSP specifications, `form-action` governs the entire post-submission redirect chain following form POST to `clerk.fodda.ai`; because Polar Browser callback domains were omitted from `formAction`, the browser terminated the redirect chain upon clicking **Allow**.
- The addition of wildcard `"https:"` alongside explicit entries permanently accommodates RFC 7591 Dynamic Client Registration (DCR) for compliant MCP clients and browsers (e.g. Polar, Cursor, Windsurf, Zed) without requiring manual allowlist updates for each new client domain.
- Set `crossOriginOpenerPolicy: false` in Helmet. By default, Helmet sent `Cross-Origin-Opener-Policy: same-origin`, which severed `window.opener` on OAuth popup windows. Disabling COOP preserves `window.opener` so client popup callbacks (e.g. Polar Browser) can successfully post `{type: 'polar:connector:ok'}` to the opener and auto-close via `window.close()`.

### Verification
- Ran preflight test suite (`node scripts/oauth-preflight.mjs`): 4 layers passed cleanly (Source guards, Allowlist behavior, OAuth resume storage, and Route wiring/CSP guards).
- Verified Helmet CSP header serialization directly (`form-action 'self' https: https://clerk.fodda.ai ... https://polarbrowser.com https://*.polarbrowser.com`).
- Ran production build (`npm run build`): Passed cleanly with 0 TypeScript/undefined errors.

## [2026-09-12] — Align Fodda App with Website Expert Booking & Inquiry Flow

### Expert Booking & Consultation Modal (`frontend/components/BookCallModal.tsx`)
- Ported `<BookCallModal>` from Fodda Website to Fodda App.
- Automatically pre-populates authenticated Clerk session email using `@clerk/react` (`useUser()`, `useAuth()`) and `window.Clerk`.
- Dispatches `expert_video_call_booking` event payload to `/api/intent` with bearer token authentication when signed in.
- Surfaces loading states, success screen ("Request Received" with note to look for an email from `team@fodda.ai`), and error banners.
- Emits analytics event (`expert_book_call_submit`) via `trackEvent`.

### Consultation CTA on Active Expert Pages (`frontend/components/ExpertTwinPage.tsx`)
- Added "Book 1-on-1 with {Name} ({callPrice})" button to the active expert profile header / action bar.
- Added `formatCallPrice` helper to display `callPrice` read from Airtable (formatting rates like `$750` or `$500/hr`, mapping `"No Calls"` to `"On request"`, and defaulting to `$750` / `"On request"`).
- Extended `ExpertData` interface with `callPrice`, `bookUrl`, `expertIn`, and `expertSlug`.
- Integrated `<BookCallModal>` controlled by `isBookModalOpen` state.

### Backend Intent Proxy & Routing (`server/routers/intentRouter.ts`, `server/index.ts`, `server/routers/expertRouter.ts`)
- Created `POST /api/intent` server-side proxy route in `server/routers/intentRouter.ts` with rate-limiting and Clerk session identity resolution.
- Proxies validated booking and inquiry payloads to Fodda Sales Agent webhook (`INTENT_WEBHOOK_URL`) using secret authorization header (`x-fodda-webhook-secret`).
- Mounted `intentRouter` at `/api/intent` in `server/index.ts`.
- Updated `GET /api/expert/me` in `server/routers/expertRouter.ts` to return `callPrice`, `bookUrl`, `expertIn`, and `expertSlug` directly from the CE Analyst Airtable record.
- Added `callPrice` and `bookUrl` fields to `KnowledgeGraph` in `shared/types.ts`.
- Added `INTENT_WEBHOOK_URL` and `INTENT_WEBHOOK_SECRET` to `.env`, `.env.example`, and `deploy_gcp.sh`.

### Manual Verification
- **Vite Build (`npm run build`)**: Passed cleanly (`check:undefined` 0 errors, 1,684 modules transformed in 3.19s).
- **Format Helper Unit Verification**: Verified `formatCallPrice` against 8 input permutations (`$750`, `500`, `No Calls`, `no calls`, `""`, `null`, `undefined`, `$500/hr`). All passed.
- **Express `/api/intent` Hop Verification**: Ran ephemeral server dispatch test (`scratch/verify_express_route.ts`), confirmed 200 OK and `{ ok: true }`.
- **Airtable Table Record Confirmation (`tbl3sPI8A7p497jOa`)**: Dispatched test booking for `piers.fawkes@psfk.com` (Analyst: `Ben Dietz`, `ben-dietz-sic`). Confirmed record created in `tbl3sPI8A7p497jOa` (`recSB67zBSaGQbZRW`) with status `Pending Qualification`.

## [2026-09-06] — Home, Profile, and Navigation Restructuring

### Navigation & Sidebar (`frontend/components/Sidebar.tsx`, `frontend/App.tsx`)
- Replaced collapsible "Ask" accordion with a direct top-level navigation item labeled **"Ask Fodda"** routing directly to `sandbox`.
- Removed "Experts" (`/directory`) and "Coverage" (`/coverage`) links from the sidebar navigation.
- Updated brand header link to route directly to `home`.

### Home Page (`frontend/components/HomeDashboard.tsx`)
- Reworked into the primary Account & Access Portal:
  - Plan tier and allowance banner at top (`account.planName`, `account.planLevel`, `account.monthlyLimit`).
  - Account Details elevated higher up (Organization, Role, Account Owner, Renewal Status, and Access/Restrictions status e.g. "Restricted to: Retail only" vs "Full Catalog Access").
  - Access Credentials section with API Key (reveal, copy, rotate modal) and MCP Endpoint URL (copy).
  - If user is a registered expert (`user.isExpert`): displays Twin Activity block showing 7-day query count and list of recent questions asked of their twin.
  - "Your Research Persona" placed at the bottom with confirmed/unconfirmed status and link to profile context.

### Profile Page (`frontend/components/ProfilePage.tsx`)
- Displayed User Information card at the top (Full Name, Email, Role, Job Title, Company, Organization) with direct "Edit Profile" modal action.
- Displayed Research Profile & Persona card (Confirmed/Unconfirmed status, persona quote context, and "Edit Persona" action).
- 3-column stats card: Queries Used, Queries Remaining, and All-Time Queries.
- Recent Executions table with clickable rows opening the Answer Receipt drawer.

### Chat / Ask Fodda (`frontend/components/ChatInterface.tsx`, `frontend/App.tsx`)
- Removed the confusing "What are you working on?" job intake input field.
- Placed the main prompt input above the suggested prompt chips for a cleaner, unified input experience.
- Updated header in `App.tsx`: eyebrow to "Research & Intelligence", title to "Ask Fodda", and subtitle to "Research across curated knowledge graphs, expert twins, and market intelligence."

### Access Page (`frontend/components/ConnectionsPage.tsx`)
- Added Claude to Card 1 title: `MCP (OAuth) — Claude`.
- Swapped lines under card titles to highlight supported platforms:
  - Card 1: `Supported on Claude, ChatGPT, Copilot` directly below title; OAuth auth explanation moved to footer.
  - Card 2: `Supported on Cursor, Gemini, Perplexity, Notion` directly below title; token auth explanation moved to footer.

### Backend & Data Service (`server/routers/expertRouter.ts`, `shared/dataService.ts`)
- Added `GET /api/expert/me/activity` endpoint retrieving 7-day query count and recent questions from `LOGS_TABLE_QUESTIONS` filtered by `analystId`.
- Added `dataService.getExpertActivity()` for client-side telemetry fetching.

### Verification
- `npm run build`: Passed cleanly (`✓ check:undefined`, vite build successful).


## [2026-09-04] — Backburner note: Monthly Plan overage forgiveness + deposit

- Added `briefs/backburner_monthly_plan_overage_forgiveness_and_deposit.md`. Piers decided the Monthly Plan card on the website will state "10% overage forgiveness, then overage at 50¢ per call" and "4 month deposit required for new users" as copy now; the App/API billing work is deferred until the first Monthly Plan subscriber. Docs only; no code changed. Verification: file present, no build impact.

## [2026-09-03] — Pricing decisions executed: Studio $2,500 in Stripe + Airtable, Base = $50 of calls/month renewing only with a card, overage billing turned on, monthly-reset cron made real

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00551-cnw` (100% traffic)
- **Commit:** `c4e38bd2` (merges `05618fb7`, `94ce591a`, `fd68884a`, `97321677`, and `3032e445` into `fix/graph-trials-canonical-mcp-url`)
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

Decisions by Piers on 2026-09-03 (final, after several revisions the same evening): pricing unit is the **API call at $0.50** (Airtable `Plan.Price Per Call`), charged by volume; the Offerings page is a guide; **Studio = $2,500/mo**; **Base-Free = 100 free API calls ($50) every month, but a free-tier account renews only if a card is on file — then 50¢/call overage**; paid subscriptions renew on their Stripe cycle; **overage billing ON**; **Starter and Team plans deleted** (by Piers, in Airtable).

### Changed — live systems (no code deploy required)
- **Stripe / Studio**: created `price_1UBhzwAYuoIyU8CGHX3flLYb` ($2,500/mo) on the real "Fodda Studio" product `prod_UPTfX1OPqwVNmF`; product description → "5,000 API calls per month."; new payment link `plink_1UBhzxAYuoIyU8CGHugHcbq9` (`https://buy.stripe.com/bJe5kC3Pr2l7gmY3RN6g80i`); archived the $1,500 price `price_1TQeiIAYuoIyU8CGfCssI9Fd` and link `plink_1TQeiJAYuoIyU8CGWFymQgjb` (0 subscribers affected). Airtable Plan 5: `stripePriceId`, `stripeLink`, `oneOff stripeLink` repointed; `Stripe Product ID` corrected (it pointed at "ENTERPRISE — Single Graph").
- **Airtable / Base-Free**: `Price Per Call` 0 → 0.5. `Monthly API Limit` stays 100 (it is the allowance field every code path reads).
- **Cloud Run `fodda-sandbox`**: new revision `fodda-sandbox-00547-jmx` with `STRIPE_OVERAGE_PRICE_ID=price_1TkoMEAYuoIyU8CGkwcDId2u` (the active $0.50 metered price) and `STRIPE_OVERAGE_METER_EVENT=fodda_overage_tokens`. Before this, production had neither var, `createOverageSubscription` took its skip branch, and overage had never billed anyone (0 subscriptions on either overage price). Local `.env` was pointing at the archived $0.20 price; corrected.
- **Cloud Scheduler job `fodda`** (monthly reset, `0 0 1 * *`): had POSTed to the placeholder `https://your-domain/api/cron/monthly-reset` every month since 2026-03-07 and never succeeded. Now targets the real route `https://app.fodda.ai/api/account/cron/monthly-reset` with the `x-cron-secret` header set, and is **PAUSED until the revision carrying the card-gated reset (below) is deployed — unpause after that deploy**, otherwise the Oct 1 run would renew every free account regardless of card.

### Changed — code
- **`server/routers/accountRouter.ts` (commit `05618fb7`)**: reset `overageTokensThisCycle` to 0 at all 6 cycle boundaries (monthly-reset cron, card-add catch-up renewal, Stripe `invoice.payment_succeeded` renewal, both plan conversions, and trial->Base). Removed `"monthlyQueries": 0` write in trial->Base conversion (computed Airtable rollup that caused 422 errors).
- **`frontend/components/BillingPage.tsx` (commit `94ce591a`)**: dropped the Lava Wallet action button and `useLavaWallet` hook usage from BillingPage (focus on SPT; Stripe Top Up remains).
- **`server/routers/accountRouter.ts` (commit `fd68884a`)**: Base allowance stays 100 (`Monthly API Limit`). Emits price string `"Free"` in `/api/account/plans` and `/admin/lookup` for any plan flagged `Is Free Tier`, preventing the computed `monthlyPriceUSD` ($50 = 100 calls × $0.50 allowance value) from showing as a charged price in the UI.
- **`server/routers/accountRouter.ts` `/cron/monthly-reset`**: rewritten. Resolves each account's Plan; skips Stripe subscriptions (webhook renews them) and consumable one-time plans (Top-Up); **free-tier accounts renew only when `hasPaymentMethod` is true** — otherwise only `nextRenewalDate` is rolled forward. Returns `{ reset, skippedNoCard, skippedSubscription, skippedOneTime }`. Two latent bugs removed on the way: the old Top-Up skip tested `acc.fields.planCode === 7` but Accounts has no `planCode` field (never matched); and the update wrote `limitReached`, which is not an Airtable field, so every per-row update would have 422'd.
- **Phantom `limitReached` field removed everywhere it was written** (`helpers.ts` `incrementUsage` when a free user hits the wall; five account flows in `accountRouter.ts`) and from the gate in `queryRouter.ts`. Each of those Airtable updates was failing wholesale on the unknown field — e.g. the App-side cycle-counter increment silently stopped persisting exactly when a free user reached the limit.
- **`deploy_gcp.sh`**: `--set-env-vars` now carries `STRIPE_OVERAGE_PRICE_ID` and `STRIPE_OVERAGE_METER_EVENT` so future deploys keep overage on.
- **`server/routers/authRouter.ts`**: profile payload adds `billingMode` and `isFreeTier` (from the linked Plan) alongside the earlier `overageRate` / `hasPaymentMethod` / `overageEnabled`.
- **`frontend/components/BillingPage.tsx`**: free tier without a card shows "Renews monthly with a card on file"; genuinely one-time plans (`billingMode: one_time` and not free tier, e.g. Top-Up) show one-time wording; everything else stays monthly.
- **`shared/types.ts`**: `Account.billingMode`, `Account.isFreeTier`.

### Deliberately not done / handed off
- **API side of the same rule** — the API's lazy reset needs the identical card gate, and `nextRenewalDate` must be set at signup (today ~87% of Base accounts have none, so nothing can renew them): `Fodda API/briefs/Brief - Card-Gated Monthly Renewal for Base & nextRenewalDate at Signup (API Agent).md`.
- **Website copy** — add the renewal condition and "$50 of API calls free every month" framing; remove Starter/Team remnants; verify the Studio button lands on $2,500: `Fodda Website/briefs/Brief - Base One-Time Copy, Studio $2,500 Link & Plan Card Cleanup (Website).md` (content updated to the monthly model; filename kept).
- **Offerings guide** (`typical_calls` ~10× below what the API meters) — `Fodda API/briefs/Brief - Measure Offering API Calls & Refresh typical_calls Guide (API Agent).md` + `.agents/workflows/measure-offering-calls.md`.
- One account is flagged `overageEnabled` with no Stripe subscription (has a customer id); no back-charging — Piers to decide whether to subscribe it for future overage.
- Base-Free `monthlyPriceUSD` was set to 50 in Airtable during the evening and renders as "$50" in `/api/account/plans`; that field is the charged price — awaiting Piers's word to set it back to 0.
- 4 accounts have no Plan link after the Starter/Team deletion (no Stripe subscriptions); awaiting Piers's word to link them to Base-Free.
- Top-Up plan: 0 accounts on it, 0 accounts with bonus calls ever, 2 lifetime `Token Purchases` rows — recommended hiding it (`showinApp?` off) and removing the billing-page Top Up button; awaiting Piers's word.

### Verification
- `npm run build` → `✓ check:undefined — no TS2304 errors in frontend/, shared/, index.tsx` → `✓ built in 2.15s` (after the cron rewrite; re-run after the `limitReached` cleanup recorded below).
- `npx tsc --noEmit` → 57 errors (unchanged from before this batch); none in `accountRouter.ts`, `BillingPage.tsx`, `authRouter.ts`, `types.ts`, `helpers.ts`, `queryRouter.ts`.
- Stripe: `GET /v1/prices/price_1UBhzwAYuoIyU8CGHX3flLYb` → `unit_amount 250000, active true, product prod_UPTfX1OPqwVNmF, interval month`; old link/price `active: false`.
- Airtable Plan 5 PATCH response shows the new `stripePriceId` / `stripeLink` / `Stripe Product ID`; Base-Free PATCH shows `Price Per Call: 0.5`.
- `gcloud run services describe fodda-sandbox` → `fodda-sandbox-00547-jmx`, both env vars SET. `gcloud scheduler jobs describe fodda` → `PAUSED`, uri `https://app.fodda.ai/api/account/cron/monthly-reset`.
- Not yet exercised: a real card-add → `/activate-overage` → Stripe subscription creation on the new revision; and the rewritten cron against live Airtable (run it once manually with the header after deploy and check the returned counts). Recommend one test with a Fodda-owned card before announcing.

### Deploy checklist for this batch
1. Deploy (ships the card-gated cron + `limitReached` cleanup + billing labels).
2. `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.fodda.ai/api/account/cron/monthly-reset` once; confirm `skippedNoCard` ≈ number of free accounts without a card and `reset` is small.
3. `gcloud scheduler jobs resume fodda --location us-central1`.

### Files Changed
- `deploy_gcp.sh`, `server/routers/authRouter.ts`, `server/routers/accountRouter.ts`, `server/routers/queryRouter.ts`, `server/helpers.ts`, `frontend/components/BillingPage.tsx`, `shared/types.ts`, `CHANGELOG.md`

---

## [2026-09-03] — App feedback fixes: Coverage crash, Ask silent failures, billing labels & Airtable-sourced overage rate (Matthew Quint / David Johnson-Igra feedback)

### Fixed
- **Coverage / My Graphs rendered a completely blank app (`frontend/App.tsx`)**: `onToggleGraph={toggleGraph}` referenced an identifier that was never defined; it threw at render and, with no ErrorBoundary, React 19 unmounted the entire root on `/coverage` and `/graphs`. Defined `toggleGraph` (toggles the user's `disabledGraphs` CSV and persists via `dataService.updateDisabledGraphs`, mirroring `MyGraphsPage`).
- **Ask rendered an empty bubble on fatal errors (`server/routers/mcpRouter.ts`)**: `mcpChat` returns `{ answer: '', failureType, error }` on MCP-connect / key-rejection / model failures, and the route reported it as `ok: true`, so the client showed nothing captioned "Unable to route" and discarded the cause. Now `ok: !result.error`, so the real error reaches the chat's error bubble.
- **`"global"` graph id from the Home "Ask Fodda Assistant" CTA (`server/routers/mcpRouter.ts`)**: normalised to `'all'` before `mcpChat` and in the Questions log. Previously injected "You MUST search the graph \"global\" first", guaranteeing a tool miss on a new user's first question.
- **Sidebar "Ask" did nothing on first click (`frontend/components/Sidebar.tsx`)**: it was a collapsible header with no navigation; opening it now takes the user to the chat (`sandbox`).
- **Billing page mixed two units under one word (`frontend/components/BillingPage.tsx`)**: the per-cycle counter (API calls) was labelled "queries" next to the lifetime questions-asked rollup, producing "134 / 100" beside "26 all-time" for a user who had asked 26 questions costing 134 API calls. Relabelled to "API Calls Used This Cycle", "Questions Asked (all time)", "N API calls / month", "Monthly Allowance: N API calls"; the lifetime figure no longer falls back to the call count.
- **Hardcoded `$0.50/call` copy (`BillingPage.tsx`, `UsageWarningBanner.tsx`)**: the rate now comes from the Airtable Plan record (`Price Per Call`) via the profile payload's `overageRate`. When the plan carries 0 or no rate, no figure is named ("your plan's overage rate" / "Per plan — see pricing").
- **`hasPaymentMethod` / `overageEnabled` never returned by `GET /api/auth/profile` (`server/routers/authRouter.ts`)**: BillingPage therefore always rendered "No Card Saved / Overage Paused" on load. Both Airtable checkboxes are now returned, plus `overageTokensThisCycle` and `overageRate` (from the linked Plan's `Price Per Call`, fetched as `fetchedPricePerCall`).
- **`UsageWarningBanner` imported but never rendered (`frontend/App.tsx`)**: mounted above both chat views; users at 80% of allowance or over it now get an in-app warning. Banner accepts an `overageRate` prop instead of hardcoding the figure.
- **Legacy signup `ReferenceError` (`server/routers/authRouter.ts:213`)**: `company` was undefined in scope (req.body destructures it as `rawCompany`), so the Streak sync call threw before `res.json`. Now passes `String(rawCompany || '').trim()`. The same bug at `webhookRouter.ts:183/215/218` is spun off as a separate task.
- **`dataService.mcpChat` return type (`shared/dataService.ts`)**: added `failureType` and `traceJson`, removing a pre-existing TS2339 in `App.tsx`.

### Added
- **`frontend/components/ErrorBoundary.tsx`**, wrapped around the app root in `index.tsx`: a render error in one view now shows a reload card instead of a blank page.
- **Build gate `scripts/check-undefined-identifiers.mjs`** — `npm run build` now runs `check:undefined` before `vite build` and fails on any `TS2304` ("Cannot find name") in `frontend/`, `shared/`, `index.tsx` — the exact class that shipped the Coverage crash, which esbuild does not catch. Deliberately scoped to that class because the repo carries other pre-existing type errors. Also added `npm run typecheck` (`tsc --noEmit`).

### Verification
- `npm run build` → `✓ check:undefined — no TS2304 errors in frontend/, shared/, index.tsx`, then `vite build` ✓ (1681 modules, built in 2.10s).
- `npx tsc --noEmit` → **57 errors (60 before this change)**: removed the `toggleGraph` TS2304, the `company` TS2304 in `authRouter.ts`, and the `failureType` TS2339 in `App.tsx`; **none introduced** — zero errors in `BillingPage.tsx`, `UsageWarningBanner.tsx`, `Sidebar.tsx`, `ErrorBoundary.tsx`, `dataService.ts`, `mcpRouter.ts`, `authRouter.ts`, `index.tsx`; remaining `App.tsx` errors are the pre-existing TS2322/TS2345/TS18048/TS2339/TS2367 set.
- `npm run preflight` → all three OAuth suites passed (Source Guards, Allowlist Behavior, Route Wiring).
- **Not yet exercised in a running app** (worktree has no `.env`). Needs a manual pass on `/coverage`, Ask (including a forced MCP failure), and `/account/billing` before deploy.

### Deliberately not changed (decisions pending with Piers)
- Base-Free `Price Per Call` is 0 in Airtable while `createOverageSubscription` attaches the $0.50 Stripe price to any card-adder.
- Studio is advertised at $2,500 but Airtable Plan 5's `stripePriceId` and `stripeLink` both resolve to the active $1,500 "Fodda Studio" price.
- `STRIPE_OVERAGE_PRICE_ID` / `STRIPE_OVERAGE_METER_EVENT` / `STRIPE_BASE_PRICE_ID` are absent from `deploy_gcp.sh`'s `--set-env-vars` list, so production skips Stripe subscription creation and overage has never billed (0 subscriptions on either overage price). Local `.env` also points at the archived $0.20 price; the active one is `price_1TkoMEAYuoIyU8CGkwcDId2u` ($0.50).

### Files Changed
- `frontend/App.tsx`, `frontend/components/BillingPage.tsx`, `frontend/components/UsageWarningBanner.tsx`, `frontend/components/Sidebar.tsx`, `frontend/components/ErrorBoundary.tsx` (new), `index.tsx`
- `server/routers/mcpRouter.ts`, `server/routers/authRouter.ts`, `shared/dataService.ts`
- `scripts/check-undefined-identifiers.mjs` (new), `package.json`, `CHANGELOG.md`

---

## [2026-09-03] — Fix undeclared `company` reference in Clerk webhook provisioning

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00548-hrg` (100% traffic)
- **Commit:** `4ade0207`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

### Fixed
- **`server/routers/webhookRouter.ts`**: three sites inside `provisionUser` referenced an undeclared identifier `company` (lines 183, 215, 218). Because `tsx` does not type-check, these would throw `ReferenceError: company is not defined` at runtime whenever a Clerk `user.created` webhook provisioned a user — breaking the new-team-member owner notification email and the Streak CRM sync for both expert and non-expert sign-ups.
- Replaced each with the in-scope, already-cleaned `effectiveCompany` value (the same variable written to the Airtable `Company` field at line 154). `effectiveCompany` falls back to an empty string when no real company name is available, which matches the Clerk-webhook reality of empty company/jobTitle for OAuth sign-ups. Behaviour is otherwise unchanged.

### Verification
- `npx tsc --noEmit 2>&1 | grep TS2304 | grep webhookRouter.ts` → no output (zero `TS2304` errors in `webhookRouter.ts`).

### Files Changed
- `server/routers/webhookRouter.ts`

## [2026-09-03] — Restore Email + Password Sign-In (temporary, for ChatGPT reviewer) (`briefs/Brief - Restore Email+Password Sign-In (temporary, for ChatGPT reviewer) — App Agent.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00546-4qc` (100% traffic)
- **Commit:** `9543900d`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

### Added & Updated (Temporary Measure)
- **Password Sign-In Option (`frontend/components/AuthGate.tsx`)**:
  - Added optional password sign-in path and field behind feature flag `ENABLE_PASSWORD_SIGNIN = true`, enabling username/password authentication for OpenAI's ChatGPT Apps Directory reviewer account (`chatgpt-review@fodda.ai`).
  - Calls `signIn.password({ identifier: email, password })` and completes via `signIn.finalize()` and `readPendingOAuthRedirect()`, reusing the exact same OAuth resume logic so the ChatGPT connector handshake continues to the consent screen.
  - Added small UI toggle ("or sign in with password instead" / "or sign in with a code instead") in both the AI assistant connect view (`hasRedirectUrl`) and the standard app login view.
  - Preserves existing SSO (LinkedIn, Google, GitHub) and 6-digit email-code paths unchanged. Sign-up flow remains code-only.
  - Updated contradictory copy: adjusted marginalia and sign-in description while password mode is active.
  - Reversibility: setting `ENABLE_PASSWORD_SIGNIN = false` or removing the gated block cleanly reverts the application to code-only authentication after OpenAI approval.

---

## [2026-09-03] — OAuth consent: allow OpenAI host family in CSP form-action

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00544-9h7` (100% traffic)
- **Commit:** `7198290`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

### Fixed
- `server/index.ts`: added `https://openai.com` and `https://*.openai.com` to Helmet CSP `formAction`. The OAuth consent Allow button was blocked for OpenAI's platform-verification connector (a different DCR client than the end-user one) because its redirect chain lands on an openai.com host. Chrome's form-action redirect-chain check reported the violation against the initial clerk.fodda.ai POST, masking the real target.
- `server/index.ts`: added `https://img.clerk.com` and `https://images.clerk.dev` to `imgSrc` so Clerk avatars render on the consent page (cosmetic; was console noise, not a blocker).

## [2026-09-03] — ChatGPT OAuth: CSP form-action + client-neutral sign-in copy

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00543-lhh` (100% traffic)
- **Commit:** `dd89bf9`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

### Fixed
- `server/index.ts`: added `https://chatgpt.com`, `https://*.chatgpt.com`, `https://*.oai.com` to Helmet CSP `formAction`. The OAuth consent Allow button silently failed for ChatGPT because the redirect target was blocked by CSP (Claude origins were whitelisted, ChatGPT was not).
- `frontend/components/AuthGate.tsx`: sign-in heading/subcopy no longer hardcode "Claude" ("Connect Fodda" / "Sign in to let your AI assistant cite your Fodda knowledge graphs"), so the shared consent page reads correctly for ChatGPT and any MCP client.

## [2026-09-02] — Connector OAuth Resume Hardening & Drift-Proofing (`briefs/connector-oauth-resume-hardening.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00542-256` (100% traffic)
- **Commit:** `1c257c0`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, 15m storage TTL expiry unit tests, route wiring & effect guards)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker + strict-origin referrer + form-action CSP, Clerk code-only configuration, Clerk display_config paths, and signed-out authorize chain probe

### Hardened & Fixed
- **Clerk-Native SSO Redirect Threading (`frontend/components/AuthGate.tsx`, `frontend/components/SsoCallbackPage.tsx`)**:
  - Threaded `resumeTarget` directly through `signIn.sso()` / `signUp.sso()` `redirectUrl` and `redirectCallbackUrl` (`/sso-callback?redirect_url=${encodeURIComponent(resumeTarget)}`).
  - `SsoCallbackPage.tsx` extracts target from query parameter first, using storage only as fallback. Dropped `continueSignUpUrl`.
  - Removed premature storage clearing from `SsoCallbackPage.tsx`.
- **Storage Hygiene & Expiry Helper (`shared/oauthResumeStorage.ts`)**:
  - Created centralized helper managing `fodda.pendingOAuthRedirect`, `fodda.pendingOAuthResume`, `fodda.pendingOAuthRedirectAt`, and `fodda.oauthPending`.
  - Enforced 15-minute TTL (`OAUTH_REDIRECT_EXPIRY_MS = 15 * 60 * 1000`); expired entries are discarded and purged automatically on read.
  - Eliminated inline `sessionStorage`/`localStorage` reads and writes across `AuthGate.tsx`, `SsoCallbackPage.tsx`, `OAuthConsentPage.tsx`, and `App.tsx`.
  - `OAuthConsentPage.tsx` clears storage keys once `clerkUserId` is confirmed.
- **App Effect Guards on OAuth Consent Route (`frontend/App.tsx`)**:
  - Added early-return guards on `/oauth-consent` and `/sso-callback` for both the billing deep-link effect and `handleSessionStart` auto-checkout effect.
  - Prevents `window.history.replaceState` and automatic checkout from running and stripping `client_id`, `redirect_uri`, `scope`, and `state`.
- **Clerk Runtime Pinning (`index.tsx`)**:
  - Pinned `<ClerkProvider clerkJSVersion="6.30.1" />` to protect against unexpected upstream CDN script mutations.
- **Branch & Deploy Hygiene (`deploy_gcp.sh`, `.agents/workflows/deploy.md`)**:
  - Added `git merge-base --is-ancestor 3c176c1 HEAD` and clean working tree checks before build/deploy in `deploy_gcp.sh`.
  - Removed 3 stale detached worktrees in `.claude/worktrees/*`.
  - Updated deploy documentation to align with current branch and ancestor requirements.
- **Preflight & Post-Deploy Smoke Checks (`scripts/oauth-preflight.mjs`, `scripts/oauth-smoke.mjs`)**:
  - Preflight: Added static guards for `signInForceRedirectUrl`, `server/index.ts` CSP/referrer headers, `App.tsx` effect guards, and unit tests verifying 15-minute TTL storage expiry and cleanup.
  - Smoke: Added live assertions for `display_config.oauth_consent_url`, `display_config.sign_in_url`, response headers (`referrer-policy: strict-origin-when-cross-origin`, CSP `form-action` containing `https://clerk.fodda.ai`), and a signed-out authorize chain probe (`/oauth/authorize` -> `/oauth/authorize/continue` -> landing on `app.fodda.ai` targeting `/oauth-consent`).
- **Rule Invariants (`.agents/rules/connector-oauth-flow.md`)**:
  - Appended rules 7–10 (SSO native threading, centralized storage helper, App effect guards, and fresh browser profile testing guidance).

### Verification
- `npm run preflight`: Passed all 4 layers (source guards, allowlist behavior, storage expiry unit tests, route wiring & effect guards).
- `npm run build`: Vite build completed cleanly with 0 errors.
- `node scripts/oauth-smoke.mjs`: Passed all 4 checks against live production endpoints including header inspection and DCR authorize probe.

---

## [2026-09-02] — Normalize Clerk OAuth Consent Redirect to App Consent Route (`briefs/Brief - Normalize Clerk OAuth Consent Redirect to App Consent Route.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00541-n4s` (100% traffic)
- **Commit:** `3c176c1`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, route wiring)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker, and Clerk code-only configuration

### Fixed
- **Clerk OAuth Consent Redirect Normalization (`shared/redirectAllowlist.ts`)**:
  - Implemented and exported `normalizeOAuthRedirectUrl()` to rewrite any redirect URL targeting `accounts.fodda.ai/oauth-consent` to same-origin `/oauth-consent${search}${hash}`.
  - Ensures unauthenticated users completing login from Claude custom connector OAuth prompts (`https://mcp.fodda.ai/mcp`) land on the dedicated `<OAuthConsentPage />` rather than Clerk's hosted account portal stub.
- **OAuth Resumption Flow Wiring (`frontend/App.tsx`, `frontend/components/AuthGate.tsx`, `frontend/components/SsoCallbackPage.tsx`)**:
  - `frontend/App.tsx`: Applied `normalizeOAuthRedirectUrl` to `redirect_url` and `pendingOAuthRedirect`/`pendingOAuthResume` storage keys before navigating to the target consent route.
  - `frontend/components/AuthGate.tsx`: Applied `normalizeOAuthRedirectUrl` in OTP sign-in and sign-up completion handlers to directly route authenticated users to `/oauth-consent`.
  - `frontend/components/SsoCallbackPage.tsx`: Applied `normalizeOAuthRedirectUrl` in fast-path OAuth resume and post-extra-fields completion handler.
- **Preflight Test Coverage (`scripts/oauth-preflight.mjs`)**:
  - Added unit test cases for `normalizeOAuthRedirectUrl` asserting correct extraction and rewriting of `accounts.fodda.ai/oauth-consent` URLs with query parameters while preserving non-matching routes and rejecting invalid/malicious domains.

### Verification
- `npm run preflight` executed and passed 100% (Source Guards, Allowlist Behavior with `normalizeOAuthRedirectUrl`, and Route Wiring checks).
- `npm run build` executed and passed with zero TypeScript or bundling errors.

### Files Changed
- `shared/redirectAllowlist.ts`
- `frontend/App.tsx`
- `frontend/components/AuthGate.tsx`
- `frontend/components/SsoCallbackPage.tsx`
- `scripts/oauth-preflight.mjs`
- `CHANGELOG.md`

---

## [2026-08-31] — Fix Account Grouping for Public Email Domains & Remediate Gmail Users

### Fixed
- **Public / Consumer Email Domain Isolation (`server/constants.ts`, `server/routers/webhookRouter.ts`, `server/routers/authRouter.ts`)**:
  - Defined `GENERIC_EMAIL_DOMAINS` and `isGenericEmailDomain` helper covering common consumer providers (`gmail.com`, `yahoo.com`, `outlook.com`, `icloud.com`, `proton.me`, etc.).
  - Prevented automatic company account matching (`{Account Name} = company`) when users register with generic email domains and no specific company name, ensuring each user receives their own individual Base account and API key.
  - Added `{accountStatus} = 'active'` filter when querying existing accounts by name, preventing newly registering users or organizations from ever linking to deleted accounts.
  - Fixed account deletion anonymization logic in `server/routers/accountRouter.ts` to query linked users directly by record ID and properly clear date fields.

### Remediated
- **Split 13 Active Users from Deleted Account `recN3rQCduEVgxPFu`**:
  - Created individual active Base accounts (`Plan: recFePJbSswaTTmHX`) with dedicated active API keys and `Owner` roles for all 13 active users previously grouped under `recN3rQCduEVgxPFu`.
  - Anonymized the original deleting owner (`the.stuart.martin@gmail.com` -> `deleted_recPYIvs6gFiYkQVr@fodda.ai`) attached to `recN3rQCduEVgxPFu`.

### Verification
- Ran verification script against Airtable confirming all 13 users are linked to their new active accounts as Owners with active API keys, and only the single anonymized deleted user remains on `recN3rQCduEVgxPFu`.

---

## [2026-08-28] — OAuth-Flow Preflight Guards, Deploy Gate & Post-Deploy Smoke Suite (`briefs/oauth-flow-preflight-guards.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00536-zfz` (100% traffic)
- **Commit:** `b90f584`
- **Preflight Gate:** `npm run preflight` → Passed cleanly (source guards, allowlist behavior, route wiring)
- **Post-Deploy Smoke Check:** `npm run smoke:oauth` → Passed HTTP 200 checks on `/`, `/oauth-consent` with bundle marker, and Clerk code-only configuration

### Added & Changed
- **OAuth Preflight Test Suite (`scripts/oauth-preflight.mjs`, `npm run preflight`)**:
  - Implemented multi-layer static and behavior test suite executed prior to build and deployment:
    - **Source Guards**: Recursively scans all frontend files ensuring zero occurrences of forbidden magic-link/legacy Clerk methods (`emailLink`, `sendEmailLink`, `prepareEmailAddressVerification`, `prepareFirstFactor`) and ensures no inline redirect host checks exist outside `shared/redirectAllowlist.ts`.
    - **Allowlist Behavior Verification**: Unit tests `isValidRedirectUrl` against malicious domains (`https://evilfodda.ai`, `https://notclerk.com`, `//evil.com`, `/\evil.com`, `javascript:alert(1)`) and valid routes (`/dashboard`, `https://app.fodda.ai/x`, `https://clerk.fodda.ai/oauth/x`, `https://accounts.fodda.ai/oauth-consent`); asserts `isInternalAppUrl` rejects all non-app hosts.
    - **Route Wiring**: Verifies existence of `frontend/components/OAuthConsentPage.tsx` and routes `/oauth-consent` to `<OAuthConsentPage />` in `frontend/App.tsx`.
- **Post-Deploy Smoke Suite (`scripts/oauth-smoke.mjs`, `npm run smoke:oauth`)**:
  - Validates live production OAuth infrastructure post-deployment:
    - `GET https://app.fodda.ai/` → HTTP `200`.
    - `GET https://app.fodda.ai/oauth-consent` → HTTP `200` and verifies `OAuthConsent` component marker is present in served JS bundles.
    - `GET https://clerk.fodda.ai/v1/environment` → HTTP `200` and validates Clerk `email_address` configuration is strictly email-code only (`verifications: ['email_code']`, `first_factors: ['email_code']`).
- **Slack Alert Dispatcher & Fail Banner (`scripts/slack-alert.mjs`)**:
  - On any preflight or smoke failure, dispatches alert message `🛑 OAuth-flow guard FAILED (<preflight|smoke>) on deploy of <commit>: <first failing check>` to `#fodda-sales` (`C0AV0HLSF24`) using `SLACK_BOT_TOKEN`.
  - Fallbacks cleanly to an unmissable console failure banner if `SLACK_BOT_TOKEN` is unset in the execution environment, always failing closed.
- **Deploy Script & Workflow Integration (`deploy_gcp.sh`, `.agents/workflows/deploy.md`)**:
  - Wired `npm run preflight` as an abort-on-failure gate before Docker build/deploy.
  - Appended `npm run smoke:oauth` as an automated post-deployment validation step.

### Verification
- `npm run preflight` executed on main working tree: passed 100% (source guards, allowlist test cases, route wiring).
- Deliberate violation test (injected `sendEmailLink` into scratch frontend file): preflight caught the issue, posted `🛑 OAuth-flow guard FAILED (preflight) on deploy of f35e46c: Forbidden token 'sendEmailLink' found in frontend/test_violation_temp.ts...` to Slack `#fodda-sales`, and aborted with exit code 1. Reverted test file and verified clean pass.
- `npm run smoke:oauth` executed against live endpoints: passed 100% (HTTP 200 on `/`, HTTP 200 + `OAuthConsent` marker on `/oauth-consent`, and Clerk environment code-only configuration verified).

### Files Changed
- `scripts/slack-alert.mjs` (new)
- `scripts/oauth-preflight.mjs` (new)
- `scripts/oauth-smoke.mjs` (new)
- `package.json`
- `deploy_gcp.sh`
- `.agents/workflows/deploy.md`
- `CHANGELOG.md`

## [2026-08-26] — Dedicated OAuth Consent Route on app.fodda.ai (`briefs/custom-oauth-consent-page.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00535-zpw` (100% traffic)
- **Health Check:** `GET /health` → HTTP `200`
- **Route Check:** `GET /oauth-consent` → HTTP `200` with `strict-origin-when-cross-origin` referrer policy

### Added & Changed
- **Dedicated Custom `/oauth-consent` Route (`frontend/components/OAuthConsentPage.tsx`, `frontend/App.tsx`)**:
  - Built custom OAuth consent page hosted on `app.fodda.ai/oauth-consent` using `@clerk/react`'s prebuilt `<OAuthConsent />` component, resolving the dead-end issue with Clerk's default-hosted `accounts.fodda.ai/oauth-consent`.
  - **Signed-In Flow**: Renders `<OAuthConsent />` in a minimal, focused container with Fodda masthead branding and standard Allow / Deny buttons. No app navigation, sidebars, or escape links.
  - **Signed-Out Flow**: Direct visits preserve the full URL (`window.location.pathname + window.location.search + window.location.hash`) as `pendingOAuthRedirect` and `pendingOAuthResume` in `sessionStorage`, rendering `AuthGate` for immediate LinkedIn/Google/Email authentication.
  - **Referrer Policy**: Enforced `strict-origin-when-cross-origin` policy in `<head>` (via `index.html` and dynamic runtime check in `OAuthConsentPage.tsx`) required for Clerk Frontend API form POSTs.
  - **Fast-Path Resume Compatibility (`frontend/App.tsx`, `frontend/components/SsoCallbackPage.tsx`)**: Guarded resume effect to prevent self-redirection loops on `/oauth-consent`, and updated `SsoCallbackPage.tsx` to directly replace location to `pendingResume`.

### Files Changed
- `frontend/components/OAuthConsentPage.tsx` (new)
- `frontend/App.tsx`
- `frontend/components/SsoCallbackPage.tsx`
- `index.html`
- `CHANGELOG.md`

## [2026-08-26] — AuthGate Sign-In Button Hierarchy (LinkedIn-First) (`briefs/authgate-button-hierarchy.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00533-l6q` (100% traffic)
- **Health Check:** `GET /health` → HTTP `200`

### Changed
- **LinkedIn-First Button Hierarchy (`frontend/components/AuthGate.tsx`)**:
  - Reordered and restyled authentication options across both sign-in and sign-up variants of AuthGate:
    - **LinkedIn**: Large primary button, full width, prominent `#0A66C2` styling with high contrast.
    - **Google**: Visually quieter secondary button directly beneath LinkedIn.
    - **Email**: Quiet text link (*"or continue with email"*) that reveals the email-code form on demand (auto-expanded if email parameter, legacy magic link, or confirm return is present).
    - **GitHub**: Quiet text link (*"GitHub"* / *"or continue with GitHub"*) keeping GitHub SSO fully functional while reducing visual clutter.
  - Applied the identical hierarchy to the Claude-connector OAuth screen (`hasRedirectUrl`), default sign-in screen, Step 1 registration screen (`isSignUp`), and Referral landing screen (`referralGraph`).
  - Updated hero callout banner to highlight LinkedIn fast-path on the Claude OAuth connector screen.
- **Provider User Verification**:
  - Queried Airtable (`USERS_TABLE`) and Clerk (`clerkClient.users.getUserList()`): confirmed **0 existing users** authenticated via GitHub provider. Demoting GitHub to a quiet text link preserves backward compatibility with zero user disruption.

### Files Changed
- `frontend/components/AuthGate.tsx`
- `CHANGELOG.md`

## [2026-08-26] — Clerk Email-Code Sign-In & OAuth Redirect Hardening (`briefs/clerk-email-code-oauth-resume.md`)

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00532-r7k` (100% traffic)
- **Health Check:** `GET /health` → HTTP `200`

### Added & Changed
- **Clerk Future API Email-Code (OTP) Flows (`frontend/components/AuthGate.tsx`, `frontend/components/AuthGateAtoms.tsx`)**:
  - Replaced legacy/magic-link calls with Clerk Core 3 Future API methods: `signIn.emailCode.sendCode()`, `signIn.emailCode.verifyCode({ code })`, `signUp.verifications.sendEmailCode()`, and `signUp.verifications.verifyEmailCode({ code })`.
  - Added 6-digit OTP verification screen (`isWaitingForConfirmation`) with autofocus input, resend handler (`handleResend`), explicit post-finalize navigation, and storage cleanup on reset/abandon.
  - Added legacy magic link detection notice (`legacyMagicLinkDetected`) when `__clerk_db_jwt` or `__clerk_status` are present, informing users that email link sign-in was replaced by 6-digit codes.
  - Updated `FieldRule` with `maxLength`/`autoFocus` support and `Btn` with `style` prop.
- **Shared Dot-Anchored Redirect Allowlist (`shared/redirectAllowlist.ts`)**:
  - Built unified validator (`isValidRedirectUrl`, `isClerkOAuthContinueUrl`, `isInternalAppUrl`) enforcing dot-anchored host matching (`host === 'fodda.ai' || host.endsWith('.fodda.ai')`, `clerk.com`, `clerk.fodda.ai`, `accounts.fodda.ai`), rejecting protocol-relative URLs (`//evil.com`, `/\\evil.com`), and permitting relative internal paths.
  - Applied shared allowlist across `App.tsx`, `AuthGate.tsx`, `SsoCallbackPage.tsx`, and `server/routers/authRouter.ts`.
- **Hardened `/api/auth/confirm` & Token Protection (`server/routers/authRouter.ts`)**:
  - `/api/auth/confirm` validates redirect URLs against the shared allowlist.
  - Ensures 15-minute `loginToken` is ONLY appended for internal app URLs (`app.fodda.ai` or relative `/...`), preventing token exfiltration to external targets.
  - Failure redirect preserves `redirect_url` only when allowlist validation passes.

### Files Changed
- `shared/redirectAllowlist.ts` (new)
- `frontend/components/AuthGate.tsx`
- `frontend/components/AuthGateAtoms.tsx`
- `frontend/components/SsoCallbackPage.tsx`
- `frontend/App.tsx`
- `server/routers/authRouter.ts`
- `CHANGELOG.md`

## [2026-08-26] — Chat Failure UX Cleanup & Query Library Button Removal (`frontend/components/ChatInterface.tsx`)

### Changed
- **Removed Broken Query Library Button**: Removed the legacy `[BROWSE QUERY LIBRARY]` button that dispatched `'show query library'` as a prompt (which caused repeated `DIDNT_ROUTE` loops).
- **Improved `DIDNT_ROUTE` Banner Messaging**: Replaced technical error copy (*"Query didn't match a tool handler. Try phrasing your prompt using forcing verbs..."*) with actionable guidance (*"Unable to route query to an available graph or tool. Try selecting a specific expert graph from the dropdown above, or phrase your prompt around a specific domain or topic."*).
- **Suppressed Redundant Raw Text**: Prevented raw `"No response generated."` text from rendering above classified failure cards.

### Files Changed
- `frontend/components/ChatInterface.tsx`
- `CHANGELOG.md`

## [2026-08-26] — Delay OAuth Welcome Email by 2 Hours

### Changed
- **Delayed OAuth Welcome Email Dispatch (`server/routers/webhookRouter.ts`)**:
  - Delayed `sendSystemEmail('OAUTH_WELCOME', ...)` by 2 hours (`OAUTH_WELCOME_DELAY_MS = 2 * 60 * 60 * 1000`) upon Clerk `user.created` webhook receipt.
  - Prevents immediate welcome emails from interrupting users while they are in the middle of authorizing their LLM / Claude connector or running initial queries.

### Files Changed
- `server/routers/webhookRouter.ts`
- `CHANGELOG.md`

### Deployment
- **Cloud Run Service:** `fodda-sandbox` (`gen-lang-client-0472572023`, `us-central1`)
- **Active Revision:** `fodda-sandbox-00531-4wz` (100% traffic)
- **Health Check:** `GET /health` → HTTP `200`
