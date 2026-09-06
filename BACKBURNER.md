# Fodda Backburner

Low-priority improvements and optimizations to revisit when time permits.

---

## 🟡 Base Tier: Card-Gated Daily Burst Unlock & Overage Auto-Continuation (API Agent)

**Added**: 2026-09-05  
**Priority**: Medium / Opportunity-driven  
**Brief**: `briefs/Brief - Base-Free Daily 50-Call Burst Cap with Card-Gated Unlock (API Agent).md`  
**Owner**: `api-agent` (Cloud Functions / credit-check middleware / Firestore counter)  

**Context**:
Accounts on the **Base - Free** plan receive 100 API calls/month ($50 value at $0.50/call). To prevent bot abuse, Base accounts without a card on file are subject to a **50 calls/day burst ceiling**.
Currently, hitting 50 calls in a day blocks the user until tomorrow. When high-intent users or agencies hit 50 calls researching a brief, stopping them loses momentum.

**Opportunity**:
- **No card on file**: Hard daily ceiling at 50 calls. Block with HTTP 403 `DAILY_LIMIT_EXCEEDED` containing a one-click Stripe `setupUrl` to add a payment card.
- **Card on file (`hasPaymentMethod === true`)**:
  - The daily 50-call burst limit is completely bypassed.
  - Queries continue drawing down from their 100/month Base allowance.
  - Once the 100/mo allowance is exhausted, queries seamlessly flow into Stripe metered overage at 50¢ per API call.

---

## 🟡 Monthly Plan: 10% Overage Forgiveness + 4-Month Deposit (App + API)

**Added**: 2026-09-04  
**Priority**: Low until trigger — do NOT build early  
**Trigger**: The first customer subscribes to a Monthly Plan (Airtable Plan 5 Studio $2,500 or Plan 6 Business $4,600). The day that happens, pick this up before their first cycle ends.  
**Brief**: `briefs/backburner_monthly_plan_overage_forgiveness_and_deposit.md`  
**Owners**: App agent (this repo: overage subscription + cycle reset) and `api-agent` (metering / credit check).  

**Context**: The marketing website now advertises on the Monthly Plan cards:
- 10% overage forgiveness, then overage at 50¢ per call
- 4 month deposit required for new users

Neither is enforced by code today. Decision made on 2026-09-04: ship the copy on the website now, defer the billing and enforcement work until a customer actually subscribes.

**Current billing behavior**:
- Overage: once `queriesUsedThisCycle` passes `Monthly API Limit`, every extra call is metered to Stripe at `STRIPE_OVERAGE_PRICE_ID` ($0.50) from the first call over. No forgiveness band.
- Deposit: Stripe payment links for Plans 5 and 6 charge one month. No deposit is collected or tracked.

**What has to change when trigger fires**:
1. **Forgiveness band**: Overage metering for Monthly Plan accounts starts at `Monthly API Limit × 1.10` (5,500 for Studio, 10,120 for Business), not at the limit. Implement as a per-plan Airtable field (e.g. `Overage Forgiveness Pct`) read by both App gating (`helpers.ts` effective-limit calc) and API credit check. Base stays at 0%.
2. **Deposit**: No deposit exists in Stripe or Airtable today. Decide and record what "4 month deposit" means in dollars, whether it is held or applied to the first months, and how it is collected (Stripe invoice, payment link, manual). Then a Stripe setup or a manual runbook, plus an Airtable field marking the deposit as received so the App can show it.
3. **Reset path**: The six cycle-reset sites in `accountRouter.ts` already zero `overageTokensThisCycle`; confirm the forgiveness band does not need its own counter.
4. **Copy check**: Once built, make sure the website bullet, the app billing page and the Stripe invoice description all say the same thing.

**Do Not**:
- Do not silently change what Base or Pay-as-they-go accounts are charged.
- Do not derive any price from `TOKEN_COSTS × SPT_RATE_CENTS`. Airtable is the source of truth.

**Companion entry**: Tracked in Website repo (`/Users/piersfawkes/Documents/Fodda Website/BACKBURNER.md`).

---

## Switch Claude connection rec from tokenized URL → OAuth

**Added**: 2026-08-01
**Priority**: Low until trigger — do NOT do early
**Trigger**: Only after the OAuth lane passes its end-to-end test (MCP repo `briefs/Brief - OAuth End-to-End Test and Key Rotation Completion.md`) AND ideally the Anthropic directory listing is approved.

**What**: The app's connect UI hands logged-in users a tokenized `https://mcp.fodda.ai/c/<token>` MCP URL (built in `server/services/mcpConnectionService.ts`, surfaced in `frontend/components/AccountPortal.tsx` / `HomeDashboard.tsx`). Once OAuth is proven, offer OAuth via the bare `https://mcp.fodda.ai/mcp` URL as the primary path (Claude runs the Clerk consent flow off our `/.well-known/oauth-*` metadata — no secret in the URL, revocable per Clerk). Keep the tokenized `/c/<token>` URL as the fallback for non-OAuth clients.

**Why not now**: OAuth deployed but not yet end-to-end validated — don't risk the funnel. And since the user is already logged into the app via Clerk, an OAuth connect in Claude is a redundant second consent; the tokenized URL is the smoother path today.

**Files**: `server/services/mcpConnectionService.ts` (URL builder), `frontend/components/AccountPortal.tsx`, `frontend/components/HomeDashboard.tsx`. Endgame after directory approval: point users at the one-click directory connector. Companion entry in the Website repo (`/Users/piersfawkes/Documents/Fodda Website/BACKBURNER.md`).

---

## ~~Replace Mock `/api/account/usage` with Real Airtable Queries~~ ✅ COMPLETED

**Added**: 2026-03-06  
**Completed**: 2026-03-07  
**Resolution**: Replaced hardcoded mock data with real Airtable queries. Now fetches Account record for `monthlyQueries`/`maxplanQueries`, linked Users for per-user breakdown, and Usage Logs table for per-graph and daily trend data. `isDemo` flag set to `false`.

---

## ~~Show Remaining Queries in Chat UI~~ ✅ COMPLETED

**Added**: 2026-03-06  
**Completed**: 2026-03-07  
**Resolution**: Added a `⚡ X / Y` query usage chip to the ChatInterface toolbar. Appears when usage > 50%, turns amber at 80%, red at 95%. Clicking it opens the UpgradeModal. Local query count increments in real-time after each successful query.

---

## ~~Monthly Usage Reset Cron~~ ✅ COMPLETED

**Added**: 2026-03-06  
**Completed**: 2026-03-07  
**Resolution**: Added `POST /api/cron/monthly-reset` endpoint secured by `CRON_SECRET` env var. Resets `monthlyQueries`→0, `limitReached`→false on all active accounts (skips planCode 7/Lapsed). Clears `usageWarningSent` on all users. Handles Airtable pagination. Ready to wire to Cloud Scheduler (`0 0 1 * *`).

---

## 🟡 Pre-Submit Limit Guard — Block Input Before Query Attempt

**Added**: 2026-03-07  
**Priority**: Medium  
**Impact**: UX — users currently type a query and get rejected, no pre-check

Currently there's no client-side check before the user submits. They type out a question, hit send, and only then get the "limit reached" error. Should check `currentAccount.currentQueryCount >= currentAccount.monthlyQueryLimit` before submitting and show an inline message with the upgrade CTA.

---

## 🟡 Disable Chat Input When Limit Reached

**Added**: 2026-03-07  
**Priority**: Medium  
**Impact**: UX — text field stays active, users can keep typing and getting rejected

When `limitReached` is true or `currentQueryCount >= monthlyQueryLimit`, the prompt input should be visually disabled with a placeholder like "Query limit reached — upgrade to continue". Prevents the frustrating loop of typing → submit → reject → repeat.

---

## ~~Top-Up Credit Purchase for Free Users~~ ✅ COMPLETED

**Added**: 2026-03-07  
**Completed**: 2026-03-07  
**Resolution**: Added a top-up card in UpgradeModal for free users (planCode 2). Links to Stripe checkout (`price_1T1ZtuAYuoIyU8CGYlgDpCEp`). Stripe webhook detects planCode 7 purchases and ADDS credits by reducing `queriesUsedThisCycle` instead of resetting. Account stays on current plan.

---

## ~~Full QA: Top-Up (100 Queries) Purchase Flow~~ ✅ COMPLETED

**Added**: 2026-03-07  
**Completed**: 2026-03-17  
**Resolution**: Full end-to-end audit completed. Found and fixed a **critical bug**: the Stripe webhook was clearing `limitReached` and reducing `queriesUsedThisCycle` but NOT resetting `monthlyQueries`. Since enforcement checks `monthlyQueries >= max`, users remained blocked after purchasing a top-up. Fixed by adding `"monthlyQueries": 0` to the top-up update. Also verified: UpgradeModal visibility logic, Stripe signature verification, email templates, rawBody preservation, monthly cron reset interaction, and edge cases (multiple top-ups, non-limit purchases, graph-scoped users). Two minor items noted: hardcoded fallback Stripe link should be verified, and post-purchase UX has no auto-refresh (user must reload).

---

## Optimize Airtable Lookups Using Record ID Fields

**Added**: 2026-02-16  
**Priority**: Low  
**Impact**: Performance & code clarity

New Airtable fields have been added that expose the Record ID as a regular field:

| Table | Const | New Field |
|---|---|---|
| `tblGWh6XpdEZxw8AE` | `USERS_TABLE` | `userRecordId` |
| `tblt6mh0XQOablFDX` | `ACCOUNTS_TABLE` | `accountRecordId` |
| `tblsDGYv8pFpNegcf` | `API_KEYS_TABLE` | `apiKeyRecordId` |
| `tblq2T5OUyrDFCda9` | `PLANS_TABLE` | `planId` |
| `tblf8OPpi0F16ofAX` | *(graphs)* | `graphRecordId` |

**What to do**: Replace `filterByFormula` calls using `RECORD_ID()` with direct Airtable record GET requests (`GET /v0/BASE_ID/TABLE_ID/{recordId}`). This avoids the overhead of a filtered list query when we already know the record ID. Affected lines in `server/index.ts`:
- Line ~254: `RECORD_ID() = '${userId}'` → direct GET
- Line ~278: `RECORD_ID() = '${tenantId}'` → direct GET
- Line ~1346: `RECORD_ID() = '${userId}'` → direct GET

---

## Medium-Term: Token Top-Up for Free Plan Users (Stripe)

**Added**: 2026-02-16  
**Priority**: Medium  
**Impact**: Revenue & retention

When a free plan account (planCode 2) runs out of tokens:
1. Upsell to 'TOP UP — 100 Queries' package (planCode 7)
2. On successful Stripe payment, **add** the Monthly Query Limit (100 queries) to the account's `maxplanQueries` (not overwrite)
3. Account stays on planCode 2 (Free), allowing up to 2 more top-ups per month
4. Ensure top-up tokens don't get wiped by monthly reallocation

**Implementation notes**:
- Add `/api/payment/top-up` endpoint with Stripe Checkout
- On Stripe webhook `checkout.session.completed`, increment `maxplanQueries += 100`
- Frontend: Show top-up CTA when `limitReached` flag is true on account

---

## ~~Longer-Term: Subscription Payment Processing (Stripe)~~ ✅ COMPLETED

**Added**: 2026-02-16  
**Completed**: 2026-05-06  
**Resolution**: Full subscription billing migration completed. Multi-event webhook handler (checkout, renewal, cancellation, plan changes). Dynamic checkout with trial/grace period support. Stripe Customer Portal integration via `account-billing` page. Domain-matching fallback for unmatched payments with admin/buyer email alerts. Plans now support `billingMode` field (`subscription` vs `one_time`). Subscription fields (`stripeCustomerId`, `subscriptionStatus`) tracked on Accounts.

---

## Enforce Includes Public APIs? Field *(API-side — Fodda API codebase)*

**Added**: 2026-02-16  
**Priority**: Medium  
**Impact**: Access control  
**Owner**: Fodda API agent (not Fodda App)

The `Includes Public APIs?` field in the Plans table determines whether an account can use public (unauthenticated) API endpoints. The App already reads and displays this flag — but enforcement must happen in the **Fodda API** middleware, similar to `checkVerticalAccess()`.

**What to do** (in Fodda API): Add middleware to public API endpoints that checks the account's `includesPublicApis` flag. If false, return 403.

---

## Marketplace Submission Prep

**Added**: 2026-02-16  
**Priority**: Low (do not start yet)  
**Impact**: User acquisition

Prepare the MCP for submission to AI/data marketplaces. Requirements:
- Ensure all API tracking works correctly for usage monitoring
- Pricing table is functional and reflects Airtable plans
- Payment flow (top-up + subscriptions) is operational
- Documentation / API spec is ready for marketplace review

---

## Audit & Improve Context Rewriting During Onboarding

**Added**: 2026-02-16  
**Priority**: Medium  
**Impact**: Response quality

The app uses `accountContext` and `userContext` to focus API responses. During onboarding, raw user input is passed through `rewriteContext()` (an LLM call) to produce API-friendly context strings.

**What to verify/improve**:
- Confirm `rewriteContext` prompt produces context that works well when injected into API calls (check `/Fodda API` codebase for how context is consumed)
- Ensure both account and user context are rewritten during registration (currently done in `/api/auth/register`)
- Ensure context is rewritten on updates too (in `/api/account/update` and `/api/user/update`)
- **If no context is provided during signup**, the LLM must produce a neutral/no-op string that has zero effect on API responses (e.g. empty string or a generic passthrough like "No specific context provided")
- Consider adding a "preview" step in the UI so users can see the rewritten context

---

## Join-Team Flow Refinements

**Added**: 2026-02-16  
**Priority**: Medium  
**Impact**: Team management & security

The `/api/auth/join` endpoint lets users join an account via signup code. Refinements needed:

1. **Role-based context editing**: Users who join via signup code should only be able to edit their own `userContext`, never `accountContext`. Only Owners and Admins can edit `accountContext`. Enforce this in:
   - Frontend: `AccountPortal.tsx` settings tab — hide/disable accountContext field for non-Owner/Admin roles
   - Backend: `/api/account/update` — reject accountContext changes from Users

2. **Admin notification on new user signup**: When a user joins via signup code, email all Owners and Admins on the account with:
   - New user's name and email
   - Link to the app (Account Portal) where they can manage the new user
   - Implement in `/api/auth/join` after successful user creation

---

## Graph Explorer (Standalone View)

**Added**: 2026-02-24  
**Priority**: Medium  
**Impact**: User understanding & infrastructure positioning

Build a standalone "Graph Explorer" view accessible from the sidebar under Explore. This is a static structural view — not tied to any chat query.

**Purpose**: Let users see the shape of the knowledge graph they're querying:
- Node types (Trend, Article, Entity, etc.)
- Relationship types (EVIDENCES, RELATED_TO, etc.)
- Sample entities
- Containment boundaries

**Implementation ideas**:
- Schema viewer + limited graph lens (think: Neo4j Browser lite)
- Clean node-link diagram with controlled color coding
- Toggleable node types
- Not a storytelling map — a structural inspection tool

**Trigger to build**: When users express confusion about what's "inside" a graph, or when onboarding research shows structural visibility improves trust.

**Currently**: Placeholder "coming soon" link in sidebar.


---

## ~~Align MCP Application with Fodda API~~ ✅ COMPLETED

**Added**: 2026-02-26  
**Completed**: 2026-03-06  
**Resolution**: MCP updated to v1.7.0 with full parity. Tool descriptions enriched with geo auto-detection, relevance gate, Brand/Location node types, and enhanced evidence schema. `include_evidence` now defaults to `true`. Internal service key support added. Types audited for stripped fields. Build passes clean.

---

## ~~Rebuild Neo4j Vector Index with gemini-embedding-001~~ ✅ COMPLETED

**Added**: 2026-02-26  
**Completed**: 2026-03-06  
**Resolution**: Fodda PSFK agent rebuilt `trend_summary_index` at 768-dim using `gemini-embedding-001`. Fodda API agent updated `embeddings.ts` to match. Vector search verified end-to-end (hybrid search returning 6 rows, scores ~0.8+). Article index (`article_summary_index`) will auto-migrate on next sync.

---

## Topic-Scope Gate for Out-of-Scope Queries

**Added**: 2026-02-26  
**Priority**: Medium  
**Impact**: Search quality — prevents shoehorning irrelevant results for off-topic queries

When a user asks a question that's outside the graph's domain (e.g., "knowledge work as a career" against a retail graph), the vector search still returns whatever is semantically closest, even if it's a poor match. The system should detect this and return "no confident matches" rather than showing irrelevant trends.

**What to do**:
1. In `v1Router.ts`, add a minimum semantic score threshold (e.g., 0.85) for vector results
2. If the top result scores below this threshold, return an empty result set with a `"confidence": "low"` flag
3. The front-end can then display a message like "No strong matches found for this query in the [graph_name] graph"

---

## Graph Export: SVG Format

**Added**: 2026-03-06  
**Priority**: Low  
**Impact**: Presentation quality

Re-render the Canvas graph as SVG for vector-quality export. Output scales cleanly to any size and is editable in Figma/Keynote/Illustrator.

**What to do**: Add an `exportSVG()` handler in `GraphVisualization.tsx` that traverses `layoutNodes` and `edges` to build SVG elements (circles, lines, text) matching the Canvas render logic. Trigger via a new "SVG" button in the export toolbar.

---

## Graph Export: PDF Report

**Added**: 2026-03-06  
**Priority**: Low  
**Impact**: Shareability & demo polish

Generate a one-page PDF containing the graph snapshot + a summary table of nodes and relationships. This is the "send to client" deliverable.

**What to do**: Use `jspdf` (or equivalent lightweight PDF lib). Embed the Canvas PNG, then append a table of `{ node.name, node.type, connections }`. Add a "PDF" button to the export toolbar. Note: this adds ~30KB to the bundle.

---

## Graph Admin: Sales-Led Account Provisioning

**Added**: 2026-03-07  
**Priority**: Medium  
**Impact**: Sales enablement — lets Fodda leaders/sales people spin up demo-ready accounts before a call

Add a feature to the Graph Admin panel that lets an admin create a new user account by entering basic details: **name**, **company**, and **email**. The system should:

1. Create a new User record and Account record in Airtable (same flow as onboarding/registration)
2. Generate an API key for the new account (same as the existing onboarding key-generation logic)
3. Instead of sending a magic-link login email, send a **welcome email** with:
   - A greeting introducing Fodda
   - Login instructions (magic-link or password-set link)
   - The user's API key or a link to find it in their Account Portal
4. The created account should be immediately functional so the invitee can self-demo before or during the sales call

**Use case**: Before a sales call, create the prospect's account so they can explore Fodda on their own and arrive at the call with hands-on experience.

**What to do**:
- Add a "Create Account" form in the Graph Admin UI (name, company, email fields + submit)
- Backend: `POST /api/admin/create-account` — reuse registration logic, skip magic-link, send welcome email instead
- Email template: new `welcome-sales` template with branding, login CTA, and API key display
- Secure behind admin-only auth (existing Graph Admin auth)

---

## ~~Anthropic Pro Detection → MCP-First Onboarding~~ ✅ COMPLETED

**Added**: 2026-03-07  
**Completed**: 2026-03-10  
**Priority**: Medium  
**Impact**: Adoption — drives Fodda usage inside Anthropic/Claude by surfacing MCP integration immediately

**Phase 1 ✅ DONE**: Added "Mainly Claude" as the first option in the "How will you query Fodda?" dropdown during onboarding. The response is saved to the `apiUse` field on the User record. Claude users skip context questions and go straight to account creation.

**Phase 2 ✅ DONE**: On first login, Claude users (`apiUse === 'Mainly Claude'`) automatically see the Account Portal opened to the MCP Integration tab with Claude setup instructions. Tracked via `fodda_mcp_first_login_shown` localStorage flag — only shown once.

---

## 🟡 Post-Login Context Questions Popup

**Added**: 2026-03-10  
**Priority**: Medium  
**Impact**: Data quality & personalization — captures context without blocking onboarding

The Company Mission and Role & Goals fields have been commented out of the onboarding form to reduce friction. These should be moved to a **dismissible welcome popup** that appears on first login inside `app.fodda.ai`.

**UX**:
- On first login, show a friendly popup: "Welcome to Fodda! Help us give you the best answers by telling us a bit about how you and your organization will use the data."
- Two optional text fields: **Your Role & Goals** and **Company Mission**
- "Save" button writes to existing `userContext` / `accountContext` fields (rewritten via `rewriteContext()`)
- "Skip for now" dismisses and sets a flag so it doesn't appear again
- Could re-surface from Account Portal settings if user wants to add context later

**What to do**:
- Create a `WelcomeContextPopup` component rendered conditionally on first login (check a `contextPromptDismissed` flag on User record)
- On save, call existing `/api/account/update` and `/api/user/update` endpoints with context values
- On dismiss, set `contextPromptDismissed: true` on User record
- The commented-out code in `AuthGate.tsx` (step 2 context textareas) can be reused for the popup fields

---

## ✅ Graph Owner Referral Links (Graph-Scoped Signup) — COMPLETED 2026-03-10

**Added**: 2026-03-10  
**Completed**: 2026-03-10  
**Status**: ✅ Core flow built and deployed

**What was built**:
- `?graph=sic` URL param scopes signup to specific graph
- Branded signup badge shows graph name, headline, owner
- "Mainly Claude" pre-selected for referral signups
- Account `vertical` set to graph slug on registration
- Sidebar greys out restricted graphs (30% opacity, unclickable)
- Auto-selects allowed graph on login
- Graph Admin → "Referral Links" tab: per-graph URL copy + badge preview
- Server returns `vertical` in account data on login/verify

**Remaining gap — Upgrade Flow for Referral Users**:
- **Top-up**: user stays on their current graph (`vertical` unchanged) — just adds credits
- **Single Graph plan**: user stays on their current graph (`vertical` unchanged) — monthly access to that one graph
- **Multi-graph plan (Pro/Enterprise)**: Stripe webhook should set `vertical` to `'all'` so all graphs unlock
- Currently: no plan-based `vertical` logic in webhook — needs a small modification in `server/index.ts` Stripe handler

---

## 🟡 Compare Mode — 3-Way Search Comparison Overlay

**Added**: 2026-03-15  
**Priority**: Medium  
**Impact**: Demo quality — lets presenters show the difference between Graph, Gemini, and Blended retrieval in one view  
**Origin**: Demo feedback — suggested that comparing LLM vs Graph responses simultaneously would be a powerful demo moment

Currently, comparing search modes requires switching the reasoning mode (which clears chat), re-asking the same question, and mentally comparing. This is awkward in a live demo.

**Proposed solution — Full-screen "Compare Mode" overlay**:
- A cinematic full-screen modal (like the existing `GraphVisualization` overlay) with **3 equal columns**: Graph | Gemini | Blended
- Each column shows: mode badge, response text (markdown), compact evidence summary (trend/article count), and latency timer
- The query fires all 3 modes **in parallel** using `Promise.allSettled` — columns populate as results stream in
- Footer has "Use this response" per column → inserts that result into the main chat and closes the modal
- **Zero impact on existing UX** — the overlay sits on top; the normal chat+evidence layout is completely untouched

**Entry points**:
- `⚡ Compare` chip in the prompt toolbar (next to the mode picker)
- "Compare Modes" nav item in sidebar Console section
- `⌘⇧C` keyboard shortcut (opens with last query pre-filled)

**Files involved**:
- `[NEW] frontend/components/CompareModal.tsx` — the 3-column overlay component
- `[MODIFY] App.tsx` — `isCompareOpen` state, `handleCompareQuery()` parallel dispatch
- `[MODIFY] ChatInterface.tsx` — "Compare" chip in toolbar
- `[MODIFY] Sidebar.tsx` — "Compare Modes" nav item under Console

**No new backend work** — all 3 generation functions (`generateResponse`, `generateGeminiSearchResponse`, `generateBlendedResponse`) already exist in `geminiService.ts`.

**Estimated effort**: 4–6 hours


---

## 🟡 UX Consistency — Toast Notifications & Alerts

**Added**: 2026-04-11  
**Priority**: Medium  
**Impact**: UX — replace browser `alert()` with consistent toast notifications

As part of the navigation refactor toward a cinematic, premium feel, all browser `alert()` calls (especially in the new Create Graph flow) should be replaced with a unified toast notification system (like the one started in `ProfilePage.tsx`). Ensures the app feels like a single integrated platform rather than a collection of pages.

---

## 🟡 Graph Lifecycle: Withdraw / Delete Submitted Graph

**Added**: 2026-04-11  
**Priority**: Medium  
**Impact**: User control — lets experts remove or retract a submitted graph

Users currently have no way to withdraw or delete a graph they've submitted. Whether it's pending review, needs revision, or even live, the expert should be able to:

1. **Withdraw** a pending/needs_revision graph (removes from admin queue)
2. **Delete** a live graph (removes from catalog, triggers cleanup in CE + Neo4j)
3. Confirmation modal with clear consequences ("This will remove your graph from all Fodda users")

**Files involved**:
- `[MODIFY] CreateGraphPage.tsx` — add "Withdraw" / "Delete" button per submission card
- `[NEW] server/routers/expertGraphRouter.ts` — `DELETE /api/expert-graph/:slug` endpoint
- `[MODIFY] graph-registry.ts` — add `deleteGraph()` function
- CE coordination: notify CE agent to clean up linked records

---

## 🟡 Graph Lifecycle: Pause / Update a Live Graph

**Added**: 2026-04-11  
**Priority**: Medium  
**Impact**: User control — lets experts temporarily hide or update their graph

Experts should be able to:

1. **Pause** a live graph (sets status to `paused`, hides from other users but preserves data)
2. **Resume** a paused graph (sets status back to `active`)
3. **Update** a graph by re-uploading a new PDF version (triggers re-ingestion while keeping the same slug)

**Files involved**:
- `[MODIFY] CreateGraphPage.tsx` — add "Pause" / "Resume" / "Update PDF" actions on live submissions
- `[MODIFY] server/routers/expertGraphRouter.ts` — `PATCH /api/expert-graph/:slug/status` endpoint
- CE coordination: paused graphs should be excluded from query routing

---

## 🟡 Website: Privacy Policy & Terms of Service Pages

**Added**: 2026-05-06  
**Priority**: Medium  
**Impact**: Legal compliance — Stripe Customer Portal shows links to ToS and Privacy Policy  
**Owner**: Website agent (PSFK site)

Stripe's Customer Portal configuration requires links to a Privacy Policy and Terms of Service page. These need to be created on fodda.ai (or psfk.com) and the URLs added to Stripe Dashboard → Settings → Public business information.

**Brief for Website agent**:
1. Create `/privacy` page on fodda.ai with standard SaaS privacy policy covering: data collection, usage, storage, third-party services (Stripe, Airtable, Google Cloud), user rights, contact info
2. Create `/terms` page on fodda.ai with standard SaaS terms of service covering: acceptable use, billing/refund policy, intellectual property, limitation of liability, termination
3. Both pages should match the existing fodda.ai design aesthetic
4. Once live, update Stripe Dashboard → Settings → Public business information with the URLs

---

## 🟡 Subscription Bolt-On: Per-Vertical Add-On Pricing

**Added**: 2026-05-06  
**Priority**: Medium  
**Impact**: Revenue — lets customers add extra graph verticals to their plan at a per-topic price  

Each plan has bolt-on pricing for additional verticals:
- **Starter**: +$20/month per extra vertical
- **Team**: +$80/month per extra vertical

**What to do**:
1. Create add-on Stripe Products/Prices for each vertical add-on tier ($20, $80)
2. Store add-on `stripePriceId` values in Airtable (Plans table or a new Add-ons table)
3. Backend: Update `/checkout/subscribe` to support adding bolt-on line items to the subscription
4. Frontend: Add a "Add Vertical" UI in the Billing or Plans modal — let users select which verticals to add
5. Webhook: Handle `customer.subscription.updated` events that include add-on line item changes, update account `vertical` field accordingly
6. Stripe Portal: Ensure portal allows quantity changes for bolt-on items

---

## 🟡 Bug: .5 API Calls appearing in Usage

**Added**: 2026-05-06  
**Priority**: Low  
**Impact**: UX — users see decimals in API call counts which should be integers.  

**Investigation**:
- Check Airtable formula for `monthlyQueries` / `currentQueryCount`.
- Verify if any query type (e.g. MCP prompts) is being calculated with fractional weights.
- Fix: Round to nearest whole number in backend before returning to frontend, or floor/ceil in UI.

---

## 🟡 Migrate Graph Toggle to API Endpoint

**Added**: 2026-05-15  
**Priority**: Low (Backburner)  
**Impact**: Consistency — resolves a 5-minute stale cache window when toggling graphs/skills.

Currently, the dashboard's My Graphs page writes directly to Airtable via `POST /api/user/disabled-graphs`. This bypasses the API's in-memory caches (`DISABLED_GRAPHS_CACHE` and `ACCESS_DECISION_CACHE`), causing up to 5 minutes of staleness where the MCP agent might still serve results from a disabled graph.

**What to do (Option B - Recommended)**:
1.  **Server-side**: Add a proxy endpoint `POST /api/user/toggle-graph` in `userRouter.ts` that forwards requests to `https://api.fodda.ai/v1/user/preferences/toggle` using the admin `FODDA_API_KEY`.
2.  **Frontend Service**: Add `toggleGraphPreference(id, enabled, email)` to `shared/dataService.ts`.
3.  **Frontend Component**: Update `MyGraphsPage.tsx` to use per-item toggles instead of the debounced CSV approach.
4.  **Skills**: Ensure this logic also covers "Skills" (Paralogy/Igloo) which are now unified in the API toggle system.

**Reference Brief**: [brief_use_toggle_api.md](file:///Users/piersfawkes/Documents/Fodda/briefs/brief_use_toggle_api.md)

---

## 🟡 Managed Agents Policy: Safety Policies & Deny-All Baseline

**Added**: 2026-05-22
**Priority**: Medium
**Impact**: Security — aligns with the Engineering Standards & Code Policy for Agents
**Policy Ref**: [managed_agents_overview.md](file:///Users/piersfawkes/.gemini/antigravity/brain/9871d5b9-b257-4cda-8792-42aeccf5e883/managed_agents_overview.md) §3

The `mcp-chat-agent` (in `mcpChatService.ts`) currently allows all MCP tools returned by `listTools()`. Per policy, production agents must use a `deny_all()` baseline + selective allow-list. Since this repo connects to MCP servers dynamically, the allow-list should be derived from the `agents.yaml` manifest or a config file rather than blindly trusting whatever the MCP server advertises.

**What to do**:
1. Create `.agents/policies/mcp-chat-agent.yaml` with an explicit tool allow-list
2. After `listTools()` in `mcpChatService.ts`, filter `mcpTools` against the allow-list
3. Log and reject any tool not on the list

---

## 🟡 Managed Agents Policy: Audit Hooks (post_tool_call / on_tool_error)

**Added**: 2026-05-22
**Priority**: Medium
**Impact**: Observability — required by Engineering Standards §5
**Policy Ref**: [managed_agents_overview.md](file:///Users/piersfawkes/.gemini/antigravity/brain/9871d5b9-b257-4cda-8792-42aeccf5e883/managed_agents_overview.md) §5

The `mcpChatService.ts` agentic loop already logs tool calls to `toolCallLog[]`, but this stays in-memory and is returned to the frontend. Per policy, all tool calls must also be emitted to a structured logging pipeline.

**What to do**:
1. Add a `postToolCall()` hook that persists each tool call to an audit table (Airtable or structured JSON log)
2. Add an `onToolError()` hook that captures failures with full context (tool name, args, error, iteration number)
3. Emit both hooks to the same pipeline as `promptSweep.ts` uses (`PROMPT_AUDIT_TABLE`) or a new `AGENT_AUDIT_TABLE`

---

## 🟡 Managed Agents Policy: Token Budget Controls

**Added**: 2026-05-22
**Priority**: Low
**Impact**: Cost control — required by Engineering Standards §5
**Policy Ref**: [managed_agents_overview.md](file:///Users/piersfawkes/.gemini/antigravity/brain/9871d5b9-b257-4cda-8792-42aeccf5e883/managed_agents_overview.md) §5

Currently, `mcpChatService.ts` caps iterations (8) and total time (45s) but does NOT track or cap token usage. Thinking tokens in particular can inflate costs silently.

**What to do**:
1. After each `generateContent()` call, read `usageMetadata.totalTokenCount` from the response
2. Track cumulative tokens across the loop; abort if exceeding a per-query budget (e.g., 50K tokens)
3. Log token usage per query alongside tool calls for cost tracking
4. Define per-agent token budgets in `agents.yaml`

---

## 🟡 Managed Agents Policy: Golden-Set Prompt Regression Testing

**Added**: 2026-05-22
**Priority**: Low
**Impact**: Quality — required by Engineering Standards §4
**Policy Ref**: [managed_agents_overview.md](file:///Users/piersfawkes/.gemini/antigravity/brain/9871d5b9-b257-4cda-8792-42aeccf5e883/managed_agents_overview.md) §4

`promptSweep.ts` tests that prompts return ≥3 results (a pass/fail gate), but does NOT verify the *quality* of results. Per policy, golden-set regression testing should compare outputs against known-good baselines.

**What to do**:
1. Create a `server/data/golden-sets/` directory with expected output fixtures per graph
2. Extend `promptSweep.ts` to compare API responses against golden baselines (semantic similarity or key-field matching)
3. Flag regressions when outputs drift significantly from baselines

---

## 🟡 Managed Agents Policy: Extract MCP Chat System Prompt to Persona File

**Added**: 2026-05-22
**Priority**: Low
**Impact**: Maintainability — system prompt is hardcoded at L124-135 of `mcpChatService.ts`
**Policy Ref**: [managed_agents_overview.md](file:///Users/piersfawkes/.gemini/antigravity/brain/9871d5b9-b257-4cda-8792-42aeccf5e883/managed_agents_overview.md) §1, §2

The MCP chat agent's system prompt is currently inline in the service file. Per policy, personas should be version-controlled as separate files so prompt changes go through PR review independently of code changes.

**What to do**:
1. Extract the system prompt to `.agents/personas/mcp-chat-agent.md`
2. Load it at startup in `mcpChatService.ts` (like `promptSelector.ts` loads `prompt-bank.json`)
3. Update `agents.yaml` manifest to point `persona:` at the new file

---

## 🟡 App Agent: Sync app.fodda.ai "Upload & Review" with Website Messaging

**Added**: 2026-05-26  
**Priority**: Medium  
**Impact**: Alignment — ensures the actual web app matches website claims about "Bring Your Own Graph", supporting slide decks, and "Upload & Review" terminology  

We need to align the Fodda App upload flow and private graph MCP integration with the positioning on the marketing website:
1. **Upload & Review Flow**: Rename "Create Graph" to "Upload & Review" (header, sidebar, nav buttons), allow slide deck files (`.pptx`, `.ppt`, `.key`) in the input file pickers and drag-and-drop zones, and update ingestion status labels (`Under Review`, `Revision Requested`, `Ingested`).
2. **Private Graph MCP Integration**: Update the MCP/Claude connector documentation in the connections tab to note that private custom graphs are queryable alongside public ones. Add a helper card in the custom graphs list on the "My Graphs" page displaying their account-wide MCP URL and API key for easy integration.

---

## 🟡 Replace WaxSeal "F" Logo on Confirmation Screen

**Added**: 2026-06-01  
**Priority**: Low  
**Impact**: Visual polish — the "A link is in the mail" confirmation screen shows a large decorative "F" wax seal that should be replaced with the actual Fodda logo.

**What to do**:
1. Update the `WaxSeal` component in [AuthGateAtoms.tsx](file:///Users/piersfawkes/Documents/Fodda/frontend/components/AuthGateAtoms.tsx) to render the proper Fodda logo instead of the stylized "F" letter.
2. Use the existing Fodda logo asset (SVG or PNG) for consistency with the rest of the brand.
3. Ensure the seal retains its current sizing and position within the confirmation screen layout ([AuthGate.tsx](file:///Users/piersfawkes/Documents/Fodda/frontend/components/AuthGate.tsx) line ~363).

---

## 🟡 Auto-Create Accounts for Unknown Login Emails

**Added**: 2026-05-28  
**Priority**: Low  
**Impact**: Friction reduction — new users can sign up automatically by simply submitting their email on the login screen, bypassing the manual registration form.

**What to do**:
1. **Backend**: Modify `/api/auth/login` in [authRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/authRouter.ts) so that if no user is found for the given email, it automatically registers the email address.
   - Extract the registration logic from `/api/auth/register` (creating an account in `ACCOUNTS_TABLE`, generating an active API key in `API_KEYS_TABLE`, and creating a user in `USERS_TABLE` with default profile values) into a helper.
   - Use default profile values: First Name = email prefix, Company Name = email, Job Title = empty string, Onboarding Intent = `'account'`, emailConfirmed = `false`.
   - Send the `SIGNUP_CONFIRMATION` email with the verification link.
   - Return a `200 OK` status with `unconfirmed: true` and an appropriate success message.
2. **Frontend**: Ensure the client-side code in [AuthGate.tsx](file:///Users/piersfawkes/Documents/Fodda/frontend/components/AuthGate.tsx) handles this payload cleanly. Since the login handler already listens for responses where `message.includes("email")` and routes to the verification status screen, it should display the check-email screen without redirecting to the signup page.

## 🟡 Proactive SEO/GEO Tracking & AI Search Referral Alerts (Pulse Bot)

**Added**: 2026-06-04  
**Priority**: Medium  
**Impact**: Strategic — helps track brand visibility, traffic referrals, and attribution share inside LLMs/Generative Search Engines

Four innovative features to code directly into our Sales Bot / Pulse framework:

1. **AI Search Engine Referral Alerts (GEO Stitching)**:
   - *Description*: Update site analytics tracking (`analytics.ts`) to detect referrers from AI engines (like `perplexity.ai`, `chatgpt.com`, `gemini.google.com`, `claude.ai`). In the daily anomaly alert cron job, calculate sessions driven by AI citation clicks and trigger Slack alerts on surges or drops.
   - *Example Alert*: `"📈 Perplexity citation traffic spiked +150% yesterday! (45 clicks vs 18 baseline)."`

2. **Proactive AI Citation Audits (Automated GEO Rank Tracking)**:
   - *Description*: Create a daily cron endpoint `/cron/geo-audit` in `slack_bot.js` that queries the Gemini API with key industry terms (e.g. *"What is the best platform for expert AI context?"*) and audits if Fodda/PSFK is cited. If citations drift or drop, trigger alerts.
   - *Example Alert*: `"⚠️ GEO Alert: We fell out of the top citations in Gemini for the query 'Independent culture expert data'."`

3. **AI Traffic Section in Weekly Briefings**:
   - *Description*: Update `lib/pulse.js` to split GA4 report queries by AI referral sources and update `generateBriefing` to parse this data and format a clean Slack block showing week-over-week performance of citations.

4. **Dynamic UTM Intent Capturing**:
   - *Description*: Capture dynamic query parameters or landing page custom parameters when users click citation links in LLMs, and push them to GA4 as custom dimensions so we can track the exact context queries that led users to click.
