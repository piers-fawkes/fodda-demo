# Fodda API v1.3 Documentation (2026-03-24)

**Base URL:** `https://api.fodda.ai`

The Fodda API provides programmatic access to curated industry knowledge graphs, 11 real-time supplemental data sources from authoritative institutions, and semantic search over curated statistics. It uses a **Hybrid Search** architecture (Vector + Keyword) to return deterministic, evidence-backed results for grounding LLM agents.

## Access Tiers

| Tier | Auth | Rate Limit | Scope |
|:---|:---|:---|:---|
| **🔓 Public** | No Key | 10 req/min | `POST /v1/psfk/overview` only |
| **🔑 Private** | `X-API-Key` | Credit managed | Full graph access (Search, Traversal, Evidence) |

**Note:** Private endpoints require the `X-API-Key` header for all requests.

---

## 1. Authentication

**Header:** `X-API-Key: YOUR_API_KEY`

Required for all PRIVATE endpoints.

### Error Codes
| Code | Description |
|:---|:---|
| `401 Unauthorized` | Missing or invalid API key |
| `402 Payment Required` | Insufficient credits |
| `403 Forbidden` | Vertical not enabled in your plan |

---

## 2. Public Endpoints

### Get PSFK Macro Overview
LLM-synthesized executive summary of industry trends.

`POST /v1/psfk/overview`

**Body:**
```json
{
  "industry": "retail",
  "sector": "ecommerce",
  "region": "US"  // optional
}
```

**Response:**
```json
{
  "summary": "...",
  "meta_patterns": [...],
  "emerging_signals": [...]
}
```

---

## 3. Private Endpoints (Graph Access)

### Discover Graphs
List available knowledge graphs and their schemas.

`GET /v1/graphs`

### Semantic Search
Hybrid search using vector similarity and keyword matching.

`POST /v1/graphs/:graph_id/search`

**Body:**
```json
{
  "query": "omnichannel retail",
  "limit": 10,
  "use_semantic": true, // default: true
  "filters": {
    "node_types": ["Trend", "Article"]
  }
}
```

### Get Node Details
Retrieve full metadata for a specific node.

`GET /v1/graphs/:graph_id/nodes/:node_id`

### Graph Traversal (Neighbors)
Find connected nodes (e.g., "What signals belong to this Trend?").

`POST /v1/graphs/:graph_id/neighbors`

**Body:**
```json
{
  "seed_node_ids": ["NODE_123"],
  "depth": 1,
  "direction": "out", // or "in"
  "limit": 20
}
```

### Evidence Retrieval
Fetch source articles and case studies backing a trend.

`POST /v1/graphs/:graph_id/evidence`

**Body:**
```json
{
  "for_node_id": "TREND_456",
  "top_k": 5
}
```

### Get Filter Values
Get unique values for a label/property to build dynamic filters.

`GET /v1/graphs/:graph_id/labels/:label/values`

**Example:** `/v1/graphs/retail/labels/Technology/values`

---

## 4. Supplemental Data Endpoints

Supplemental sources provide quantitative, real-time data from authoritative institutions. All endpoints require `X-API-Key`.

### Discovery: List Sources
`GET /v1/supplemental/sources`

Returns all registered supplemental data sources with status, endpoint, and attribution.

### US Economic Data

| Endpoint | Source | Key Params |
|:---|:---|:---|
| `GET /v1/supplemental/census/retail-snapshot` | US Census Bureau | `year`, `include_subcategories`, `include_time_series` |
| `GET /v1/supplemental/census/demographics-snapshot` | US Census Bureau (ACS) | `state`, `category` |
| `GET /v1/supplemental/fred/economic-snapshot` | Federal Reserve (FRED) | `categories` |
| `GET /v1/supplemental/bls/economic-snapshot` | Bureau of Labor Statistics | `categories` |
| `GET /v1/supplemental/bea/spending-snapshot` | Bureau of Economic Analysis | `frequency`, `years`, `categories` |

### Health & Science

| Endpoint | Source | Key Params |
|:---|:---|:---|
| `GET /v1/supplemental/fda/ingredient-safety` | openFDA | `ingredients` |
| `GET /v1/supplemental/fda/recalls` | openFDA | `search`, `limit` |
| `GET /v1/supplemental/clinical-trials/search` | ClinicalTrials.gov | `term`, `status`, `limit` |
| `GET /v1/supplemental/cdc/health-data` | CDC (BRFSS) | `topic`, `location`, `limit` |
| `GET /v1/supplemental/pubmed/research-trends` | NCBI / PubMed | `term`, `years`, `recent` |

### Global & Cultural

| Endpoint | Source | Key Params |
|:---|:---|:---|
| `GET /v1/supplemental/wikipedia/pageviews` | Wikimedia Foundation | `articles`, `period`, `start`, `end` |
| `GET /v1/supplemental/worldbank/global-snapshot` | World Bank | `countries`, `categories` |

**Attribution:** Every response includes `source` and `source_url` fields for citation.

---

## 4b. Statistics Search Endpoint

Semantic search over curated data points (Metric nodes) in the knowledge graph. Returns statistics with their parent trend context, enabling reverse lookup: data point → expert trend.

### Search Statistics
`GET /v1/graphs/:graph_id/statistics`

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| `query` | string | *(required)* | Search text, e.g. "resale market size", "Gen Z spending" |
| `limit` | integer | 10 | Max results (max: 50) |
| `min_score` | float | 0.70 | Minimum cosine similarity threshold (0-1) |
| `include_signals` | boolean | false | Also return Signal nodes (case studies, brand examples) |

**Response shape:**
```json
{
  "statistics": [
    {
      "type": "metric",
      "id": "met_12464",
      "title": "Luxury resale market: USD 38.32B in 2025, projected to reach USD 55.88B by 2029 (9.9% CAGR)",
      "summary": "The statistic places the luxury resale market at...",
      "source_url": "https://www.researchandmarkets.com/reports/6009271/luxury-resale-market-report",
      "publication": "Research and Markets",
      "published_at": "12/16/2025",
      "brands": "Hermès, Rebag",
      "vertical": "retail",
      "relevance_score": 0.846,
      "parent_trend": {
        "trendId": 6221,
        "trendName": "Gated Luxury Resale & Private Access Platforms",
        "trendDescription": "Luxury resale and private-sale operators are using...",
        "signal_score": 37,
        "vertical": "retail,luxury"
      }
    }
  ],
  "count": 1,
  "min_score": 0.70,
  "usage": { "total_billable_units": 1 }
}
```

**Notes:**
- Uses 768-dim vector embeddings on Metric nodes via `metric_summary_index`
- The same Metric may appear multiple times if linked to multiple parent trends
- Costs 1 billable unit per query

---

## 5. Response Envelope

All v1 API responses follow this standard envelope:

```json
{
  "ok": true,
  "data": { ... }, // Endpoint specific data
  "meta": {
    "requestId": "req_123...",
    "version": "v1.1",
    "schema_version": "1.0",
    "deterministic": true,
    "generated_at": "2023-10-27T10:00:00Z"
  },
  "usage": {
    "query_units": 1,
    "total_billable_units": 1
  }
}
```
