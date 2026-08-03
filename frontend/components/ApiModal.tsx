
import React from 'react';

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code }) => (
  <div className="relative group">
    <pre className="bg-ink text-cream p-4 rounded-xl text-[11px] font-mono overflow-x-auto border border-line-strong my-3">
      <code>{code.trim()}</code>
    </pre>
    <button
      onClick={() => navigator.clipboard.writeText(code.trim())}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-ink-2 text-cream/60 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
      title="Copy to clipboard"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    </button>
  </div>
);

const MethodBadge: React.FC<{ method: 'GET' | 'POST' }> = ({ method }) => (
  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${method === 'POST' ? 'bg-brand-soft text-brand' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
    {method}
  </span>
);

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownloadDocs = () => {
    const markdownContent = `# Fodda API v1.4 Documentation (2026-04-05)

**Base URL:** \`https://api.fodda.ai\`

The Fodda API provides programmatic access to 20+ curated and expert knowledge graphs, 19 real-time supplemental data sources from authoritative institutions, and semantic search over curated statistics (metrics, quotes, interpretations, and signals). It uses a **Hybrid Search** architecture (Vector + Keyword) to return deterministic, evidence-backed results for grounding LLM agents.

## Access Tiers

| Tier | Auth | Rate Limit | Scope |
|:---|:---|:---|:---|
| **🔓 Public** | No Key | 10 req/min | \`POST /v1/psfk/overview\`, \`GET /v1/graphs/catalog\` |
| **🔑 Private** | \`X-API-Key\` | Credit managed | Full graph access (Search, Traversal, Evidence) |
| **🏢 Enterprise** | OIDC JWT | Flat rate | Full access via enterprise SSO |

**Note:** Private endpoints require the \`X-API-Key\` header or OIDC Bearer token for all requests.

---

## 1. Authentication

### API Key Auth
**Header:** \`X-API-Key: YOUR_API_KEY\`

### Enterprise OIDC Auth
**Header:** \`Authorization: Bearer <JWT>\`

OIDC tokens are validated against configured issuers. Claims map to tenant, scopes, and role.

### Error Codes
| Code | Description |
|:---|:---|
| \`401 INVALID_API_KEY\` | Unknown or mistyped API key |
| \`401 Unauthorized\` | Missing auth credentials |
| \`402 CREDITS_EXHAUSTED\` | Query limit reached (includes renewal date, limit, and admin contact) |
| \`403 FORBIDDEN\` | Vertical or supplemental source not enabled in your plan |
| \`403 GRAPH_DISABLED\` | Graph disabled in user settings |

---

## 2. Public Endpoints

### Get PSFK Macro Overview
LLM-synthesized executive summary of industry trends.

\`POST /v1/psfk/overview\`

**Body:**
\`\`\`json
{
  "industry": "retail",
  "sector": "ecommerce",
  "region": "US"
}
\`\`\`

### Get Graph Catalog (Public)
Public, unauthenticated graph registry with display names, descriptions, and metadata.

\`GET /v1/graphs/catalog\`

Returns the full graph registry from Airtable with 1-hour server-side cache.

---

## 3. Private Endpoints (Graph Access)

### Discover Graphs
List available knowledge graphs, schemas, supplemental sources, plan access info, and account profile.

\`GET /v1/graphs\`

**Response includes:**
- \`graphs[]\` — Available knowledge graphs filtered by plan, with node types, relationship types, and schemas
- \`supplemental_sources[]\` — Available supplemental data sources with access status
- \`plan_info\` — User's accessible graphs, upgrade URL, and plan message
- \`_account\` *(optional)* — Account profile metadata for MCP persona framing

### Semantic Search
Hybrid search using vector similarity and keyword matching.

\`POST /v1/graphs/:graph_id/search\`

**Body:**
\`\`\`json
{
  "query": "omnichannel retail",
  "limit": 10,
  "use_semantic": true,
  "include_evidence": true,
  "include_unverified": false
}
\`\`\`

**Key response fields per result:**
| Field | Description |
|:---|:---|
| \`semantic_score\` | 0–1 raw vector similarity |
| \`relevance_score\` | 0–1 composite (penalizes zero-evidence trends by 0.6×) |
| \`evidence_count\` | Integer count of linked evidence articles |
| \`firstSeen\` | ISO date when trend first appeared |
| \`lastSeen\` | ISO date of most recent evidence |
| \`freshnessDays\` | Days since last evidence |
| \`dataStatus\` | \`TREND_MATCH\` / \`PARTIAL_MATCH\` / \`NO_MATCH\` / \`FALLBACK\` |

**Features:**
- **Geo auto-detection** — Location terms auto-expand and hard-filter results
- **Brand boost** — Brand/entity mentions boost matching results
- **Relevance gate** — Filters out low-score results

### Get Node Details
Retrieve full metadata for a specific node.

\`GET /v1/graphs/:graph_id/nodes/:node_id\`

### Graph Traversal (Neighbors)
Find connected nodes.

\`POST /v1/graphs/:graph_id/neighbors\`

**Body:**
\`\`\`json
{
  "seed_node_ids": ["NODE_123"],
  "depth": 1,
  "direction": "out",
  "limit": 20
}
\`\`\`

### Evidence Retrieval
Fetch source articles and case studies backing a trend.

\`POST /v1/graphs/:graph_id/evidence\`

**Body:**
\`\`\`json
{
  "for_node_id": "TREND_456",
  "top_k": 5
}
\`\`\`

### Get Filter Values
Get unique values for a label/property.

\`GET /v1/graphs/:graph_id/labels/:label/values\`

**Labels:** \`Brand\`, \`Technology\`, \`Audience\`, \`RetailerType\`, \`Location\`, \`Trend\`

### Discover Adjacent Trends
Find semantically similar but not editorially linked trends.

\`GET /v1/graphs/:graph_id/adjacent\`

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| \`node_id\` | string | *(required)* | Seed trend ID |
| \`min_score\` | float | 0.80 | Minimum similarity |
| \`limit\` | integer | 10 | Max results |

### Brand Intelligence (Legacy)
Retrieve brand evidence across all knowledge graphs.

\`POST /api/brand/evidence\`

**Body:**
\`\`\`json
{
  "brandName": "Nike",
  "limit": 10
}
\`\`\`

Returns evidence linked via \`ASSOCIATED_BRAND\`, \`MENTIONS_BRAND\`, and \`FEATURES_BRAND\` relationships.

### Brand Intelligence (v1)
Cross-graph brand analysis: trend footprint, competitive context, co-occurring brands, and cross-graph presence.

\`POST /v1/brand-intelligence/:brandName\`

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| \`maxEvidence\` | integer | 10 | Max evidence articles per graph |
| \`limit\` | integer | 50 | Max total results |

---

## 4. Supplemental Data Sources

20+ real-time supplemental data sources from authoritative institutions — including US Census, Federal Reserve, BLS, CDC, World Bank, PubMed, and more — are available via the Fodda MCP integration. See [fodda.ai/api](https://www.fodda.ai/api) for MCP setup.

Every supplemental response includes \`source\` and \`source_url\` for citation.

---

## 5. Statistics & Insights Search

Semantic search over curated data points (Metric, Quote, Interpretation, and Signal nodes) in the knowledge graph.

### Search Statistics
\`GET /v1/graphs/:graph_id/statistics\`

| Param | Type | Default | Description |
|:---|:---|:---|:---|
| \`query\` | string | *(required)* | Search text |
| \`limit\` | integer | 10 | Max results (max: 50) |
| \`min_score\` | float | 0.70 | Cosine similarity threshold |
| \`include_signals\` | boolean | false | Include Signal nodes |
| \`types\` | string | \`metric\` | Comma-separated: metric, quote, interpretation |

**Evidence types:**
| Type | Description |
|:---|:---|
| \`metric\` | Quantitative data points (market sizes, growth rates) |
| \`quote\` | Expert/industry voice quotes with speaker attribution |
| \`interpretation\` | Analytical perspectives from opinion/analysis articles |
| \`signal\` | Brand case studies and real-world implementations |

Each result includes \`parent_trend\` context for reverse lookup.

---

## 6. Copilot Adapter Endpoints

Optimized for Microsoft Copilot Studio and M365 RAG workflows.

| Endpoint | Method | Description |
|:---|:---|:---|
| \`/copilot/get_evidence\` | POST | Trend-level supporting articles |
| \`/copilot/get_statistics\` | POST | Quantitative search for metrics, quotes, signals |

---

## 7. Response Envelope

All v1 responses follow this standard structure:

\`\`\`json
{
  "requestId": "req_123...",
  "version": "v1.1",
  "schema_version": "1.0",
  "billing_version": "2026-Q1",
  "graph_version": "2026-Q1",
  "deterministic": true,
  "generated_at": "2026-04-05T12:00:00Z",
  "graphs": [...],
  "supplemental_sources": [...],
  "plan_info": {...},
  "_account": {...}
}
\`\`\`

---

## 8. Knowledge Graph Architecture

### Graph Types
| Type | Examples |
|:---|:---|
| **Curated** | retail, beauty, sports, fashion |
| **Expert** | sic, ce-design, mlb-sponsorship, etc. |
| **Baseline** | pew (Pew Research Center) |
| **Community** | User-contributed Pattern Graphs |

### Node Types
\`Trend\`, \`Article\`, \`Brand\`, \`Location\`, \`Sector\`, \`Industry\`, \`Signal\`, \`Metric\`, \`Quote\`, \`Interpretation\`

### Relationship Types
\`EVIDENCE_FOR\`, \`IS_CASE_STUDY_OF\`, \`RELATED_TO\`, \`SEMANTICALLY_SIMILAR\`, \`ASSOCIATED_BRAND\`, \`MENTIONS_BRAND\`, \`FEATURES_BRAND\`, \`IN_LOCATION\`, \`PART_OF_SECTOR\`, \`PART_OF_INDUSTRY\`

### Embeddings
- Model: \`gemini-embedding-001\` (768-dim)
- Indexes: \`trend_summary_index\`, \`article_summary_index\`, \`metric_summary_index\`, \`quote_summary_index\`, \`interpretation_summary_index\`, \`signal_summary_index\`

---

## 9. Centralized Graph Registry

Canonical graph registry stored in Airtable. PSFK and expert pipelines auto-update metadata after every successful Neo4j sync.

- \`GET /v1/graphs\` — Authenticated, plan-filtered graph list
- \`GET /v1/graphs/catalog\` — Public, full catalog with 1h cache
`;

    const blob = new Blob([markdownContent.trim()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Fodda_API_Documentation_v1.4_2026-04-05.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border border-line flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-line flex justify-between items-center bg-cream shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-soft p-2 rounded-lg">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h3 className="font-serif italic text-xl text-ink">Fodda API v1.4 Documentation</h3>
          </div>
          <button onClick={onClose} className="p-2 text-ink-3 hover:text-ink transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto text-ink-2 leading-relaxed text-sm scrollbar-hide">
          {/* Base URL & Overview */}
          <section>
            <h4 className="eyebrow mb-4">Base Configuration</h4>
            <div className="bg-paper p-4 rounded-xl border border-line space-y-2">
              <p className="text-xs"><span className="font-bold text-ink">Base URL:</span> <code className="bg-cream px-1.5 py-0.5 rounded text-ink-2 font-mono border border-line">https://api.fodda.ai</code></p>
              <p className="text-xs text-ink-3">Hybrid Search architecture (Vector + Keyword) for deterministic, evidence-backed results. 20+ knowledge graphs, 19 supplemental data sources, and semantic statistics search across metrics, quotes, interpretations, and signals.</p>
            </div>
          </section>

          {/* Access Tiers */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Access Tiers</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-paper rounded-xl border border-line">
                <p className="text-sm mb-1"><span className="font-bold text-ink">Public</span></p>
                <p className="text-[10px] text-ink-3">No API key • 10 req/min</p>
                <p className="text-[10px] text-ink-3 mt-1"><code className="bg-cream px-1 py-0.5 rounded text-ink-2 font-mono border border-line">POST /v1/psfk/overview</code></p>
                <p className="text-[10px] text-ink-3 mt-0.5"><code className="bg-cream px-1 py-0.5 rounded text-ink-2 font-mono border border-line">GET /v1/graphs/catalog</code></p>
              </div>
              <div className="p-4 bg-paper rounded-xl border border-line border-brand/20 shadow-sm shadow-brand/5">
                <p className="text-sm mb-1"><span className="font-bold text-ink">Private</span></p>
                <p className="text-[10px] text-ink-3"><code className="bg-cream px-1 py-0.5 rounded text-ink-2 font-mono border border-line">X-API-Key</code> required</p>
                <p className="text-[10px] text-ink-3 mt-1">Credit managed • Full graph access</p>
              </div>
              <div className="p-4 bg-paper rounded-xl border border-line">
                <p className="text-sm mb-1"><span className="font-bold text-ink">Enterprise</span></p>
                <p className="text-[10px] text-ink-3">OIDC JWT • Flat rate</p>
                <p className="text-[10px] text-ink-3 mt-1">Full access via enterprise SSO</p>
              </div>
            </div>
          </section>

          {/* Authentication */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Authentication</h4>
            <div className="space-y-3 mb-4">
              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-1">API Key Auth</p>
                <CodeBlock code={`X-API-Key: YOUR_API_KEY`} />
              </div>
              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-1">Enterprise OIDC Auth</p>
                <CodeBlock code={`Authorization: Bearer <JWT>`} />
                <p className="text-[10px] text-ink-3 mt-1">OIDC tokens validated against configured issuers. Claims map to tenant, scopes, and role.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                <p className="text-xs font-bold text-red-700">401</p>
                <p className="text-[10px] text-red-600">Missing/invalid key</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <p className="text-xs font-bold text-amber-700">402</p>
                <p className="text-[10px] text-amber-600">Credits exhausted</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
                <p className="text-xs font-bold text-orange-700">403</p>
                <p className="text-[10px] text-orange-600">Forbidden / disabled</p>
              </div>
            </div>
          </section>

          {/* Public Endpoints */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Public Endpoints</h4>
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/v1/psfk/overview</h5>
                </div>
                <p className="text-ink-3 text-xs mb-3">LLM-synthesized executive summary of industry trends.</p>
                <CodeBlock code={`POST /v1/psfk/overview\n{"industry":"retail","sector":"ecommerce","region":"US"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="GET" />
                  <h5 className="font-bold text-ink">/v1/graphs/catalog</h5>
                </div>
                <p className="text-ink-3 text-xs">Public graph registry with display names, descriptions, and metadata. 1h server cache.</p>
              </div>
            </div>
          </section>

          {/* Private Endpoints */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Private Endpoints (Graph Access)</h4>
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="GET" />
                  <h5 className="font-bold text-ink">/v1/graphs</h5>
                </div>
                <p className="text-ink-3 text-xs mb-2">Discover graphs, schemas, supplemental sources, plan info, and account profile.</p>
                <div className="p-3 bg-paper rounded-xl border border-line">
                  <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-1">_account Persona Framing</p>
                  <p className="text-[10px] text-ink-3">Returns optional <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">_account</code> with <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">isProfessionalServices</code>, <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">jobTitle</code>, <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">companyName</code> for MCP persona framing.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/search</h5>
                </div>
                <p className="text-ink-3 text-xs mb-3">Hybrid search (vector + keyword) with trend lifecycle fields.</p>
                <CodeBlock code={`POST /v1/graphs/psfk/search\n{"query":"omnichannel retail","limit":10,"use_semantic":true,"include_evidence":true}`} />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="p-2 bg-paper rounded-lg border border-line">
                    <p className="text-[9px] text-ink-4 uppercase tracking-widest">semantic_score</p>
                    <p className="text-[10px] text-ink-3">0–1 raw vector similarity</p>
                  </div>
                  <div className="p-2 bg-paper rounded-lg border border-line">
                    <p className="text-[9px] text-ink-4 uppercase tracking-widest">relevance_score</p>
                    <p className="text-[10px] text-ink-3">0–1 composite score</p>
                  </div>
                  <div className="p-2 bg-paper rounded-lg border border-line">
                    <p className="text-[9px] text-ink-4 uppercase tracking-widest">firstSeen / lastSeen</p>
                    <p className="text-[10px] text-ink-3">Trend lifecycle dates</p>
                  </div>
                  <div className="p-2 bg-paper rounded-lg border border-line">
                    <p className="text-[9px] text-ink-4 uppercase tracking-widest">freshnessDays</p>
                    <p className="text-[10px] text-ink-3">Days since last evidence</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="GET" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/nodes/:node_id</h5>
                </div>
                <p className="text-ink-3 text-xs">Retrieve full metadata for a specific node.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/neighbors</h5>
                </div>
                <p className="text-ink-3 text-xs mb-3">Graph traversal — find connected nodes.</p>
                <CodeBlock code={`POST /v1/graphs/psfk/neighbors\n{"seed_node_ids":["NODE_123"],"depth":1,"direction":"out","limit":20}`} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/evidence</h5>
                </div>
                <p className="text-ink-3 text-xs mb-3">Fetch source articles backing a trend.</p>
                <CodeBlock code={`POST /v1/graphs/psfk/evidence\n{"for_node_id":"TREND_456","top_k":5}`} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="GET" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/labels/:label/values</h5>
                </div>
                <p className="text-ink-3 text-xs">Dynamic filter values — Brand, Technology, Audience, Location, Trend.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="GET" />
                  <h5 className="font-bold text-ink">/v1/graphs/:graph_id/adjacent</h5>
                </div>
                <p className="text-ink-3 text-xs">Discover semantically similar but not editorially linked trends.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/v1/brand-intelligence/:brandName</h5>
                </div>
                <p className="text-ink-3 text-xs mb-3">Cross-graph brand analysis — trend footprint, competitive context, co-occurring brands.</p>
                <CodeBlock code={`POST /v1/brand-intelligence/Nike?maxEvidence=10&limit=50`} />
                <p className="text-[10px] text-ink-4 italic mt-1">Query params: maxEvidence (default 10), limit (default 50).</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/api/brand/evidence</h5>
                </div>
                <p className="text-ink-3 text-xs">Legacy brand evidence lookup across all knowledge graphs.</p>
              </div>
            </div>
          </section>

          {/* Supplemental Data Sources */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Supplemental Data Sources</h4>
            <div className="p-4 bg-paper rounded-xl border border-line">
              <p className="text-xs text-ink-2 leading-relaxed">20+ real-time supplemental data sources from authoritative institutions — including US Census, Federal Reserve, BLS, CDC, World Bank, PubMed, and more — are available via the <span className="font-bold text-ink">Fodda MCP integration</span>.</p>
              <p className="text-[10px] text-ink-4 mt-3">See <a href="https://www.fodda.ai/api" className="text-brand underline hover:text-brand-dark transition-colors" target="_blank" rel="noopener noreferrer">fodda.ai/api</a> for MCP setup instructions.</p>
              <p className="text-[10px] text-ink-4 italic mt-2">Every supplemental response includes <code className="text-ink-3 font-mono">source</code> and <code className="text-ink-3 font-mono">source_url</code> for citation.</p>
            </div>
          </section>

          {/* Statistics & Insights Search */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Statistics & Insights Search</h4>
            <p className="text-xs text-ink-3 mb-3">Semantic search over curated data points — Metric, Quote, Interpretation, and Signal nodes. Returns results with parent trend context.</p>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <h5 className="font-bold text-ink">/v1/graphs/:graph_id/statistics</h5>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 bg-paper rounded-lg border border-line">
                  <p className="text-[9px] text-ink-4 uppercase tracking-widest">query</p>
                  <p className="text-[10px] text-ink-3">Search text (required)</p>
                </div>
                <div className="p-2 bg-paper rounded-lg border border-line">
                  <p className="text-[9px] text-ink-4 uppercase tracking-widest">limit</p>
                  <p className="text-[10px] text-ink-3">Max results (default: 10)</p>
                </div>
                <div className="p-2 bg-paper rounded-lg border border-line">
                  <p className="text-[9px] text-ink-4 uppercase tracking-widest">types</p>
                  <p className="text-[10px] text-ink-3">metric, quote, interpretation</p>
                </div>
                <div className="p-2 bg-paper rounded-lg border border-line">
                  <p className="text-[9px] text-ink-4 uppercase tracking-widest">include_signals</p>
                  <p className="text-[10px] text-ink-3">Include Signal nodes (default: false)</p>
                </div>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line mt-3">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-2">Evidence Types</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-lg border border-line">
                    <p className="text-[10px] font-bold text-ink">metric</p>
                    <p className="text-[9px] text-ink-3">Market sizes, growth rates</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-line">
                    <p className="text-[10px] font-bold text-ink">quote</p>
                    <p className="text-[9px] text-ink-3">Expert voices with attribution</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-line">
                    <p className="text-[10px] font-bold text-ink">interpretation</p>
                    <p className="text-[9px] text-ink-3">Analytical perspectives</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-line">
                    <p className="text-[10px) font-bold text-ink">signal</p>
                    <p className="text-[9px] text-ink-3">Brand case studies</p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-ink-4 italic mt-3">Returns results with <code className="text-ink-4 font-mono">relevance_score</code>, <code className="text-ink-4 font-mono">parent_trend</code> context, and source attribution. 1 billable unit per query.</p>
            </div>
          </section>

          {/* Copilot Adapter Endpoints */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Copilot Adapter Endpoints</h4>
            <p className="text-xs text-ink-3 mb-3">Optimized for Microsoft Copilot Studio and M365 RAG workflows.</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/copilot/get_evidence</h5>
                </div>
                <p className="text-ink-3 text-xs">Trend-level supporting articles.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MethodBadge method="POST" />
                  <h5 className="font-bold text-ink">/copilot/get_statistics</h5>
                </div>
                <p className="text-ink-3 text-xs">Quantitative search for metrics, quotes, and signals.</p>
              </div>
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 mt-4 shadow-sm shadow-teal-500/5">
                <p className="text-[9px] font-bold text-teal-700 uppercase tracking-widest mb-1">Copilot Studio Tip</p>
                <p className="text-[10px] text-teal-700 leading-relaxed italic">Use your API Key as a <span className="font-bold">Bearer Token</span> in Copilot Studio. The model will automatically cite returned sources.</p>
              </div>
            </div>
          </section>

          {/* Response Envelope */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Response Envelope</h4>
            <p className="text-xs text-ink-3 mb-3">All v1 responses follow this standard structure:</p>
            <CodeBlock code={`{\n  "requestId": "req_123...",\n  "version": "v1.1",\n  "schema_version": "1.0",\n  "billing_version": "2026-Q1",\n  "graph_version": "2026-Q1",\n  "deterministic": true,\n  "generated_at": "2026-04-05T12:00:00Z",\n  "graphs": [...],\n  "supplemental_sources": [...],\n  "plan_info": {...},\n  "_account": {...}\n}`} />
          </section>

          {/* Knowledge Graph Architecture */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Knowledge Graph Architecture</h4>
            <div className="space-y-4">
              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-2">Graph Types</p>
                <div className="space-y-1 text-[11px] text-ink-3">
                  <p><span className="font-bold text-ink">Curated</span> — retail, beauty, sports, fashion</p>
                  <p><span className="font-bold text-ink">Expert</span> — sic, ce-design, mlb-sponsorship, etc.</p>
                  <p><span className="font-bold text-ink">Baseline</span> — pew (Pew Research Center)</p>
                  <p><span className="font-bold text-ink">Community</span> — User-contributed Pattern Graphs</p>
                </div>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-2">Node Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Trend', 'Article', 'Brand', 'Location', 'Sector', 'Industry', 'Signal', 'Metric', 'Quote', 'Interpretation'].map(t => (
                    <span key={t} className="px-2 py-0.5 bg-cream text-ink-2 text-[10px] rounded-full border border-line">{t}</span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-2">Relationship Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {['EVIDENCE_FOR', 'IS_CASE_STUDY_OF', 'RELATED_TO', 'SEMANTICALLY_SIMILAR', 'ASSOCIATED_BRAND', 'MENTIONS_BRAND', 'FEATURES_BRAND', 'IN_LOCATION', 'PART_OF_SECTOR', 'PART_OF_INDUSTRY'].map(r => (
                    <span key={r} className="px-2 py-0.5 bg-cream text-ink-2 text-[10px] rounded-full border border-line font-mono">{r}</span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="text-[9px] font-bold text-ink-4 uppercase tracking-widest mb-2">Embeddings</p>
                <p className="text-[10px] text-ink-3"><span className="font-bold text-ink">Model:</span> <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">gemini-embedding-001</code> (768-dim)</p>
                <p className="text-[10px] text-ink-4 mt-1">Indexes: trend, article, metric, quote, interpretation, signal</p>
              </div>
            </div>
          </section>

          {/* Graph Registry */}
          <section className="pt-6 border-t border-line">
            <h4 className="eyebrow mb-4">Centralized Graph Registry</h4>
            <div className="p-3 bg-paper rounded-xl border border-line">
              <p className="text-[10px] text-ink-3">Canonical registry stored in Airtable. PSFK and expert pipelines auto-update <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">lastUpdated</code> and <code className="bg-cream px-1 rounded text-ink-2 font-mono border border-line">publishedDate</code> after every successful Neo4j sync.</p>
              <div className="mt-2 space-y-1 text-[11px]">
                <p><code className="text-ink-2 bg-cream px-1 rounded font-mono border border-line">GET /v1/graphs</code> — Authenticated, plan-filtered list</p>
                <p><code className="text-ink-2 bg-cream px-1 rounded font-mono border border-line">GET /v1/graphs/catalog</code> — Public catalog with 1h cache</p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 bg-ink flex justify-between items-center shrink-0">
          <p className="text-[10px] text-cream/40 font-bold uppercase tracking-widest px-4">Fodda API v1.4 • 2026-04-05</p>
          <div className="flex space-x-3">
            <button
              onClick={handleDownloadDocs}
              className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-brand-dark transition-colors flex items-center shadow-lg shadow-brand/20"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download .MD
            </button>
            <button onClick={onClose} className="px-6 py-2 bg-cream/10 text-cream rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-cream/20 transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
