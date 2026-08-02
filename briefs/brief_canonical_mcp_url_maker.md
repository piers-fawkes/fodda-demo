# Brief — Canonical MCP Connection-URL Maker (single source of truth)

> **For:** App/API Agent (this repo, `/Fodda`) — primary. Website + Sales agents consume the contract defined here (separate thin-client briefs).
> **Status:** Build. Root-cause fix for MCP-URL drift.
> **Why:** The MCP connection URL is currently hand-rolled in ~60+ places across 4 repos (app, Website, Sales, MCP). When the scheme moved from `?api_key=&user_id=` to the opaque token form `/c/<token>`, every surface drifted independently — some tokenized, most didn't, SSE variants are inconsistent. This brief establishes **one** maker that owns the URL format, so the next scheme change is a one-function edit.
> **Decisions (Piers, 2026-07-24):** (1) **One canonical maker**, owned by the app/API backend. (2) **Keep legacy as a fallback** — emit `/c/<token>` for streamable-HTTP; keep legacy `?api_key=` for SSE and existing pasted URLs. Do **not** sunset legacy in this brief.
> **Related:** `Fodda MCP/briefs/Brief MCP Identity and URL Scheme.md` (the scheme design; this brief assigns it a code owner, which it never had).

---

## Background (verified state)

- **Token scheme is live** in Fodda MCP + Website: MCP route `app.all(['/mcp', '/c/:token'])` (`Fodda MCP/src/index.ts:606`) resolves a token by calling the Website `GET https://www.fodda.ai/api/mcp-tokens/<token>`, which reads Airtable **base `appXUeeWN1uD9NdCW` / table `tblGWh6XpdEZxw8AE` / field `mcpConnectionToken`** and returns `{ email, apiKey, name, analystId }`.
- **This repo already reads/writes that exact base/table** — `server/constants.ts:2` (`BASE_ID = 'appXUeeWN1uD9NdCW'`), `:3` (`USERS_TABLE = 'tblGWh6XpdEZxw8AE'`). So minting a token here resolves through the existing resolver with **no new infra**.
- **SSE has NO token route.** `Fodda MCP/src/index.ts:743` (`app.get('/sse')`) is legacy-only (`?api_key=&user_id=`). There is no `/c/<token>` SSE equivalent. **SSE URLs must stay legacy** until/unless the MCP server adds a token SSE route (out of scope here).

---

## 1. The canonical maker (build this)

### 1a. Internal function — `buildMcpConnection(email)`

One function, single source of truth for URL format. Suggested home: `server/services/mcpConnectionService.ts`.

```ts
// The ONLY place in the codebase that constructs an MCP connection URL.
export interface McpConnection {
  ok: boolean;
  hasActiveKey: boolean;
  alreadyExists: boolean;
  mcpUrl: string | null;        // streamable HTTP, token scheme: https://mcp.fodda.ai/c/<token>
  sseUrl: string | null;        // SSE, LEGACY scheme (no token route exists): .../sse?api_key=&user_id=
  claudeConnectorUrl: string | null;
  token: string | null;
}

export async function buildMcpConnection(email: string): Promise<McpConnection> {
  // 1. Look up user record in BASE_ID / USERS_TABLE by lowercased email.
  // 2. Resolve the active sk_live_ API key (existing getActiveKeysForAccount path).
  //    If none: return { ok:true, hasActiveKey:false, ...nulls } — caller shows guidance, never a broken URL.
  // 3. Mint-once: read mcpConnectionToken; if absent, token = randomBytes(24).toString('base64url')
  //    and PATCH it back onto THIS record (same base/table). If present, REUSE it (never re-mint —
  //    re-minting rotates the token and breaks URLs already handed out).
  // 4. Build:
  const mcpUrl = `https://mcp.fodda.ai/c/${token}`;
  const sseUrl = `https://mcp.fodda.ai/sse?api_key=${apiKey}&user_id=${encodeURIComponent(email)}`; // LEGACY on purpose
  const claudeConnectorUrl =
    `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(mcpUrl)}`;
  return { ok:true, hasActiveKey:true, alreadyExists, mcpUrl, sseUrl, claudeConnectorUrl, token };
}
```

Rules encoded in this ONE place: token scheme for HTTP, legacy for SSE, mint-once-reuse, base/table invariant, no-key handling. Nobody else concatenates an MCP URL string.

**Identity-boundary guardrail (keeps Phase 2 open, costs nothing now):** the token is the identity handle — it resolves to a record. Do **not** add any *new* email-as-identity coupling while migrating. Where a stable identity key is needed, prefer the existing **`clerkUserId`** already on the User record (`server/routers/webhookRouter.ts:143`) over email or Airtable record ids. This keeps the maker a clean foundation without building anything speculative.

### 1b. Public endpoint — `POST /api/account/mcp-connection`

Thin HTTP wrapper so the other services (Website, Sales) can call the maker without duplicating it.

- **Auth:** internal only — reuse the `trial-provision` internal-bypass check (`adminSecret === FODDA_INTERNAL_API_KEY` or `x-fodda-internal-key` header). Rate-limit per IP like the other account routes.
- **Body:** `{ email }` (optionally `accountId`).
- **Returns:** the `McpConnection` object from `buildMcpConnection`.
- When `hasActiveKey:false`, return `200` with the flag + a `message` the caller can surface (point the user to sign in / provision), never a fabricated URL.

---

## 2. Migrate this repo's own surfaces to call the maker

Replace every hand-rolled MCP URL in `/Fodda` with a call to `buildMcpConnection` (server-side) or the endpoint (frontend, via an authed tRPC/proxy route — do **not** expose `FODDA_INTERNAL_API_KEY` to the browser):

- `server/routers/accountRouter.ts` — `trial-provision` returns `mcpUrl` at **:2016, :2035, :2137**. Have it call `buildMcpConnection` and return `{ mcpUrl, sseUrl, claudeConnectorUrl }`. (This is what **Sales** consumes — fixing it here fixes Sales' upstream too.)
- `server/services/emailTemplates.ts` — ~14 spots (`:202, :204, :232, :255-256, :280, :310, :324, :569-570, :1009-1010, :1243-1244, :1286-1287`). Pass a prebuilt `McpConnection` into the template data instead of building strings inside the template. Keep SSE lines (they stay legacy — that's correct).
- `frontend/components/ProfilePage.tsx:144-146`, `Dashboard.tsx:431/442`, `AccountPortal.tsx:521/543/1078/1429-1430`, `AdminPortal.tsx:631/855` — fetch the connection from a server route; render `mcpUrl` (token) as the primary "copy" value, `sseUrl` (legacy) as the labelled SSE option. Remove the inline `?api_key=…&user_id=…` construction.
- `server/services/mcpChatService.ts:104/474`, `svgConstellationService.ts:51` — these are **internal service-to-service** calls using an internal key / `user_id=system-*`, not user connection URLs. **Leave as legacy** (they don't go through the token store); just add a comment noting they're intentionally internal.

---

## 3. Contract for other repos (they consume, don't rebuild)

Website and Sales get thin-client briefs that say: **call `POST /api/account/mcp-connection`** and render what it returns. They must not hand-roll `/c/<token>` themselves. (Interim: the Sales agent's in-flight `getConnectionTokenUrl` helper mints locally into the same Airtable field — acceptable short-term because base/table match, but it should converge to calling this endpoint so there's truly one maker.)

The Website **resolver** (`/api/mcp-tokens/:token`) and the Website's existing `lookupExpertMcpCreds` mint stay where they are for now (the MCP server already points at them). Minting identically from two places is safe because both use the same 24-byte-base64url token in the same field — but note it as future consolidation (single minter).

---

## Acceptance

1. `buildMcpConnection` is the only place in `/Fodda` that builds an `mcp.fodda.ai/c/` or `mcp.fodda.ai/mcp?` string (grep confirms no other `mcp.fodda.ai/mcp?api_key` in user-facing code paths; internal services excepted and commented).
2. `POST /api/account/mcp-connection { email }` (internal auth) returns a working `mcpUrl` of the form `.../c/<token>`; `curl` of that token URL does not 401/404; a random token 401s.
3. `trial-provision` now returns a `/c/<token>` `mcpUrl`; Sales (which calls it) surfaces the token URL unchanged.
4. Dashboard/Profile/Account/Admin "copy MCP URL" shows the token URL; SSE field still shows legacy and still connects via an SSE client.
5. Mint-once: calling the endpoint twice for the same user returns the **same** token.
6. No-active-key user → endpoint returns `hasActiveKey:false` + guidance; UI shows a sign-in/provision prompt, not a broken URL.

## What NOT to touch
- The MCP server and the Website `/api/mcp-tokens/:token` resolver — correct as-is.
- SSE URL format (stays legacy) and the internal service-to-service URLs in `mcpChatService`/`svgConstellationService`.
- Legacy `?api_key=` acceptance — this brief keeps it as a fallback; do not sunset it here.

## Explicitly out of scope — Phase 2 (do NOT design or build here)
The scheme design doc (`Fodda MCP/briefs/Brief MCP Identity and URL Scheme.md`) proposes a stable internal `user_id` and OAuth 2.1. **Do not fold these in.** Reason: this repo **already uses Clerk** as its identity/auth system — `clerkUserId` is on the User record and Clerk webhooks sync users into Airtable (`webhookRouter.ts`). So:
- A new hand-rolled "internal user_id" would duplicate/collide with `clerkUserId` — Clerk already provides the stable key.
- Custom MCP OAuth would overlap Clerk, which can act as an OAuth IdP.

Phase 2, if/when picked up, is therefore a **"reconcile the token/identity model with Clerk"** investigation (can `clerkUserId` back the token record? can Clerk be the MCP OAuth provider?), **not** a from-scratch identity scheme. Capture it there; keep it out of this Phase-1 build.
