---
id: FODDA-QUICKSTART
title: Fodda Quickstart Guide
version: 2.0.0
compliance: RFC-2119
owner: Fodda / PSFK
created: 2026-06-08
---

# Fodda — Agent-Friendly Setup Guide

> [!NOTE]
> For AI agents (Claude, Codex, Cursor, etc.): This guide contains everything needed to connect to Fodda's knowledge graph infrastructure via MCP or REST API. Feed this entire document to your agent.

---

## 1. Setup & Credentials

### RECORD: UserCredentials
- api_key: String — "sk_live_..." (from your welcome email)
- standard_mcp_url: String — `https://mcp.fodda.ai/mcp?api_key=YOUR_KEY&user_id=YOUR_EMAIL` (For Claude Web / Notion / Gemini)
- sse_mcp_url: String — `https://mcp.fodda.ai/sse?api_key=YOUR_KEY&user_id=YOUR_EMAIL` (For Desktop / Cursor / Windsurf)
- dashboard_url: "https://app.fodda.ai"
- api_docs_url: "https://app.fodda.ai/knowledge/api-docs"

### TOKEN: AccessModes
- **Web Application (app.fodda.ai)**: Interactive UI to explore graphs and read evidence.
- **Agent Integrations (MCP)**: One-click integrations for Claude, Cursor, Windsurf, Notion, and Microsoft 365 Copilot.
- **REST API**: For custom applications, search engines, and pipelines.
- **Custom Chat Connector**: Connect Fodda MCP directly to Lovable/Cursor during app build phase for real-time context.
- **REST App Connector**: final app integration using standard REST calls. Copy-Paste Prompt:
  ```text
  Integrate the Fodda REST API. Base URL: https://api.fodda.ai/v1. Auth: Bearer token [INSERT_YOUR_SK_TRIAL_KEY]. Please ingest the full API schema from https://[fodda-website-domain]/openapi.json to understand the available endpoints. I need a dashboard that fetches and displays recent case studies using GET /graphs/{graph_id}/search.
  ```

### SEQUENCE: ClaudeWebSetup
1. Copy the standard MCP URL: `https://mcp.fodda.ai/mcp?api_key=YOUR_API_KEY&user_id=YOUR_EMAIL`
2. Open Claude.ai.
3. Navigate to **Settings** → **Connectors** → **Add custom connector**.
4. Paste the URL. Leave OAuth fields **blank**.

### SEQUENCE: DesktopConnection
1. Copy the SSE MCP URL: `https://mcp.fodda.ai/sse?api_key=YOUR_API_KEY&user_id=YOUR_EMAIL`
2. **Claude Code (CLI)**:
   ```bash
   claude mcp add --transport sse fodda "https://mcp.fodda.ai/sse?api_key=YOUR_API_KEY&user_id=YOUR_EMAIL"
   ```
3. **Claude Desktop Config**: Add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "fodda": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-http-sse", "https://mcp.fodda.ai/sse?api_key=YOUR_API_KEY&user_id=YOUR_EMAIL"]
       }
     }
   }
   ```
4. **Cursor / Windsurf**: Connect using SSE protocol. Leave headers blank.

---

## 2. Platform Capabilities & Pipeline

### TOKEN: AvailableTools

| Tool | Description |
|------|-------------|
| `list_graphs` | List all knowledge graphs you can access |
| `search_graph` | Search for trends, signals, and case studies |
| `get_evidence` | Get source articles and evidence for a trend |
| `search_insights` | Find expert quotes and qualitative analysis |
| `search_statistics` | Find curated data points and metrics |
| `get_adjacent_trends` | Discover related trends across graphs |
| `search_domain_graphs` | Search all curated domain graphs in one call |
| `search_expert_graphs` | Search all expert specialist graphs in one call |
| `search_filtered` | Semantic search with metadata filters (category, date, brand, geography) |
| `get_supplemental_context` | Unified access to live institutional data sources |
| `deep_dive_research` | Autonomous deep-dive research with cited analysis |
| `research_chat` | Multi-turn conversational research with session memory |
| `get_my_account` | Check your account status and API call balance |

- note: `get_supplemental_context` routes internally to 22+ live institutional sources (economic, demographic, market, food systems).

### SEQUENCE: ToolOrchestration
When you give the agent a high-level goal, it autonomously chains tools:
1. **Discover** — Classifies query intent and queries `list_graphs` or `search_domain_graphs`.
2. **Retrieve** — Searches selected graph(s) using `search_graph` or `search_filtered`.
3. **Ground** — Fetches primary citations using `get_evidence` and `search_statistics`.
4. **Contextualize** — Adds macroeconomic context using `get_supplemental_context`.
5. **Expand** — Walks adjacent possibilities using `get_adjacent_trends`.

---

## 3. REST API Reference

> [!NOTE]
> API access requires a Studio or Enterprise plan. Auth header format: `X-API-Key: YOUR_API_KEY`

### RECORD: APIEndpoints
- **GET /v1/graphs/catalog** — Public registry. No auth.
- **POST /v1/psfk/overview** — Synthesized industry overview. Input: `{"industry": "retail", "sector": "ecommerce", "region": "US"}`. No auth.
- **GET /v1/graphs** — Discover available knowledge graphs.
- **POST /v1/graphs/:graph_id/search** — Hybrid semantic + keyword search. Input: `{"query": "...", "limit": 10, "use_semantic": true, "include_evidence": true}`.
- **GET /v1/graphs/:graph_id/nodes/:node_id** — Node metadata lookup.
- **POST /v1/graphs/:graph_id/neighbors** — Graph traversal (max depth: 2). Input: `{"seed_node_ids": ["NODE_123"], "depth": 1, "direction": "out", "limit": 20}`.
- **POST /v1/graphs/:graph_id/evidence** — Retrieve evidence articles. Input: `{"for_node_id": "TREND_456", "top_k": 5}`.
- **GET /v1/graphs/:graph_id/statistics** — Search metrics, quotes, and signals. Parameters: `query`, `limit`, `types` (metric, quote, interpretation, signal).
- **GET /v1/graphs/:graph_id/adjacent** — cosine similarity search.
- **GET /v1/graphs/:graph_id/labels/:label/values** — Get dynamic filters.
- **POST /v1/supplemental/context** — Query parallel institutional data. Input: `{"query": "...", "domain": "food", "graph_ids": ["retail"]}`.
- **POST /v1/brand-intelligence/:brandName** — Cross-graph brand footprint profiling.
- **POST /v1/search/domain** | **POST /v1/search/expert** | **POST /v1/search/report** — Type-scoped search.
- **POST /v1/search/filtered** — Search with metadata post-filters.
- **POST /v1/research/deep-dive** — long-running autonomous research.
- **POST /v1/research/chat** — persistence sessions.
- **POST /v1/research/schedules** — manage scheduled briefings.

---

## 4. Payment & Billing

### TOKEN: PaymentChannels
- **Plans (Stripe)**: Monthly subscription at app.fodda.ai for researchers.
- **Lava PAYG**: Metered pay-as-you-go billing for developers.
- **API Call Top-Up**: One-time inline Stripe Checkout when credit is low.
- **SPT Auth**: Shared Payment Tokens (Stripe agentic commerce). Zero-onboarding per-request payment.

### RULE: CreditExhaustionRouting
- Developer accounts MUST be routed to Lava PAYG.
- Standard dashboard users MUST be routed to the plans page.
- MCP users MUST be presented with an inline Stripe Checkout session link.
- API responses SHALL include an `agent_checkout` block containing the Stripe checkout URL.

### RULE: ZeroOnboardingAgentAccess
- Autonomous agents MAY authenticate via OIDC or Shared Payment Tokens (SPT).
- Send header: `X-Stripe-SPT: spt_xxx`. The system charges the Stripe Link wallet directly without an account.

---

## 5. Best Practices & Mandates

### RULE: QueryBestPractices
- The agent SHOULD write thematic, conversational queries (e.g. "How are retailers removing friction from the buying journey?").
- The agent SHOULD search first, then deep-dive using evidence and statistics.
- The agent SHOULD validate findings using `get_supplemental_context`.

### TOKEN: SuggestedAgentMandates
1. **Topic & trend research**: "Goal: Provide a comprehensive overview of AI-assisted customer service in physical retail based on Fodda's retail intelligence."
2. **URL as Fodda prompt**: "Goal: Read https://www.retaildive.com/news/walmart-pilot-beauty-store-associate-role/818927/ and cross-reference its themes against Fodda's retail intelligence to identify validations, gaps, and contradictions."
3. **Upload and compare**: "Goal: [Drop in PDF] Analyze this document and compare its themes against Fodda's retail intelligence."
4. **Brand intelligence**: "Goal: Build a comprehensive brand tracker profile for Lululemon, detailing their market position, search trends, and strategic direction according to Fodda's graphs."
5. **Live economic snapshots**: "Goal: Synthesize current Google Trends and Federal Reserve economic snapshots regarding consumer spending on luxury goods."
6. **Adjacent trends**: "Goal: Brainstorm adjacent territories connected to the rise of wellness commerce using Fodda's graph connections."
7. **Deep research**: "Goal: Conduct deep research on the future of beauty retail in the US, specifically projecting where the category is heading in the next 18 months."
8. **Consult analyst**: "Goal: Consult Fodda's retail design analyst to identify the biggest structural shift happening in physical retail right now."
