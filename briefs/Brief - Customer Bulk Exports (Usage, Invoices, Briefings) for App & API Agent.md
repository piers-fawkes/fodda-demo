# Brief (App & API Agent) — Customer Bulk Exports (Usage, Invoices, Briefing History) on app.fodda.ai

**Target repo:** Fodda Monorepo (`app.fodda.ai` frontend console in `src/` + `api.fodda.ai` in `functions/`)
**Execution handle:** `/build-from-brief briefs/Brief - Customer Bulk Exports (Usage, Invoices, Briefings) for App & API Agent.md`
**Prepared by:** Website Agent
**Related document:** "Making Fodda Polar-Ready" (Polar Browser / AI Agentic Browser Compatibility)

---

## Context

Polar (`polarbrowser.com`) and other agentic AI browsers (Claude Computer Use, ChatGPT Agent Mode, MultiOn) automate multi-step operations for enterprise users (GTM, strategy, research, and finance teams). A frequent task assigned to these agents is:
> *"Export last month's Fodda query usage and invoices for our accounting team, and download all research briefings on retail trends."*

Currently, `app.fodda.ai` and `api.fodda.ai` offer:
1. **Zero customer-facing usage export:** Users can only view queries on-screen; there is no CSV/JSON export.
2. **Zero invoice summary export:** Invoices are offloaded to Stripe customer portal, requiring agents to scrape or download single PDFs one by one.
3. **Zero briefing bulk export:** Research sessions and deliverables must be copied out individually.

This brief specifies the 3 bulk export capabilities needed on `app.fodda.ai` and backed by `api.fodda.ai`.

---

## What to build

### 1. Usage & Query History Bulk Export (`CSV` and `JSON`)
- **Backend Endpoint (`functions/` in API monorepo):**
  - `GET /v1/user/usage/export?format=csv|json&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - Authenticated via Clerk OIDC or API Key (`req.user.accountId`).
  - Queries user's records from the `Questions` / `audit_logs` store (respecting `zeroQueryRetention` contracts — redaction text `[zero-retention contract]` preserved).
  - Emits standard downloadable attachment:
    - Content-Disposition: `attachment; filename="fodda-usage-YYYY-MM-DD.csv"`
    - Columns: `Timestamp (UTC)`, `Request ID`, `Question / Query`, `Graph / Source ID`, `Channel` (MCP, REST, Web), `Status`, `API Calls Billed`.
- **Frontend UI (`src/` in App):**
  - Add **"Export CSV"** and **"Export JSON"** buttons on the Usage / Query History view.
  - Stable selectors: `data-testid="export-usage-csv"` and `data-testid="export-usage-json"`.
  - Accessible names: `aria-label="Export query usage as CSV"` and `aria-label="Export query usage as JSON"`.
  - Native file trigger: direct anchor download (`<a href="..." download>`) or standard fetch blob download — **no multi-step confirmation modals**.

### 2. Invoices & Billing Summary Bulk Export (`CSV`)
- **Backend Endpoint (`functions/` in API monorepo):**
  - `GET /v1/user/invoices/export?format=csv`
  - Queries Stripe API (`stripe.invoices.list({ customer })`) + Lava purchase records (`Token Purchases` in Airtable for the user's account).
  - Emits:
    - Content-Disposition: `attachment; filename="fodda-invoices-summary-YYYY-MM-DD.csv"`
    - Columns: `Invoice / Charge ID`, `Date (UTC)`, `Description`, `Amount (USD)`, `Payment Rail` (Stripe / Lava / Card), `Status` (Paid, Open), `Hosted Invoice URL`, `PDF Download URL`.
- **Frontend UI (`src/` in App):**
  - In the Billing tab (`?view=billing`), under the Invoices / Transactions section, add an **"Export Invoices (CSV)"** button.
  - Stable selector: `data-testid="export-invoices-csv"`.
  - Accessible name: `aria-label="Export invoice history as CSV"`.

### 3. Briefings & Research Deliverables Export (`JSON` / `ZIP`)
- **Backend Endpoint (`functions/` in API monorepo):**
  - `GET /v1/user/briefings/export?format=json|zip`
  - Gathers user's completed research deliverables from `analyst_deliverables` and saved research chats (`analyst_sessions`).
  - Returns a JSON dump (or a zipped archive of individual `.md` files):
    - File naming: `{date}_{analyst-or-topic-slug}.md`
    - Content: Markdown with YAML frontmatter (Title, Date, Analyst, Model, Sources Cited) + deliverable body text.
- **Frontend UI (`src/` in App):**
  - On the Research / Briefing History view, add an **"Export All Briefings"** button.
  - Stable selector: `data-testid="export-briefings-all"`.
  - Accessible name: `aria-label="Export all research briefings and deliverables"`.

---

## Where to register

1. **API Routes:** Register export routes under `/v1/user/` in `functions/v1/userRouter.ts` (or `functions/v1/v1Router.ts`).
2. **App Routes/UI:** Mount download buttons in the corresponding account/usage, billing, and research views in `src/components/` and `src/pages/`.
3. **OpenAPI Spec:** Document the export endpoints in `openapi.json` so machine callers and developer docs stay in sync.

---

## Definition of Done

1. A logged-in user or browser agent clicking `[data-testid="export-usage-csv"]` immediately triggers a browser file download of `fodda-usage-*.csv` containing their billed query history.
2. An enterprise with zero-retention contract retains `[zero-retention contract]` in the query column; standard accounts get full query strings.
3. Clicking `[data-testid="export-invoices-csv"]` on the billing tab downloads a consolidated CSV of all historical Stripe and Lava payments with direct receipt links.
4. Clicking `[data-testid="export-briefings-all"]` downloads all past research briefings as clean Markdown / JSON.
5. All buttons render with clear `aria-label` and `data-testid` attributes in the DOM accessibility tree (0 unlabeled buttons).
6. Headless automation scripts (Playwright `page.waitForEvent('download')`) complete downloads in a single step with 0 popup obstructions.

---

## Do Not

- **Do not invent or recalculate billing prices:** All USD amounts must match Stripe/Airtable source of truth.
- **Do not leak internal operational fields:** Keep admin columns (like internal worker ID, server node) out of the customer CSV.
- **Do not introduce heavy canvas or blocking modal dialogs:** Use native browser download streams.
- **Do not bypass authentication:** All export endpoints must require valid user session (Clerk OIDC or user API key).

---

## Files expected to change

### Fodda App (`src/`)
- `src/components/UsageTable.tsx` (or query history component) — add export CSV/JSON buttons with testids
- `src/pages/Billing.tsx` — add invoices export button with testid
- `src/components/ResearchHistory.tsx` (or briefing history view) — add export deliverables button

### Fodda API (`functions/`)
- `functions/v1/userRouter.ts` (or `functions/index.ts`) — implement `GET /v1/user/usage/export`, `GET /v1/user/invoices/export`, `GET /v1/user/briefings/export`
- `openapi.json` — document export endpoint schemas
