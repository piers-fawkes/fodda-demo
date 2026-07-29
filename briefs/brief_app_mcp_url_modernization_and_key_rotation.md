# Brief: App MCP URL Modernization & API Key Rotation

**Date:** 2026-07-29  
**For:** API Agent / App Agent (`Fodda` / `Fodda API` repo)  
**Priority:** High  
**Relates to:** `app.fodda.ai` (`frontend/components/ProfilePage.tsx`, `frontend/components/AccountPortal.tsx`, `frontend/components/Dashboard.tsx`, `frontend/components/AdminPortal.tsx`, `functions/v1/user.ts`)

---

## 1. Objective & Context

We recently modernized MCP URL provisioning across the Fodda platform to use short token-resolved connection URLs (`https://mcp.fodda.ai/c/:token`) and standard HTTP Bearer headers (`Authorization: Bearer sk_live_...`), moving away from exposed query parameters (`api_key=...&user_id=...`).

However, the user dashboard app (`app.fodda.ai` in `/Fodda`) is still displaying legacy query-param URLs on:
1. **Profile → Overview**: Renders `https://mcp.fodda.ai/mcp?api_key=...` in the MCP URL card.
2. **Connections Tabs** (Claude Connector, ChatGPT Connector, Gemini / Vertex, Perplexity, Copilot, Notion, MCP Server): Render hardcoded query strings in Quick Connect buttons, copy fields, and CLI commands.

Additionally, users currently have no self-service mechanism in the app to rotate their API key if compromised.

---

## 2. Requirements

### Part 1: Modernize MCP URL Display Across `app.fodda.ai`

1. **Profile → Overview (`frontend/components/ProfilePage.tsx`)**:
   - Update `mcpFullUrl` and `mcpMaskedUrl` to default to the token-resolved URL (`https://mcp.fodda.ai/c/${mcpConn.token}`) when `mcpConn.token` is available.
   - For SSE clients (Cursor, Desktop), display `https://mcp.fodda.ai/sse` with `Authorization: Bearer <key>` header instructions rather than raw query params.

2. **Connections Tabs (`frontend/components/AccountPortal.tsx`)**:
   - **Claude Connector**:
     - Quick Connect link ("Add Fodda to Claude"): Use tokenized connector URL `https://mcp.fodda.ai/c/${token}` in the Claude custom connector deep link.
     - Claude Code CLI tab: Update terminal command snippet from `https://mcp.fodda.ai/mcp?api_key=...&user_id=...` to:
       ```bash
       claude mcp add --transport http fodda "https://mcp.fodda.ai/c/:token"
       ```
       or
       ```bash
       claude mcp add --transport sse fodda "https://mcp.fodda.ai/sse" --header "Authorization: Bearer sk_live_..."
       ```
   - **ChatGPT Connector**: Update Developer Mode URL field and Responses API code samples to use `/c/:token` or Bearer headers.
   - **Gemini / Vertex, Copilot, Perplexity, Notion, MCP Server tabs**: Audit and replace all `${MCP_ENDPOINT}?api_key=...&user_id=...` fallbacks with tokenized `/c/:token` or clean Bearer header syntax.

3. **Dashboard & Admin Portal (`Dashboard.tsx`, `AdminPortal.tsx`)**:
   - Update fallback MCP URL string building to use `https://mcp.fodda.ai/c/:token`.

---

### Part 2: Self-Service API Key Rotation

1. **Backend Endpoint (`functions/v1/user.ts` or `functions/v1/account.ts`)**:
   - Add `POST /v1/user/api-key/rotate` (authenticated via session/token).
   - Generates a new `sk_live_...` key for the account, invalidates the previous key in Firestore, updates active connection tokens, and returns `{ ok: true, apiKey: "sk_live_new...", token: "..." }`.

2. **Frontend UI (`ProfilePage.tsx` & `AccountPortal.tsx` -> API Access tab)**:
   - Add a **"Rotate API Key"** button next to the API Key / Connection settings.
   - Show a modal confirmation warning:
     > *"Rotating your API key will revoke your current key immediately. Active token connections (`/c/:token`) will update on next resolution. Are you sure?"*
   - On confirmation, call `POST /v1/user/api-key/rotate`, update local account state, and copy the new key to clipboard with a success toast.

---

## 3. Verification Plan

1. **Local App Build**: Run `npm run build` in `/Fodda` to verify TypeScript compilation.
2. **Visual Audit**: Load `app.fodda.ai` locally and verify:
   - Profile → Overview displays `https://mcp.fodda.ai/c/:token`.
   - Claude Connector tab displays updated Quick Connect and Claude Code CLI command.
   - Key rotation modal triggers cleanly and updates the displayed key and connection URL.
