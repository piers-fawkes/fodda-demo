# Brief — Test Bench MCP-Only (Kill Direct Mode, Demote the Graph Dropdown)

**Repo:** Fodda App
**Date:** 2026-08-14
**Requested by:** Piers
**Execution:** `/build-from-brief briefs/brief_testbench_mcp_only.md`

## Context

The Test Bench (`/sandbox`) currently carries two execution pipelines and a mandatory-feeling
graph selector, which together teach users the wrong mental model ("pick the right graph before
asking"). MCP users on Claude never see that model — the agent starts at the tools and fans out —
so the sandbox is not an honest demo of the product.

Current state (verified in code 2026-08-14):

- `frontend/App.tsx:284` — `isMcpMode` defaults to `true`; MCP agentic mode is already the
  default path. Queries go to `dataService.mcpChat(...)` → `POST /api/mcp/chat`.
- `frontend/App.tsx:922–994` — legacy **Direct API mode** branch in `handleSendMessage`:
  `dataService.retrieve(text, currentVertical, ...)` + `generateResponse(...)`, hard-scoped to
  one graph, with a special case for `Vertical.Baseline` (survey data, 200 rows, segment params).
- `frontend/App.tsx:2050–2058` — `DevToolsDrawer` exposes the `isMcpMode` toggle
  (`onToggleMcpMode`).
- `frontend/App.tsx:133` — `currentVertical` defaults to `Vertical.Retail`, so even in MCP mode
  every sandbox query silently sends `vertical: "retail"` as a hint unless the user picks
  something else. There is no "all graphs" option in the UI.
- `frontend/App.tsx:1686–1830` — sandbox header renders a searchable, categorized dropdown of
  the full graph catalog labeled "Graph:", with copy "Compose a query against any live graph."
- `server/routers/mcpRouter.ts:96` — the server already handles the unscoped case:
  `vertical || 'all'` flows into `mcpChat(...)` and into Airtable query logging
  (`graphId`, `taxonomy_node`). **No server change is needed.**
- The expert-chat view (`activeView === 'expert-chat'`) shares `handleSendMessage` and has its
  own Expert dropdown (`App.tsx` ~1449–1560). Expert chat legitimately needs a selected
  expert/graph.
- The Query Library was hidden from the UI on 2026-08-14 (see CHANGELOG); its "Try in Test
  Bench" graph-targeting is no longer an entry point. Remaining graph-targeted entry points:
  Coverage Map cards and `?graph=` referral/deep links (`App.tsx:647`).

## What to build

Make the Test Bench MCP-only, with graph selection demoted from a required scope to an
**optional focus hint**.

1. **Remove Direct API mode from the sandbox flow.**
   - Delete the `isMcpMode` state and make `handleSendMessage` unconditionally take the MCP
     path. Remove the now-dead direct branch (`dataService.retrieve` + `generateResponse` call
     inside `handleSendMessage`) and the `isMcpMode`/`onToggleMcpMode` props from
     `DevToolsDrawer` (keep the transaction viewer itself — it already renders MCP tool-call
     traces).
   - Remove `dataService.retrieve` / `generateResponse` imports from `App.tsx` if nothing else
     uses them after the deletion. Do not delete them from `shared/dataService.ts` or the
     service layer — other surfaces/tests may use them.
   - **Baseline decision:** the `Vertical.Baseline` special case only exists in the direct
     branch. Route Baseline through MCP like everything else. If smoke-testing shows the MCP
     agent cannot answer a Baseline survey question (e.g. an age-group segment stat), STOP and
     flag to Piers rather than silently keeping the direct pipeline.

2. **Default to unscoped queries.**
   - The sandbox's effective default vertical must be `'all'` (no focus), not
     `Vertical.Retail`. `mcpChat` may pass `'all'` explicitly or omit vertical — the server
     treats falsy as `'all'` either way.
   - Expert-chat is unaffected: it continues to set the vertical from the selected expert.

3. **Demote the graph dropdown to an optional "Focus" control.**
   - Keep the existing searchable dropdown component, but:
     - Relabel from "Graph:" to "Focus (optional)" with default display "All graphs".
     - Add an "All graphs (recommended)" row at the top that clears focus back to `'all'`.
     - When a focus is set (via dropdown, Coverage Map card, or `?graph=` deep link), show it
       as a dismissible chip/state so the user can clear it back to All graphs in one click.
   - When focus is set, keep passing it as `vertical` to `mcpChat` — it is a hint the agent
     may use, not a hard scope (this is already how the MCP path treats it).
   - Update header copy: "Compose a query against any live graph." → copy that reflects
     tools-first behavior, e.g. "Ask anything — the agent picks the right graphs and tools."
     (Exact wording is the builder's call; do not mention tokens/SPT in any user-visible copy.)

4. **Keep graph-targeted entry points working as focus-setters.**
   - `?graph=` deep links and Coverage Map "launch in Test Bench" clicks set the focus hint
     (and show the dismissible chip) instead of implying a hard scope. No behavior change
     beyond the UI framing.

5. **Leave expert-chat's Expert dropdown untouched.** It is a different interaction (choosing
   whom to talk to, not scoping retrieval).

## Where to register

- No new routes, tools, or server registrations. This is a frontend-only change to the
  existing `/sandbox` view in `frontend/App.tsx` (+ `DevToolsDrawer.tsx` prop cleanup, and any
  entry-point components that set a graph when launching the sandbox, e.g.
  `CoverageMapPage.tsx` copy if it promises per-graph querying).

## Definition of Done

- `npx vite build` compiles clean.
- Sending a query in the Test Bench with no focus selected returns an MCP agentic answer; the
  DevTools drawer shows the tool-call fan-out and the Airtable question log records
  `graphId: 'all'`, `source: 'mcp'`.
- Selecting a focus graph passes that `vertical` to `/api/mcp/chat`; clearing the chip returns
  to `'all'`.
- `?graph=<id>` deep link opens the sandbox with the focus chip set to that graph.
- A Baseline survey question through the sandbox returns a sensible MCP answer (or the
  Baseline gap is flagged to Piers — see decision above).
- Expert chat still works end-to-end with its Expert dropdown.
- No reference to `isMcpMode` remains in the codebase.
- `CHANGELOG.md` updated with a real verification result (not "should work").

## Do Not

- Do not touch the Fodda MCP repo or the `/api/mcp/chat` request/response contract.
- Do not delete `QueryLibraryPage.tsx` or the `/api/prompts` endpoint (library is hidden, not
  removed).
- Do not remove or modify the expert-chat Expert dropdown.
- Do not delete `retrieve`/`generateResponse` from the shared service layer — only their use
  in the sandbox send path.
- Do not surface tokens/SPT or any machine pricing in user-visible copy.

## Files-changed (expected)

- `frontend/App.tsx` — remove `isMcpMode` + direct branch; default vertical to `'all'` for
  sandbox; dropdown → optional Focus control; header copy.
- `frontend/components/DevToolsDrawer.tsx` — drop `isMcpMode`/`onToggleMcpMode` props.
- `frontend/components/CoverageMapPage.tsx` — copy tweak only if it promises per-graph scoping.
- `CHANGELOG.md` — entry with verification.
