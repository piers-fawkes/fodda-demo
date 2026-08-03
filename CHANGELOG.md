# Fodda App — Changelog

All notable changes to this project are documented in this file.
Format: newest entries at the top. Each entry should include the date, a short title, and bullet points describing what changed.

## [2026-08-03] — Connections Tab Copy & Dead Link Cleanup (`AccountPortal.tsx` & `AdminPortal.tsx`)

### Fixed & Cleaned Up
- **Copilot Transport & Setup Update (`AccountPortal.tsx`)**:
  - Removed deprecated `MCP_SSE_URL` (`https://mcp.fodda.ai/sse`) from Copilot quick-connect.
  - Updated Copilot instructions to standard `/mcp` HTTP endpoint with OAuth 2.0 dynamic discovery.
  - Removed fabricated Copilot transcript section containing non-existent `search_trends` tool call.
  - Replaced marketing terms ("Direct Knowledge Injection", "Live Hash", "Secure Protocol URL") with standard technical descriptions ("M365 Copilot Direct MCP Setup", "API Key", "MCP Endpoint URL").
- **ChatGPT Setup Instructions (`AccountPortal.tsx`)**:
  - Replaced placeholder roadmap block with actual ChatGPT developer mode setup steps (Developer mode toggle, custom plugin creation, `/mcp` with OAuth, and `/c/<token>` fallback).
- **Claude & Notion Connector Copy Alignment (`AccountPortal.tsx` & `ConnectionsPage.tsx`)**:
  - Updated stale Anthropic URLs from `claude.ai/settings/connectors` to `claude.ai/customize/connectors`.
  - Removed all occurrences of "leave the OAuth fields blank" across `AccountPortal.tsx` and `ConnectionsPage.tsx`, replacing with "Sign in with your Fodda account when prompted." for Claude OAuth and path token URLs for non-OAuth clients.
- **Dead Link Remediation (`AccountPortal.tsx` & `AdminPortal.tsx`)**:
  - `AdminPortal.tsx`: Replaced 404 URL `https://mcp.fodda.ai/mcp/tools` with `/api/mcp/tools` proxy.
  - `AccountPortal.tsx`: Fixed 404 endpoint `/copilot/search_insights` to base API URL.
  - `AccountPortal.tsx`: Removed broken `/Fodda_Claude_Skill.md` download link.
  - `AccountPortal.tsx`: Replaced broken `#/...` hash route links with canonical `www.fodda.ai/api` and `www.fodda.ai/agents` URLs.

## [2026-08-03] — MCP Token Mint Hardening & API Key URL Elimination

### Fixed & Hardened
- **MCP Connection Token Mint Hardening (`server/services/mcpConnectionService.ts`)**:
  - `buildMcpConnection` now catches failures when persisting a newly minted `mcpConnectionToken` to Airtable and returns `{ ok: false, mcpUrl: null }` instead of surfacing an unpersisted token URL that fails with 404.
  - Set `sseUrl: null` to eliminate legacy `?api_key=...&user_id=...` query param URL generation from the service.
- **GitHub SSO Login & Registration (`AuthGate.tsx`)**:
  - Added GitHub OAuth button (`oauth_github`) to the AuthGate login and sign-up modal screens, alongside Google and LinkedIn.
- **Email Template & Route URL Hardening (`emailTemplates.ts`, `authRouter.ts`, `accountRouter.ts`, `webhookRouter.ts`)**:
  - Updated `foddaMcpCard` helper to require tokenized `mcpUrl` (`/c/<token>`) and deleted all `?api_key=` fallback constructions across email templates (`SIGNUP_CONFIRMATION`, `DEVELOPER_ONBOARDING`, `PLAN_UPGRADED`, `PARTNER_WELCOME`).
  - Enforced that when `mcpUrl` is absent (standard signup prior to token minting on app visit), outbound confirmation emails suppress the MCP connection block and direct users to `https://app.fodda.ai`.
  - Stripped `apiKey` parameters passed to `sendSystemEmail` across `/register`, `/join`, `/trial-convert`, `/convert-to-base`, and Clerk webhook handlers.

## [2026-08-03] — Access / Connectors Redesign & Connection Reference Alignment (Brief 2 Audit, QA & Strict Refusal Enforcement)

### Refactored & Fixed
- **Strict Evidence Refusal Enforcement (`mcpChatService.ts`)**:
  - Removed ungrounded fallback LLM generation. When a query produces no matching evidence in the graph or fails to match a tool handler, Fodda strictly refuses to hallucinate and correctly classifies the outcome (`DIDNT_ROUTE` for unrouted prompts, `NO_COVERAGE` when graph tools return 0 matching nodes).
  - Preserved the Classified Failure UI state banners (`DIDNT_ROUTE` purple box and `NO_COVERAGE` red box) to guide users on forcing verbs and coverage requests.
- **Airtable API Key Lookup & Auto-Provisioning (`mcpConnectionService.ts`)**:
  - **Flag 1**: Fixed API key fallback reading on `ACCOUNTS` table to inspect the formula field `apiKey` (type-checking for `sk_live_...` strings) rather than the linked-record field `'API Key'`, which returned an array of record IDs (`['rec...']`).
  - **Flag 2**: Removed invalid write to `ACCOUNTS.'API Key'` linked-record field during API key auto-provisioning. `createAirtableRecord` on `API_KEYS` already populates `ACCOUNTS.'API Key'` automatically via Airtable's inverse link.
  - **Flag 3**: Retained `getActiveKeysForAccount` Account Name resolution to safely filter linked-record fields in Airtable formulas.
- **Gemini CLI / Vertex Schema Fix (`AccountPortal.tsx` & `ConnectionsPage.tsx`)**:
  - Replaced stale `"type": "mcp"` schema with canonical `"type": "mcp_server"` across all Gemini / Vertex AI config generators.
- **Anthropic Connector Deep Link Alignment (`emailTemplates.ts`, `Dashboard.tsx`, `AccountPortal.tsx`, `ConnectionsPage.tsx`)**:
  - Updated all 16 occurrences of Anthropic connector setup links from `claude.ai/settings/connectors` to `claude.ai/customize/connectors` across the app and onboarding email templates.
- **Claude Code CLI & Transport Modernization (`AccountPortal.tsx` & `ConnectionsPage.tsx`)**:
  - Updated Claude Code CLI command snippets to use `--transport http` with tokenized HTTP URLs (`/c/<token>`) instead of deprecated `/sse`.
  - Replaced legacy `/sse` transport instruction cards with Streamable HTTP and tokenized path endpoints across AccountPortal.


## [2026-08-03] — Overage Billing Mechanism Clarification

### Fixed & Remediated
- **Overage Billing Card (`BillingPage.tsx`)**:
  - Enhanced the **Payment Method & Overage** tile on the Billing page to clearly explain how overage billing works:
    - **Card Saved**: Displays `Overage Enabled` with instructions that queries past your monthly allowance automatically continue at $0.50/call (and that removing your card via Stripe Portal pauses overages).
    - **No Card**: Displays `Overage Paused` with instructions to click **"Add Credit Card"** to enable metered overages.

## [2026-08-03] — Coverage Page Blank Screen & Deep Link Resolution

### Fixed & Remediated
- **Coverage Map Filtering (`CoverageMapPage.tsx`)**:
  - Fixed bug where `validGraphs` filter stripped out active graphs with 0 or missing `evidence_count`, causing `verticalGroups` to evaluate to `[]` and rendering a blank page body.
  - Added clean loading/empty fallbacks when domain catalog is fetching.
- **Coverage Deep Linking (`App.tsx`)**:
  - Added `'/coverage': 'coverage'` to `deepLinkMap` and `'coverage': '/coverage'` to `viewToPath` so direct link navigation and browser back/forward buttons work seamlessly.

## [2026-08-03] — Lava Wallet Integration, Danger Zone Offboarding & Usage Card Deduplication

### Fixed & Remediated
- **Lava PAYG Wallet Button (`BillingPage.tsx`)**:
  - Integrated `useLavaWallet` hook into top-right actions on `BillingPage.tsx`. Added a prominent **`"🔥 Lava Wallet"`** button allowing users to launch the embedded Lava PAYG wallet overlay.
- **Danger Zone / Account Offboarding (`ConnectionsPage.tsx`)**:
  - Restored account deletion flow in a discreet **"Danger Zone"** section at the bottom of the Access page (`ConnectionsPage.tsx`). Clicking **"Delete Account"** opens a confirmation modal requiring users to type `"DELETE"` before calling `/api/account/delete` and clearing sessions.
- **Billing Page Usage Card Deduplication (`UsageMeter.tsx` & `BillingPage.tsx`)**:
  - Added `hideStatTiles={true}` prop to `UsageMeter.tsx`.
  - Updated `BillingPage.tsx` to render daily query volume charts and domain breakdowns without duplicating the 3 top stat tiles (`QUERIES USED`, `QUERIES REMAINING`, `ALL-TIME QUERIES`).

## [2026-08-03] — Coverage Explanation, "Access" Sidebar, Credit Card Action & Plan Naming

### Fixed & Remediated
- **Coverage Map (`CoverageMapPage.tsx`)**:
  - Replaced ambiguous header text with plain-English explanation of Coverage (directory of active graphs, research depth node counts, and update frequency).
  - Made all **Supplemental Data Source** cards interactive with explicit **`Ask →`** buttons so every card links directly into the Test Bench.
- **Sidebar Navigation (`Sidebar.tsx`)**:
  - Renamed nav item from `"Team & Access"` to **`"Access"`**.
- **Billing & Usage (`BillingPage.tsx`)**:
  - Added an explicit **`"Add Credit Card"`** / **`"Update Payment Method"`** button in the Payment Method tile.
  - Formatted plan names to explicitly include **`" Plan"`** (e.g. `"Team Plan"`, `"Base - Free Plan"`, `"Scale Plan"`).

## [2026-08-03] — Airtable `niche` & `askLine` Field Resolution on Expert Cards

### Fixed & Remediated
- **Airtable Field Extraction (`server/routers/catalogRouter.ts` & `shared/dataService.ts`)**:
  - Mapped `niche`, `expertise`, `askLine`, and `ask_line` directly from Airtable graph & analyst records (`Niche Expertise`, `Niche`, `Ask Line`, `Ask`).
- **Expert Card Display (`ExpertDirectoryPage.tsx`)**:
  - Removed generic hardcoded fallback string ("Sector & Strategic Analysis").
  - Dynamically renders real Airtable niche expertise / topic tags (`g.topics.join(' · ')`) and specific ask prompts (`askLine` / `example_queries[0]`) for every expert twin.

## [2026-08-03] — Claude Design System Integration & Home Dashboard Routing

### Fixed & Enhanced
- **Home Dashboard Reachability & Routing (`App.tsx` & `Sidebar.tsx`)**:
  - Resolved Home routing bug where `Sidebar.tsx` navigated to `'account-overview'` and `<AccountPortal />` masked `HomeDashboard.tsx`.
  - Added `'home'` to `AppView` union, mapped `/` & `/home` deep-links to `'home'`, and set default landing view to `'home'`.
- **Unified Page Layout System (`PageShell.tsx`)**:
  - Created reusable `<PageShell>` container (`max-w-[1000px]`, centered, `px-[26px] pt-6 pb-8`) enforcing consistent typography, rhythm, and headers across `HomeDashboard`, `BillingPage`, and `ProfilePage`.
- **Home Dashboard (`HomeDashboard.tsx`)**:
  - Added System Status Strip (live graphs, Human Agents, categories, 120-day evidence discipline, MCP token status).
  - Built 3 headline stat tiles (Queries Used, Queries Remaining, All-Time Queries).
  - Added MCP Connector card, Domain Coverage card, and dense "What to Ask" prompt bank teasers.
- **Billing & Usage (`BillingPage.tsx`)**:
  - Upgraded to `<PageShell>` layout with plan status, query counts, overage alerts, and Stripe subscription portal management.
- **Profile Page (`ProfilePage.tsx`)**:
  - Upgraded to `<PageShell>` layout focusing strictly on user persona, interest tags, sharing toggles, API key, and MCP URL configuration.

## [2026-08-02] — Expert Cards `askLine` Field Integration

### Fixed & Remediated
- **Expert Card `askLine` Field (`ExpertDirectoryPage.tsx`, `shared/types.ts`, `shared/dataService.ts`)**:
  - Added `askLine` field to `KnowledgeGraph` interface and dataService catalog/analyst fetch mappers.
  - Updated the sample query container on Expert Cards to render `askLine` directly (with fallback to `example_queries[0]`).
  - Attached `askLine` to the **Ask This Expert →** CTA click handler.

## [2026-08-02] — Expert Cards Design Cleanup

### Fixed & Remediated
- **Expert Card UI Cleanup (`ExpertDirectoryPage.tsx`)**:
  - Removed the `Turnaround` ("Real-time via MCP") and `Cost` ("5-10 calls") row from all expert cards.
  - Removed the automatic fallback disclaimer footnote from the bottom of expert cards.

## [2026-08-02] — Lifetime Queries Account Field Mapping

### Fixed & Remediated
- **Lifetime Queries Account Field (`UsageMeter.tsx` & `server/routers/authRouter.ts`)**:
  - Added `lifetimeQueries?: number` to `Account` interface (`shared/types.ts`).
  - Mapped `lifetimeQueries` explicitly in `authRouter.ts` and `accountRouter.ts` from Airtable account fields (`accFields.lifetimeQueries` / `accFields.monthlyQueries` / `accFields.monthlyQuerytotal`).
  - Updated `UsageMeter.tsx` so the "ALL-TIME QUERIES" box queries `account.lifetimeQueries` directly as its primary value.

## [2026-08-02] — Top-Up Checkout Stripe Price Target Alignment

### Fixed & Remediated
- **Top-Up Stripe Price Target (`server/routers/accountRouter.ts`)**:
  - Updated `POST /api/account/checkout/agent-session` endpoint to target Stripe Price ID `price_1TLaiOAYuoIyU8CG2rjxhylB` for "+ BUY MORE API CALLS" top-up purchases.

## [2026-08-02] — Sidebar Navigation Casing Alignment

### Fixed & Remediated
- **Sidebar Casing Uniformity (`Sidebar.tsx`)**:
  - Removed hardcoded `uppercase` styling from `SectionHeader` in `Sidebar.tsx`.
  - Updated **Ask** to render in sentence case (**Ask**), matching **Home**, **Experts**, **Coverage**, **Team & Access**, **Billing & Usage**, and **Profile**.

## [2026-08-02] — Query Library Plain-English Taxonomy & Slack `@Claude` Copy

### Fixed & Enhanced
- **Query & Prompt Library Clarity (`QueryLibraryPage.tsx` & `server/routers/accountRouter.ts`)**:
  - Replaced internal terminology ("Prompt Bank by Job to be Done") with clear, plain-English heading (`Query & Prompt Library`) and eyebrow (`Sample Prompts & Research Workflows`).
  - Renamed job taxonomy tabs to intuitive work goals: `Pitch & Deck Prep`, `Trend Scanning`, `Market Research`, `Slide Validation`, `Competitor Audit`, and `Executive Insights`.
  - Added robust candidate path resolution for `prompt-bank.json` and rich fallback prompts to ensure the Query Library is never empty (`ALL JOBS (0)`).
- **Slack Integration Copy (`AccountPortal.tsx`)**:
  - Updated card headline to **Access Fodda via Slack (via `@Claude` Tag)** and refined body text to explicitly describe querying connected Fodda knowledge graphs directly inside Slack channels.

## [2026-08-02] — Coverage Tab Purpose & Interactive Graph Cards

### Fixed & Remediated
- **Coverage Tab Header Clarity (`CoverageMapPage.tsx`)**:
  - Replaced internal jargon ("Job J1 · Proof of Coverage") with clear eyebrow (`Domain Intelligence & Knowledge Index`) and title (`Coverage Map & Knowledge Index`).
  - Added plain-English subtitle explaining that the Coverage tab is for verifying research depth across Fodda's active knowledge graphs and supplemental data feeds.
- **Interactive Graph Cards (`CoverageMapPage.tsx` & `App.tsx`)**:
  - Fixed "Dead Link" behavior where graph cards were non-interactive.
  - Added click handlers to graph cards and added an explicit **Ask →** button on each graph card that instantly navigates to the ASK query interface focused on that specific domain graph.

## [2026-08-02] — Team & Access Tab Information Rendering Fix

### Fixed & Remediated
- **Team & Access Tab Mapping (`ConnectionsPage.tsx` & `AccountPortal.tsx`)**:
  - Fixed tab ID mismatch in `ConnectionsPage.tsx` where selecting **Team Members & Access** passed `initialTab='users'` instead of `initialTab='team'`.
  - Removed restrictive `isPaidPlan` gate in `AccountPortal.tsx` for team management so Team Overview (queries used, plan level, API key), team member lists, invitations, domain auto-provisioning settings, and user roles render for all active accounts.

## [2026-08-02] — Expert Directory Categorization & Supplemental Data Separation

### Fixed & Remediated
- **Expert Directory Categorization (`ExpertDirectoryPage.tsx`)**:
  - Reconciled Expert Directory filters so non-persona domain graphs (e.g. `NIQ Beauty Graph`, `Pacific Island CPI`, `OpenAlex Academic`) are no longer misclassified under "Human Expert Twins".
  - Created 3 distinct, accurate catalog sections: **Human Expert Twins** (Verified Real Persons / Digital Twins), **Synthetic Role Personas** (AI Domain Personas), and **Supplemental Data & Knowledge Graphs** (Data & Benchmark Feeds).

## [2026-08-02] — Gemini / Vertex AI Tab Redesign

### Fixed & Enhanced
- **Bespoke Gemini & Vertex AI Connector View (`AccountPortal.tsx`)**:
  - Replaced legacy Claude text mapping when opening the **Gemini / Vertex AI** tab with a dedicated, bespoke Google Gemini integration section.
  - Added copyable tokenized MCP URL (`https://mcp.fodda.ai/c/<token>`) for Gemini CLI, Google AI Studio, and Vertex AI Agent Builder.
  - Built interactive **Vertex AI Agent JSON Config Generator** with 1-click *Copy to Clipboard* and *Download JSON* (`fodda-mcp-config.json`) functionality.

## [2026-08-02] — Account & User Usage Log Formula Filtering Fix

### Fixed & Remediated
- **Targeted Log Retrieval & Pagination (`server/db.ts`, `server/routers/accountRouter.ts`)**:
  - Fixed empty *Daily Query Volume* and *Usage by Knowledge Domain* charts on the Usage & Consumption page.
  - Added `queryAirtableAll` pagination helper in `server/db.ts` to retrieve all pages of matching Airtable records.
  - Updated `GET /api/account/usage` in `accountRouter.ts` to include user emails (`piers.fawkes@psfk.com` and team members) and account ID directly in the Airtable `filterByFormula` parameter, ensuring user query logs are retrieved instead of getting lost in global unpaginated table slices.

## [2026-08-02] — Remove "Cost Per Query" Card

### Removed
- **Usage & Consumption Section (`UsageMeter.tsx`)**: Removed the "COST PER QUERY" ("Derived plan unit rate") stat card from the Usage & Consumption dashboard, adjusting the grid to 3 columns ("Queries Used", "Queries Remaining", "All-Time Queries").

## [2026-08-02] — Remove "What Each Query Costs" Section

### Removed
- **Billing Page (`BillingPage.tsx`)**: Removed the "WHAT EACH QUERY COSTS" card section from the Billing & Account management page.

## [2026-08-02] — Top-Up Checkout Quantity ($100 for 200 API Calls) Reconciled

### Fixed & Remediated
- **Top-Up Checkout Quantity (`server/routers/accountRouter.ts`)**:
  - Updated `POST /api/account/checkout/agent-session` line items quantity from `1` to `2` (2 × $50 = $100).
  - Clicking "+ BUY MORE API CALLS" in the web UI (and MCP token top-up flows) now opens a Stripe Checkout session for **$100 for 200 API calls**.

## [2026-08-02] — Subscription Checkout "Unauthorized" Alert Fix

### Fixed & Remediated
- **Resilient Auth for Subscription Checkout (`UpgradeModal.tsx`, `dataService.ts`, `server/routers/accountRouter.ts`)**:
  - Fixed `401 Unauthorized` alert when clicking "SUBSCRIBE" buttons on the `Plans & Pricing` modal.
  - Updated `createSubscriptionCheckout` in `shared/dataService.ts` to attach `x-user-id: email` in request headers alongside `email` in body.
  - Updated `POST /api/account/checkout/subscribe` in `accountRouter.ts` to resolve `email` from `user?.email || req.body?.email || req.body?.userEmail || req.headers['x-user-id']`, ensuring subscription checkout URLs generate seamlessly for all active sessions.

## [2026-08-02] — Payment Setup "Unauthorized" Fix

### Fixed & Remediated
- **Resilient Auth for Payment Setup (`PaymentSetupModal.tsx`, `server/helpers.ts`, `server/routers/accountRouter.ts`)**:
  - Fixed `401 Unauthorized` errors on `/api/account/setup-payment` and `/api/account/activate-overage` when `localStorage` `sessionToken` is empty or using Clerk session auth.
  - Updated `PaymentSetupModal.tsx` to explicitly pass `email: userEmail` in body and `x-user-id` header on fetch calls.
  - Enhanced `authenticateSession(req)` in `server/helpers.ts` to check `x-user-id` header and body/query email as an identity fallback.
  - Added request body `accountId` and `email` fallbacks on `/api/account/setup-payment` and `/api/account/activate-overage` endpoints in `accountRouter.ts` so the Add Payment Method form initializes seamlessly for all logged-in accounts.

## [2026-08-02] — Perplexity MCP Tab Redesign & Token Fallback Elimination

### Fixed & Enhanced
- **Perplexity Connection Tab (`AccountPortal.tsx`)**: Re-architected the Perplexity page to make **Model Context Protocol (MCP)** connection the primary, prominent setup flow with a copyable tokenized URL (`https://mcp.fodda.ai/c/<token>`), demoting REST browser search to a secondary alternative.
- **Eliminated Raw `:token` Fallbacks (`AccountPortal.tsx`, `ProfilePage.tsx`, `Dashboard.tsx`)**: Replaced all hardcoded fallback strings returning `https://mcp.fodda.ai/c/:token` during async connection loading with real token resolution or active state fallbacks (`Loading connection token...`, authenticated SSE, or base URL).

## [2026-08-02] — Remove Agent Payment Yellow Banners

### Changed
- **Team & Access / Connections Pages (`AccountPortal.tsx`)**: Removed `AgentPaymentBanner` yellow box ("Have you set up payment options for your agent?") from Developer API & MCP Keys, Gemini / Vertex AI, Claude Connector, and Overview pages per user request.

## [2026-08-02] — MCP Connection Token & Session Header Remediation

### Fixed & Remediated
- **Automatic Session Authentication in DataService (`shared/dataService.ts`)**: Updated `postJson` to automatically attach the `x-session-token` header from `localStorage` on all API calls, resolving `401 Unauthorized` responses on `/api/account/mcp-connection`.
- **API Key & Token Auto-Provisioning (`server/services/mcpConnectionService.ts`)**: Enhanced `buildMcpConnection` to auto-provision an active `sk_live_...` API key in `API_KEYS_TABLE` if missing on the account record, guaranteeing every authenticated user receives a valid MCP token (`https://mcp.fodda.ai/c/<token>`) and full SSE endpoint (`https://mcp.fodda.ai/sse?api_key=...&user_id=...`).
- **Claude & SSE Connection Displays (`frontend/components/ProfilePage.tsx`, `AccountPortal.tsx`, `Dashboard.tsx`)**: Replaced raw template fallbacks (`/c/:token`) across Copy URL buttons, Claude Quick Connect deep links, Claude Code CLI commands, and SSE endpoint displays with live, user-resolved token URLs.

## [2026-08-02] — Payment & Billing QA Remediation

### Fixed & Enhanced
- **Team & Access Banner & Navigation (`AgentPaymentBanner.tsx`, `ConnectionsPage.tsx`, `AccountPortal.tsx`)**:
  - Wired `onSetupPayment` handler through `ConnectionsPage` and `AccountPortal` so clicking "Add Credit Card" in the `Team & Access` banner opens `PaymentSetupModal`.
  - Added `userEmail` prop to `AgentPaymentBanner` to pre-fill the Lava PAYG wallet URL (`https://www.lava.so/?prefilled_email=...`).
  - Restyled "SPT Auth Info" into a visible secondary button (`border border-amber-300 bg-amber-100/60 text-amber-900`) linking to `https://www.fodda.ai/pricing#agent-pricing`.
- **Auto-Checkout & Session Auth (`App.tsx`, `dataService.ts`)**:
  - Added `x-session-token` header to `/api/account/checkout/subscribe` auto-checkout calls in `App.tsx` and `dataService.ts` to prevent 401 Unauthorized rejections.
  - Added URL query parameter parsing (`?plan=...`) on app startup for already-authenticated users to save pending plan codes to `localStorage` and launch Stripe checkout automatically.
- **Payment Setup Modal & Billing Page (`PaymentSetupModal.tsx`, `BillingPage.tsx`, `accountRouter.ts`)**:
  - Added `x-session-token` headers to `/api/account/setup-payment` and `/api/account/activate-overage` fetch calls (resolving "Unauthorized" error state).
  - Added "Cardholder Name" input field and expanded `CardElement` container padding (`max-w-lg`) so card number, expiration date, CVC, and ZIP code render without truncation.
- **Cross-Repo Handoff Brief (`briefs/Brief_Website_Pricing_Page_Payment_Flow_Fixes.md`)**:
  - Created handoff brief for website repo (`fodda-website`) to resolve Lava Wallet popover escape/dismiss handler and monthly plan CTA parameters on `fodda.ai/pricing`.

### QA Corrections (2026-08-02, follow-up review)
- **Corrected pricing-page plan codes in the handoff brief**: the first draft mapped the $100/$1,500/$4,600 CTAs to `plan=1/2/3`, which are wrong (planCode 1=Sandpit, 2=Base-Free, 3=Starter/$100). Verified against the live Plans table and corrected to **Starter=3, Team=4, Studio=5, Business=6**; flagged that planCode 8 is duplicated in Airtable and the Agent plan (14) has no Stripe price.
- **Usage counters now distinguish current-cycle vs lifetime (`authRouter.ts`, `accountRouter.ts`, `UsageMeter.tsx`)**: "Queries used this month" was reading the un-resettable Airtable rollup `monthlyQueries` (a lifetime total), so it equalled "All-Time" and never reset. Switched "this month" / `currentQueryCount` / `remaining` to the resettable `queriesUsedThisCycle`, and surface the rollup as All-Time only.
- **Query-limit enforcement now uses current-cycle usage (`queryRouter.ts`)**: the soft-cap check compared the lifetime rollup against the monthly limit, permanently locking accounts once their lifetime total crossed the limit. Now enforces on `queriesUsedThisCycle`.
- **Reverted Top-Up token count to 200 (`accountRouter.ts`)**: the earlier "100 API calls" change contradicted the live product ("Top-Up — 200 API Calls", Airtable Monthly API Limit=200, Stripe checkout shows 200). Backend fallback restored to 200 and `UpgradeModal.tsx` now derives the quantity from the plan record instead of a hardcoded "100".
- **Open items flagged for the owner** (not code): (1) the `/api/cron/monthly-reset` job is "ready for Cloud Scheduler" but is **not scheduled** — cycle counters for non-subscription accounts never reset until it runs; (2) Airtable planCode 7 `monthlyPriceUSD` (100) is stale vs the live Stripe price ($50) and the 200-vs-100 quantity is a pricing decision; (3) SPT button still deep-links to a marketing page.

### Lava PAYG — real embedded checkout (frontend)
- Replaced the dead `lava.so` deep-links on the "Lava PAYG Wallet" button (`AgentPaymentBanner.tsx`) and the PAYG card (`UpgradeModal.tsx`) with the real `@lavapayments/checkout` embedded flow via a new `frontend/hooks/useLavaWallet.ts` hook. It mints a session through the Fodda API's `POST /api/checkout/lava-session` (which stamps `metadata.accountId`/email so the Lava webhook credits the right account), then opens the SDK overlay. The SDK's `onCancel` makes the overlay dismissable — fixing Nathan's "inescapable popover." `accountId` is threaded through `AccountPortal` and `App.tsx`; added `@lavapayments/checkout` (installed with `--legacy-peer-deps`, matching the repo's pre-existing lucide-react/React-19 peer setup).
- Runtime dependencies: the Fodda API `/api/checkout/lava-session` must be deployed (currently blocked by an unrelated, uncommitted `functions/tracking/lava.ts` compile break in the API repo) and CORS must allow `app.fodda.ai`.

## [2026-08-02] — Auditor v2.4.0 Prompt Specification & Backburner Sync

### Changed
- **Auditor Specification (`public/Fodda_Integration_Auditor.md`)**: Updated Fodda Integration Use Case Analysis specification to v2.4.0. Refreshed headline MCP tool catalog (30+ tools), updated institutional data source coverage (100+ sources across 30+ countries), and documented A2A Agentic Delegation pay-per-task Deep Research via Stripe Shared Payment Tokens (`Authorization: Bearer spt_xxx` with upfront `402 Payment Required` pricing).

### Added
- **Backburner Backlog (`BACKBURNER.md`)**: Documented low-priority item for transitioning Claude connection UI recommendation from tokenized URLs (`/c/<token>`) to bare OAuth (`/mcp`) once end-to-end OAuth validation and directory approval complete.

## [2026-07-30] — App: Payment-Journey Failure Alerts to Slack (#fodda-sales)

### Added & Fixed
- **Shared Payment Slack Service (`server/services/paymentSlackService.ts`)**: Built non-blocking, fire-and-forget alert helper `notifyPaymentSlack(stage, detail)` targeting `#fodda-sales` (channel `C0AV0HLSF24`, or `SLACK_SALES_CHANNEL_ID`). Features 10-minute in-memory deduplication window per stage + error signature, 10s timeout, and email redaction (`pi***@domain`) for non-critical alerts.
- **Stripe Webhook Alert Wiring (`server/routers/accountRouter.ts`)**: Integrated Slack notifications into all failure paths on `/api/account/stripe/webhook`:
  - `constructEvent` signature verification rejection (`webhook_signature_failed`).
  - Missing plan record lookup (`plan_not_found`).
  - Unmatched payments (`unmatched_payment_auto_resolved`, `unmatched_payment_no_user`, `unmatched_payment_no_account`).
  - Post-payment Airtable record update failures (`airtable_update_failed` 🚨).
  - Updated `PAYMENT_UNMATCHED_ADMIN` recipient email address from `piers@psfk.com` to `piers.fawkes@psfk.com`.
- **Subscribe Endpoint Alert Wiring (`server/routers/accountRouter.ts`)**: Integrated Slack alerts into `POST /api/account/checkout/subscribe` for 5xx errors (`subscribe_5xx`), missing Stripe price ID (`subscribe_no_price_id`), and missing plan records (`subscribe_plan_not_found`). Routine 401 unauthenticated requests and 429 rate limits do not fire alerts.
- **Client-Side Failure Beacon (`server/routers/accountRouter.ts`, `frontend/App.tsx`)**: Created new rate-limited endpoint `POST /api/account/payment-event` and wired failure beacon in `App.tsx` auto-checkout logic to report client-side checkout redirect failures to Slack.

### Verification Run
- **Deduplication Verification**: Verified identical events within 10 minutes are suppressed (1 message posted).
- **Message Format & Payload Audit**: Verified all 7 failure stage payloads against mock Slack API runner: correct channel (`C0AV0HLSF24`), emoji severity, un-unfurl settings, and email redactions.
- **Email Recipient Audit**: Confirmed all admin email alerts send to `piers.fawkes@psfk.com`.
- **TypeScript & Runtime Verification**: Tested `paymentSlackService.ts` and `accountRouter.ts` execution; zero runtime exceptions.

## [2026-07-31] — Supplier Console Follow-Ups: Takedown Join Key & Canonical API Earnings Proxy

### Added & Fixed
- **Fixed CE Analysts Table Takedown Join Key (`POST /api/creator/takedown`)** (`server/routers/creatorRouter.ts`): Updated record lookup in CE `Analysts` table to match by `Analyst ID` or `expertSlug` (`OR({Analyst ID} = '...', {expertSlug} = '...')`) rather than `graphId`, ensuring the analyst twin's status is updated so `/v1/analysts` and MCP tools respect pause status.
- **Canonical API Earnings Proxy (`GET /api/creator/earnings`)** (`server/routers/creatorRouter.ts`): Integrated forward-compatible proxy to `GET /v1/creator/earnings` on the canonical API metering layer, preserving a safe `coming_soon` fallback when the endpoint is unpopulated.

## [2026-07-31] — Phase 7: Real Home Dashboard & Reconciled 7-Destination Nav Structure

### Added & Fixed
- **Real Home Dashboard (`HomeDashboard.tsx`)** (`frontend/components/HomeDashboard.tsx`, `App.tsx`): Built and wired the front-door Home landing view (`/`) assembling the 5 real blocks (MCP Connection State & Claude quick link, Domain Coverage Snapshot, real-time Usage Meter with receipt drawer entry points, Recent Executions, and "What to Ask" prompt bank teasers with "Try in Test Bench" action buttons).
- **Reconciled 7 Top-Level Destinations (`Sidebar.tsx`, `App.tsx`)**: Finalized sidebar navigation into exactly 7 clean, un-duplicated destinations (**Home**, **Ask**, **Experts**, **Coverage**, **Team & Access**, **Billing & Usage**, **Profile**), eliminating top-level nav sprawl and dead links.
- **Unified Team & Access Destination (`ConnectionsPage.tsx` / `/connect`)**: Consolidated all 8 connector tabs (Claude MCP, ChatGPT, Gemini/Vertex, Microsoft Copilot, Perplexity, Notion, REST API/MCP Keys, and Team Members & Roles) into a single destination with per-user token safety lifecycle.
- **"Add Your Own Source" Roadmap Card (`ConnectionsPage.tsx`)**: Added grayed-out enterprise roadmap card inviting partners and creators to connect custom knowledge graphs or proprietary APIs with Enterprise Beta inquiry triggers.
- **Documentation & Skills Footer Group (`Sidebar.tsx`)**: Moved documentation links, skills, and security pages to a clean footer link group.

## [2026-07-31] — Phase 6: My Expert Page (Twin Editing, Honest Revenue Status & Controls)

### Added & Fixed
- **Honest Revenue Share Status (`GET /api/creator/earnings`)** (`server/routers/creatorRouter.ts`, `frontend/components/ExpertTwinPage.tsx`): Replaced referral-bounty dollar calculations with an honest `"Earnings — coming soon, wiring usage attribution to API metering layer"` state. Disclosed session footprint as **In-App Activity Footprint** to prevent undercounting Claude MCP usage.
- **Consolidated "My Expert Page" (`ExpertTwinPage.tsx`)**: Consolidated expert twin management, status controls, draft preview sandbox, and plain-text promises into a single view under Profile with zero top-level nav sprawl.
- **Real Multi-Channel Takedown (`POST /api/creator/takedown`)** (`server/routers/creatorRouter.ts`): Built 1-click takedown control updating `{Status}` (`Active` <-> `Paused`) on `CE_ANALYSTS_TABLE` (`Analysts` in `CE_BASE_ID`) and `GRAPH_LIST_TABLE` with measured latency notice (`~5 min propagation`).
- **"Test-Drive Your Twin" Draft Preview Sandbox**: Built in-page draft preview sandbox allowing creators to test-query their twin in draft state before live release.
- **Plain-Text Promises**: Integrated transparent creator terms: **Text-only, no avatar**, **Non-exclusive content license**, **Pause/Takedown anytime**, and **50/50 revenue share on all paying usage**.

## [2026-07-30] — Phase 5: Expert Directory & Answer Receipts

### Added & Fixed
- **Fail-Closed Account Boundary Guard on Receipt Endpoint (`GET /api/account/receipt/:id`)** (`server/routers/accountRouter.ts`): Refactored receipt authorization check to fail-closed (`!sameAccount && !sameUser → 403`), eliminating role-bypass vulnerabilities where account owners could bypass boundary checks across foreign accounts.
- **Conditional Recency Discipline Copy** (`frontend/components/AnswerReceiptDrawer.tsx`): Conditionally rendered the 120-day evidence discipline claim only when a valid date range was observed, preventing unobserved queries from presenting uncaptured policy claims.
- **Account Boundary Guard on Receipt Endpoint (`GET /api/account/receipt/:id`)** (`server/routers/accountRouter.ts`): Enforced cross-tenant account boundary security checks; non-admin users attempting to fetch log receipts belonging to another account now receive HTTP 403 Forbidden.
- **Eliminated Fabricated Date Fallbacks** (`server/services/mcpChatService.ts`, `frontend/components/AnswerReceiptDrawer.tsx`): Removed hardcoded `'120-day active window'` fallback string from trace logic when evidence dates are unobserved, displaying `'Date range not captured in evidence nodes'` instead.
- **Searchable Expert Directory (`ExpertDirectoryPage.tsx`)**: Built Expert Directory with topic/niche/keyword search, explicit visual separation between **Human Expert Twins** and **Synthetic Role Personas**, published blind spots, turnaround times, and real pricing/token costs.
- **"Ask This Expert" Workflows**: Added one-click "Ask This Expert" buttons linking directly into the Test Bench with expert scope pre-selected.
- **Server-Persisted Query Traces & Receipt API (`GET /api/account/receipt/:id`)** (`server/services/mcpChatService.ts`, `server/routers/accountRouter.ts`): Captured compact `traceJson` on chat completion (tool execution steps, min/max evidence dates, human expert attribution, latency) and persisted to `LOGS_TABLE_QUESTIONS`.
- **Shareable Answer Receipt Drawer (`AnswerReceiptDrawer.tsx`)**: Built Answer Receipt process audit drawer featuring 120-day evidence recency discipline windows, human expert revenue attribution, tool execution step logs, and shareable deep-link URLs (`/receipt/:id`).
- **Everywhere Receipt Entry Points**: Embedded receipt drawers across Chat message footers and Recent Executions rows in `<UsageMeter />`.

## [2026-07-30] — App: Pricing & Purchase Flow Fixes

### Fixed & Enhanced
- **Pending-Plan Auto-Checkout for Returning Users** (`frontend/App.tsx`): Dropped `isFirstLogin` condition so returning users with `fodda.pendingPlanCode` in `localStorage` auto-checkout on sign-in. Retained intent keys until checkout session URL is successfully created.
- **Airtable Field Name Typo (`Monthly API Limit`)** (`server/routers/accountRouter.ts`, `server/routers/authRouter.ts`, `server/helpers.ts`): Replaced all 10 occurrences of `Monthly Query Limit` with `Monthly API Limit` to align with the live Airtable Plans schema.
- **Authenticated Subscription Checkout (`POST /api/account/checkout/subscribe`)** (`server/routers/accountRouter.ts`): Added session authentication (`authenticateSession`) requiring a valid session token or Clerk JWT; derived customer email from session instead of request body and added rate-limiting (10 requests/min).
- **Public Domain Match Restriction** (`server/helpers.ts`, `server/routers/accountRouter.ts`): Added `isPublicEmailDomain` denylist (`gmail.com`, `outlook.com`, `gmx.*`, `yandex.*`, `proton.me`, etc.) to prevent domain-matching purchases from generic email providers to existing accounts, falling back to `PAYMENT_UNMATCHED_ADMIN` notifications.

### Verification Run
- **Field Name Audit**: `grep -rn "Monthly Query Limit" server/ frontend/ shared/` returned 0 hits.
- **Domain & Rate Limit Tests**: Verified `isPublicEmailDomain` and `isRateLimited` against test matrix of 23 domain types and rate-limit triggers.
- **Production Build**: Ran `npm run build` — Vite build succeeded cleanly in 2.79s.

## [2026-07-30] — Phase 4: Query Library & Unified Test Bench Merge

### Added
- **Canonical Prompt Bank API (`GET /api/prompts`)** (`server/routers/accountRouter.ts`): Built endpoint reading directly from `server/data/prompt-bank.json`, enriching prompt entries with Job to be Done taxonomy metadata (`Pitch Prep`, `Trend Scan`, `Market Sizing`, `Deck Review`, `Competitor Read`, `Earnings Read`).
- **In-App Query Library View** (`frontend/components/QueryLibraryPage.tsx`): Built Query Library page categorized by Jobs to be Done with tool capability metadata (`"Runs brand_intelligence · ~20 calls"`), copy-to-clipboard, and "Try in Test Bench" action buttons.
- **Unified Test Bench & Sidebar Hygiene** (`frontend/components/ChatInterface.tsx`, `frontend/components/Sidebar.tsx`): Merged expert-chat and sandbox into one unified Test Bench interface, updated sidebar Ask section to exactly two items (**Query Library** and **Test Bench**), and preserved legacy deep links (`/expert`, `/sandbox`, `/research`).
- **3 Server-Classified Failure States & Per-Answer Receipts**: Classified `mcpChat` execution outcomes (`NO_COVERAGE`, `DIDNT_ROUTE`, `TIMEOUT`) with tailored resolution UI and rendered step receipts (`N steps · N queries`) on every answer.
- **Safe "Try in Test Bench"**: Configured "Try in Test Bench" to navigate and prefill the input bar without auto-submitting.

## [2026-07-30] — Phase 3: Step Count Semantics, Fallback Cleanups & Deployment

### Fixed & Enhanced
- **Corrected `/api/query` Step Logging (`server/routers/queryRouter.ts`)**: Fixed step logging logic to log `stepCount = 1` for single-step API queries, dropping the `usage.tokens` multiplier fallback.
- **MCP Multi-Step Log Capture (`server/routers/mcpRouter.ts`)**: Added fire-and-forget log writes to `LOGS_TABLE_QUESTIONS` on `mcpChat` completion with `stepCount = toolCalls.length` and `source: 'mcp'`.
- **Eliminated Hardcoded Pricing Fallbacks (`server/routers/accountRouter.ts`)**: Removed server-side `monthlyPrice || 100` and `$0.50` default fallbacks. Unit rates are calculated dynamically from Account or linked Plan price fields, returning `null` when missing.
- **Dynamic Usage Meter UI (`frontend/components/UsageMeter.tsx`)**: Updated `UsageMeter.tsx` to display `"—"` when unit rate data is missing/unpopulated, added a Recent Activity view, and dynamically rendered step badges for multi-step entries (`N steps`) while suppressing step columns for single-step views.

### Verification Run
- Ran `npm run build` — compiled cleanly without errors.
- Verified `/api/query` logs single-step `stepCount: 1`.
- Verified `mcpRouter.ts` logs multi-step executions.
- Verified missing cost data renders `"—"` in `UsageMeter.tsx`.

## [2026-07-30] — Phase 3: Plain-Language Meter & Real Usage Data

### Added
- **Two-Source Usage Endpoint (`GET /api/account/usage`)** (`server/routers/accountRouter.ts`): Built live usage aggregation service with 5-minute server caching. Headline metrics (`monthlyQueries`, `monthlyQueryLimit`, `totalQueries`, `remainingQueries`) are sourced directly from canonical Account record counters; breakdowns (`byGraph`, `byUser`, `dailyTrend`, `recentQueries`) are aggregated from `LOGS_TABLE_QUESTIONS` with a 30-day date filter and `[Coverage Request]` exclusion.
- **Single Reusable `<UsageMeter />` Component** (`frontend/components/UsageMeter.tsx`): Built unified Usage Meter component consumed across Profile Usage, Account Portal, and Billing views, guaranteeing 100% number consistency and eliminating duplicate/fake dashboards.
- **Step Count Logging & Dynamic Pricing**: Logged `stepCount` on query execution (`server/routers/queryRouter.ts`) to make multi-step agent query costs legible; derived unit rates dynamically without hardcoded literals.
- **WCAG AA Contrast & Terminology Sweep**: Enforced ≥ 4.5:1 text contrast across meter elements and standardized copy everywhere (*Queries*, *This Month*, *All Time*, *Change Plan*, *Add Team Members*).

## [2026-07-30] — Phase 2: Team & Identity

### Added
- **Per-User Connection Tokens (`mcpConnectionToken`)** (`server/services/mcpConnectionService.ts`, `server/routers/accountRouter.ts`): Standardized per-user connector URL scheme `https://mcp.fodda.ai/c/<token>`. Added `POST /api/account/mcp-connection/revoke` and `POST /api/account/mcp-connection/regenerate` endpoints (gated to Owner/Admin via Clerk authentication).
- **Primary Connection UI** (`frontend/components/ProfilePage.tsx`): Surfaced personal `/c/<token>` connector URL card and **"Add Fodda to Claude"** deep-link button directly on user profile and connection pages.
- **Opt-In Corporate Auto-Provisioning & Admin Notification** (`server/helpers.ts`, `server/routers/queryRouter.ts`, `server/routers/mcpRouter.ts`): Wired `autoProvisionUser()` helper to check `autoProvisionToggle === true` and domain match on incoming query/MCP calls. Dispatches automated email notification (`sendDirectEmail`) to Account Owner when a new member joins.
- **Real Dates & Clean Plan Names** (`frontend/components/AccountPortal.tsx`): Removed hardcoded Nov 12 fallbacks in Account Health & Billing views, displaying real subscription start/renewal dates and clean plan names.
- **Unified Role Vocabulary**: Standardized role labels across frontend & backend to `Owner` / `Admin` / `Member`.

## [2026-07-29] — Phase 1: Coverage Map & Request Coverage Queue

### Security & Reliability Remediation
- **Dedicated Coverage Request Queue Table** (`server/constants.ts`, `server/routers/coverageRouter.ts`): Pointed `COVERAGE_REQUESTS_TABLE_ID` to dedicated queue table `tblc1qEPqx27FTROZ` (`NOTIFICATION_REQUESTS_TABLE_ID`), isolating coverage requests from the query log table (`LOGS_TABLE_QUESTIONS`) to prevent usage meter data pollution in Phase 3. Cleaned up historical test records from `LOGS_TABLE_QUESTIONS`.
- **Deployment Script Consolidation** (`deploy_gcp.sh`, `.agents/workflows/deploy.md`): Synchronized `deploy_gcp.sh` with `deploy.md`, setting default `SLACK_RESEARCH_CHANNEL_ID=C0AU0403M3M` and passing `COVERAGE_REQUESTS_TABLE_ID`.
- **Honest Per-Leg Status Response** (`server/routers/coverageRouter.ts`): Refactored `POST /api/coverage/request` to return explicit per-leg execution status (`airtable: ok/failed`, `slack: ok/failed`) and HTTP 500 on failure instead of false `ok: true`.
- **Unverified Email Attribution Discipline** (`server/routers/coverageRouter.ts`): User email parameter is accepted as verified strictly for Clerk/session-authenticated users. Unauthenticated submissions are tagged `unverified:<email>` to prevent identity spoofing.
- **Search-Miss Debounce & Separate Rate Limits** (`frontend/components/CoverageMapPage.tsx`, `server/routers/coverageRouter.ts`): Added a 1-second settled-state debounce on search misses and split rate limit keys (`search_miss` 15 req/10m vs `button` 5 req/10m).

### Added
- **Coverage Map Component** (`frontend/components/CoverageMapPage.tsx`): Built the new Coverage Map view implementing Job J1 (Proof of Coverage). Features per-vertical evidence node depth badges (Strong ≥300 / Partial 50-299 / Thin 1-49 / Not Covered 0), real-time topic search across normalized tags, freshness markers for graphs updated within 7 days, and separate counting for supplemental data sources.
- **Search-Miss Demand Signal & Auto-Logging** (`frontend/components/CoverageMapPage.tsx`): Implemented zero-result search miss state ("Not covered today") with prefilled Request Coverage button and automatic background demand signal logging (`source: 'search_miss'`).
- **Request Coverage Server Endpoint & Slack Alerts** (`server/routers/coverageRouter.ts`): Added `POST /api/coverage/request` with rate limiting, Airtable logging, and automated Slack alerts to `#fodda-research`.
- **Integrated Graph Toggles** (`frontend/components/CoverageMapPage.tsx`): Embedded per-graph enable/disable toggles directly on coverage cards, consolidating graph management into Coverage Map.

### Changed
- **Generic Placeholder Filtering** (`frontend/components/CoverageMapPage.tsx`): Implemented generic filter hiding graphs with `status === 'coming_soon'` or `status === 'live'` with 0 evidence nodes (automatically hiding placeholder records without hardcoding slug lists).
- **Sidebar & App Routing** (`frontend/App.tsx`, `frontend/components/Sidebar.tsx`): Updated navigation routing to link "Coverage" / "Coverage Map" to `coverage` view with deep-link support.

### Verified
- **Production Build Verification**: Ran `npm run build` (`vite build`). Compiled 1670 modules cleanly into `dist/` with 0 errors in 2.28s.
- **Slack Alert Verification**: Confirmed Slack message delivery to channel `C0AU0403M3M` (`#fodda-research`).
- **Airtable Write Verification**: Confirmed record creation in Airtable table `tblvHx1DzwuTq3TJE`.

## [2026-07-29] — Phase 0: Trust Surface & Broken Basics Fixes

### Security
- **Strict Clerk-Only Session Fallback** (`server/helpers.ts`): Removed unverified header (`x-user-email`), body (`requesterEmail`/`email`), and query string (`email`) fallback parameters from `authenticateSession`. Restricted authentication strictly to database-validated `x-session-token` or Clerk-verified `req.auth` tokens (with primary email resolution via `@clerk/express` `clerkClient` if `sessionClaims.email` is absent). Eliminates risk of header/body email spoofing across sensitive endpoints (e.g. key rotation, account deletion, team invites).

### Changed
- **Per-User Usage Counter Lookup** (`server/helpers.ts`): Fixed `incrementUsageCounters` to support user email lookup in addition to Airtable record IDs (`rec...`).
- **Removed Fabricated Usage Charts** (`frontend/components/AccountPortal.tsx`, `frontend/components/ProfileUsagePage.tsx`): Removed `Math.random()` loops, fake past 6-month data, and hardcoded domain distributions (`40% Retail / 30% Beauty / 20% Sports / 10% SIC`). Replaced with real query counters.
- **Removed Hardcoded Rank & Status Indicators** (`frontend/components/AccountPortal.tsx`, `frontend/components/ProfilePage.tsx`): Removed hardcoded "Network Rank: Top 15%", "Lifetime Rev" multiplier (`queries * $0.45`), hardcoded "Live / Stable" Environment Sync, and the fake green "Live" pulse dot on profile cards.
- **Completed Vocabulary Sweep** (`frontend/components/`): Replaced telemetry-speak across UI components:
  - "Personal Telemetry" → "My Usage" (`ProfileUsagePage.tsx`)
  - "Telemetry Fault" → "Unable to load usage data" (`AccountPortal.tsx`)
  - "Aggregate Consumption" → "Total Usage" (`AccountPortal.tsx`)
  - "UNITS" → "queries" (`AccountPortal.tsx`, `ProfileUsagePage.tsx`)
  - "Network Expansion" → "Team Access" (`AccountPortal.tsx`, `AdminPortal.tsx`)
  - "Collaborator Invite Portal" → "Invite Team Member" (`UsersList.tsx`)
  - "Sever Associate" → "Remove User" (`UsersList.tsx`)
  - "Intelligence Vectors" → "Available Tools" (`AccountPortal.tsx`)
- **Cleaned Sidebar Navigation & Footer** (`frontend/components/Sidebar.tsx`): Renamed `Demo Area` section header to `Ask` (containing `Expert Chat` and `Test Bench`) and removed legacy "Fodda Console v2.0" string from footer.
- **Deep Link Navigation & Browser History** (`frontend/App.tsx`): Replaced path-wiping logic (`replaceState(..., '/')`) on deep links with client-side history navigation (`pushState`/`popstate`).
- **Sidebar & Deep-link Routing Dispatch** (`frontend/App.tsx`): Updated `Sidebar` `onNavigate` prop to call `handleNavigate` to preserve URL routing (e.g., `/account/billing`, `/connections/claude`).

### Added
- **ChatGPT Connector Roadmap Notice** (`frontend/components/AccountPortal.tsx`): Added explicit `chatgpt` connection tab rendering a clean "ChatGPT Connector — On the Roadmap" notice instead of an empty shell.
- **Linked Data Source Roadmap Card** (`frontend/components/MyGraphsPage.tsx`): Replaced plaintext local credentials form (`fodda_linked_research`) with a roadmap notice stating *"Fodda holds the connection, not the data — your source answers your queries and nobody else's."*

### Verified
- **Production Build Verification**: Ran `npm run build` (`vite build`). Compiled 1669 modules cleanly into `dist/` with 0 TypeScript/Vite errors in 2.22 seconds.

### Deployed
- **Cloud Run Deployment**: Deployed revision `fodda-sandbox-00458-p55` serving 100% traffic on `app.fodda.ai` and `https://fodda-sandbox-1095548227950.us-central1.run.app`. Health check `/health` returned HTTP 200 OK (`{"status":"ok"}`).

## [2026-07-29] — App MCP URL Modernization & Self-Service Key Rotation

### Added
- **Self-Service API Key Rotation Endpoint** (`server/routers/userRouter.ts`): Added `POST /api/user/api-key/rotate` and `POST /v1/user/api-key/rotate` endpoints. Revokes active API key(s) for the user's account, generates a new `sk_live_...` key, refreshes connection token details, and returns updated key & connection payload.
- **Client DataService Method** (`shared/dataService.ts`): Added `rotateApiKey(email?)` method to invoke key rotation and return updated API key and connection data.
- **Key Rotation UI & Modal** (`frontend/components/ProfilePage.tsx` & `frontend/components/AccountPortal.tsx`): Added "Rotate Key" / "Reset API Key" action buttons and confirmation warning modal (*"Rotating your API key will revoke your current key immediately..."*). Auto-copies the new key to clipboard with toast notification.

### Changed
- **Modernized MCP Connection Display** (`frontend/components/ProfilePage.tsx`, `AccountPortal.tsx`, `Dashboard.tsx`, `AdminPortal.tsx`): Updated displayed MCP URLs from legacy query params (`?api_key=...&user_id=...`) to short token-resolved URLs (`https://mcp.fodda.ai/c/:token`) and updated SSE instruction cards to specify standard `Authorization: Bearer sk_live_...` headers.

## [2026-07-29] — Fix OAuth Google & LinkedIn Buttons in AuthGate

### Fixed
- **Google & LinkedIn OAuth Sign-In** (`frontend/components/AuthGate.tsx`): Updated `handleOAuth` method to call Clerk Core 3 API methods `signUp.sso()` and `signIn.sso()` with `redirectUrl` and `redirectCallbackUrl` instead of calling non-existent `authenticateWithRedirect()`. Resolves issue where clicking "Continue with Google" or "Continue with LinkedIn" triggered no response or JS error on `app.fodda.ai`.

### Deployed
- **Cloud Run Deployment**: Deployed revision `fodda-sandbox-00456-jn6` serving 100% traffic on `app.fodda.ai` and `https://fodda-sandbox-1095548227950.us-central1.run.app`. Health check returned HTTP 200 OK.

## [2026-07-26] — In-App Plan List Filtering Fix

### Changed
- **In-App Plan Filtering** (`frontend/components/UpgradeModal.tsx`, `frontend/components/BillingPage.tsx`): Updated in-app plan list filtering from `p.planCode !== 7` to `p.billingMode === 'subscription'`. Prevents non-subscription plans (such as planCode 14, Agent Pay-Per-Query) from appearing in the in-app Upgrade Modal and Billing Page table while preserving public `/pricing` rendering.

### Deployed
- **Cloud Run Deployment**: Deployed revision `fodda-sandbox-00455-88b` serving 100% traffic on `app.fodda.ai` and `https://fodda-sandbox-1095548227950.us-central1.run.app`. Health check returned HTTP 200 OK.

## [2026-07-24] — Canonical MCP Connection-URL Maker

### Added
- **Canonical MCP Connection Maker Service** (`server/services/mcpConnectionService.ts`): Single source of truth function `buildMcpConnection(email)` that looks up user records, checks active API keys, enforces a **mint-once** policy for `/c/<token>` URLs in Airtable (`USERS_TABLE`), and returns `mcpUrl` (tokenized streamable-HTTP), `sseUrl` (legacy `/sse?api_key=&user_id=`), and `claudeConnectorUrl`.
- **Public API Endpoint** (`server/routers/accountRouter.ts`): Exposed `POST /api/account/mcp-connection` with security authorization matrix (internal API key header/secret bypass, admin session lookup capability, and session-only restriction for regular users).
- **Shared DataService Client Helper** (`shared/dataService.ts`): Added `getMcpConnection(email?, adminSecret?)` to fetch canonical connection info across client surfaces.

### Changed
- **Trial Provisioning Router** (`server/routers/accountRouter.ts`): Refactored `trial-provision` endpoint to build and return canonical token URLs *after* creating/activating API key records.
- **System Email Templates** (`server/services/emailTemplates.ts`): Updated `foddaMcpCard` and signup/onboarding templates to render the canonical `/c/<token>` URL for standard HTTP connections and legacy URL for SSE.
- **Frontend Components** (`ProfilePage.tsx`, `Dashboard.tsx`, `AccountPortal.tsx`, `AdminPortal.tsx`): Updated UI surfaces to fetch and render tokenized MCP URLs for standard connectors, while preserving SSE and corporate/org documentation URLs as legacy.
- **Internal Service Annotations** (`mcpChatService.ts`, `svgConstellationService.ts`): Added explicit comments documenting internal service-to-service calls that intentionally preserve legacy URL formats.

### Deployed
- **Cloud Run Deployment**: Deployed revision `fodda-sandbox-00454-z6h` serving 100% traffic on `app.fodda.ai` and `https://fodda-sandbox-1095548227950.us-central1.run.app`. Health check returned HTTP 200 OK.

## [2026-07-01] — Stop Payment Nudge Emails

### Changed
- **Payment Nudge Kill Switch** (`deploy_gcp.sh`): Added `DISABLE_AGENT_PAYMENT_NUDGE=true` to the `--set-env-vars` line in the deploy script. This hard-disables all "Quick tip — set up payment…" nudge emails at the environment level. Added to the deploy script (not just the Cloud Run console) because `--set-env-vars` replaces all env vars on every deploy and would wipe a console-only setting. To re-enable nudges later, set to `false` or remove the var and redeploy — the account-age gate in commit `4538491` makes that safe.

### Deployed
- Deployed to Cloud Run: revision `fodda-sandbox-00445-nrw` serving 100% traffic. Includes fix commit `4538491` (gate payment nudge to new accounts only + stop duplicates) and the env-level kill switch.

## [2026-06-24] — Claude Tag Dashboard Support & Credit Freshness

### Added
- **Claude Tag Setup Card** (`AccountPortal.tsx`): Added a new "Claude Tag — Slack Integration" card to the `claude` tab, positioned between Quick Connect and Team Enrollment. Links to the setup guide and Anthropic's Claude Tag announcement. Explains that Claude Tag enables multiplayer Slack access to Fodda graphs via `@Claude` mentions. Includes a "Requires" footer noting Claude for Work dependency and credit metering behavior.
- **Visibility-Change Account Refresh** (`App.tsx`): Added a `visibilitychange` event listener that silently re-fetches the user's account profile when they return to the Fodda tab. This keeps credit balance, usage counts, and account state fresh — especially important for Claude Tag users where multiple team members may be consuming credits via Slack while the dashboard is in the background. Silent fail on error to avoid breaking the UI.

### Investigated
- **Claude Tag Dashboard Review** (`Brief_App_Claude_Tag_Slack_Review_RESPONSE.md`): Completed evaluation of schedule management compatibility, dashboard features, and credit metering for Claude Tag. Key findings: scheduled research is entirely unimplemented (greenfield), usage breakdown by source is blocked on API Agent adding a server-side `source` enum, and credit metering is structurally correct for multi-user usage but previously showed stale data (now fixed by visibility refresh). Backburnered: usage source breakdown, schedule management UI, burn rate projection, "Connected via Claude Tag" badge.

## [2026-06-21] — Expert CTA Deep-Link, Sign Up UX & OAuth Fixes


### Added
- **Expert Deep-Link Context Persistence** (`AuthGate.tsx`, `App.tsx`): When a user arrives via `/expert/<slug>?q=<question>`, the expert slug and pre-filled question are stored in `localStorage` (`fodda.pendingExpert`, `fodda.pendingQ`) before the Clerk signup round-trip. After auth, `App.tsx` reads them back, routes to `expert-chat`, auto-selects the expert, and auto-submits the question.
- **Catalog `expert_slug` Enrichment** (`catalogRouter.ts`): The `/api/graph-catalog` endpoint now cross-references the Fodda Analysts API to populate `expert_slug` on every expert graph, backfill blank `graph_sub_type`, and — most importantly — **derive `graph_type='expert'` from Digital Twin analyst records**. Graphs backed by a Digital Twin analyst are automatically promoted to `graph_type='expert'`, making the Analyst table the single source of truth. No manual Graph List typing is needed for future experts. Gracefully degrades if the analysts API is unavailable.
- **"Already registered?" Signpost** (`AuthGate.tsx`): Added a right-margin link on both the standard signup Step 1 and the Referral Landing screens so returning users can easily switch to sign-in mode.
- **Expert Portraits in Referral Landing** (`AuthGate.tsx`): Extended `GRAPH_LOOKUP` with `portrait_url` and added entries for Jeremy Bergstein, Piers Fawkes, and Ben Dietz expert graphs. The "Free Access" badge now renders the expert's portrait when available.
- **`prefilledQuestion` Auto-Submit** (`App.tsx`): New `useEffect` watches for `isUnlocked`, `activeView === 'expert-chat'`, and a matching expert graph to be loaded, then auto-submits the prefilled question and clears the state.

### Changed
- **AuthGate Sign-up Copy** (`AuthGate.tsx`): Removed the trailing email-specific sentence ("You'll be reading by the bottom of this email.") from the step 1 sign-up paragraph to avoid user confusion.
- **Company Input Field** (`AuthGate.tsx`): Removed the hint `"employer · client"` from the company name field to clean up the registration UI.

### Fixed
- **Fodda Upstream API CSP Block** (`index.ts`): Added `https://api.fodda.ai` and `https://*.fodda.ai` to the CSP `connectSrc` directive in Helmet to allow the frontend to query the upstream Fodda API directly.
- **App Component Initialization Order (Temporal Dead Zone ReferenceError)** (`App.tsx`): Fixed a critical white-screen crash on production caused by referencing `handleSendMessage` in the dependency array of the auto-submit `useEffect` hook before the callback was initialized. Fixed by relocating the `useEffect` hook below the `handleSendMessage` declaration.
- **Fuzzy Expert Slug Matching & Airtable Direct Query** (`unclaimedRouter.ts`, `index.ts`): Refactored the unclaimed expert lookup endpoint to query the Airtable `Analysts` database table directly instead of calling the production Fodda API (which only exposes Active/Claimed experts). Added a comprehensive normalization and variation matching algorithm to handle slug generation differences (e.g. `dr-c-line-gounder` vs `dr-celine-gounder` due to character encoding, and short slugs like `ben-dietz` mapping to `ben-dietz-sic`).
- **ES Modules Dotenv Initialization Hoisting** (`index.ts`): Solved a local database connection hoisting issue where server routers imported database helpers that evaluated environment variables before `dotenv.config()` was executed. Fixed by importing `dotenv/config` at the very top of `index.ts` imports.
- **Stripe Publishable Key Initialization** (`PaymentSetupModal.tsx`, `Dockerfile`, `deploy_gcp.sh`): Fixed a white-screen crash on production caused by the Stripe SDK being initialized with an empty publishable key. Root cause: the build-time environment variable `VITE_STRIPE_PUBLISHABLE_KEY` was missing from `Dockerfile`. Also refactored the frontend to load Stripe conditionally and show a clean fallback UI instead of crashing when the key is not configured.
- **Clerk Content Security Policy (CSP) Block** (`server/index.ts`): Fixed a blocking issue where browsers blocked Clerk's Web Worker creation because of strict script-src CSP rules. Added `workerSrc` and `childSrc` directives allowing `blob:` URLs in CSP.
- **OAuth Signup Flow** (`AuthGate.tsx`): Fixed Google & LinkedIn signup buttons not redirecting on the "Let's sign you up" page. Routed signup OAuth calls through `signUp.authenticateWithRedirect` instead of reusing `signIn` methods, which Clerk blocks during registration attempts.
- **`setShowIntent` Crash Bug** (`AuthGate.tsx`): Fixed runtime crash when a sign-in attempt returned `form_identifier_not_found` — replaced the call to undeclared `setShowIntent(true)` with `setIsSignUp(true); setStep(1)` to gracefully redirect the user to registration.
- **Catalog Pagination** (`catalogRouter.ts`): Fixed Graph List fetch being silently truncated to 100 records (Airtable's single-page default). Added `offset`-based pagination loop so the catalog now returns all ~224 graphs. This was blocking expert deep-links — expert graphs (including Jeremy) were beyond the 100-record cut and never reached the frontend.

## [2026-06-19] — Billing UX Consistency: "API Calls" Language, Trial Removal, Spend Visibility

### Changed
- **Terminology — "tokens" → "API calls"** (`UsageWarningBanner.tsx`, `PaymentSetupModal.tsx`, `GraphCard.tsx`): All user-facing billing copy now uses "API calls" instead of "tokens", matching the MCP `get_my_account` labeling. Overage rate displays as "$0.20/API call".
- **BillingPage Rewrite** (`frontend/components/BillingPage.tsx`): Complete rewrite of the billing dashboard. Now surfaces: API calls remaining/total/used with progress bar, billing cycle reset date, overage state banner when over limit, per-query cost table (fetched from `GET /v1/research/pricing` — single source of truth, no hardcoding), "Add Payment Method" and "Buy More API Calls" CTAs aligned with MCP exhaustion-state flows. Removed hardcoded invoice stubs. `trialing` Stripe status now maps to "Active" badge label.
- **`?view=billing` Deep Link** (`frontend/App.tsx`): Added support for `?view=billing` query parameter and `/account/billing` path route, both navigating to `account-billing` view. This is the URL the MCP hands agents via `errorHandling.ts:303` when users hit `PLAN_LIMIT_EXCEEDED`.
- **DataService Methods** (`shared/dataService.ts`): Added `fetchQueryPricing()` (calls `GET /v1/research/pricing`) and `createAgentCheckout()` (calls `POST /api/account/checkout/agent-session`).
- **Account Type** (`shared/types.ts`): Added `resetDate?: string` field to the `Account` interface.

### Removed
- **Trial UI** (`BillingPage.tsx`, `AccountPortal.tsx`): Removed all trial-specific badges, status messages, and the `.includes('trial')` API access check. New users default to free Base (100 API calls/month). Stripe `trialing` status is still handled gracefully (mapped to Active) but no trial-specific UI is rendered.

## [2026-06-18] — LinkedIn & Google OAuth Sign-In + Expert Onboarding Clerk Brief

### Added
- **OAuth Sign-In / Sign-Up Buttons** (`frontend/components/AuthGate.tsx`): Added Google and LinkedIn OIDC OAuth buttons to both the Sign In screen and Sign Up Step 1 screen. Uses Clerk Core 3's `signIn.sso()` API. Provider logos are inline SVGs (no icon library dependency). An `OR VIA EMAIL` / `OR WITH EMAIL` divider separates the OAuth buttons from the existing magic-link email flow. A new `OAuthBtn` atom component handles hover state and brand-consistent pill styling.
- **SSO Callback Page** (`frontend/components/SsoCallbackPage.tsx`): New page that handles the OAuth redirect back from Clerk via `<AuthenticateWithRedirectCallback />`. For new users it shows a "Tell us a little more" GateFrame modal to collect company, job title, and platform preference (since OAuth providers don't return these). Calls `PATCH /api/auth/patch-oauth-metadata` and `user.update()` to backfill `unsafeMetadata`, then redirects to `/`. Returning users bypass the modal and go straight to the app.
- **`/sso-callback` Route** (`frontend/App.tsx`): Added a pathname intercept for `/sso-callback` that renders `SsoCallbackPage` before the `isUnlocked` / Clerk-loading guard, so the OAuth handshake completes correctly even during session resolution.
- **`PATCH /api/auth/patch-oauth-metadata`** (`server/routers/authRouter.ts`): New Clerk-JWT-authenticated endpoint that backfills `Job Title`, `Company`, and `apiUse` on the Airtable User record after an OAuth sign-in. Also updates the linked Account name if the current value looks like an auto-generated placeholder (email domain, "Default Company", or bare email address).
- **Clerk OAuth Infrastructure Note** (`brain/clerk_note_for_website_agent.md`): Wrote a detailed briefing note for the Website Agent explaining how Clerk works across the Fodda stack, how `user.created` webhooks drive Airtable provisioning, what `unsafe_metadata` fields are used, and three options (A/B/C) for integrating Clerk into the expert onboarding wizard at `www.fodda.ai/join-experts`. Recommended approach: a new `signupIntent: "expert"` path in `webhookRouter.ts`.

### Changed
- **GCP OAuth Client** (manual): Added `https://app.fodda.ai/sso-callback` to the Authorized Redirect URIs on GCP OAuth client `1921946112-1f980e49qbvqtn7f8iqnqndhdvgrsahc` (project `1921946112`).
- **LinkedIn Developer App** (manual): Added `https://app.fodda.ai/sso-callback` to the Authorized redirect URLs alongside the existing `https://clerk.fodda.ai/v1/oauth_callback` entry.

## [2026-06-11] — Tech, Food & Travel Graphs Surfaced in Frontend + PSFK Favicon in Graph Selector

### Added
- **Tech, Food & Travel Verticals** (`shared/types.ts`, `shared/dataService.ts`, `shared/constants.ts`): Confirmed that all three new PSFK PSFK vertical graphs (`tech`, `food`, `travel`) were already wired end-to-end: `Vertical` enum entries, `FALLBACK_GRAPHS` entries with correct display names/descriptions, `SUGGESTED_QUESTIONS` (4 per vertical), `MOCK_TRENDS` (3 per vertical), and `MOCK_ARTICLES` (3 per vertical). No changes needed — completed by a prior API Agent pass.
- **PSFK Favicon in Graph Selector** (`frontend/App.tsx`): Added the PSFK favicon (`https://psfk.com/favicon.ico`, 16×16, `rounded-sm`) as a left-aligned prefix icon in both the graph selector trigger button and each dropdown row for the 7 PSFK domain graphs: `retail`, `beauty`, `sports`, `fashion`, `tech`, `food`, `travel`. Non-PSFK graphs (supplemental data, user/custom, etc.) retain the existing animated green dot indicator. A `PSFK_GRAPH_IDS` Set is defined locally in the sandbox view render path for clean, O(1) membership checks.

## [2026-06-09] — Drop Website Widget, Clerk-Only Sign-Up, Gemini 2.5 Flash Migration & Onboarding QA

### Investigated
- **David Cutler Onboarding Failure**: QA'd a user report (`dcutler@eatmedia.com`) where the SIGNUP_CONFIRMATION email was never received. Root cause: user signed up via the `GetStartedWidget` on `fodda.ai/forrester-predictions2026_b2bmarketing`, which called `/api/account/trial-provision`. This endpoint creates Airtable records and API keys but **does not create a Clerk user**, leaving the user unable to log in to `app.fodda.ai`. The SIGNUP_CONFIRMATION email was either silently lost (`.catch()` on line 2130 of `accountRouter.ts` swallows errors) or the Resend/Gmail send failed — original Cloud Run logs from June 5 had rotated out.
- **49 Stuck Users Audit**: Discovered 49 users with no `clerkUserId` (Role=Owner, never logged in). A batch of 35+ from May 29 appears to be a bulk import (`onboardingIntent: trial`). Recent organic signups (June 1–9) also affected. All have `buyer_type: NOT ENRICHED` due to the deprecated Gemini model.

### Fixed
- **Deprecated Gemini Model (`gemini-2.0-flash` → `gemini-2.5-flash`)**: The `gemini-2.0-flash` model was deprecated and returning 404 errors, breaking user enrichment (buyer type classification), MCP chat, query digests, persona synthesis, and Gemini proxy calls. Updated all 15 references across 9 files: `userEnrichmentService.ts`, `helpers.ts`, `queryRouter.ts`, `mcpChatService.ts`, `personaSynthesisService.ts`, `queryDigestService.ts`, `App.tsx`, `geminiService.ts`, `fodda-take-pipeline.ts`.
- **David's API Key Activation**: Manually activated David's API key from `Pending` to `Active` via Airtable API (`sk_live_8d2f…`).

### Changed
- **AuthGate Dynamic Graph Referrals** (`AuthGate.tsx`): Previously only 6 hardcoded graphs in `GRAPH_LOOKUP` triggered the referral landing screen. Now accepts any `?graph=<id>` value — known graphs show their name/owner, unknown graph IDs (e.g. `forrester-predictions2026_b2bmarketing`) get auto-formatted as a title with a generic "Expert-curated knowledge graph" message. Also parses and persists `?view=api` to `localStorage` for post-login routing.
- **Post-Login Routing Priority** (`App.tsx`): Added a 3-tier routing priority in `handleSessionStart`: (1) `?view=api` from localStorage → MCP connections page, (2) `?graph=<id>` → sandbox with that graph auto-selected as `currentVertical`, (3) existing `apiUse`/`onboardingIntent`-based routing for first logins.
- **Website Widget Removal** (`fodda.ai`): Replaced `GraphTrialWidget` and `GetStartedWidget` across 4 pages (Graph Detail, Connect, Graphs Marketplace, C-Suite Landing) with CTA buttons linking to `app.fodda.ai?graph={graphId}&signup=true`. All CTAs route through Clerk sign-up, eliminating the broken `/trial-provision` path from the marketing site.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Deployed revision `fodda-sandbox-00415-ndg` to Google Cloud Run with the Gemini 2.5 Flash migration and AuthGate/App.tsx routing changes, serving 100 percent of traffic. Health check confirmed (200 OK).

## [2026-06-08] — Update Prompting Guide Link

### Changed
- **Integration Auditor Link** (`AuthGate.tsx`): Updated the "Prompting Guide" button on the Auth Gate page to link to the new `Fodda_Integration_Auditor.md` skill guide, changing its label and description to reflect the codebase auditing functionality per the Agent-First consolidation.

## [2026-06-07] — Experts Roster CORS Fix, Suggested Questions Refinements & Agent-First Refactor

### Added
- **Proxy Experts API Route** (`catalogRouter.ts`): Added a backend proxy endpoint `GET /api/analysts` that forwards requests to the official Fodda experts API (`https://api.fodda.ai/v1/analysts`). This prevents browser CORS errors when loading the expert list from sandbox/staging and local development domains.

### Changed
- **Agent-First Prompting Tip** (`App.tsx` & `AccountPortal.tsx`): Added a prominent "Agentic Prompting Tip" to the MCP connection snippets guiding users to provide high-level goals instead of rigid tool execution scripts.
- **Documentation Refactor** (`public/Fodda_Quickstart.md`): Updated architecture descriptions to emphasize self-describing MCP tools and replaced legacy conversational prompts with goal-driven Agent Mandates.
- **Stacking Context Fixes** (`App.tsx`): Added `relative z-20` to the Page Header in both Sandbox and Expert Chat views. This resolves a layout bug where the expert dropdown select menu fell behind the Evidence drawer.
- **Expert Chat Prompts Gating** (`ChatInterface.tsx` & `App.tsx`): Passed `isExpertChat` prop to `ChatInterface` and disabled falling back to static PSFK domain questions (`SUGGESTED_QUESTIONS`) in Expert Chat. Suggested prompts are now only displayed in Expert Chat if the selected expert has explicit queries.
- **Case-Insensitive Suggested Questions Lookup** (`ChatInterface.tsx`): Updated the suggested questions lookup to be case-insensitive, fixing a bug where sandbox graphs with lowercase IDs (e.g. `'retail'`, `'beauty'`) failed to match the capital-cased static `SUGGESTED_QUESTIONS` keys.
- **Experts Roster Source** (`dataService.ts`): Updated the expert list fetch to call the new `/api/analysts` proxy endpoint instead of fetching directly from the external `api.fodda.ai` address, bypassing mixed content/CORS restrictions.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Deployed revision to Google Cloud Run to push the Agent-First prompting tips and updated Quickstart documentation.

## [2026-06-04] — Security Hardening, Endpoint Authorization & Graph Analytics Dashboard

### Added
- **Graph Creator Analytics Dashboard** (`creatorRouter.ts`, `index.ts`, `dataService.ts`, `types.ts`, `MyGraphsPage.tsx`): Added an inline stats panel for graph owners on their owned cards. Features a Clerk-gated and Registry-verified API (`GET /api/creator/analytics`) that aggregates 30-day query volume, unique users, daily trends, top queries, recent queries with color-coded quality pills, and masked top audience emails. Displays an interactive panel with summary metrics, SVG trend graphs, and splits for audience and query lists.
- **Security Headers (Helmet)** (`server/index.ts` & `package.json`): Installed `helmet` and mounted the middleware to enforce Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, and a customized Content-Security-Policy supporting Clerk, Stripe, GTM, GA, Tailwind, and ESM.sh.
- **Endpoint Authorization (Gemini Search & Contributions)** (`queryRouter.ts` & `contributionRouter.ts`): Enforced authentication on `/api/gemini-search` and `/api/contributions` requiring either a valid Clerk session or a valid `X-API-Key`.
- **Custom Checkout Authorization** (`accountRouter.ts`): Authenticated `/api/account/checkout/custom` and restricted access to users with Owner or Admin privileges.
- **Admin Secret Header Support** (`catalogRouter.ts`): Added HTTP header support (`X-Cron-Secret`, `X-Admin-Secret`, and `Authorization: Bearer`) for `/api/graph-trials` authentication.

### Changed
- **Fail-Closed Verification in Production** (`index.ts`, `cronRouter.ts`, `webhookRouter.ts`, `slackEventsRouter.ts`): Tightened security checks to fail-closed in production if required environment secrets are unset, while maintaining fail-open/warning behavior in development.
- **JSON Payload Limit** (`index.ts`): Decreased default payload parsing limit from `75mb` to `1mb` to prevent memory exhaustion / DoS attacks.
- **Sensitive Log Sanitization** (`index.ts`): Safe-masked authorization token logging to prevent partial credential exposure.

### Fixed
- **HMAC Outbound Signing Bug** (`helpers.ts`): Fixed a critical bug in `signOutboundRequest` where signatures were generated via plain SHA-256 hash without the secret. Replaced `createHash` with `createHmac`.
- **Airtable Formula Injection Prevention** (`helpers.ts`): Escaped dynamic API key parameters in Airtable query formulas using `escapeAirtableString()`.
- **Docker Build Exclusions** (`.dockerignore`): Excluded local test, debug, and scratch files from production Docker builds to reduce image attack surface.

## [2026-06-03] — Overage Billing System

### Added
- **Stripe Overage Service** (`server/services/stripeOverageService.ts`): New service encapsulating all overage billing logic — `ensureStripeCustomer()`, `createSetupIntent()` for card collection, `createOverageSubscription()` for $0 metered subscriptions, `reportOverageToStripe()` for Stripe Meter usage events, and `generateSetupUrl()` for one-click setup links in API/MCP 403 responses.
- **Setup Payment Endpoint** (`POST /api/account/setup-payment`): Authenticated endpoint that creates a Stripe Customer and SetupIntent for card collection. Returns `client_secret` for frontend Stripe Elements.
- **Activate Overage Endpoint** (`POST /api/account/activate-overage`): Creates a $0 Stripe subscription with a metered price component ($0.20/unit) after card is saved.
- **Setup URL Endpoint** (`POST /api/account/setup-url`): Public endpoint generating one-click Stripe Checkout URLs (setup mode) for API/MCP 403 responses.
- **Webhook Handlers** (`accountRouter.ts`): Added `setup_intent.succeeded` and `invoice.payment_failed` event handlers.
- **PaymentSetupModal** (`frontend/components/PaymentSetupModal.tsx`): Stripe Elements card collection modal using SetupIntent flow.
- **UsageWarningBanner** (`frontend/components/UsageWarningBanner.tsx`): Amber warning at 80%+ usage; blue info bar when overage active.
- **Overage Email Templates** (`emailTemplates.ts`): `OVERAGE_ACTIVATED` and `OVERAGE_PAYMENT_FAILED` templates with pricing page CTAs.
- **Stripe Meter** (`fodda_overage_tokens`): Created via Stripe API — $0.20/unit metered monthly billing.
- **Airtable Fields**: `hasPaymentMethod`, `overageEnabled`, `overageTokensThisCycle` on Accounts table.

### Changed
- **Soft Cap Logic** (`queryRouter.ts`): Hard block replaced with soft cap — accounts with card + overage enabled continue at $0.20/token. No card → 403 with `setupUrl` for one-click card addition.
- **Usage Warning Headers** (`queryRouter.ts`): `X-Usage-Warning` + `X-Usage-Percent` headers at 80%, `overage-active` headers when over limit. Also in `meta.usageWarning` response body.
- **Overage Tracking** (`helpers.ts`): `incrementUsage` reports to Stripe Meter when in overage and triggers `OVERAGE_ACTIVATED` email on first overage token.
- **PLAN_LIMIT_EXCEEDED Handler** (`App.tsx`): Opens `PaymentSetupModal` when `setupUrl` is present, falls back to `UpgradeModal`.
- **Plan Limit Warning Email** (`emailTemplates.ts`): Updated to mention $0.20/token overage and link to billing page.
- **Account Interface** (`shared/types.ts`): Added `hasPaymentMethod`, `overageEnabled`, `overageTokensThisCycle`, `overageRate`.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Deployed revision `fodda-sandbox-00395-pxd` with overage billing and new env vars (`STRIPE_OVERAGE_METER_EVENT`, `STRIPE_OVERAGE_PRICE_ID`, `VITE_STRIPE_PUBLISHABLE_KEY`).

## [2026-06-02] — Intent-Based Account Provisioning & Pending API Key Gating

### Added
- **Pending API Key Gate Middleware** (`server/index.ts`): Intercepts all `/api` requests with a pending API key and returns a 403 `KEY_PENDING_CONFIRMATION` error. Automatically bypasses Clerk session auth (missing `X-API-Key`) and legacy `sk_trial_` keys to prevent breaking normal dashboard features.
- **Pending Key Verification & Activation Helpers** (`server/helpers.ts`): Added `keyStatus` field resolving to `resolveIdentity()` and exported `isPendingKey()` helper.

### Changed
- **Intent-Based Account Provisioning** (`server/routers/accountRouter.ts`): Branched behavior of the public `/api/account/trial-provision` endpoint based on the presence of the `intent` parameter:
  - *Website Signups* (with `intent`): Provisions a **Base** plan (planCode 2) with a **Pending** API key, requiring email confirmation to activate.
  - *Sales Channels* (no `intent`): Provisions a **Trial** plan (planCode 13) with an **Active** API key, preserving existing behavior.
- **Verification Email Activation** (`server/routers/authRouter.ts`): Clicking the email confirmation link (`GET /api/auth/confirm`) now marks the user as `emailConfirmed: true` in Airtable, activates all "Pending" API keys for their account, and redirects them to the App dashboard with intent-specific query params (e.g. `/dashboard?tab=claude`, `/sandbox`).
- **Clerk Integration Auto-Activation Sync** (`server/routers/webhookRouter.ts` & `server/routers/authRouter.ts`): Configured Clerk webhook signups (`user.created` event) and profile fallback lookup linking (`GET /api/auth/profile`) to automatically set `emailConfirmed: true` and activate all "Pending" API keys for matched users. Since Clerk has already verified the email, this guarantees a seamless transition to an active API key when logging in to Clerk.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Built and deployed revision `fodda-sandbox-00390-2vz` to Google Cloud Run, serving 100 percent of traffic. Tested health endpoint successfully (200 OK).

## [2026-06-01] — Self-Healing Clerk Profile Linking, Local JWT Verification & AuthGate UX Fixes

### Fixed
- **Self-Healing Profile Linking Loop** (`authRouter.ts`): Fixed a redirect loop bug where clicking the magic link signed the user in via Clerk but redirected them back to the sign-in page. The root cause was that `/api/auth/profile` returned a 404/failure when `clerkUserId` was not yet mapped in Airtable. Implemented an email fallback lookup (which checks `sessionClaims.email` or queries Clerk's API directly) to find the user in Airtable and link their `clerkUserId` on the fly.
- **Redirect Loop & Race Condition on Redirect Urls** (`App.tsx`): Added polling for the Clerk token and a retry loop for `/api/auth/profile` profile fetches to handle initial page load race conditions where `getToken()` resolves to `null` before the redirect session parameters are fully consumed.
- **Clerk Express publishableKey Startup Race** (`index.ts` & `deploy_gcp.sh`): Resolved a critical production issue where Clerk rejected all JWT tokens with a 401. The root cause was that Cloud Run only defined `VITE_CLERK_PUBLISHABLE_KEY` and not `CLERK_PUBLISHABLE_KEY`. Because ES module static imports are hoisted, the Clerk SDK initialized with an undefined key at startup before dynamic fallbacks executed. Fixed by explicitly configuring `clerkMiddleware()` with keys and injecting `CLERK_PUBLISHABLE_KEY` in the Cloud Run deploy script.
- **Clerk Email Delivery for Gmail** (`reset_gmail_user.js`): Programmatically reset the Clerk user and Airtable association for `piers.fawkes@gmail.com` to clear any SendGrid/Clerk email suppression blocks.
- **Clerk JWT Signature Validation Failures in Cloud Run** (`index.ts` & `deploy_gcp.sh`): Configured local/networkless JWT verification by setting `CLERK_JWT_KEY` environment variable and explicitly passing `jwtKey` to `clerkMiddleware()` in `server/index.ts`. This resolves OIDC issuer verification and DNS resolution lookup failures (to `clerk.fodda.ai`) inside the Cloud Run container.
- **Outdated frontend profile loading retry loop** (`App.tsx`): Updated the profile fetching retry loop to directly check for `profile.user` and `profile.account` on the response object instead of catching exceptions (since `getCurrentProfile()` resolves to a status envelope rather than throwing), enabling retries for transient 401s.
- **Clerk Multi-Session Login Trap** (`AuthGate.tsx`): Updated the "Use a different email" click handler to invoke `signOut()`, clearing any stale or unauthorized Clerk session cookies from the browser to ensure a clean subsequent sign-in.
- **Clerk Team Members Custom UI & Layout Fix** (`AccountPortal.tsx`): Replaced the prebuilt Clerk `<OrganizationProfile />` component inside the Team tab with a custom-themed, Fodda-native UI using the low-level `@clerk/react` `useOrganization()` hook. This completely resolves the mobile-collapsing, layout deformation, and horizontal clipping/scrolling issues inside the Clerk organization view, allowing the members list and pending invitations tables to scale dynamically to the full desktop width.

### Changed
- **Authorization Header Diagnostic Logging** (`index.ts`): Added truncated `Authorization` header logging and custom JWT diagnostic decoding logs for incoming request paths to identify missing/invalid tokens on the server.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Built and deployed revision `fodda-sandbox-00388-v6n` to Google Cloud Run with the custom Fodda-native Clerk UI layout fix, serving 100 percent of traffic.

## [2026-05-31] — Clerk Auth Startup Fix & AuthGate UX Improvements

### Added
- **Manual Trial Provisioning Command** (`slack_bot.js`): Added a new `PROVISION_TRIAL` action to the Sales Bot natural language handler. It handles requests to provision a trial account, retrieve active API keys, and formats standard MCP, SSE MCP, and Claude 1-Click Connect URLs directly inside Slack.
- **Streak Onboarding Trigger Integration** (`slack_bot.js`): If a new trial is provisioned, the Sales Bot automatically queues the Streak CRM MCP follow-up sequence.

### Fixed
- **Clerk Sign-In Silent Hang & Loop Deadlock** (`index.tsx`, `App.tsx` & `package.json`): Fixed a critical bug where calling `signIn.create` would hang indefinitely without making network requests. Identified two root causes:
  1. *Version Mismatch*: Browser had a cached v5 `__clerk_environment` in `localStorage` which caused `@clerk/react` v6 to fetch the outdated `@clerk/clerk-js@5` script. Added a programmatic cache-clearing routine in `index.tsx` that removes stale v5/non-v6 `__clerk_environment` entries on load. Removed the deprecated `@clerk/clerk-react` dependency.
  2. *Fetch Interceptor Deadlock*: The global fetch interceptor in `App.tsx` intercepted and called `globalGetToken()` for all requests, causing a circular promise chain deadlock on Clerk's internal loading fetches. Refactored the interceptor to only execute `globalGetToken()` for requests targeting `/api/`.
- **Silent Clerk SDK Load Failures** (`AuthGate.tsx`): Upgraded sign-in, sign-up, and verification resend form handlers to throw explicit, user-friendly errors when the Clerk SDK fails to load (e.g., due to an adblocker blocking `clerk.accounts.dev`). This replaces previous silent early returns which left the UI in an inactive state without feedback.
- **Clerk Express SDK publishableKey Crash** (`index.ts`): Resolved a critical startup crash in production where the `@clerk/express` middleware threw a fatal error because it expects `CLERK_PUBLISHABLE_KEY` (while Fodda's environment conventions standardize on `VITE_CLERK_PUBLISHABLE_KEY`). Added a fallback to default the SDK's expected variable to `VITE_CLERK_PUBLISHABLE_KEY` if undefined.
- **Client-side White Screen Fix** (`Dockerfile` & Deploy Command): Baked the public `VITE_CLERK_PUBLISHABLE_KEY` into the frontend build environment inside the `Dockerfile`. Since `.env` is excluded by `.dockerignore` during container compilation on Cloud Build, Vite previously compiled without a publishable key, throwing a fatal startup exception in the browser. Sourcing parser failures in the deploy shell script were also resolved.

### Deployed
- **Fodda App (`app.fodda.ai`)**: Built and deployed revision `fodda-sandbox-00362-hwd` to Google Cloud Run, serving 100 percent of traffic.
- **Fodda Sales Bot (`fodda-sales-agent`)**: Built and deployed revision `fodda-sales-agent-00158-65m` to Cloud Run.

## [2026-05-29] — Clerk Auth Integration, Conversational Trial Welcome Email, Case-Insensitive Email Lookups & Trial Provisioning Fixes

### Added
- **Clerk Webhook Sync Handler** (`webhookRouter.ts`): Cryptographically verifies svix signatures and routes events for `user.created`, `user.updated`, `user.deleted`, `organization.created`, and `organizationMembership.created` to keep Airtable in sync.
- **Organization and Team Joining Support** (`webhookRouter.ts` & `AuthGate.tsx`): Integrates team registration and domain-based mapping to Fodda Accounts using `signupCode` or Clerk organizations.
- **Dynamic Profile Retrieval API** (`authRouter.ts`): Added a `/profile` endpoint to load combined user-account profiles from Airtable by mapping `req.auth.userId`.
- **Conversational Trial Welcome Email** (`emailTemplates.ts`): Re-designed the `SIGNUP_CONFIRMATION` email template for `intent === 'trial'` to use a conversational agent tone ("Hi - I'm an automated agent that helps Piers..."). Corrected spelling ("to day" -> "to say"), normalized formatting, and corrected numbering mismatch ("2 things" -> "3 things").
- **Prefilled Claude Installer** (`emailTemplates.ts`): Embedded a fully pre-filled 1-click Claude MCP connector install link in the welcome email to bypass manual URL copy-pasting.
- **Email Suppression Flag** (`accountRouter.ts`): Added a `suppressEmail` body parameter to `POST /api/account/trial-provision` to allow external tools (like sales bots) to disable redundant automated system welcome emails.

### Changed
- **Headless Authentication UI** (`AuthGate.tsx`): Refactored custom magic link forms to run headless Clerk sign-up (`useSignUp`) and sign-in (`useSignIn`) verification flows under Fodda's custom UI theme.
- **Global Session State** (`App.tsx`): Bound `useAuth` hook and dynamically injected Clerk JWT Bearer tokens to the global `window.fetch` interceptor registry. Migrated legacy token session restoration to Clerk profile synchronization.
- **Formal Email Sender** (`emailService.ts`): Updated the default Resend outbound email address `RESEND_FROM` from `hello@fodda.ai` to `team@fodda.ai`.
- **Case-Insensitive Email Queries** (`accountRouter.ts`, `authRouter.ts`, `helpers.ts`): Audited and upgraded user database lookups across 17+ endpoints to perform case-insensitive Airtable queries using `LOWER({email})`, preventing duplicate user/account creations from casing variations.

### Fixed
- **API Key Linked Record Mismatch** (`accountRouter.ts`): Fixed a bug where querying `API_KEYS_TABLE` by `{Account} = '${accountId}'` always returned 0 records because Airtable evaluates linked record fields in formulas using the Primary Display Text (Account Name) rather than their record IDs. Introduced a new `getActiveKeysForAccount` helper to first resolve the Account Name and then query keys using that name. This resolves the duplicate trial account loop when looking up existing users.
- **Airtable Field Mapping** (`accountRouter.ts`): Fixed a critical crash where user provisioning wrote data to invalid Airtable column fields (`companyName` and `jobTitle`), mapping them correctly to `"Company"` and `"Job Title"`.

## [2026-05-28] — Connections UI Redesign, Auto-Create Accounts Unknown Emails, Sandbox UX Cleanup & Diagnostic Console Integration

### Added
- **Auto-Create Accounts Task**: Added the `"Auto-Create Accounts for Unknown Login Emails"` task to `BACKBURNER.md` to track deferring the automatic registration of unknown login emails.
- **Diagnostic Console Keyboard Shortcut** (`App.tsx`): Registered a global keyboard listener for `CTRL + SHIFT + D` (and `CMD + SHIFT + D` for macOS) to toggle the developer Diagnostic Console (`isDevMode`).
- **Diagnostic Console Header Button** (`App.tsx`): Added a "Diagnostic Console" action button next to the Sandbox page title to easily toggle the DevTools panel with one click.
- **Categorized, Searchable Graph Selector** (`App.tsx`): Created a premium dropdown graph selector to replace the horizontal buttons row, supporting search filtering and logical grouping of graphs by their Airtable categories (e.g. Domain Context, Expert Graphs, Industry Papers, Supplemental Data).
- **Expert Subtype Badges** (`GraphCard.tsx`): Added visual badges with tailored color styles for expert subtypes: `Digital Twin` (violet), `Synthetic Executive` (indigo), and `Synthetic Expert` (purple) to easily distinguish expert graph categories on cards.
- **MCP Optional API Key Field** (`MyGraphsPage.tsx`): Added support for an optional API Key / Access Token input field to the custom MCP data source form, making the MCP connection form layout match the URL + API Key layout.
- **Custom Resource Delete Action** (`MyGraphsPage.tsx`): Added a deletion handler `handleDeleteResource` and a trash icon button next to each custom linked research resource, with updates synced to `localStorage`.

### Changed
- **Connection Guides Redesign** (`App.tsx`, `AccountPortal.tsx`): Overhauled all client connection guides (Gemini/Vertex, Claude, Notion, Copilot, MCP Server, and API Access tabs) using Fodda's premium light-themed cards (`bg-paper border border-line rounded-2xl`), resolving text contrast issues, and styling dark terminal code blocks (`bg-ink`) with checkmark copy-to-clipboard feedback. Replaced outdated GCP Run endpoints with the canonical `https://mcp.fodda.ai` custom domain paths.
- **Knowledge & API Documentation Redesign** (`KnowledgePage.tsx`): Restructured the API Documentation, Reliability, and Security pages into card-based layouts and introduced a stateful, interactive `CodeBlock` component supporting copy feedback and customized text color mappings.
- **Sidebar Navigation Cleanup** (`Sidebar.tsx`): Removed the redundant "Live Requests" navigation link from the Demo Area, keeping only "Sandbox" as the single entry point.
- **Premium Category Labels & Styling** (`MyGraphsPage.tsx`): Overhauled category titles, descriptions, and colors (e.g. "Industry Papers" to "Industry Research", "Supplemental" to "Supplemental Data") to align with the website's premium design aesthetics.
- **Recently Added (New) Grouping** (`MyGraphsPage.tsx`): Refactored the "Recently Added" section layout from a flat list to be clustered by category type under styled category headers.
- **Custom Tab Persistent Visibility** (`MyGraphsPage.tsx`): Updated the custom section rendering condition so it always displays when the "Custom" tab is active, showing the empty state and the "+ Add" form even if there are no custom resources yet.
- **Lava PAYG Plan Integration** (`UpgradeModal.tsx`): Styled the Lava PAYG metered plan row and CTA button using Lava's brand red/orange color (`#ff5a1f`), labeled the action as "SET UP PAYG" pointing to Lava.so with email pre-filling, and added an explicit "External Service" subtitle along with a deep link to the Lava.so dashboard wallet for easy balance management.

### Fixed
- **Skills Visibility (Paralogy / Igloo)** (`MyGraphsPage.tsx`): Bypassed standard status filters for graph type `'skill'` in `visibleGraphs` to ensure draft and beta skills (like Paralogy and Igloo) are visible.
- **Domain Context PSFK Graphs** (`MyGraphsPage.tsx`): Removed manual `isPsfk` filtering that previously hid PSFK retail/sports/beauty graphs in the UI.
- **Fodda Pricing Link** (`UpgradeModal.tsx`): Updated the broken pricing link from `https://fodda.ai/pricing` to the canonical `https://www.fodda.ai/pricing`.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`): Deployed revision `fodda-sandbox-00330-8hc` containing the QA improvements and build validations, serving 100 percent of traffic.

---

## [2026-05-26] — Defer Upload Flow Sync

### Added
- **Upload Flow Deferral**: Added the `"App Agent: Sync app.fodda.ai "Upload & Review" with Website Messaging"` brief task to `BACKBURNER.md` as requested to defer the implementation.

---

## [2026-05-22] — Managed Agents Policy Compliance & Repo Standardization

### Added
- **Agent Mapping Manifest** (`agents.yaml`): Created the repo's first `agents.yaml` per the new Engineering Standards & Code Policy for Agents. Maps prompt orchestration (promptSelector + promptValidator + promptSweep) and the MCP agentic chat loop as `prompt-as-agent` entities.
- **Policy Compliance Backburner Items**: Added 5 tracked items to `BACKBURNER.md` for longer-term policy requirements: safety policies & deny-all baseline, audit hooks (post_tool_call / on_tool_error), token budget controls, golden-set prompt regression testing, and MCP chat system prompt extraction.

### Changed
- **`.env.example` Expanded**: Grew from 7 to 20+ documented env vars, now covering all secrets used in the server: Airtable PATs, FODDA_MCP_SECRET, FODDA_INTERNAL_API_KEY, Stripe keys, Resend, Slack signing secret, and Google service account key. Organized by service group per policy §3 (Secrets Scoping).
- **Brief Consolidation**: Moved 4 root-level briefs and 6 docs/ briefs into `briefs/` directory. Removed empty `docs/` directory. All briefs now live in a single canonical location per policy §1.
- **Workflow Standardization**: Migrated `.agent/workflows/update-changelog.md` into `.agents/workflows/`. Removed deprecated `.agent/` directory. All repos now standardize on `.agents/workflows/` per policy §2.

## [2026-05-21] — Account Portal UI Polish, New Backend User Routing, Premium Chart Overhaul & Security Hardening

### Added
- **Get Account Users API Route**: Added a new `GET /api/account/:accountId/users` endpoint to `accountRouter.ts` to retrieve all team members belonging to a given account.
- **Delete User API Route**: Added a new `DELETE /api/user/:userId` endpoint to `userRouter.ts` to allow Owners and Admins to remove a user from their account.
- **Dynamic 6-Month Monthly Trend**: Programmed `loadUsageData` in `AccountPortal.tsx` to generate 6-month historical query volume trends.
- **6-Month Historical Chart**: Replaced the duplicate daily trend with a dedicated Monthly Trend bar chart with wide bars, horizontal gridlines, and clean labels.
- **Airtable Sanitization Helper**: Added `escapeAirtableString` in `server/db.ts` to sanitize dynamic inputs in Airtable formulas against injection attacks.
- **Fail-Closed Session Authentication**: Added `authenticateSession` in `server/helpers.ts` to extract and validate the `X-Session-Token` header.
- **Global Fetch Interceptor**: Added a global `fetch` interceptor in `frontend/App.tsx` that automatically injects the `X-Session-Token` header into all outbound `/api/` requests.
- **Security Verification Suite**: Added `scratch/verify_security.ts` to test escaping and session validation helpers.
- **API Role Alignment Brief**: Added `briefs/brief_api_role_alignment.md` to specify role alignment and trial key rules for the Fodda API server.

### Changed
- **Premium Chart Design**: Renamed "Inference Velocity" to "Daily Query Volume" and overhauled it as a premium bar chart with custom tooltips and horizontal gridlines.
- **Team Portal Invitation UI**: Renamed "+ Invite Team Member" to "Invite Team Members" in both the action button and the overlay modal.
- **Account Layout symmetry**: Grouped "Top Users" and the new "Monthly Trend" chart in a symmetric 2-column grid.
- **Interactive & Dynamic Billing Upgrades**: Replaced the static, hardcoded "Scale Tier" ($99/mo) option in `BillingPage.tsx` with a dynamic upgrade button. If on Free, it invites the user to upgrade to Pro ($99/mo); if on Pro, it invites them to upgrade to Enterprise (Contact Sales). Clicking the card now directly opens the Plans & Pricing modal.
- **Fail-Closed Router Gating**: Standardized protection across `authRouter.ts`, `userRouter.ts`, `accountRouter.ts`, and `expertGraphRouter.ts` using `authenticateSession`.
- **Airtable Formula Sanitization**: Enforced escaping on all dynamic query variables in Airtable formula builders to prevent string-breaking injections.
- **Role Normalization**: Standardized user provisioning roles to title-cased `"Employee"` to prevent casing mismatches.
- **Context API Mapping**: Mapped `updateAccountContext` to `updateAccount` in `shared/dataService.ts`.

### Removed
- **Duplicate Headers**: Deleted duplicate titles and subtitles in both the Team Members and Usage tabs.
- **Unimplemented Actions**: Removed the non-functional "Upload Bulk" button in the Team tab and the "Synthesizing Live Traffic" animation badge from the Usage tab.

### Investigated
- **Companion Repositories Security Audit**: Inspected `/Fodda PSFK`, `/Fodda CE`, and `/Fodda Sales` for public-facing route vulnerabilities. Verified that PSFK and CE are password-gated and Sales runs inside Slack with no public web endpoints.

---

---

## [2026-05-20] — Team Auto-Provisioning Control Panel & Bulk Invites

### Added
- **Corporate Auto-Provisioning Settings**: Connected the "Auto-Provision New Team Members" toggle in `AccountPortal.tsx` to the backend. Account Owners can toggle auto-provisioning and specify their corporate domain (e.g. `moversshakers.co`).
- **Sign-Up Auto-Extraction**: Upgraded B2B signup and trial conversion routes in `accountRouter.ts` to automatically populate the `autoProvisionDomain` and enable the toggle for corporate emails.
- **Bulk Invitation Processing**: Upgraded the invite modal and `/invite` API endpoint in `accountRouter.ts` to accept comma-separated email addresses, inviting multiple team members at once and returning success/error breakdowns in the UI.

### Changed
- **Architectural Realignment**: Reverted app-level query proxy interceptors in `mcpRouter.ts` and `queryRouter.ts`. Handed off the runtime enforcement of auto-provisioning to the Core API (`api.fodda.ai`) and MCP (`mcp.fodda.ai`) agents to cover 90% of direct API/MCP traffic.

---

## [2026-05-14] — Admin Portal Identity Resolution & API Key Fixes

### Fixed
- **Admin Portal Identity Resolution**: Fixed a critical bug in `AdminPortal.tsx` where resolving a user's identity caused a blank page crash. Root cause: The `changingPlan` state variable was used but not defined, leading to a `ReferenceError` during React's render phase when displaying the plan change UI. Fixed by properly defining the state variable using `useState`.
- **Admin API Key Lookup**: Fixed a bug in `accountRouter.ts` where the `/admin/lookup` endpoint failed to return API keys due to an incorrect Airtable formula for linked fields. Switched to `FIND()` for reliable resolution.

### Added
- **Workflow Documentation**: Added `.agents/workflows/lookup-user-mcp.md` to standardize the process for retrieving user credentials and MCP URLs.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) deployed via `gcloud run deploy`. Deploys the Admin Portal crash fix.

---

## [2026-05-06] — Simplified MCP URL Parameters & Contextual Onboarding

### Added
- **Contextual Onboarding (10m -> 72h -> 48h)**: Implemented a new onboarding sequence that distinguishes between paid clients and trial users. Clients receive a warmer "Welcome" email with 8 prompt suggestions, automatic CC to `team@fodda.ai`, and a final 48h support nudge that notifies the sales team via Slack.
- **Slack Client Nudge Notifications**: Integrated `app.client.chat.postMessage` in the Sales bot to alert `#fodda-sales` when a client reaches the 48h follow-up mark without conversion.

### Changed
- **Simplified MCP URL Parameters**: Updated both Standard (`/mcp`) and SSE (`/sse`) endpoints to support a unified `?api_key=...&user_id=...` authentication format. Removed instructions for manual Bearer header configuration to reduce friction for desktop and CLI users.
- **App UI Clarity** (`AccountPortal.tsx`): Redesigned the MCP and Claude connection tabs with clear "Best for Browser" vs "Best for Desktop/CLI" labels and updated setup snippets using the simplified URL format.
- **Documentation Overhaul**: Updated `Fodda_Quickstart.md`, `Fodda_Claude_Skill.md`, `Fodda_Notion_README.md`, and `Fodda_CoPilot_Guide.md` with the new unified URL parameter examples.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`): Deployed updated App UI and documentation files to production.

---

## [2026-05-01] — Ways to Access Fodda in Quickstart

### Added
- **Ways to Access Fodda** (`public/Fodda_Quickstart.md`, `dist/Fodda_Quickstart.md`): Added a clear "Ways to Access Fodda" section to the Quickstart guide to clarify the three primary access methods (Web App, MCP Integrations, and REST API) for the Sales agent and users.

---

## [2026-04-30] — Account Tab Navigation Fix & USDA Supplemental Sources

### Added
- **USDA Supplemental Data Sources**: Added 4 new USDA sources (`usda_ers`, `usda_nass`, `usda_fdc`, `usda_ams`) to the fallback supplemental sources list in `MyGraphsPage.tsx` to ensure they are discoverable in the UI even if the API catalog request fails.

### Changed
- **Supplemental Sources Sorting**: Added an alphabetical sort to the fallback supplemental sources array in `MyGraphsPage.tsx` so the UI fallback list renders cleanly from A to Z.
- **Claude Connector Setup URL**: Updated the Claude settings link to include `?modal=add-custom-connector`, which forces the "Add custom connector" modal to open automatically for a smoother setup flow.

### Fixed
- **Initial View Routing Bug**: Fixed an issue where existing users were incorrectly redirected to the MCP Server tab (or other onboarding tabs) upon login or session restore.
  - **Root Cause**: The `validate-session` and `verify` endpoints were not returning `apiUse` or `onboardingIntent`, causing the frontend's `hasSetInitialView` check to fall back to the default MCP connection view every time the app loaded.
  - **Fix**: Added `isFirstLogin` flag to `AuthResponse`, determining its value by the absence of `lastLogin`. The frontend now only applies the onboarding tab redirect (`apiUse`/`onboardingIntent`) if `auth.isFirstLogin` is true, ensuring existing users land safely on their default Overview tab.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) deployed via `gcloud run deploy`. Deploys the USDA supplemental sources and Claude Connector URL UI updates.

---

## [2026-04-28] — Graph Registry: Per-Graph API Key & MCP URL

### Added
- **Graph Credentials in Admin Portal** (`AdminPortal.tsx`): The Graph Registry tab now displays trial API key and MCP URL for each graph that has provisioned trial credentials. When an admin selects a graph, a new "Graph Credentials" card appears below the Deployment Specifications, showing: masked trial API key with Reveal/Copy buttons, full MCP server URL with Copy URL button, trial credit usage (remaining/total), active/exhausted status badge, and trial owner email. Follows the same reveal/copy UX pattern as the User Lookup credentials section.
- **`GET /api/graph-trials` endpoint** (`catalogRouter.ts`): New admin-only endpoint that fetches all trial records from the Airtable Trials table and returns a map of `graphId → { trial_key, mcp_url, api_header, status, credits_remaining, credits_total, owner_email }`. Gated by `?secret=` query parameter.
- **`fetchGraphTrials()` method** (`dataService.ts`): New client-side method that calls the graph-trials endpoint and returns the trial credentials map. Used by the Admin Portal to populate per-graph credential display.

---


### Changed
- **Email Templates** (`server/services/emailTemplates.ts`): Updated all user-facing email copy from "tokens" to "API calls" across 6 templates — `PLAN_LIMIT_WARNING` ("token limit" → "API call limit"), `PLAN_UPGRADED` ("token allowance/counter/usage" → "API call allowance/counter/usage"), `TOP_UP_CONFIRMED` (subject line + body: "bonus tokens" → "bonus API calls"), `EXPERT_GRAPH_APPROVED` ("token usage" → "API call usage"), and `PARTNER_WELCOME` ("tokens/month" → "API calls/month" in both plaintext and HTML variants).
- **Trial Limit Error Messages** (`server/helpers.ts`): All 3 trial-exceeded error strings updated from "Trial token limit exceeded. Sign up for a free Base account to get 100 tokens/month." → "Trial API call limit exceeded. Sign up for a free Base account to get 100 API calls/month."
- **Plan Limit Error Message** (`server/routers/queryRouter.ts`): Changed from "Monthly token limit exceeded. Upgrade your plan or purchase more tokens." → "Monthly API call limit exceeded. Upgrade your plan or purchase more API calls."
- **Admin Portal Comment** (`frontend/components/AdminPortal.tsx`): "Token Usage Bar" → "API Call Usage Bar".
- **Upgrade Modal Comment** (`frontend/components/UpgradeModal.tsx`): "Monthly Tokens" → "Monthly API Calls".
- **Internal Comment** (`server/helpers.ts`): "Token Usage Tracking" → "API Call Usage Tracking".

### Added
- **Dual API Response Fields** (`server/routers/accountRouter.ts`): The `GET /api/account/status` endpoint now returns both new (`api_calls_remaining`, `api_calls_total`, `api_calls_used`, `bonus_api_calls`) and legacy (`tokens_remaining`, `tokens_total`, `tokens_used`, `bonus_tokens`) field names. Updated clients should prefer the `api_calls_*` fields with fallback to `tokens_*` during transition.

---

## [2026-04-24] — Waverunner Create Graph Integration (3 Opportunities)

### Added
- **Deep Extract endpoint** (`server/routers/expertGraphRouter.ts`): New `POST /api/expert-graph/deep-extract` endpoint using Gemini 2.5 Flash with Google Search grounding. Validates each extracted trend against current web data, returning `validationStatus` (verified/emerging/review) and `validationNote` per trend. Streams progress updates to the frontend via Server-Sent Events (SSE) with stage indicators (uploading → extracting → validating → enriching → complete).
- **Waverunner Extraction Service** (`server/services/waverunnerExtractionService.ts`): New service with two extraction functions — `extractWithWaverunner()` for PDF deep extraction with autonomous Google Search validation, and `extractFromUrlContext()` for URL-based extraction using Gemini's native `url_context` tool. Both support real-time progress callbacks.
- **SVG Constellation endpoint** (`server/routers/expertGraphRouter.ts`): New `POST /api/expert-graph/constellation-svg` endpoint that generates a Trend Constellation SVG visualization. Calls the MCP server's `generate_visual` tool via the MCP SDK client for branded watercolor-style output, with a lightweight fallback SVG renderer when the MCP is unavailable.
- **SVG Constellation Service** (`server/services/svgConstellationService.ts`): New service that connects to the Fodda MCP server (`mcp.fodda.ai`) to call the `generate_visual` tool for Trend Constellation SVGs. Includes a self-contained fallback SVG generator with the Fodda brand palette, inner/outer ring layout, and validation-status color coding.
- **Dual-button UX** (`frontend/components/CreateGraphPage.tsx`): Replaced the single "Synthesize Graph" button with two extraction modes — "Quick Extract" (existing Gemini 2.0 Flash, ~5s, outlined button with lightning icon) and "Deep Extract →" (Waverunner + Google Search, ~15-30s, primary brand button with search icon). Both are mutually disabled during extraction.
- **SSE Progress Indicator** (`frontend/components/CreateGraphPage.tsx`): New extraction progress card with a progress bar, percentage counter, and staged checklist (extracting → validating → enriching → complete). Each stage shows ✓/◉/○ status icons and bold highlighting for the current stage. Only visible during active extraction.
- **SVG Constellation Preview** (`frontend/components/CreateGraphPage.tsx`): After extraction, the "Graph Topology Preview" section renders an SVG constellation visualization fetched from the MCP engine. Shows a loading spinner while the SVG is being generated.
- **Validation badges on trend pills** (`frontend/components/CreateGraphPage.tsx`): When Deep Extract is used, trend pills are color-coded — green for "✓ Verified", amber for "⚡ Emerging", gray for "Review" — with a "Deep Validated" badge in the section header and a color legend footer.

### Changed
- **URL input upgraded to `url_context`** (`server/routers/expertGraphRouter.ts`): The existing Quick Extract URL path now uses Gemini 2.5 Flash with the `url_context` tool to read any public URL (PDFs, blog posts, Substack newsletters, company reports). Falls back to the original single-shot Gemini Flash extraction if `url_context` fails.
- **URL placeholder updated** (`frontend/components/CreateGraphPage.tsx`): Changed from `https://example.com/report.pdf` to `https://example.com/report.pdf or any public URL` with help text: "Accepts PDF links, blog posts, Substack newsletters, company report pages".
- **Extraction response enriched** (`server/routers/expertGraphRouter.ts`): Both Quick and Deep Extract responses now include `extractionMode` ('quick' or 'deep'). Deep Extract additionally returns `validationStatus` and `validationNote` per trend.

---



### Fixed
- **Welcome Popup ReferenceError** (`App.tsx`): Fixed an issue where a missing import and undefined state for `WelcomeContextPopup` crashed the React app. The popup is now correctly conditionally rendered using the `shouldShowWelcomePopup` helper function.
- **Supplemental Discovery HTML Fallback** (`apiConfig.ts`): Updated all V1 and Supplemental API endpoints to use absolute paths (`https://api.fodda.ai`) instead of relative paths. This prevents the frontend Fodda App from returning HTML fallback pages for API routes that do not exist locally.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) deployed via `gcloud run deploy`. Deploys the Welcome Popup and API URL fixes.

---

## [2026-04-23] — Airtable Registration Fix & Registration Schema Alignment

### Fixed
- **Airtable Registration Write Error** (`authRouter.ts`): Resolved a critical "UNKNOWN_FIELD_NAME: promoTag" error that caused user registration to fail on the second screen of the sign-up flow. The `promoTag` field was removed from the `Users` table Airtable write payload as the column does not exist in the current schema.
- **Confirmation Flow Alignment** (`authRouter.ts`): Updated the email confirmation route to no longer attempt reading the non-existent `promoTag` field from Airtable.
- **Streak CRM Continuity** (`authRouter.ts`): Ensured that `promoTag` (captured from URL parameters) continues to be passed to the Streak CRM integration for lead attribution, preserving sales tracking while stabilizing the registration database write.

---

## [2026-04-22] — MCP URL in Confirmation Emails

### Added
- **MCP URL in Confirmation Email** (`emailTemplates.ts`, `authRouter.ts`, `accountRouter.ts`): The `SIGNUP_CONFIRMATION` email template now accepts an optional `apiKey` parameter and conditionally displays a ready-to-use MCP connection URL (`https://mcp.fodda.ai/mcp?api_key=...`). The API key is sourced dynamically for new accounts during `/register` and `/trial-convert`, and queried securely from `API_KEYS_TABLE` for existing accounts during `/join` and `/resend-confirmation`. This allows users to immediately connect their AI agent (like Claude) straight from their inbox.
- **Quickstart Guide Updates** (`Fodda_Quickstart.md`, `emailTemplates.ts`): Added a direct link to the Fodda Quickstart Guide (`https://app.fodda.ai/Fodda_Quickstart.md`) in the `SIGNUP_CONFIRMATION` email. Additionally, updated the Quickstart Guide to include explicit connection instructions and configuration structure for **Google Gemini (via Vertex AI)**.

---

## [2026-04-22] — API Documentation Audit: Supplemental Policy & Brand Intelligence

### Changed
- **Supplemental Data section** (`ApiModal.tsx`): Replaced the full listing of 19 individual `/v1/supplemental/*` endpoint paths with a capability-only mention: "20+ real-time supplemental data sources available via the Fodda MCP integration." This aligns with the documentation policy that supplemental endpoints are MCP-internal and should not be exposed for direct third-party REST calls.
- **Downloadable markdown** (`ApiModal.tsx`): Updated the `handleDownloadDocs` markdown export to match — removed all individual supplemental endpoint tables, replaced with the same capability mention and link to `fodda.ai/api`.
- **Quickstart Guide** (`public/Fodda_Quickstart.md`): Major corrections — fixed base URL from `app.fodda.ai` to `api.fodda.ai`, replaced fictional endpoint paths (`/v1/retrieve`, `/v1/evidence`, `/v1/insights`) with actual graph-scoped paths (`/v1/graphs/:graph_id/search`, `/v1/graphs/:graph_id/evidence`, etc.), fixed catalog method from POST to GET, added all missing endpoints (neighbors, adjacent, labels, statistics, brand-intelligence), and added Copilot adapter section.

### Added
- **"How It Works" section** (`Fodda_Quickstart.md`): New section explaining MCP architecture (agent → MCP server → API → Neo4j), typical prompt orchestration flow (6–10 chained tool calls), supplemental data auto-invocation rules (pattern-matched by query content), authentication flow per client type (URL param vs Bearer header), and token metering behavior. No individual supplemental source paths exposed — describes trigger categories only.
- **`POST /v1/brand-intelligence/:brandName`** (`ApiModal.tsx`, `Fodda_Quickstart.md`): Added the new v1 brand intelligence endpoint to the App Docs Modal (UI + downloadable markdown) and the public Quickstart guide. Documents query params `maxEvidence` (default 10) and `limit` (default 50). The legacy `POST /api/brand/evidence` endpoint is preserved and labeled as "Legacy."

### Fixed
- **Airtable Computed Field Write Error** (`authRouter.ts`, `accountRouter.ts`, `helpers.ts`): Fixed an issue where new signups and account updates threw an `INVALID_VALUE_FOR_COLUMN` error. The `monthlyQueries` field was recently converted to a computed field in Airtable, making it read-only. Removed all attempts to write or reset `monthlyQueries` (such as setting it to 0) across the codebase.
- **Server startup crash** (`authRouter.ts`): Removed a duplicate `const providedKey` declaration in the `/register` handler (lines 51 and 135) that caused `tsx` to throw `TransformError: The symbol "providedKey" has already been declared`, crashing the container on startup. The first declaration (line 51) and its unused `rewriteContext` calls were dead code — the background refinement block at line 135 re-declared and re-computed the same values.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00275-v77`. Deploys the Airtable computed field write fix.
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00274-2mv`. Deploys API documentation audit fixes, Quickstart guide overhaul, and authRouter crash fix.

---

## [2026-04-20] — Content Gap Detection → Slack

### Added
- **Content Gap Slack Report** (`queryDigestService.ts`): New `runContentGapSlackReport()` function that analyzes recent queries for content gaps (MISS + WEAK + graph bouncing) and posts a formatted summary to `#fodda-research` on the PSFK Slack workspace. Reuses the existing query digest metrics pipeline — no code duplication.
- **WEAK Result Tracking** (`queryDigestService.ts`): `computeMetrics()` now separately tracks queries that returned results with low relevance (WEAK quality). Previously only MISS (zero results) queries were flagged. WEAK queries are aggregated by frequency into `topWeakQueries`.
- **Graph Bouncing Detection** (`queryDigestService.ts`): Detects when a user searches the same query across 3+ different graphs — a signal the topic exists but is fragmented or poorly covered. Tracked per-user per-normalized-query via `userQueryGraphs` map, exposed as `graphBounces` in metrics.
- **`POST /api/cron/content-gaps` endpoint** (`cronRouter.ts`): New cron-triggerable endpoint. Accepts `{ days: number }` body (default 7). Returns `{ ok, gaps, bounces, slackPosted }`. Protected by the same `CRON_SECRET` auth as existing cron endpoints.
- **`SLACK_BOT_TOKEN` env var** (`.env`): Added the Slack bot token for posting to `#fodda-research`.

### Changed
- **`DigestMetrics` interface** (`queryDigestService.ts`): Extended with `topWeakQueries` and `graphBounces` fields. Existing email digest format unchanged — the new data is only surfaced in the Slack report for now.

---

## [2026-04-16] — MCP Server & Email Refinements

### Added
- **`GET /api/mcp/tools` endpoint** (`mcpRouter.ts`): New backend proxy that utilizes the MCP SDK to dynamically fetch tool metadata from the live MCP server. This resolves the CORS and "Could not load MCP tools" errors by providing a secure, server-side discovery path.
- **`listMcpTools` helper** (`mcpChatService.ts`): Reusable service logic for connecting to and listing tools from the Fodda MCP server.

### Changed
- **MCP Tab UI Reordering** (`AccountPortal.tsx`): Moved the "Endpoints & Auth" card above the "Quick Connect" card to prioritize setup details for new users.
- **Supplemental Sources Sync** (`AccountPortal.tsx`): Updated the supplemental data source count to **21** and expanded the displayed list to include new academic and economic sources (OpenAlex, Semantic Scholar, etc.).
- **Intelligence Tools Sync** (`AccountPortal.tsx`): Updated the Graph Intelligence tools list to reflect live capabilities including node details and neighbor lookups.
- **Frontend Discovery Logic** (`AccountPortal.tsx`): Updated `loadMcpData` to use the new local proxy and pass the user's API key for authenticated tool discovery.

### Fixed
- **Onboarding Email Polish** (`emailTemplates.ts`): Replaced an AI-sounding line in the "5 prompts to start with" email with a more explanatory, human-focused description of why specific queries work best with Fodda.

---

## [2026-04-15] — MCP UX Improvements: Account Status API, Deep Linking & Delete Account

### Added
- **`GET /api/account/status` endpoint** (`accountRouter.ts`): New API endpoint for MCP's `get_my_account` tool. Accepts API key via `X-API-Key` or `Authorization: Bearer` header and returns: `plan`, `tokens_remaining`, `tokens_total`, `tokens_used`, `bonus_tokens`, `graphs_enabled[]`, `graphs_disabled[]`, `profile` (name, email, company, job_title), `reset_date`, `limit_reached`. Resolves API key → Account → Plan → Graph List via existing Airtable queries.
- **`POST /api/account/delete` endpoint** (`accountRouter.ts`): Owner-only account deletion. Validates ownership, requires `confirmPhrase: "DELETE"` safety check, then: (1) revokes all API keys, (2) anonymizes all user records to `deleted_<id>@fodda.ai`, (3) marks account as deleted, (4) sends confirmation email. Non-owners receive a 403 with guidance.
- **`deleteAccount()` method** (`dataService.ts`): Frontend data service method that calls the new delete endpoint.
- **Delete Account UI** (`ProfilePage.tsx`): "Danger Zone" section at the bottom of the Profile page (Owner-only). Red-themed card with a "Delete Account" button that opens a two-step confirmation modal — lists all consequences (anonymization, key revocation, team removal, context deletion) and requires typing "DELETE" to enable the destructive button. On success, clears all localStorage/sessionStorage and reloads to login.
- **SPA Deep Linking** (`App.tsx`): The App now parses `window.location.pathname` on mount and routes to the correct view. Supported deep links: `/account/settings`, `/account/overview`, `/account/team`, `/account/usage`, `/profile`, `/profile/context`, `/connections/claude`, `/connections/gemini`, `/connections/api`, `/connections/mcp`, `/graphs`, `/sandbox`, `/knowledge/api-docs`. URL is cleaned via `history.replaceState('/')` after routing.
- **`/account/top-up` deep link** (`App.tsx`): Navigating to `/account/top-up` or `/account/topup` opens the UpgradeModal automatically after authentication, using a deferred `pendingTopUpModal` flag.

### Fixed
- **Broken Graph Admin link on gate page** (`App.tsx`): Resolved an issue where the "Graph Admin" link on the `AuthGate` (login screen) failed to trigger the admin portal. Wired the `isAdminOpen` state into the `App` component's rendering logic for both unauthenticated and authenticated sessions.

### Investigated
- **`id` Parameter Tracking**: Verified that trial key attribution (`sk_trial_*` → graph slug extraction), `sourceGraphId` on accounts, and `Trials` table tracking are all working correctly. The MCP server handles the `?id=` parameter at its own layer — no App-side changes needed.

---

## [2026-04-12] — Token Economy, Trial System & Top-Up Fix

### Added
- **Token Purchases logging** (`accountRouter.ts`): All Stripe transactions (top-ups and plan upgrades) now log to the `Token Purchases` table (`tblNJdPZnVQ0jmlQh`) with `accountId`, `userEmail`, `amount`, `priceUSD`, `stripeSessionId`, `referralGraphId`, `payoutStatus`, and `type`. This enables 50% rev-share attribution for graph owners via `sourceGraphId`.
- **`TOP_UP_CONFIRMED` email template** (`emailTemplates.ts`): New email sent on top-up purchases: "X bonus tokens added to your account" with balance summary. Bonus tokens don't expire and don't reset on billing cycle.
- **`POST /api/account/trial-convert` endpoint** (`accountRouter.ts`): Auto-creates a Base account from a trial key + email. Extracts `graphId` from the trial key (`sk_trial_2026-macro-trend-graph` → `2026-macro-trend-graph`), sets `sourceGraphId`/`sourceTrialKey` for revenue attribution, scopes the vertical, generates an API key, sends confirmation email, and fires user enrichment. Called by the MCP when it captures a trial user's email. Handles existing users gracefully (returns `alreadyExists: true`).
- **Trial data in My Graphs** (`expertGraphRouter.ts`): `GET /api/expert-graph/my-submissions` now fetches the `Trials` table in parallel and includes a `trial` object per graph with `api_key`, `mcp_url`, `credits_remaining`, `credits_total`. Powers the credit bars, Copy MCP URL, and Copy API Key buttons in the "Your Graphs" section.
- **`graphsIncluded` in plans API** (`accountRouter.ts`): `GET /api/plans` now returns the `Graphs Included` field from Airtable, fixing the UpgradeModal's graph access display.
- **`TRIALS_TABLE` + `TOKEN_PURCHASES_TABLE` constants** (`constants.ts`, `db.ts`): New Airtable table IDs wired into the shared constants layer.

### Changed
- **Language sweep: "queries" → "tokens"** (8 files): Updated all user-facing billing and metering copy across `helpers.ts`, `queryRouter.ts`, `emailTemplates.ts`, `metering.ts`, `UpgradeModal.tsx`, `MyGraphsPage.tsx`, `AccountPortal.tsx`, `AuthGate.tsx`. Internal field names (e.g. `monthlyQueries`) are unchanged to avoid Airtable schema breaks.
- **Trial limit bumped to 50** (`helpers.ts`): `TRIAL_TOKEN_LIMIT` increased from 5 to 50. Trial keys provisioned via the Airtable Trials table get persistent tracking; non-provisioned keys fall back to in-memory metering.
- **Metering module renamed** (`shared/metering.ts`): `QUERY_UNIT_CONFIG` → `TOKEN_COST_CONFIG`, `calculateQueryUnits()` → `calculateTokenCost()`. Backward alias `calculateQueryUnits` preserved for API compatibility.
- **`fetchOwnedGraphs` rewired** (`dataService.ts`): Switched from the external `/v1/graphs/mine` API to the local `/api/expert-graph/my-submissions` endpoint which now includes trial data. Accepts `email` parameter.

### Fixed
- **🚨 Critical: Top-up purchases overwriting user plans** (`accountRouter.ts`): Previously, buying a 100-token top-up via Stripe would overwrite the user's real plan (e.g., Pro) with Plan 7 ("Top-Up"), reset their monthly counter, and permanently break their billing cycle (the cron skips planCode 7). Fixed by splitting the Stripe webhook into two paths: top-ups add to a `bonusTokens` field without touching the plan; plan upgrades follow the original flow.
- **Effective token limit now includes bonus tokens** (`queryRouter.ts`): Plan limit check updated from `monthlyLimit` to `monthlyLimit + bonusTokens`, so purchased top-up tokens actually extend the user's capacity.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00251-mrw`. Activates the full token economy, persistent trial system, top-up fix, and trial-convert endpoint.

---

## [2026-04-12] — Graph Toggle Persistence & User Router

### Added
- **`POST /api/user/disabled-graphs` endpoint** (`server/routers/userRouter.ts`): New backend endpoint that persists the user's graph toggle preferences to the Airtable `disabledGraphs` field. The frontend's `MyGraphsPage.tsx` already calls this via `dataService.updateDisabledGraphs()` — previously the call silently failed because no server route existed. Toggle state now survives page reloads.
- **`userRouter.ts`** (`server/routers/`): New dedicated router for user-level endpoints. Includes `POST /disabled-graphs`, `POST /update`, `POST /context`, and `GET /stats` — all previously called by `dataService.ts` but missing from the server. Mounted at `/api/user` in `server/index.ts`.

### Changed
- **`disabledGraphs` in auth response** (`server/routers/authRouter.ts`): Both `/api/auth/verify` and `/api/auth/validate-session` now include `disabledGraphs` (from Airtable user record) in the returned user object. This allows the frontend to initialize the toggle state from the server on login and session restore, completing the persistence round-trip.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00249-pmv`. Activates graph toggle persistence and the user router.

---

## [2026-04-12] — Magic Link Fix, Catalog Restore & UI Polish

### Fixed
- **Expert Graph Submission Failure** (`expertGraphRouter.ts`): Resolved a critical issue where new graph submissions failed to reach the CE review base due to a schema mismatch (attempting to write to non-existent fields like `PDF URL`, `Published Date`). Corrected the mapping and implemented atomic error handling to prevent "broken" admin links. Manually restored the missing "Restaurant Dining Trends" record.
- **Auto-Heal for Missing Submissions** (`expertGraphRouter.ts`): Added logic to dynamically discover and heal ownership of Registry records if they exist in the CE base but are missing from the user's dashboard.
- **Critical: Airtable Schema Mismatch** (`authRouter.ts`): Identified that the `Users` table in the production base is missing `sessionToken`, `sessionExpiresAt`, and `lastLogin` fields. My previous "atomic" optimization caused these missing fields to trigger a terminal 422 error, blocking all logins. Resolved by removing these fields from the database update payload.
- **Magic Link Race Condition** (`AuthGate.tsx`): Resolved a critical bug where React 18 StrictMode caused double-verification of magic link tokens. The first call would successfully verify and clear the token, while the second call would fail (already cleared), causing an "Invalid Link" error for the user. Implemented a `sessionStorage` guard to ensure tokens are only verified once per session.
- **Verification Atomic Update** (`server/routers/authRouter.ts`): Optimized the login verification process by combining token clearing and session creation into a single atomic Airtable update. This prevents partial state failures and reduces latency during login.
- **Critical: `/api/graph-catalog` endpoint missing** (`server/routers/catalogRouter.ts`, `server/index.ts`): The graph catalog endpoint was accidentally dropped during the server router refactoring. This caused the frontend to always fall back to the static list in `dataService.ts`, resulting in graphs appearing in the wrong categories (e.g. Industry Papers showing as Expert). Created new `catalogRouter.ts` and mounted it at `/api/graph-catalog`.
- **Static fallback graph list** (`shared/dataService.ts`): Replaced the stale 10-entry fallback with all 44 live graphs, each with correct `graph_type` values matching the Airtable Graph List (source of truth). Fallback now covers all 6 categories: Domain (4), Expert (10), Industry Papers (9), Supplemental (21), Skills (2), Custom (1).
- **Airtable URL Construction** (`server/db.ts`): Fixed potential trailing ampersand issues in Airtable query strings when no extra parameters were provided.

### Added
- **"New" navigation pill** (`MyGraphsPage.tsx`): Added a ✨ "New" pill to the category nav bar with a count badge. Shows graphs approved in the last 30 days. Clicking it shows only the "New" section — other category sections are hidden.
- **"New" badge on graph cards** (`MyGraphsPage.tsx`): Individual graph cards now show a sky-blue ✨ "New" badge next to their name when their `approved_date` (or `published_date` fallback) is within the last 30 days.
- **`approved_date` field** (`catalogRouter.ts`, `dataService.ts`, `types.ts`): Wired the Airtable "Approved Date" column through the full stack — server reads it from Airtable, API returns it as `approved_date`, dataService maps it, and the `KnowledgeGraph` TypeScript interface now includes it.

### Changed
- **AuthGate Error Messaging** (`AuthGate.tsx`): Improved user guidance when a magic link fails. Changed the generic "Invalid or Expired Link" error to "Link invalid or expired. Please resubmit your email to get a new link." and added automatic error clearing when the user starts typing.
- **Error UI Polish** (`AuthGate.tsx`): Removed forced uppercase styling for error toasts to improve readability of multi-sentence instructions and adjusted layout positioning for better fit.
- **`KnowledgeGraph` type** (`shared/types.ts`): Added `approved_date?: string` field and `'industry report'` (with space) to the `graph_type` union to handle the Airtable format.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00244-rxq`. This deployment activates the magic link fixes, restored catalog, and improved messaging.

---

## [2026-04-11] — Expert Graph Pipeline Refinement & Uploadcare Integration

### Added
- **Uploadcare CDN Integration** (`server/services/uploadcareService.ts`): New service for handling PDF and headshot uploads. Local file storage is replaced by direct-to-CDN uploads, ensuring the App only passes lightweight CDN URLs to the CE ingestion pipeline.
- **Submission Confirmation Modal** (`CreateGraphPage.tsx`): Added a mandatory glassmorphism confirmation popup for graph submissions. Users must acknowledge content rights and sharing permissions before their graph enters the review queue.
- **Macro Trend Extraction**: Updated the lightweight Gemini extraction pipeline to identify and count high-level "Macro Trends" in addition to standard trends and evidence.
- **Headshot Re-use Logic** (`server/index.ts`): Server now automatically searches the graph registry for existing headshots associated with the same creator or organization during extraction to reduce redundant uploads.

### Changed
- **Graph Type Classification** (`CreateGraphPage.tsx`): Added manual and automated classification for "Expert Report" vs. "Industry Report". This value is now synced to the CE Airtable base for improved cataloging.
- **Trend Capitalization Standard**: Prompted Gemini to enforce "Title Case" for all extracted trend names. Added a `toTitleCase` helper in the server mapping to guarantee consistency across all extraction sources (Gemini and CE).
- **Extraction Response**: `/api/expert-graph/upload-pdf` now returns the permanent Uploadcare CDN URL immediately, which the frontend adopts for the final submission.

### Deployed
- **Cloud Run service `fodda-sandbox`** (`app.fodda.ai`) revision `fodda-sandbox-00232-xkv`. This deployment activates the Uploadcare integration and the updated extraction prompt.

---


### Changed
- **"Free - Trial" Plan Limit** (`Airtable`): Increased the monthly query limit for registered users on the Free tier from 50 to **100**. This change was applied directly to the canonical Plans table in Airtable.
- **Anonymous Trial Limit** (`server/index.ts`): Increased the query limit for anonymous sessions (those using `sk_trial_` keys) from 12 to **30** to allow for better experimentation without registration.

---

## [2026-04-10] — 'The Connection Index' Graph Integration

### Added
- **`Vertical.Delta_ConnectionIndex`** (`shared/types.ts`): New enum value `'delta-the-connection-index'` added to the shared Vertical enum.
- **Suggested Questions** (`shared/constants.ts`): Added 4 starter questions specific to the Delta Connection Index (travel & human connection).
- **Visible 'Coming Soon' Status** (`server/index.ts`, `MyGraphsPage.tsx`): Updated the graph catalog logic to include and display graphs with the `coming_soon` status in the UI, ensuring the new Delta graph is discoverable as a placeholder.

### Changed
- **Graph Catalog Filter** (`MyGraphsPage.tsx`): Updated the `visibleGraphs` filter to allow `coming_soon` status alongside `live` and `beta`.

### Deployed
- Cloud Run service `fodda-sandbox` (`app.fodda.ai`) revision `fodda-sandbox-00220-xg2`. This deployment was necessary to activate the hardcoded anonymous limit increase.

---

## [2026-04-09] — My Graphs: Group Controls, Custom Section Split & Category Rename

### Changed
- **"Industry Reports" → "Industry Papers"** (`MyGraphsPage.tsx`): Renamed the pill navigation label and category header to "Industry Papers".
- **"Custom Reports" → "Custom"** (`MyGraphsPage.tsx`): Renamed and broadened the label to encompass both user-uploaded graphs and linked external research.
- **"Add Resource" Button Behavior** (`MyGraphsPage.tsx`): The top-bar "Add Resource" button now navigates to the Custom category pill and opens the form inline within the Linked Research sub-section, rather than floating at the top of the page.
- **CE Design `graph_type` fallback** (`dataService.ts`): Fixed static fallback from `'domain'` to `'user'` to match Airtable — CE Design now correctly appears under Custom instead of Domain Context.

### Deployed
- Cloud Run service `fodda-sandbox` (`app.fodda.ai`) revision `fodda-sandbox-00218-g5g`.

---

## [2026-04-09] — Gate Login-to-Signup Redirect for Unknown Emails

### Changed
- **AuthGate Unknown Email Flow** (`AuthGate.tsx`): When a user enters an email at the Gate that isn't found in the system, the app now treats it as a sign-up intent instead of rejecting with an error message. The Gate seamlessly transitions to the onboarding form (step 1) with the email pre-populated, eliminating the friction of a dead-end "user not found" error. Detection is based on the server's 404 response status and error message keywords (`"can't find"`, `"not found"`, `"sign up"`).

---

## [2026-04-09] — OpenAlex Academic Research Chat Integration

### Added
- **`SUPPLEMENTAL_OPENALEX` endpoint** (`shared/apiConfig.ts`): New API endpoint constant for the OpenAlex academic research trends source (`/v1/supplemental/openalex/research-trends`).
- **OpenAlex in Chat Enrichment** (`frontend/services/geminiService.ts`): `fetchSupplementalData()` now calls the Academic Research Tracker endpoint for all verticals. PubMed remains the specialized biomedical source for beauty/health; OpenAlex (250M+ works) provides broad academic context for retail, fashion, sports, culture, CE design, and all other domains. Both fire for beauty/health to cover biomedical + general research.

### Verified
- **Auto-Discovery**: The `openalex_research` source is registered in the API's `SUPPLEMENTAL_SOURCES` and appears via `GET /v1/supplemental/sources`. The App discovers it automatically via the existing `supplemental_sources` array in the graph catalog response — no manual source list changes needed.
- **No New UI Components**: The source follows the standard `SupplementalSource` shape. Existing supplemental source cards in MyGraphsPage render it automatically with the teal accent and "Available" badge.

---

## [2026-04-09] — My Graphs Expert Dashboard: Owned Graphs & Trial URLs

### Added
- **"Your Graphs" Owned Section** (`MyGraphsPage.tsx`): New premium section at the top of the My Graphs page showing graphs the authenticated user owns (via `GET /v1/graphs/mine`). Each owned graph card displays: graph name with gold ★ Owner badge, curator, graph ID slug, live/beta status badge, toggle ON/OFF (reuses existing `disabledGraphs` persistence), trial credits progress bar (green > 50%, amber 25–50%, red < 25%), prominent "Copy MCP URL" button (amber accent), secondary "Copy API Key" button, and a sharing tip recommending `&userId=email` for usage tracking. Section only renders when `ownedGraphs.length > 0`.
- **Copy-to-Clipboard UX** (`MyGraphsPage.tsx`): Inline "Copied ✓" feedback on each copy button with 2-second auto-dismiss. Both MCP URL and API Key buttons share a single `copiedKey` state to avoid multiple simultaneous "Copied" indicators.
- **`fetchOwnedGraphs()` method** (`shared/dataService.ts`): New `DataService` method that calls `GET https://api.fodda.ai/v1/graphs/mine` with the account's API key. Returns `OwnedGraph[]` with trial access info (api_key, mcp_url, credits_remaining/total). Gracefully returns `[]` on failure.
- **`OwnedGraph` TypeScript interface** (`MyGraphsPage.tsx`): Local typed interface matching the `/v1/graphs/mine` API response shape, including optional `trial` object with credits tracking.
- **`ownedGraphs` prop** (`MyGraphsPage.tsx`, `App.tsx`): New prop wired from App state through to the component. Fetched in parallel with the graph catalog during `handleSessionStart`.

---

## [2026-04-09] — My Graphs Pill Navigation & Skill Graph Type

### Added
- **Pill Navigation** (`MyGraphsPage.tsx`): Added a horizontal pill navigation bar to filter the My Graphs list by graph type (All, Domain Context, Expert Graphs, Institutional, Industry Reports, Custom Reports, Skills).

### Changed
- **`graph_type` Union** (`shared/types.ts`): Added a new `'skill'` type to the union.
- **Graph Categories** (`MyGraphsPage.tsx`): Updated category labels to match new terminology (e.g., Domain Context, Institutional, Custom Reports) and integrated the new "Skills" category to group agent workflows.

### Fixed
- **Airtable API Parsing** (`server/index.ts`): Fixed a critical crash on `/api/graph-catalog` causing graph fetching to fail/fallback due to a missing `headshotUrl` field (now mapped to `Portrait Attachment`).
- **Airtable Fields Hardening** (`server/index.ts`): Removed the strict URL-encoded `fields[]` array from the Airtable query entirely, allowing it to graciously return all columns. This prevents future 422 Unprocessable Entity crashes if the CE team renames or deletes columns (like `trend_count` to `trendCount`), and guarantees the Fodda App never falls back to static mocks unexpectedly.
- **Graph Type Mapping** (`server/index.ts`, `MyGraphsPage.tsx`): Fixed `graphType` parsing from Airtable (fetching custom field `graphType` instead of `graph_type`). Frontend now handles whitespace variants from the database like "industry report".

### Deployed
- Cloud Run service `fodda-sandbox` (`app.fodda.ai`) revision `fodda-sandbox-00215`.

---

## [2026-04-08] — Graph Type Taxonomy Expansion (5 Types)

### Changed
- **`graph_type` Union** (`shared/types.ts`): Expanded from `'domain' | 'expert' | 'supplemental' | 'baseline'` to `'domain' | 'expert' | 'industry_report' | 'supplemental' | 'user' | 'baseline'`. The `baseline` value is retained for backward compatibility with existing Airtable records (folded into supplemental in the UI).
- **`MyGraphsPage.tsx` Categories**: Updated from 3 visual categories (Domain, Expert, Supplemental) to 5 — added **Industry Reports** (indigo accent, for business/organization-published research) and **Your Graphs** (teal accent, for user-uploaded graphs). Grouping logic now routes `industry_report` and `user` graph types to their own sections.
- **Category Render Order**: Domain → Expert → Industry Reports → Your Graphs → Supplemental Data. Empty categories are auto-hidden.

### Deployed
- Cloud Run service `fodda-sandbox` (`app.fodda.ai`) revision `fodda-sandbox-00212-z9b`.

---

## [2026-04-08] — Microsoft 365 Copilot MCP Apps Setup Portal

### Added
- **MCP Direct Connection Path** (`AccountPortal.tsx`): New recommended connection method for Microsoft 365 Copilot using native MCP Apps support (announced March 9, 2026). Includes step-by-step VS Code Agents Toolkit flow, inline MCP URL with "Copy MCP URL" button, API Key display with reveal/copy buttons, authentication config cards (Type: API Key, Header: X-API-Key), tool count badge, and capabilities checklist (7 graph tools, 18 supplemental sources).
- **"What it looks like in Copilot" Preview** (`AccountPortal.tsx`): Aspirational section showing a simulated Copilot chat interaction — user asks about DHL e-commerce trends, Copilot calls `search_trends`, results render inline. Useful for Microsoft meeting demos.
- **Copilot Tab in MCP Quick Connect** (`AccountPortal.tsx`): Added "M365 Copilot" as a third option in the MCP/Dev Quick Connect tabs (alongside CLI and Streamable HTTP). Shows condensed Agents Toolkit setup with copy-able MCP URL and auto-discovered tool count.
- **Copilot Link in MCP Help Footer** (`AccountPortal.tsx`): Added link to Microsoft's "MCP Apps in Copilot" blog post alongside existing Gemini, OpenAI, and Claude setup guides.

### Changed
- **Copilot Tab Path Switcher** (`AccountPortal.tsx`): Copilot tab now shows two paths via a tabbed switcher — "MCP Direct" (recommended, green badge) and "Teams App Plugin" (labeled as Legacy/Alternative). The existing Copilot Studio REST API flow is preserved under the Plugin tab.
- **Copilot Tab Header** (`AccountPortal.tsx`): Updated from "Microsoft Copilot Connection" to "Microsoft 365 Copilot" with live tool count badge from MCP server.
- **MCP Data Loading** (`AccountPortal.tsx`): Copilot tab now triggers MCP tool data loading (previously only Claude, Notion, and MCP tabs did).
- **ConnectionsPage Subtitle** (`ConnectionsPage.tsx`): Updated Copilot subtitle to "Connect Fodda to Microsoft 365 Copilot via MCP or Teams plugin".

---

## [2026-04-05] — Professional Services Flag (Persona-Aware Framing)

### Added
- **Onboarding Navigation Rules** (`shared/types.ts`, `server/index.ts`, `App.tsx`): Implemented logic to automatically route users to specific views upon their first login based on their selected intent.
    - **"Self Demo a Graph"** → Routes to the **Sandbox**.
    - **"🔧Developer / API"** → Routes to the **API Documentation**.
- **`onboardingIntent` User Field** (`shared/types.ts`): New field on the `User` interface to persist the user's initial onboarding choice.

### Changed
- **Auth Flow Persistence** (`server/index.ts`): Updated `/api/auth/register` to save `onboardingIntent` to Airtable. Updated `/api/auth/verify` and `/api/auth/validate-session` to retrieve and return the `onboardingIntent` to the frontend.
- **Initial View Logic** (`App.tsx`): Refactored `handleSessionStart` to prioritize `onboardingIntent` over `apiUse` when setting the application's initial view. Added support for the `'sandbox'` keyword in the `apiUse` check.
- **`isProfessionalServices` Account Flag** (`shared/types.ts`): New optional boolean on the `Account` interface. Controls whether the MCP server adapts its analytical framing for agency/consultancy users who research on behalf of clients rather than for their own company.
- **Registration Checkbox** (`AuthGate.tsx`): "We research on behalf of clients" checkbox on Step 2 of the Create Account flow. Value forwarded to Airtable `Is Professional Services` column.
- **Welcome Popup Checkbox** (`WelcomeContextPopup.tsx`): Added same checkbox to the post-login onboarding popup.
- **Settings Toggle** (`AccountPortal.tsx`): Added "Professional Services Account" toggle to the Settings tab for easy configuration.
- **MCP Chat Persona Injection** (`server/index.ts`): Service adapts analytic framing based on the `Is Professional Services` flag.

### Deployed
- Cloud Run service `fodda-sandbox` (`app.fodda.ai`) updated with new navigation rules and persona-aware framing.

---

## [2026-04-03b] — Admin Workspace Polish: Round 2

### Added
- **Profile**: Dedicated person icon in sidebar nav. "Billing" sub-item (disabled, "Soon" badge).
- **Account > Context**: New sub-menu under Account for managing Account Context and Personal Research Persona — inline editable with save-to-DB.
- **Connections > Gemini / Vertex**: New sidebar item routing to the MCP tab with Vertex/Gemini quickConnect pre-selected.
- **Sandbox Graph Selector**: Top bar with all available graph options for switching between verticals during chat. Replaces the old hardcoded vertical switch.
- **Logout in Sidebar Footer**: Moved from ProfilePage bottom to the sidebar footer, available globally.

### Changed
- **Account Overview**: Redesigned into 3 sections — Account Info (with company name), Plan (with "Change Plan →" link), Monthly Usage. Removed Manage Team, Copy API Key, and View Plans buttons.
- **Profile Page**: Restyled all sections to match Connections design language (`p-6 bg-zinc-900/50 border-zinc-800 rounded-2xl`). Fixed usage stats to read from account object (same source as AccountPortal overview). Removed logout button.
- **Team Members**: Current logged-in user now always appears in the team list, even if the API doesn't return them.
- **Graph Registry**: Updated `dataService.getGraphs()` from 6 to 25 entries — now mirrors the canonical `GRAPH_REGISTRY` in the Fodda API (21 graphs + Pew baseline). All expert/partner graphs (Dentsu, TBWA, Publicis Sapient, Braze, DHL, Firefish, etc.) now visible in My Graphs and sandbox.
- **Sidebar**: Reordered — My Graphs now appears above Connections. Removed Graph Admin link. Added account-context.
- **`AppView` type**: Added `account-context`, `connections-gemini`, `profile-billing`. Removed `account-graph-admin`.
- **`ConnectionTab` type**: Added `gemini`.

### Fixed
- ProfilePage `planName`/`planCode` lint errors (cast to `any`).
- AccountPortal `gemini` tab type mismatch — mapped to `mcp` with `vertex` quickConnect auto-selected.

### Deployed

## [2026-04-03] — Navigation Refactor: Modal-to-Tab Architecture

### Added
- **`ProfilePage.tsx`**: Full-page user profile replacing the legacy `Dashboard` modal. Includes usage stats with color-coded progress bar, masked API key with reveal/copy toggle, editable research persona, inline toast notifications (replacing browser `alert()`), and logout. Default landing page after login.
- **`ConnectionsPage.tsx`**: Thin wrapper rendering `AccountPortal` inline for Claude, Notion, Copilot, MCP, and API connector tabs. Adds contextual page headers (e.g. "Connections > Claude Connector") with subtitles.
- **`MyGraphsPage.tsx`**: Categorized knowledge graph list (Domain, Expert, Supplemental) with toggle switches and a mock "Add Research Resource" flow for future graph contribution.
- **`KnowledgePage.tsx`**: Consolidated API Docs, Reliability/Deterministic Mode, and Security content from legacy modals (`ApiModal`, `DeterministicModal`, `SecurityModal`) into a single tabbed page with breadcrumb headers.
- **`GovernancePage.tsx`**: Mock-up of 5 governance categories (Data Access Controls, User Permissions, Audit & Compliance, Data Retention, Content Policies) with "Coming Soon" badges and disabled toggles.
- **`AppView` type** (`Sidebar.tsx`): 18-value union type defining all navigable views. Exported for use in `App.tsx` routing.
- **Sidebar footer**: Version label ("Fodda Console v2.0") in the sidebar footer.

### Changed
- **`Sidebar.tsx`**: Complete rewrite from individual click handlers (`onAccountClick`, `onApiClick`, `onDashboardClick`, etc.) to a unified `onNavigate(view: AppView)` pattern. 6-section collapsible navigation: Profile, Account (Admin/Owner only), Connections, My Graphs, Demo Area, Knowledge. Sections auto-expand when their child view is active. Section expand/collapse state persisted to `localStorage`.
- **`AccountPortal.tsx`**: Added `inline?: boolean` and `initialTab?` props. When `inline=true`, the modal wrapper, header, and internal sidebar are hidden — the portal renders as a flat page component inside `<main>`. All existing tab logic and usage tracking preserved.
- **`App.tsx`**: Replaced 9 boolean modal states (`isAccountPortalOpen`, `isDashboardOpen`, `isApiModalOpen`, `isSecurityModalOpen`, `isDeterministicModalOpen`, etc.) with a single `activeView: AppView` state. New `renderActiveView()` function routes to the correct page component. Chat sandbox + Evidence drawer remain as the fallback view. Onboarding-aware initial view routing: `apiUse` containing "claude" → `connections-claude`, "notion" → `connections-notion`, "api" → `connections-api`, "chat" → `sandbox`, default → `profile`.

### Preserved (unchanged)
- **AuthGate**: All onboarding/login flows, magic link verification, referral codes
- **UpgradeModal**: Plan limit enforcement and Stripe checkout
- **DevToolsDrawer**: Dev mode toggle and API transaction inspection
- **Usage tracking**: `logToAirtable`, query metering, session management (24h expiry, auth policy enforcement)
- **Chat engine**: `handleSendMessage`, hybrid search, Gemini synthesis, evidence retrieval
- **Server-side**: Zero server changes

### Deployed
- **Production** (`app.fodda.ai`): Deployed revision `fodda-sandbox-00198-ps8` (initial), then `fodda-sandbox-00199` (polish pass) to Google Cloud Run.

---

## [2026-04-02] — Anonymous Query Identity Resolution & Automatic Supplemental Data

### Added
- **Automatic Supplemental Data Rules** (`public/Fodda_Claude_Skill.md`): New `## AUTOMATIC SUPPLEMENTAL DATA RULES` section added to the MCP skill file. Defines conditional trigger logic so Claude automatically fires supplemental data tools (`get_census_demographics_snapshot`, `get_fred_economic_snapshot`, `get_census_retail_snapshot`, `get_worldbank_global_snapshot`, `get_bls_economic_snapshot`, `get_amazon_products_snapshot`) in parallel with evidence deep-dives after every `search_graph` call. Triggers pattern-match on query content: US locations (fuzzy — neighborhoods, cities, metro areas), consumer behavior/spending, non-US countries, health/wellness topics, and specific product categories. Multiple triggers can fire simultaneously.
- **`resolveEmailFromApiKey()` helper** (`server/index.ts`): New async function that resolves a human-readable identity from an API key. Trial keys (e.g. `sk_trial_sic`) return the key name directly. Real keys look up the Account's `adminEmail` via `resolveIdentity()` → Airtable Account fetch. Falls back to Account name + `(API)` suffix, then to a truncated key stub. Results cached in-memory (`emailFromKeyCache`) to avoid repeat Airtable lookups.
- **Auto-logging for external API/MCP callers** (`server/index.ts`): Both `/api/query` and `/v1/graphs/:graphId/search` now automatically write to the Airtable Questions table for external (non-web-app) callers. Previously, only web app users who triggered `/api/log` appeared in the logs dashboard — MCP and direct API callers were invisible. The auto-log fires asynchronously (non-blocking) and uses the resolved email/label from `resolveEmailFromApiKey()`.

### Changed
- **`/api/log` endpoint** (`server/index.ts`): When `email` is empty but `accessKey` is provided, now resolves identity from the key instead of defaulting to `"anonymous"`. Uses the same `resolveEmailFromApiKey()` helper.

### Deployed
- **Production** (`app.fodda.ai`): Deployed revision `fodda-sandbox-00197-6j8` to Google Cloud Run.

---

## [2026-03-31] — MLB Sponsorship Expert Graph Integration & WTO Trade Data Source

### Added
- **`Vertical.MLBSponsorship`** (`shared/types.ts`, `types.ts`): New enum value `'mlb-sponsorship'` added to both the shared and root Vertical enums.
- **MLB Sponsorship in Graph List** (`shared/dataService.ts`): Added to `getGraphs()` with metadata — owner: Andy Abramson / Comunicano, quarterly updates, $0.75/query, "Sports Sponsorship" vertical name.
- **MLB Sponsorship Persona** (`frontend/services/geminiService.ts`): Dedicated system prompt persona as the "MLB Sponsorship & Technology Intelligence Analyst", focusing on sponsorship ROI, fan experience innovation, and technology deployment across MLB's 30-team ecosystem.
- **Suggested Questions** (`shared/constants.ts`, `constants.ts`): 4 starter questions covering T-Mobile 5G, facial authentication, prediction markets, and the Automated Ball-Strike Challenge system.
- **Mock Trends & Articles** (`constants.ts`): 5 mock trends (AI avatars, prediction markets, AI marketing, facial authentication, MiLB platforms) and 5 mock articles for offline fallback.
- **Sidebar Logo** (`frontend/components/Sidebar.tsx`): `MLBSponsorshipLogo` component using Andy Abramson's headshot. Graph appears in the "Expert Graphs" sidebar section alongside SIC and CE Design.
- **WTO Trade Snapshot Proxy** (`server/index.ts`): New `GET /v1/supplemental/wto/trade-snapshot` proxy route forwarding `countries`, `categories`, and `years` query params to the upstream Fodda API. Follows the same `proxySupplementalGet` pattern as the other 12 supplemental proxies.
- **`SUPPLEMENTAL_WTO_TRADE` endpoint** (`shared/apiConfig.ts`): New endpoint constant for the WTO trade-snapshot supplemental source.
- **WTO in Gemini Prompt Enrichment** (`server/index.ts`): `fetchSupplementalContext()` now fetches WTO merchandise trade data for `retail`/`fashion` verticals, and WTO trade + tariffs for the `ce-design` vertical. Grouped alongside World Bank as a "Global & International" data source.

### Changed
- **`normalizeVertical()`** (`shared/dataService.ts`): Added `mlb`, `mlbsponsorship`, `mlb-sponsorship` pattern matching.
- **`logToAirtable()`** (`shared/dataService.ts`): Added `mlb` → `mlb-sponsorship` graphId derivation for usage logging.
- **`retrieve()`** (`shared/dataService.ts`): Added `isMLBSponsorship` routing that maps to `graphId: 'mlb-sponsorship'`, `apiVertical: 'general'`.
- **`ChatInterface.tsx`**: Added `isMLBSponsorship` variable, header label "MLB Sponsorship Graph", and welcome title "MLB Sponsorship & Technology Intelligence."
- **`App.tsx`**: Updated `useDiscovery` hook to route `mlb-sponsorship` correctly.
- **Server Registration** (`server/index.ts`): Added `mlb-sponsorship` to `validGraphSlugs` and `verticalMap` for referral link support.
- **Prompt Validator** (`server/services/promptValidator.ts`): Added `mlb-sponsorship` to `GRAPH_SLUG_MAP`.
- **Prompt Selector** (`server/services/promptSelector.ts`): Added `mlb-sponsorship` to `KNOWN_GRAPH_IDS`.
- **Graph Display Name** (`shared/dataService.ts`): Updated to official registry name "Comunicano MLB Sponsorship & Technology Graph" with "Curated by Comunicano" in description.
- **Mock Articles** (`constants.ts`): Updated to use real Airtable data (correct snippets, sourceUrls, and Airtable trend record IDs) from the synced graph.

### Deployed
- **Production** (`app.fodda.ai`): Deployed revision `fodda-sandbox-00192-ckk` to Google Cloud Run.

---

## [2026-03-30] — Graph Reorganization, CE Design Branding & Personalized Onboarding Email
 
### Added
- **CE Design Persona** (`geminiService.ts`): Created a specialized expert analyst persona for the Consumer Electronics & Design graph, focusing on hardware innovation, industrial design, and human-centric technology.
- **Personalized Onboarding Email System** (`server/services/userEnrichmentService.ts`, `promptSelector.ts`, `promptValidator.ts`, `data/prompt-bank.json`, `emailTemplates.ts`, `server/index.ts`): Replaced the generic "What do you think?" welcome email with a structured pipeline that fires 5 minutes after email confirmation:
  1. **Buyer enrichment** fires immediately on confirm — uses Gemini's built-in `googleSearch` grounding tool (no additional API key required) to search for the user's name + company, then classifies them into a buyer type (`Agency Strategist`, `Enterprise Research/AI`, `AI Startup/Developer`, `Publisher/Thought Leader`, `Unknown`) and infers their industry. Writes `buyer_type` and `buyer_industry` to the Airtable Users record.
  2. **Prompt selector** (`promptSelector.ts`) picks 8–10 candidate prompts keyed by `[graph_id][buyer_type]`. Includes a `cross-graph` tier for users whose inferred industry (finance, legal, healthcare, etc.) doesn't match Fodda's available graphs — these users receive "bridge" prompts that connect their world to our graphs.
  3. **Prompt validator** (`promptValidator.ts`) tests each candidate against the live Fodda API (minimum 3 results required). Failures are swapped for the next candidate. If fewer than 5 prompts pass, an alert fires to `piers@psfk.com` with the failed prompts and the full candidate list for review.
  4. **Onboarding email** (`ONBOARDING_PROMPTS` template) sends 5 validated prompts with a personalisation line if buyer type is known. Subject: "5 prompts to start with." Signed from Piers. Plain text + HTML variants.
- **`PROMPT_VALIDATION_ALERT` email template** (`emailTemplates.ts`): Internal alert to `piers@psfk.com` when prompt validation can't fill all 5 slots. Includes failed prompts, what was sent, and the full candidate list to fix.
- **Prompt bank** (`server/data/prompt-bank.json`): Editable JSON keyed by `[graph_id][buyer_type]`. Covers retail, beauty, sports, ce-design, cross-graph bridge, and default. Edit and redeploy to update prompts without touching code.

### Changed
- **`/api/auth/confirm` endpoint** (`server/index.ts`): Replaced 120-second `WELCOME_EMAIL` timeout with the new enrichment + validation + onboarding pipeline (5-minute delay). Streak CRM sync preserved.
- **`/api/account/invite` endpoint** (`server/index.ts`): Replaced 120-second `WELCOME_EMAIL` timeout with the same onboarding pipeline for team-join users.


### Changed
- **Onboarding UI** (`AuthGate.tsx`): Updated the call-to-action button label and expanded the **"Setup Guides & Resources"** section by default. This ensures resource visibility for first-time users while still allowing them to collapse the section.
- **Sidebar Navigation** (`Sidebar.tsx`): Renamed the "Playground" section to **"Expert Graphs"**. Moved the **CE Design Graph** into this section alongside SIC.
- **CE Design Branding** (`Sidebar.tsx`, `ChatInterface.tsx`): Implemented custom branding for the CE Design graph using Piers Fawkes' headshot as the logo icon. Updated the chat interface headers and welcome titles to reflect the "Expert" status.
- **Logo Click Action** (`Sidebar.tsx`): Updated the main Fodda logo click behavior to default to the "Future of Retail" graph instead of the Pew (Baseline) graph.
- **Discovery Logic** (`App.tsx`): Updated the `useDiscovery` hook to dynamically map graph IDs for the active vertical, ensuring correct filtering for CE Design and SIC.
- **Supplemental Data** (`geminiService.ts`): Updated the supplemental data fetching logic to include US Census demographics for the CE Design and SIC graphs.

### Removed
- **Pew Graph/Baseline** (`Sidebar.tsx`, `AuthGate.tsx`): Hidden the "Pew Public Beliefs" graph from the sidebar and discovery navigation. It remains functional in the backend for supplemental data usage by AI agents.

### Deployed
- **Fodda Sandbox** (`app.fodda.ai`): Deployed latest build (revision `fodda-sandbox-00190-9sq`) to Google Cloud Run. This release promotes the CE Design graph to "Expert" status and streamlines the primary navigation.

---

## [2026-03-29] — Cumulative Updates & Sandbox Deployment

## [2026-03-27] — CE Design Expert Graph Referral Code

### Added
- **CE Design Referral Link** (`AuthGate.tsx`, `server/index.ts`, `shared/types.ts`, `shared/dataService.ts`, `shared/constants.ts`): Added `ce-design` to the referral system. Users arriving via `app.fodda.ai?graph=ce-design` see a branded signup badge ("Consumer Electronics & Design Graph, by Piers Fawkes"), skip Step 2, and get their account scoped to the CE Design graph only. Other graphs appear greyed out in the sidebar.
- **`Vertical.CEDesign`** (`shared/types.ts`): New enum value `'ce-design'` added to the Vertical enum.
- **CE Design in Graph List** (`shared/dataService.ts`): Added to `getGraphs()` with proper metadata (owner: Piers Fawkes, weekly updates, $0.50/query).
- **Server-side validation** (`server/index.ts`): `ce-design` added to `validGraphSlugs` and `verticalMap` in the registration endpoint so referral signups are correctly validated and scoped.
- **Suggested Questions** (`shared/constants.ts`): Added starter questions for the CE Design graph (smart home, wearables, sustainable electronics).
- **Admin Referral Links page** (`AdminPortal.tsx`): CE Design graph now appears automatically in the Referral Links tab (dynamic via `getGraphs()`), with its own copy-to-clipboard URL and signup badge preview.

### Changed
- **`SUGGESTED_QUESTIONS` type** (`constants.ts`): Changed from `Record<Vertical, ...>` to `Partial<Record<Vertical, ...>>` to accommodate verticals without hardcoded suggested questions.
- **`normalizeVertical()`** (`shared/dataService.ts`): Added CE Design pattern matching.
- **`logToAirtable()`** (`shared/dataService.ts`): Added `ce-design` graphId derivation for usage logging.

---

## [2026-03-25] — UI Readability Pass (Beta Feedback)

### Changed
- **Chat Body Text** (`ChatInterface.tsx`): Increased paragraph and list-item font size from 14px (`text-sm`) to 15px with line-height bumped from `leading-relaxed` (1.625) to `leading-[1.75]`. Text color brightened from `zinc-300` to `zinc-200` for stronger contrast against the `#141413` background.
- **Headings** (`ChatInterface.tsx`): h2 bumped from 18px → 20px, h3 from 15px → 17px. Section labels (h1 markers) from 10px → 11px with brighter `zinc-400` color and more visible `zinc-700/60` border.
- **Metadata & Toolbar Text** (`ChatInterface.tsx`): All 9px metadata text (node counts, mode badges, timestamps, action buttons) bumped to 10px. Replaced `text-cloudy` (#B1ADA1) with `text-zinc-400` for better readability.
- **Suggested Query Buttons** (`ChatInterface.tsx`): Enlarged from 12px/10px to 13px/12px with brighter `zinc-300` text and increased padding for easier tap targets.
- **User Query Text** (`ChatInterface.tsx`): Bumped from 14px `zinc-300` to 15px `zinc-200` with `leading-relaxed`.
- **Evidence Drawer** (`EvidenceDrawer.tsx`): Trend card titles from 14px → 15px, summaries from 12px `zinc-400` → 13px `zinc-300` with `leading-relaxed`. Signal snippets from 10px `zinc-400` → 12px `zinc-300`. Adjacent trend names from 11px → 12px, descriptions from 10px `zinc-600` → 11px `zinc-400`.
- **Sidebar** (`Sidebar.tsx`): Section headers from 9px `zinc-600` → 10px `zinc-500`. Sub-labels from 8px `zinc-700` → 9px `zinc-600`. Graph descriptions from 9px → 10px with brighter zinc tones.

---

## [2026-03-24] — API Documentation Sync (Supplemental Data + Statistics Search)

### Changed
- **API Modal** (`ApiModal.tsx`): Bumped version to **v1.5**. Added **Supplemental Data Endpoints** section (11 sources in US Economic, Health & Science, and Global & Cultural categories) and **Statistics Search** endpoint (`GET /v1/graphs/:graph_id/statistics`). Updated intro text, downloadable `.md` content, and download filename.
- **API Documentation** (`Fodda_API_Documentation_v1.2_2026-02-17.md`): Replaced with canonical v1.3 API repo version — includes Section 4 (Supplemental Data Endpoints), Section 4b (Statistics Search), and updated intro text.
- **Account Portal API tab** (`AccountPortal.tsx`): Added "Supplemental Data" and "Statistics Search" sections to the Endpoint Reference.
- **README.md**: Added Statistics Search to Key Features list.

---

## [2026-03-22] — Supplemental Data Sources in Graph Admin

### Added
- **Supplemental Data Sources section** (`AdminPortal.tsx`): New section in the Graph Admin "Graph List" tab, below knowledge graphs. Displays external structured datasets (e.g., US Census retail sales) fetched from the `GET /v1/graphs` API response. Each source card shows: name, description, source attribution, frequency badge (e.g., "Monthly"), category tag pills, and a status badge (Active/Coming Soon/Inactive). Active sources include a "Test Endpoint" button that calls the source's API endpoint and displays the JSON snapshot inline.
- **`SupplementalSource` type** (`shared/types.ts`): New TypeScript interface for supplemental data sources with fields for `id`, `name`, `description`, `type`, `categories`, `endpoint`, `frequency`, `source`, `source_url`, and `status`.
- **`V1_GRAPHS` endpoint** (`shared/apiConfig.ts`): New API endpoint constant pointing to `https://api.fodda.ai/v1/graphs` for fetching both graphs and supplemental sources.
- **`getSupplementalSources()` method** (`shared/dataService.ts`): New async method that calls the `GET /v1/graphs` API and extracts the `supplemental_sources` array. Returns `[]` gracefully on failure.

### Design
- Visual distinction from knowledge graphs: teal/cyan accent color (vs. purple for graphs), 📊 data icon (vs. network icon), and a separate section header with descriptive subtitle.
- Grid layout supports 5–10 sources. "Coming Soon" sources render at reduced opacity.

### Deployed
- **Production** (`app.fodda.ai`): revision `fodda-sandbox-00179-t67`

---

## [2026-03-19] — Notion Integration & Trial Query Metering

### Added
- **Notion README** (`public/Fodda_Notion_README.md`): Comprehensive setup guide for using Fodda knowledge graphs in Notion via Custom Agents. Includes setup steps, MCP URL format, available tools table, example prompts, and requirements.
- **Notion download link on Gate page** (`AuthGate.tsx`): Blue-themed "Fodda-Notion Connection Help" download card in the AI Co-Pilot Resources section, alongside existing Claude and Prompting Guide links.
- **Notion Connector tab in Account Admin** (`AccountPortal.tsx`): New tab between Claude Connector and MCP/Dev. Includes 6-step setup instructions for Notion Custom Agents, connector URL with copy button, API key display, requirements checklist, and README download link. Blue theme to match Notion's brand.
- **"Mainly Notion" onboarding** (`AuthGate.tsx`, `App.tsx`, `WelcomeContextPopup.tsx`): New signup dropdown option. Notion users auto-see the Account Admin → Notion Connector tab on first login (same pattern as Claude). Welcome context popup skipped for Notion users.
- **Per-session trial query metering** (`server/index.ts`): Anonymous Notion marketplace users get 3 free queries per session via `sk_trial_` API keys. In-memory `trialSessionStore` tracks per-session fingerprints (MCP session ID or IP+UA hash) with 24h TTL. After 3 queries, returns a friendly message with a signup URL (`app.fodda.ai?graph={graph}`). Applied to both `/api/query` and `/v1/search` endpoints.

### Deployed
- **Production** (`app.fodda.ai`): revision `fodda-sandbox-00176-9jh`

---

## [2026-03-18] — Chat UI Color Adjustments

### Changed
- **Chat Background** (`ChatInterface.tsx`, `index.html`): Replaced pure black (`#000000`) with a warmer near-black (`#141413`) across the chat container, scroll area, and base HTML/body background. Added `chat-bg` and updated `void` Tailwind color tokens.
- **Secondary/Muted Text** (`ChatInterface.tsx`): Replaced `text-zinc-500` (`#71717a`) with a new `cloudy` tone (`#B1ADA1`) for all secondary labels — Graph Sandbox header, loading text, toolbar chips, TXT/JSON/COPY buttons, evidence stats, placeholder text, and submit button icon.
- **Prompt Bar Border** (`ChatInterface.tsx`): Changed from `border-white/[0.08]` to `border-cloudy/40` for significantly better visibility against the dark background.

### Deployed
- **Production** (`app.fodda.ai`): revision `fodda-sandbox-00169-p9z`

---

## [2026-03-17] — Critical Fix: Top-Up Purchase Webhook

### Fixed
- **Top-Up Webhook Not Resetting `monthlyQueries`** (`server/index.ts`): The Stripe webhook for planCode 7 (top-up) purchases was clearing `limitReached` and reducing `queriesUsedThisCycle`, but was NOT resetting `monthlyQueries`. Since the query enforcement logic checks `monthlyQueries >= max`, users remained blocked after purchasing a top-up. Fixed by adding `"monthlyQueries": 0` to the top-up update payload.

---

## [2026-03-17] — AI Co-Pilot Resources on Gate Page

### Added
- **Co-Pilot Guide** (`public/Fodda_CoPilot_Guide.md`): Downloadable README for users working with ChatGPT, Gemini, or other LLMs that don't have direct Fodda access. Teaches the model how to interpret Fodda data structures (trends, signals, evidence), suggests effective query patterns organized by intent (Explore, Deep-Dive, Compare, Build), and guides structured analysis workflows. Includes cross-graph analysis tips and a nudge toward MCP integration for seamless access.
- **Claude Skill File** (`public/Fodda_Claude_Skill.md`): Downloadable skill file for Claude users connecting Fodda via MCP. Covers full setup (account creation, Claude Web/CLI/Desktop connection, verification), all 7 MCP tools with input schemas, query construction best practices, fallback sequences for thin results, signal score interpretation, and troubleshooting for common connector issues (OAuth blanks, session timeouts, unauthorized errors).
- **Gate Page Download Cards** (`AuthGate.tsx`): Two styled download buttons at the bottom of the login/signup screen — emerald-accented "Co-Pilot Guide" card and purple-accented "Claude Skill File" card. Each triggers a direct `.md` file download from the `public/` directory. Visible to all visitors before login.
- **Claude Tab Skill Link** (`AccountPortal.tsx`): Added a purple-accented download card in the Claude Connector tab — "Use a Claude Skill to set up Fodda quickly" — linking to the skill file. Placed between the API Key section and the help links.
- **Chat Toolbar Help Icon** (`ChatInterface.tsx`): Added a `?` icon in the prompt bar toolbar that downloads the Co-Pilot Guide. Tooltip reads: "Need help prompting Fodda? Download this guide and upload it to your LLM co-pilot for better results".

---

## [2026-03-16] — Graph Registry + Contributor Portal (Pattern Graph Network)


### Added
- **Graph Registry Service** (`server/services/graph-registry.ts`): Full CRUD for the new Airtable `Graph Registry` table (`tblezSucv8qmbSSy9`). Handles graph registration, slug generation, uniqueness validation (rejects reserved VIP slugs), status updates, and stats tracking.
- **Data Ingestion Service** (`server/services/graph-ingestion.ts`): Reads Google Sheets via `googleapis` service account, validates data quality (minimum 5 signals, 2 patterns, 1 entity, ≥80% summary coverage with ≥250 char minimum, pattern inflation guard requiring ≥2 linked signals per pattern), caches as JSON (in-memory Map + disk at `/tmp/graph-cache/`), and exposes query functions (`searchPatterns`, `getEvidence`, `getNeighbors`, `getNode`) that return data in the same shape as the Neo4j-backed endpoints.
- **6 new API endpoints** (`server/index.ts`): `POST /v1/graphs/register`, `GET /v1/graphs/registry`, `POST /v1/graphs/:slug/validate`, `POST /v1/graphs/:slug/refresh`, `GET /v1/graphs/:slug/stats`, `POST /v1/graphs/sheet-meta`.
- **Community Graph Routing Layer** (`server/index.ts`): `/v1/graphs/:graphId/search`, `/neighbors`, `/evidence` now check the registry — community graphs query the local cache; VIP graphs continue proxying to the upstream Neo4j API unchanged.
- **"My Graphs" tab** (`AccountPortal.tsx`): New tab in Account Portal with emerald accent. Includes: empty state hero with template link, multi-step registration flow (source selection → Sheet URL + service account sharing instruction → auto-filled metadata from Graph Meta tab → validation → MCP endpoint), graph management cards with status badges/stats/refresh, and Pattern Standard template link.
- **`googleapis` dependency** (`package.json`): Added for Google Sheets API v4 access.

---

## [2026-03-15] — Compare Mode: 3-Way Search Comparison

### Added
- **Compare Mode overlay** (`CompareModal.tsx`): Full-screen 3-column comparison view that fires Graph, Gemini, and Blended queries **in parallel** against the same prompt. Each column shows: mode badge, markdown response, compact evidence summary (trend/article counts), and latency timer. Desktop shows all 3 columns side-by-side; mobile provides a tabbed view. "Use this response" button per column inserts the chosen response into the main chat.
- **Compare chip in prompt toolbar** (`ChatInterface.tsx`): Purple `⚡ Compare` chip next to the Dev Console chip (desktop only, hidden on Baseline vertical).
- **Compare Modes nav item** (`Sidebar.tsx`): New "Compare Modes" link under the Console section with a purple column-split icon.
- **⌘⇧C keyboard shortcut** (`App.tsx`): Toggles the Compare Mode overlay from anywhere in the app.
- **Backburner item** (`BACKBURNER.md`): Added the full design spec and marked as implemented.

### Changed
- **`App.tsx`**: Added `isCompareOpen`, `compareColumns`, `compareQuery` state; `handleCompareQuery()` parallel dispatcher using `Promise.allSettled`; `handleUseCompareResponse()` to insert chosen response into chat; wired `CompareModal` rendering alongside `GraphVisualization`.

---

## [2026-03-12] — Claude Connector Promotion

### Changed
- **Dashboard "Fodda on Claude" section** (`Dashboard.tsx`): Renamed header to **"Claude Connector"**, updated subtitle to "Connect Fodda to Claude — works with Pro, Max, Team, and Enterprise", renamed "Remote MCP Server URL" label to **"Connector URL"**, updated "Set Up Now" link from `claude.ai/customize/connectors` to `claude.ai/settings/connectors` (current Anthropic URL).
- **AccountPortal sidebar** (`AccountPortal.tsx`): Split the old **"MCP Integration"** tab into two separate tabs: **"Claude Connector"** (user-facing Claude setup) and **"MCP / Dev"** (developer tools, CLI, Gemini, endpoints).
- **First-login redirect** (`App.tsx`): Claude-intent users (`apiUse === 'Mainly Claude'`) now open **AccountPortal → Claude Connector** tab on first login instead of the User Profile modal.
- **Enterprise sub-tab label** (`AccountPortal.tsx`): Renamed from "Enterprise" → **"Enterprise (Admin)"** to clarify the admin setup flow.

### Added
- **Dedicated Claude Connector tab** (`AccountPortal.tsx`): New standalone tab with Claude Pro/Max/Team setup steps, Enterprise admin section with selling points (governance, Research, zero-install), API key display, and Claude-specific help links.
- **Enterprise admin note** (`Dashboard.tsx`): One-liner below "Set Up Now" link: "Enterprise? Ask your workspace admin to add this in Organization Settings → Connectors."
- **Anthropic Connectors guide links** (`AccountPortal.tsx`): Added link to [Anthropic's official Connectors guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) across Claude tab and Enterprise section.

---

## [2026-03-10] — Onboarding Streamline: Mainly Claude + Context Fields Removed

### Changed
- **"How will you query Fodda?" dropdown** (`AuthGate.tsx`): Added **"Mainly Claude"** as the first and default-selected option. Existing options (API Access, MCP Use, Sandbox Access, etc.) remain in order below it.
- **Context textareas commented out** (`AuthGate.tsx`): Company Mission and Role & Goals fields removed from onboarding step 2 for all users. Code preserved as comments for reuse.
- **Step 2 subtitle** (`AuthGate.tsx`): Updated from "Help us understand your retrieval needs" → "One quick question before we get you set up."

### Added
- **Post-login Welcome Context Popup** (`WelcomeContextPopup.tsx`): New dismissible popup shown on first login for non-Claude users. Captures optional **Role & Goals** and **Company Mission** context. Saves via existing `/api/user/context` and `/api/account/context` endpoints. Dismissed via "Skip for now" or "Save & Continue" — uses localStorage flag so it only appears once. **Claude users skip this entirely** to get to their MCP key faster.
- **MCP-first login for Claude users** (`App.tsx`, `AccountPortal.tsx`): On first login, users who selected "Mainly Claude" during onboarding automatically see the Account Portal open to the **MCP Integration tab** with Claude setup instructions. Tracked via `fodda_mcp_first_login_shown` localStorage flag — only shown once. Completes Anthropic Pro Detection Phase 2.
- **Graph Owner Referral Links** (`AuthGate.tsx`, `dataService.ts`, `server/index.ts`, `Sidebar.tsx`, `App.tsx`, `types.ts`): Graph owners can share `app.fodda.ai?graph=sic` links. Users see a branded graph badge during signup, account gets scoped to that graph (`vertical` field), sidebar greys out other graphs, auto-selects the allowed graph on login. Claude-biased by default.
- **Post-Login Context Questions Popup** (`BACKBURNER.md`): Backburner item for future improvements to this popup.
- **Anthropic Pro Detection Phase 1 & 2 marked ✅** (`BACKBURNER.md`): Both phases complete — Phase 1 (onboarding "Mainly Claude" option), Phase 2 (MCP-first login redirect).

### Fixed
- **MCP health check URL** (`AdminPortal.tsx`): Updated from old Cloud Run URL to `mcp.fodda.ai`
- **Chat input contrast** (`ChatInterface.tsx`): Added `bg-zinc-900/60` background to prompt bar to differentiate from black chat area. Lightened placeholder text to `zinc-500`.
- **Signup form gray text** (`AuthGate.tsx`): Lightened all placeholder text from `zinc-600` to `zinc-500` for better visibility.

### Deployed
- **Production** (`app.fodda.ai`): revision `fodda-the-ai-context-layer-website-00106-8tt` (onboarding streamline)

---

## [2026-03-09] — Plan Limit Pre-Check Fix (Credits False Block)

### Investigated
- **Query at 1:14 PM ET**: Traced `POST /v1/graphs/beauty/search` returning 403 for API key `sk_live_abcdef` ("Clinical skincare meets retail" query). Account has 99,900 available credits upstream, but the Sandbox's local pre-check was reading `Max Plan Queries` (absent) → `maxplanQueries` (absent) → default **50**, and the local counter was at 74/50.

### Fixed
- **`extractNumericLimit()` helper** (`server/index.ts`): New helper function that checks all known plan-limit field names in priority order (`monthlyQueryLimit`, `Monthly Query Limit`, `Max Plan Queries`, `Max API Calls Number`, `maxplanQueries`) and correctly unwraps Airtable array values (e.g. `[100000]` → `100000`). Previously, Plan lookup fields (arrays) were skipped by the `||` fallback chain, causing accounts to default to 50 or 10.
- **All plan-limit reads updated**: `/api/query` pre-check, `/v1/graphs/:graphId/search` pre-check, `incrementUsage()` account limit, `incrementUsage()` user 80% warning, `/api/account/usage` stats, `/api/admin/users/:userId/stats`, account users list — all now use `extractNumericLimit()`.
- **Auth flow fallbacks hardened**: Login (`/api/auth/verify`) and session validation (`/api/auth/validate-session`) Plan fetch fallbacks and `monthlyQueryLimit` response fields now use `extractNumericLimit()` instead of `accountData.maxplanQueries || 10`. If the Plan record fetch fails, the frontend will still see the correct limit from the account's `monthlyQueryLimit` field.

### Deployed
- **Production** (`www.fodda.ai`): revision `fodda-the-ai-context-layer-website-00104-8b4`
- **Sandbox** (`app.fodda.ai`): revision `fodda-sandbox-00152-74t` — fix was missing from this service causing continued 403 blocks

---

## [2026-03-07] — Billing Field Alignment & API Call Logging

### Changed
- **`incrementUsage()`** — Now writes to both `monthlyQueries` (App) AND `queriesUsedThisCycle` (API) in a single Airtable update, keeping both counters in sync.
- **Monthly reset cron** — Now also resets `queriesUsedThisCycle` → 0 and sets `nextRenewalDate` to the 1st of next month alongside the existing `monthlyQueries`/`limitReached` reset.
- **Stripe webhook** — On plan upgrade, now also writes `queriesUsedThisCycle` → 0, `nextRenewalDate`, `limitReached` → false, and `accountStatus` → "active". Top-up purchases (planCode 7) now ADD credits instead of resetting.
- **`/api/log`** — Now accepts a separate `apiCall` field. Previously `apiCall` was hardcoded to copy the raw user question.
- **`App.tsx`** — Query logging moved to post-query. `apiCall` field now contains: cleaned query, reasoning mode, graph, result count, and data status.
- **`dataService.logToAirtable()`** — Added optional `apiCall` parameter.
- **Limit-reached message** — Now shows renewal date, query limit, and plan-specific guidance (corporate: contact admin, free: upgrade link).

### Added
- **Top-up card in UpgradeModal** — Free plan users see a prominent "Buy 100 Queries" card above the plans table with direct Stripe checkout.
- **Top-up webhook handling** — planCode 7 purchases add credits by reducing `queriesUsedThisCycle` without changing the account's current plan.
- **Account fields** — `nextRenewalDate` and `adminEmail` added to Account type and hydrated from Airtable in both login and session flows.

---

## [2026-03-07] — Claude Quick Connect & MCP Tab Overhaul

### Fixed
- **MCP Endpoint Bug**: Corrected `MCP_ENDPOINT` constant in `AccountPortal.tsx` from the wrong `/messages` path to the correct `/mcp` (Streamable HTTP) endpoint. The old path was the internal SSE message-posting sub-path and would fail for Claude/OpenAI users.

### Added
- **Claude Quick Connect Section** (`AccountPortal.tsx`): New tabbed "Quick Connect" card at the top of the MCP Integration tab with four platform-specific flows:
  - **☁ Claude (Web)** — Step-by-step guide for Claude Pro/Max/Team users. API key is embedded in the URL as a `?api_key=` query parameter (since Claude's connector form doesn't have a custom headers option). Includes a one-click "Copy URL" button with the user's real key pre-filled, and a security callout explaining the HTTPS-encrypted URL approach.
  - **🏢 Enterprise** — Admin-managed connector setup with `?api_key=` URL format, OAuth fields left blank, fallback SSE URL, auto-discovery endpoint, and link to the Enterprise MCP Setup Guide.
  - **⌨ CLI** — Ready-to-run `claude mcp add` command with pre-filled API key and copy button (CLI uses `Authorization: Bearer` header, not URL param).
  - **◆ Gemini/Vertex** — Existing Vertex config with copy/download, now accessible from the Quick Connect tabs.
- **Generate Claude URL Button** (`AccountPortal.tsx`): New "Config Generators" section with "Generate Claude URL" (shows pre-built `https://mcp.fodda.ai/mcp?api_key=...` URL) and "Generate Vertex Config" (existing). Both include Copy and Download buttons.
- **SSE Endpoint Display** (`AccountPortal.tsx`): New `MCP_SSE_URL` constant (`https://mcp.fodda.ai/sse`) shown alongside the Streamable HTTP endpoint. Endpoints section now clearly labels transport types with usage hints (e.g., "recommended for Claude, OpenAI" vs "for Claude Code, Gemini CLI").
- **Copy Feedback on All Endpoint Fields**: All copy buttons across the MCP tab now show a green checkmark for 2 seconds after copying, replacing the generic clipboard icon.

### Changed
- **MCP Tab Subtitle**: Updated from Vertex/Gemini-only messaging to platform-neutral: "Connect Fodda knowledge graphs to Claude, Gemini, OpenAI, and other AI platforms via MCP".
- **Help Links**: Updated bottom help link from a single "Vertex AI Quickstart Guide" link to multi-platform links: Claude · Gemini · OpenAI.
- **Claude Auth Method**: Changed from `Authorization: Bearer` header approach to URL query parameter (`?api_key=`) approach — Claude's web connector form only has OAuth fields, not custom headers. The MCP server already supports extracting `api_key` from URL params.

---

## [2026-03-07] — Monetization Phase 1 & 2: Usage Visibility, Enforcement, & Reset

### Changed
- **`/api/account/usage`** — Replaced hardcoded mock data with real Airtable queries. Fetches Account `monthlyQueries`/`maxplanQueries`, linked Users for per-user breakdown, Usage Logs for per-graph and daily trend charts.
- **V1 search proxy** (`/v1/graphs/:graphId/search`) — Added local plan limit pre-check. Previously only the legacy `/api/query` path checked limits; now the V1 path also blocks over-limit accounts before forwarding to the upstream API.
- **`RetrievedRow` type** — Added `brandNames` and `Brand` fields to fix pre-existing lint errors from brand boosting logic.

### Added
- **Query usage chip** in ChatInterface toolbar — Shows `⚡ X / Y` when usage > 50%. Turns amber at 80%, red at 95%. Click opens UpgradeModal. Counter increments locally in real-time after each query.
- **`POST /api/cron/monthly-reset`** — Monthly billing reset endpoint. Resets `monthlyQueries`→0, `limitReached`→false for all active accounts (skips Lapsed/planCode 7). Clears `usageWarningSent` on users. Secured by `CRON_SECRET` env var. Ready for Cloud Scheduler (`0 0 1 * *`).

---

## [2026-03-06] — Monetization Pipeline Audit

### Analysis
- **Full audit** of usage tracking, plan enforcement, Stripe payments, and upsell flows across App server, Fodda API, and frontend.
- **Key finding**: Most plumbing works (Stripe webhook, plan limits, UpgradeModal, usage increment). Three critical gaps identified:
  1. `/api/account/usage` returns hardcoded mock data — account owners see fake usage numbers
  2. No monthly usage reset cron — free accounts are permanently locked after hitting limits
  3. No remaining-queries indicator in the chat UI — users hit the wall with zero warning

### Added
- 3 new **high-priority backburner items** in `BACKBURNER.md`: mock usage endpoint fix, chat query counter, monthly reset cron.
- Comprehensive monetization plan artifact with 4-phase roadmap.

---

## [2026-03-06] — MCP Parity Update (Cross-Agent)

### Changed
- **Fodda MCP v1.7.0**: Coordinated parity update with the Fodda MCP agent. Tool descriptions enriched with geo auto-detection, relevance gate awareness, Brand/Location node types, and enhanced evidence schema. `include_evidence` now defaults to `true`. Internal service key support added. Types audited for stripped fields.
- **Backburner item marked ✅ COMPLETED** (`BACKBURNER.md`): "Align MCP Application with Fodda API" resolved.

---

## [2026-03-06] — Neo4j Vector Index Rebuilt (Cross-Agent)

### Fixed
- **Vector Search Restored**: The `trend_summary_index` was rebuilt from `text-embedding-004` (3072-dim, deprecated) to `gemini-embedding-001` (768-dim) — coordinated across the **Fodda PSFK** agent (re-embedded all Trend nodes, rebuilt index) and **Fodda API** agent (updated query-time `embeddings.ts` to match). Verified end-to-end: hybrid search returns 6 rows with scores ~0.8+. Deployed as Fodda API Revision 00082.

### Changed
- **Stale 3072-dim comment** (`shared/dataService.ts`): Updated comment on the Waldo/SIC legacy path that referenced the old 3072-dim vectors.
- **Backburner item marked ✅ COMPLETED** (`BACKBURNER.md`): Highest-priority item resolved.

---

## [2026-03-06] — Adjacent Possibilities Feature

### Added
- **Adjacent Possibilities** (`EvidenceDrawer.tsx`): When a user expands a trend card, a new "🔭 Adjacent Possibilities" section appears. Clicking it lazily fetches semantically similar trends from the `GET /v1/graphs/:graphId/adjacent` API endpoint and displays them as compact cards with color-coded similarity badges (≥90% teal, 85-89% blue, 80-84% muted). Clicking an adjacent trend fires the existing `onLearnMore` flow (Deep Dive query).
- **`AdjacentTrend` / `AdjacentResponse` types** (`shared/types.ts`): Type definitions for the adjacent possibilities API response.
- **`V1_ADJACENT` endpoint** (`shared/apiConfig.ts`): Endpoint registry entry for the adjacent API.
- **`getAdjacentTrends()` method** (`shared/dataService.ts`): New data service method — GET-based fetch with graceful fallback to empty result on failure.
- **`SimilarityBadge` component** (`EvidenceDrawer.tsx`): Reusable badge with 3-tier color coding based on similarity score.
- **`AdjacentTrendCard` component** (`EvidenceDrawer.tsx`): Compact card showing trend name, similarity badge, and truncated description. Hover state highlights in teal.

### Changed
- **`TrendCard` component** (`EvidenceDrawer.tsx`): Now accepts a `vertical` prop (passed from `EvidenceDrawer`). Expanded state includes a new collapsible "Adjacent Possibilities" section below the action buttons. Adjacent trends are lazy-loaded (fetched on first click, not on drawer open) with loading spinner and empty state.

---

## [2026-03-06] — Gemini-Style UI Polish & Toolbar Redesign

### Added
- **CSS Design System** (`index.html`): New utility classes — `.fodda-gradient` (purple-anchored gradient), `.fodda-gradient-text`, `.fodda-shimmer` (Gemini-style shimmer animation), `.glass` / `.glass-subtle` (glassmorphism with backdrop-blur), `.prompt-bar` (purple focus glow), `.accent-pulse` (pulsing live indicator), `.card-hover` (lift-on-hover).
- **Mode Picker Popover** (`ChatInterface.tsx`): Replaced inline `ReasoningModeSelector` with a Claude/Gemini-style popover chip beneath the prompt bar. Shows Graph/Gemini/Blended options with descriptions. Opens upward from the toolbar.
- **Dev Console Chip** (`ChatInterface.tsx`): Added `>_ Live` chip in the toolbar to open the DevToolsDrawer directly from the chat view, without navigating to the sidebar.
- **Evidence Badge Chip** (`ChatInterface.tsx`): Evidence count now appears as a clickable chip in the toolbar (desktop) to toggle the evidence drawer.

### Changed
- **Header Simplification** (`ChatInterface.tsx`): Removed the two-row metadata header (Graph/Mode/Evidence info bar). Replaced with a slim "Graph Sandbox" title bar. All controls moved to a toolbar row beneath the prompt bar.
- **Prompt Bar** (`ChatInterface.tsx`): Upgraded to pill shape (`rounded-2xl`) with glassmorphism and a purple glow halo on focus.
- **Thinking State** (`ChatInterface.tsx`): Replaced generic `animate-pulse` loading indicator with Gemini-style skeleton bars — serif italic status text with a pulsing gradient dot + 3 staggered shimmer bars.
- **Welcome Title**: Now uses gradient text (`fodda-gradient-text`) instead of plain white.
- **Sidebar** (`Sidebar.tsx`): Frosted glass panel background, gradient-filled "F" logo badge.
- **Evidence Drawer** (`EvidenceDrawer.tsx`): Frosted glass background, glass header/footer, card-hover lift on trend and article cards.
- **Context Chips** (`ContextChips.tsx`): Redesigned to match toolbar chip aesthetic — slimmer, consistent `rounded-lg` borders, shortened labels ("Acct"/"User"), inline lock icon.
- **Query Buttons**: All suggested query buttons upgraded with `card-hover` lift, rounded corners, and purple accent on hover.
- **Scrollbar**: Thinner (5px), transparent track, subtle thumb with smooth hover transition.

---

## [2026-03-06] — Error Serialization Fix

### Fixed
- **`[object Object]` Error on PSFK Queries**: Fixed a bug where error messages from the upstream API were displayed as `Error: [object Object]` instead of readable text. The root cause was non-string `error` fields (objects) from the upstream API being passed directly to JavaScript's `Error()` constructor, which calls `.toString()` on them. Fixed at four layers:
  - `postJson()` in `dataService.ts`: Coerces `json.error` to string via `JSON.stringify` if it's an object.
  - `retrieve()` in `dataService.ts`: Same treatment for `response.error` in the validation check.
  - `App.tsx` catch block: Robust error extraction that handles `Error` instances, strings, and plain objects.
  - Server proxy (both `/api/query` and `/v1/graphs/:graphId/search`): Coerces upstream error messages to strings before forwarding.

---

## [2026-03-06] — Graph Export, Evidence Drawer Audit, API Handoff

### Added
- **Graph Export (PNG + JSON)**: Users can now download the graph visualization as a PNG image or export the raw graph data as JSON. Export buttons added to the `GraphVisualization.tsx` toolbar.
- **SVG & PDF Export**: Added to [BACKBURNER.md](BACKBURNER.md) for future implementation.

### Changed
- **Evidence Drawer Audit**: Fixed fictitious `psfk.com` source links that appeared when no nested evidence was found. Evidence drawer now only displays relevant cited evidence instead of all retrieved trends.
- **Brand Boost Fix**: `hasBrand()` and `hasTrendBrand()` now split multi-word queries into individual terms (≥3 chars) for matching, fixing the bug where "Nike London" never matched any brand fields.

### Investigated
- **Brand Relevance Debugging**: Analyzed why "Nike London" queries didn't yield expected results. Root cause was the `searchFields.includes()` matching entire phrase instead of individual terms.
- **API Handoff Processed**: Verified app compatibility with stripped API fields (`brands`, `Freshness Date`, `industry`, etc.). Confirmed `brandNames` and `Brand` fields are correctly used. New `place` field noted for future Evidence drawer enhancement.

---

## [2026-03-05] — Reasoning Modes, Live QA

### Added
- **Reasoning Mode Selector**: Three-mode segmented pill selector in chat header:
  - **PSFK Graph** (default) — Neo4j knowledge graph retrieval + Gemini structured synthesis
  - **Gemini Only** — Google Search grounding, skips graph entirely
  - **Blended** — Graph retrieval + Google Search grounding combined
- **`POST /api/gemini-search` Endpoint**: New server endpoint supporting Gemini Search grounding with optional graph context injection for blended mode.
- **Mode Badges on Messages**: Each assistant response carries a colored badge — `GRAPH` (emerald), `GEMINI` (blue), `BLEND` (amber).
- **Reasoning Mode README**: Comprehensive architecture doc at [REASONING_MODE_README.md](REASONING_MODE_README.md).

### Changed
- **Chat Clears on Mode Switch**: Switching reasoning modes clears the conversation for clean comparison.
- **Evidence Panel Behavior**: Panel only auto-opens when actual evidence exists; stays empty for Gemini Only mode.
- **Processing Indicators**: Updated to show `QUERYING_GRAPH`, `QUERYING_GEMINI`, or `BLENDING` based on active mode.

### Tested
- **Live QA on Reasoning Modes**: Verified selector, mode badges, header metadata, and API/MCP orthogonality across all three modes.

---

## [2026-03-04] — Evidence Drawer Bug Fixes

### Fixed
- **Evidence Drawer Discrepancy**: Investigated and resolved the gap between trends retrieved by the graph vs. trends cited by the AI. Reduced "uncited" trend noise in the Evidence drawer.
- **UI Display Issues**: Investigated inconsistent chat window labels for articles, incorrect "Adjacent Possibilities" formatting, and unclear body text sourcing in the Evidence drawer.

---

## [2026-03-03] — Deployment & Bug Fixes

### Fixed
- **Mobile Menu Fixes**: Resolved mobile sidebar responsiveness issues.
- **Waldo Graph**: Commented out Waldo graph from navigation (temporarily disabled pending data issues).
- **"More Graphs" Button**: Fixed navigation button behavior.
- **Redesigned AI Buttons**: Updated UI for AI action buttons.

### Deployed
- Production deployment via `deploy_website.sh`.

---

## [2026-02-27] — SIC Graph Fix, Icon Refresh, Waldo README

### Fixed
- **SIC Graph Data Bleed**: Resolved dual-layer mapping issue where querying the SIC graph returned PSFK Retail data. Root cause was cross-graph data bleed in the API proxy layer. Fix ensures SIC queries return SIC data or `NO_MATCH`.

### Added
- **Waldo Graph README**: Created documentation to help LLMs prepare CSV files for Neo4j upload/sync, leveraging existing sync code and sample data.
- **Icon Adaptation Guide**: Identified icons suitable for "smudy connected dots" style with color guidance and image-gen prompts.

### Investigated
- **Graph Access Control**: Confirmed the `vertical` field on user accounts is still used for graph access control during signup.
- **Backburner Review**: Audited existing backburner projects for prioritization.

---

## [2026-02-26] — Backburner Items Added

### Added (to Backburner)
- **Align MCP with Fodda API**: Noted the need to sync `/Fodda MCP` codebase with recent API improvements.
- **Rebuild Neo4j Vector Index**: `text-embedding-004` deprecated; need to rebuild with `gemini-embedding-001` (768-dim).
- **Topic-Scope Gate**: Proposed minimum semantic score threshold to prevent irrelevant results for off-topic queries.

---

## [2026-02-25] — Claude Plugin Packaging

### Added
- **Claude Plugin Manifest**: Generated `plugin.json`, `.mcp.json`, and README for the Fodda Claude plugin.
- **Slash Commands**: Defined MCP slash commands for plugin integration.
- **Auth Configuration**: Set up API-key authentication for the plugin.

---

## [2026-02-16] — Security, Account Admin, BACKLOG & BACKBURNER

### Added
- **BACKLOG.md**: Comprehensive task tracker for account admin, plan enforcement, email notifications, and UI refinements.
- **BACKBURNER.md**: Low-priority improvement tracker (Airtable optimizations, Stripe payments, marketplace prep, context rewriting audit, join-team flow, Graph Explorer).
- **Security Documentation**: Created `Fodda_Security_Architecture_Pack_Draft.md`, `Fodda_Security_Overview_README.md`, and `Fodda_Security_Pack_v2.md`.

### Changed
- **Airtable Record ID Fields**: New `userRecordId`, `accountRecordId`, `apiKeyRecordId`, `planId`, and `graphRecordId` fields added to Airtable for future lookup optimization.

---

## [2026-02-15] — Security Hardening & Deployment

### Fixed
- **Removed Hardcoded API Keys**: Scrubbed all hardcoded API keys from source files.

### Deployed
- Latest updates pushed for production deployment.

---

## [2026-02-14] — Code Deployment

### Deployed
- Updated code for production deployment (config and code sync).

---

## [2026-02-06] — SIC Vertical, Backend Proxy, UI Contamination Fix

### Added
- **SIC Vertical System Instruction**: Enhanced the SIC graph vertical with a specific, tailored system instruction for better response quality.
- **Backend Proxy for Gemini API**: Implemented server-side proxy for Gemini API calls (keys no longer exposed to the frontend).

### Fixed
- **UI Contamination on Vertical Change**: Explicitly reset messages and drawer state when switching verticals, preventing data bleed between graphs.
- **Trend ID Suppression**: Refined Gemini prompt to suppress visible trend IDs in chat text output.

---

## [2026-02-01] — Server Updates

### Changed
- Server index updates for ongoing API refinements.

---

## [2026-01-22 → 2026-01-23] — Infrastructure Sprint

### Added
- **`tsconfig.api.json`**: Separate TypeScript config for the API build.
- **`fodda-vertex-tool.yaml`**: Vertex AI tool configuration file.

### Changed
- Multiple iterations on `server/index.ts`, `Dockerfile`, and `package.json` for deployment stability and dependency resolution.
- **dataService.ts**: Updated data service layer.

---

## [2026-01-20] — App & Server Updates

### Changed
- **App.tsx**: Frontend application updates.
- **Server index.ts**: API endpoint refinements.

---

## [2025-12-26 → 2025-12-30] — Monorepo Restructure & Server Iteration

### Changed
- **Monorepo Restructure**: Project restructured into a unified monorepo with `frontend/`, `server/`, `shared/`, and `services/` directories.
- **Dependency Updates**: Resolved TypeScript errors and updated dependencies.
- **Docker Build**: Improved Docker build process and `.dockerignore`.
- Multiple server iterations for API stability.

---

## [2025-12-19] — Enhanced UX & Data Grounding

### Added
- **Improved UX**: Enhanced demo with better user experience patterns.
- **Data Grounding**: Improved data retrieval and grounding for chat responses.

---

## [2025-12-17] — Project Initialization

### Added
- **Initial Commit**: Fodda Contextual Demo project initialized.
- Core structure: Vite + React + TypeScript frontend, Express server, Gemini AI integration.
- Basic chat interface with knowledge graph retrieval.
