# Reasoning Mode — Blended Architecture

## Overview

The Reasoning Mode feature adds a three-way selector to the graph chat interface, allowing users to compare different intelligence retrieval and synthesis approaches side-by-side without leaving the UI.

## Three Modes

| Mode | Data Source | Synthesis | Evidence Panel |
|------|-----------|-----------|----------------|
| **PSFK Graph** (default) | Neo4j knowledge graph via Fodda API | Gemini structured JSON synthesis | ✅ Trends + Articles |
| **Gemini Only** | Google Search grounding (live web) | Gemini free-form synthesis | ❌ Empty |
| **Blended** | Neo4j graph + Google Search grounding | Gemini synthesis with graph context + web freshness | ✅ Trends + Articles |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User Query                                                     │
│  ┌──────────────────┐                                           │
│  │ ReasoningMode     │  'graph' | 'gemini' | 'blended'          │
│  └────────┬─────────┘                                           │
│           │                                                     │
│     ┌─────▼──────────────────────────────────────────────┐      │
│     │            App.tsx :: handleSendMessage             │      │
│     │                                                    │      │
│     │  if mode === 'graph':                              │      │
│     │    1. dataService.retrieve() → graph data          │      │
│     │    2. generateResponse() → structured synthesis    │      │
│     │                                                    │      │
│     │  if mode === 'gemini':                             │      │
│     │    1. generateGeminiSearchResponse() → web search  │      │
│     │       (skips graph retrieval entirely)             │      │
│     │                                                    │      │
│     │  if mode === 'blended':                            │      │
│     │    1. dataService.retrieve() → graph data          │      │
│     │    2. generateBlendedResponse()                    │      │
│     │       → sends graph context + query to Gemini      │      │
│     │         with Google Search grounding               │      │
│     └────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ Graph API    │  │ /api/gemini-search│  │ /api/generate   │   │
│  │ (Fodda API)  │  │ (Google Search   │  │ (Gemini JSON    │   │
│  │              │  │  grounding)      │  │  synthesis)     │   │
│  └──────────────┘  └──────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## File Map

### Shared Layer
- **`shared/types.ts`** — `ReasoningMode` type (`'graph' | 'gemini' | 'blended'`) and `reasoningMode` field on `Message` interface

### Server Layer
- **`server/index.ts`** — `POST /api/gemini-search` endpoint
  - Accepts `{ query, vertical, graphContext? }`
  - Uses `@google/genai` SDK with `tools: [{ googleSearch: {} }]` for Google Search grounding
  - If `graphContext` is provided (blended mode), it's injected into the system instruction as primary evidence
  - Returns `{ ok, answer, groundingMetadata, suggestedQuestions }`

### Frontend Service Layer
- **`frontend/services/geminiService.ts`** — Three exported functions:
  - `generateResponse()` — Existing. Graph mode. Calls `/api/generate` with structured JSON schema
  - `generateGeminiSearchResponse(query, vertical)` — New. Gemini mode. Calls `/api/gemini-search` without graph context
  - `generateBlendedResponse(query, vertical, retrievedData)` — New. Blended mode. Builds graph context string via `formatContext()`, sends to `/api/gemini-search` with that context

### UI Layer
- **`frontend/components/ReasoningModeSelector.tsx`** — New component. Segmented pill selector with three options, each with an SVG icon. Props: `currentMode`, `onChange`, `disabled`
- **`frontend/components/ChatInterface.tsx`** — Updated:
  - Renders `ReasoningModeSelector` in the header bar (hidden for Baseline vertical)
  - Shows reasoning method in metadata bar (`Graph retrieval` / `Gemini Search` / `Graph + Gemini`)
  - Displays colored mode badge on each assistant message: `GRAPH` (green), `GEMINI` (blue), `BLEND` (amber)
  - Updates processing indicator: `QUERYING_GRAPH` / `QUERYING_GEMINI` / `BLENDING`
- **`frontend/App.tsx`** — Updated:
  - `reasoningMode` state (default: `'graph'`)
  - `handleSendMessage` branches on mode (see architecture above)
  - Chat clears when mode changes (same as vertical switch) for clean comparison
  - Stamps `reasoningMode` onto each `Message` for display
  - Evidence drawer only auto-opens when there's actual evidence

## Orthogonality with API/MCP Mode

The existing `TEST MODE: API | MCP` toggle in the sidebar is **orthogonal** to Reasoning Mode:

- **API/MCP** controls *how* graph data is fetched (direct Fodda API call vs MCP protocol)
- **Reasoning Mode** controls *whether and how* graph data is used

| Reasoning Mode | Uses Graph Retrieval? | API/MCP Applies? |
|---------------|----------------------|-----------------|
| Graph         | ✅ Yes               | ✅ Yes          |
| Gemini        | ❌ No (skipped)      | ❌ N/A          |
| Blended       | ✅ Yes (first step)  | ✅ Yes          |

## Server Endpoint Detail

### `POST /api/gemini-search`

```typescript
// Request
{
  query: string,        // User's question
  vertical: string,     // e.g. "Retail", "Beauty"
  graphContext?: string  // Optional — graph signals for blended mode
}

// Response
{
  ok: boolean,
  answer: string,             // Markdown-formatted analysis
  groundingMetadata?: any,    // Google Search grounding sources
  suggestedQuestions: string[]
}
```

**System instruction** includes the vertical context and formatting requirements. When `graphContext` is provided (blended mode), it's appended to the system instruction with instructions to use it as the primary evidence base while supplementing with web search.

**Gemini config:**
- Model: `gemini-2.0-flash`
- Temperature: `0.3`
- Max output tokens: `8192`
- Tools: `[{ googleSearch: {} }]` — enables Google Search grounding

## UI Behavior

1. Mode selector appears in the chat header next to "GRAPH SANDBOX" label
2. Selector is **disabled while processing** a query (prevents mid-flight mode changes)
3. Switching modes **clears the chat** so users can re-ask the same question for clean comparison
4. Each response carries a **colored badge**: `GRAPH` (emerald), `GEMINI` (blue), `BLEND` (amber)
5. Mode selector is **hidden on Baseline vertical** (which uses different data retrieval patterns)
6. Evidence panel remains populated for Graph and Blended modes, stays empty for Gemini Only

## Testing Notes

- **Gemini Only** mode works independently of Fodda API credits (only needs `GEMINI_API_KEY`)
- **Graph** and **Blended** modes require valid Fodda API credits for graph retrieval
- The `GEMINI_API_KEY` is loaded from environment variables on the server side
- The Fodda API key comes from the user's account record in Airtable
