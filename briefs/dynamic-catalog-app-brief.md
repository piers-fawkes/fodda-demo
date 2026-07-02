# Brief: Switch App Graph Catalog to Dynamic Airtable Reads

> **To:** Fodda App Agent  
> **From:** Fodda CE Pipeline  
> **Date:** 2026-04-08  
> **Purpose:** Replace the hardcoded graph catalog and suggested questions with a runtime Airtable read so new graphs appear in the app automatically when CE approves them.

---

## The Problem

Today, adding a new Expert Graph to the app requires manual code changes — adding entries to the graph catalog, suggested questions config, and mock data arrays. With 19 graphs and growing, this creates a bottleneck.

## The Solution

Read the graph catalog from the **Graph List Airtable table** at runtime. When CE approves a new graph and updates the Airtable record (setting `graphStatus` to `live`), the app's graph selector picks it up automatically.

## Airtable Source

| Field | Value |
|-------|-------|
| **Base ID** | `appXUeeWN1uD9NdCW` |
| **Table ID** | `tblf8OPpi0F16ofAX` |
| **Table Name** | `Graph List` |
| **PAT env var** | `AIRTABLE_PAT` (⚠️ needs regeneration — current one is stale) |

## Fields Needed by the App

| Airtable Field | What It Provides |
|---------------|-----------------|
| `graphId` | Unique identifier, e.g. `revisionary-studio/2026-macro-trend-graph` |
| `Graph Name` | Display name in graph selector |
| `Headline` | Short description shown below the name |
| `curator` | Expert name (shown in graph card) |
| `curatorUrl` | Link to expert's profile |
| `graphStatus` | `live`, `beta`, `coming-soon` — filter to show only `live` and `beta` |
| `domain` | Topic area tag |
| `topics` | Comma-separated tags for filtering |
| `exampleQueries` | JSON string array of 4-6 suggested questions |

### Expert Headshot

The expert's headshot URL is stored in the **CE Graphs table** (base `appnYwCT6QlDSy5i3`), field `Expert Headshot URL`. Two options:
1. **Option A:** CE copies the headshot URL to the Graph List table (add a new field `headshotUrl`). Recommended — single source.
2. **Option B:** App fetches from CE's Graphs table directly. More complex, requires cross-base access.

We recommend **Option A** — we'll add `headshotUrl` to the Graph List table and populate it during approval.

## Suggested Implementation

### 1. New API endpoint: `GET /api/graph-catalog`

```typescript
app.get('/api/graph-catalog', async (req, res) => {
  try {
    const cached = graphCatalogCache.get();
    if (cached) return res.json({ ok: true, graphs: cached });

    const table = new Airtable({ apiKey: AIRTABLE_PAT })
      .base('appXUeeWN1uD9NdCW')('tblf8OPpi0F16ofAX');

    const records = await table.select({
      filterByFormula: `OR({graphStatus} = 'live', {graphStatus} = 'beta')`,
      fields: ['graphId', 'Graph Name', 'Headline', 'curator', 'curatorUrl', 
               'graphStatus', 'domain', 'topics', 'exampleQueries', 'headshotUrl'],
    }).all();

    const graphs = records.map(r => ({
      id: r.get('graphId'),
      name: r.get('Graph Name') || r.get('graphId'),
      description: r.get('Headline') || '',
      curator: r.get('curator') || '',
      curatorUrl: r.get('curatorUrl') || '',
      status: r.get('graphStatus') || 'coming-soon',
      domain: r.get('domain') || '',
      tags: ((r.get('topics') as string) || '').split(',').map(t => t.trim()).filter(Boolean),
      suggestedQuestions: safeJsonParse(r.get('exampleQueries')),
      curatorAvatar: r.get('headshotUrl') || '',
    })).filter(g => g.id);

    graphCatalogCache.set(graphs, 5 * 60 * 1000); // 5 min cache
    res.json({ ok: true, graphs });
  } catch (err) {
    // Fallback to static catalog
    res.json({ ok: true, graphs: STATIC_GRAPH_CATALOG, source: 'fallback' });
  }
});
```

### 2. Update Graph Selector Component

Replace the hardcoded graph list with a fetch to `/api/graph-catalog`:

```typescript
useEffect(() => {
  fetch('/api/graph-catalog')
    .then(res => res.json())
    .then(data => setGraphs(data.graphs))
    .catch(() => setGraphs(STATIC_FALLBACK_GRAPHS));
}, []);
```

### 3. Update Suggested Questions

Currently hardcoded per-vertical. Replace with the `suggestedQuestions` array from the catalog:

```typescript
const selectedGraph = graphs.find(g => g.id === currentGraphId);
const questions = selectedGraph?.suggestedQuestions || DEFAULT_QUESTIONS;
```

### 4. Keep Static Fallback

Keep existing hardcoded catalog as a fallback in case Airtable is unreachable. The app should never show an empty graph selector.

## What This Enables

```
CE approves new graph → updates Graph List Airtable → 
App shows it in graph selector within 5 minutes. 
Suggested questions auto-populate. Zero code changes.
```

## Definition of Done

- [ ] Graph selector reads from Airtable (with 5-min cache)
- [ ] Suggested questions come from Airtable `exampleQueries` field
- [ ] Expert headshot/avatar displays from Airtable
- [ ] Static fallback works if Airtable is down
- [ ] All 19 existing graphs still appear correctly

## ⚠️ Prerequisite

The `AIRTABLE_PAT` environment variable needs to be regenerated with access to base `appXUeeWN1uD9NdCW`.

## Do Not

- Do not remove the static graph catalog — keep it as fallback
- Do not make the graph selector dependent on Airtable being up
- Do not fetch on every render — cache for 5 minutes
