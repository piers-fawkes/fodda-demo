# Brief: Web Chat Sandbox Bearer Auth & Error Sanitization (App Agent)

**Target Repo:** `piers-fawkes/fodda-demo` (`Fodda` / `app.fodda.ai`)  
**Agent:** `app-agent`  
**Priority:** P1 (Companion to Fodda MCP v1.46.67)  
**Execution:** `/build-from-brief "briefs/Brief — Web Chat Sandbox Bearer Auth & Error Sanitization (App Agent).md"`  

---

## 1. Context & Background

In `fodda-mcp` v1.46.67, the MCP server was updated to accept standard `Authorization: Bearer <apiKey>` headers on `/mcp`, support internal service bypass (`X-Internal-Key`, HMAC `X-Fodda-Signature`), resolve user identity via `X-User-Email` and `X-User-Id`, and execute stateless JSON-RPC calls.

To ensure client hygiene and eliminate API keys from HTTP access URLs in Cloud Run logs, `app.fodda.ai` should stop connecting via legacy query strings (`/mcp?api_key=...&user_id=...`) and instead pass modern headers via `StreamableHTTPClientTransport`.

Additionally, if any raw JSON-RPC error occurs, the chat interface should display a user-friendly message rather than dumping raw JSON into the chat bubble.

---

## 2. Requirements

### 1. Modernize MCP Client Transport in `server/services/mcpChatService.ts`
- **In `mcpChat()` (around line 108):**
  - Replace:
    ```ts
    const mcpUrl = `${MCP_BASE_URL}/mcp?api_key=${encodeURIComponent(apiKey)}&user_id=${encodeURIComponent(userEmail)}`;
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    ```
  - With:
    ```ts
    const transport = new StreamableHTTPClientTransport(new URL(`${MCP_BASE_URL}/mcp`), {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-User-Email': userEmail,
          'X-Fodda-Session-Kind': 'internal-test'
        }
      }
    });
    ```
- **In `listMcpTools()` (around line 542):**
  - Modernize transport similarly to pass `Authorization: Bearer ${apiKey}` and `X-User-Email: userEmail` in `requestInit.headers`.

### 2. Modernize `server/services/svgConstellationService.ts` (around line 52)
- Pass `Authorization: Bearer ${MCP_INTERNAL_KEY}` and `X-User-Id: system-svg-gen` in `requestInit.headers` of `StreamableHTTPClientTransport` instead of query parameters.

### 3. Sanitize Chat Error Bubble in `frontend/App.tsx` (around line 943)
- In the `catch` handler for sandbox / expert chat:
  - If `err.message` begins with `{` or contains `"jsonrpc"`, sanitize it to:
    ```ts
    let displayError = err.message || "Failed to connect to research agent.";
    if (typeof displayError === 'string' && (displayError.trim().startsWith('{') || displayError.includes('"jsonrpc"'))) {
      try {
        const parsed = JSON.parse(displayError);
        displayError = parsed.error?.message || "Unable to connect to research agent. Please try again.";
      } catch {
        displayError = "Unable to connect to research agent. Please try again.";
      }
    }
    ```
  - Render `displayError` instead of the raw JSON string.

---

## 3. Files Expected to Change
- `server/services/mcpChatService.ts`
- `server/services/svgConstellationService.ts`
- `frontend/App.tsx`
- `CHANGELOG.md` (in `Fodda`)

---

## 4. Definition of Done
- `npm run build` passes in `Fodda`.
- Starting chat sandbox on `app.fodda.ai` connects to MCP without query-string API keys in URLs.
- Any simulated connection error renders a friendly markdown message in the UI rather than raw JSON.
