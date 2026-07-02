# Brief: Quickstart — Token → API Call Terminology Update

**File:** `public/Fodda_Quickstart.md` (also rebuild `dist/Fodda_Quickstart.md`)
**Priority:** High — this is a public-facing document served at `app.fodda.ai/Fodda_Quickstart.md`

---

## What to change

The Quickstart still uses "token" terminology in several places. Update all user-facing "token" references to "API call" to match the platform-wide migration.

### Change 1 — Line 112: Tool table
```diff
-| `get_my_account` | Check your account status and token balance |
+| `get_my_account` | Check your account status and API call balance |
```

### Change 2 — Line 154: Auth flow section
```diff
-The MCP server extracts the key, forwards it to the Fodda API as an `X-API-Key` header, and handles all token metering. Your agent never sees or manages the API key directly.
+The MCP server extracts the key, forwards it to the Fodda API as an `X-API-Key` header, and handles all API call metering. Your agent never sees or manages the API key directly.
```

### Change 3 — Lines 156-158: Token metering section header + content
```diff
-### Token metering
-Every tool call the MCP server makes to the Fodda API costs **1 token**. The server tracks usage against your account's monthly allowance and surfaces warnings when you're running low. When tokens are exhausted, tools return a clear message with a top-up link instead of failing silently.
+### API call metering
+Every tool call the MCP server makes to the Fodda API costs **1 API call**. The server tracks usage against your account's monthly allowance and surfaces warnings when you're running low. When API calls are exhausted, tools return a clear message with options to top up or upgrade instead of failing silently.
```

### Change 4 — Lines 141: MCP prompt cost
```diff
-A single prompt typically chains **6–10 tool calls** — this is why 1 MCP prompt ≈ 8 tokens.
+A single prompt typically chains **6–10 tool calls** — this is why 1 MCP prompt ≈ 8 API calls.
```

### Change 5 — Lines 289-295: Token Usage section (full rewrite)
```diff
-## Token Usage
-- 1 API call = 1 token
-- 1 MCP prompt ≈ 8 tokens (multiple tool calls)
-- Deep dive research = 10 tokens (fast) or 25 tokens (comprehensive)
-- Check balance: Use `get_my_account` tool or visit [app.fodda.ai/account/usage](https://app.fodda.ai/account/usage)
-- Top up: [app.fodda.ai/account/top-up](https://app.fodda.ai/account/top-up)
+## API Call Usage
+- 1 request to the Fodda API = 1 API call
+- 1 MCP prompt ≈ 8 API calls (multiple tool calls per prompt)
+- Deep dive research = 10 API calls (fast) or 25 API calls (comprehensive)
+- Check balance: Use `get_my_account` tool or visit [app.fodda.ai/account](https://app.fodda.ai/account)
+- Top up: [app.fodda.ai/account#top-up](https://app.fodda.ai/account#top-up)
```

### Change 6 — Line 313: Links section
```diff
-- **Top Up Tokens**: [app.fodda.ai/account/top-up](https://app.fodda.ai/account/top-up)
+- **Top Up API Calls**: [app.fodda.ai/account#top-up](https://app.fodda.ai/account#top-up)
```

---

## What NOT to change

- ❌ `X-API-Key` header references — these are the authentication header name, not billing
- ❌ `api_key` URL parameter references — authentication, not billing
- ❌ `sk_live_` key format references — authentication
- ❌ Any code examples or JSON payloads
- ❌ The word "API" when it refers to the REST API itself (not the billing unit)

---

## Deploy

After editing `public/Fodda_Quickstart.md`, rebuild and redeploy so the live URL at `app.fodda.ai/Fodda_Quickstart.md` reflects the changes.
