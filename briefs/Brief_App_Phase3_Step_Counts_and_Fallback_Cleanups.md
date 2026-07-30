# Brief — App: Phase 3 Step Count Semantics, Fallback Literals Cleanup & Deployment

**Execution handle:** `/build-from-brief briefs/Brief_App_Phase3_Step_Counts_and_Fallback_Cleanups.md`
**Source:** Phase 3 QA feedback (2026-07-30).

## Context

A post-implementation audit of Phase 3 landed the two-source design cleanly, but highlighted two semantic/presentation bugs and an urgent deployment priority:

1. **Step Count Semantics & Logging Gap:**
   - Logging in `/api/query` falls back to `usage.tokens` (the token multiplier, e.g. 2 for the SIC graph). `/api/query` is single-step by definition — displaying "2 steps" for a single query against a 2× graph is inaccurate.
   - The multi-step MCP chat loop in `mcpRouter` currently has **no log write** at all when tool calls execute.
   - Fix: Drop `usage.tokens` as `stepCount` fallback in `/api/query` (default to 1). Add a log write in `mcpRouter` after the chat loop completes with `stepCount = toolCalls.length`. In `UsageMeter.tsx`, display true step counts or hide the step count column when entries are single-step.

2. **Fallback Literals Cleanup:**
   - The frontend defaults to `"$0.50"` when cost data from the endpoint is missing.
   - The server defaults `monthlyPrice` to `100` (`|| 100`) when Airtable plan price data is absent.
   - Fix: When pricing or limit inputs are missing, display `"—"`, never an invented dollar figure or hardcoded $100 plan price fallback. Also verify whether `Monthly Price` or `Price` is populated on Airtable Plans/Account tables.

3. **Urgent App Deployment Priority:**
   - Cloud Run deployment for `app.fodda.ai` is currently pending behind `gcloud auth login`. Once `gcloud` session is re-authenticated by the user, deploy the App repo immediately to ship the Phase 2 cross-tenant token security fix (`6f2173d`), Coverage Requests table config, and Phase 3 together.

## What to build

1. **Correct `/api/query` Step Logging:**
   - In `/api/query` logging, remove `usage.tokens` fallback for step count. Set `stepCount = 1` for single-step API queries.
2. **Add MCP Multi-Step Logging (`mcpRouter`):**
   - In `mcpRouter` (or wherever the MCP multi-step chat loop finishes), add a log write recording the completed interaction with `stepCount = toolCalls.length` (or loop iteration count).
3. **Usage Meter UI Updates (`UsageMeter.tsx`):**
   - Update `UsageMeter.tsx` to handle true step counts. If all items in a view are single-step (or step count column is non-informative), hide or suppress the step count column/badge rather than displaying artificial multipliers.
4. **Remove Hardcoded Fallbacks:**
   - Remove frontend fallback `"$0.50"` when query cost is undefined/unpopulated. Render `"—"`.
   - Remove server-side `monthlyPrice || 100` fallback in account/usage endpoints. Return `null` or `undefined` when missing so frontend displays `"—"`.
   - Inspect Airtable Plans table schema to verify the actual price field name (`Price` vs `Monthly Price`).

## Where to register

- Logging changes: `/api/query` handler (e.g. `server/routers/queryRouter.ts`) and `server/routers/mcpRouter.ts`.
- UI changes: `frontend/components/UsageMeter.tsx`.
- Pricing router: `server/routers/accountRouter.ts`.

## Definition of Done

- [ ] `/api/query` logs write `stepCount = 1` (never equal to `usage.tokens` multiplier).
- [ ] `mcpRouter` multi-step chat loops write log records with `stepCount = toolCalls.length`.
- [ ] `UsageMeter.tsx` renders true step counts or suppresses step column for single-step queries.
- [ ] Missing pricing inputs display `"—"` in the UI, not `$0.50` or derived numbers based on hardcoded 100.
- [ ] `CHANGELOG.md` updated with verification steps and results.

## Do Not

- Do not use `usage.tokens` multiplier as step count.
- Do not invent dollar fallbacks (`$0.50` or `100`).
- Do not bypass authentication or security checks.

## Files-changed (expected)

- `frontend/components/UsageMeter.tsx`
- `server/routers/queryRouter.ts` (or query logger)
- `server/routers/mcpRouter.ts`
- `server/routers/accountRouter.ts`
- `CHANGELOG.md`
