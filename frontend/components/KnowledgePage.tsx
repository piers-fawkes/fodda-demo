import React, { useState } from 'react';

export type KnowledgeTab = 'api-docs' | 'reliability' | 'security';

interface KnowledgePageProps {
  activeTab: KnowledgeTab;
  onTabChange?: (tab: KnowledgeTab) => void;
}

// ─── Code Block helper ───
const CodeBlock: React.FC<{ code: string; colorClass?: string }> = ({ code, colorClass = 'text-green-400' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <pre className="bg-ink border border-ink-2 rounded-xl p-4 font-mono text-[11px] overflow-x-auto leading-relaxed shadow-xl">
        <code className={colorClass}>{code.trim()}</code>
      </pre>
      <button
        onClick={handleCopy}
        className={`absolute top-3 right-3 p-1.5 rounded-md transition-all hover:text-white ${copied ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
        title="Copy"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
        )}
      </button>
    </div>
  );
};

const MethodBadge: React.FC<{ method: 'GET' | 'POST' }> = ({ method }) => (
  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${method === 'POST' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
    {method}
  </span>
);

// ─── API Documentation Content ───
const ApiDocsContent: React.FC = () => {
  const handleDownloadDocs = () => {
    const markdownContent = `# Fodda API v1.6 Documentation\n\n**Base URL:** \`https://api.fodda.ai\`\n\nSee full docs at app.fodda.ai → Knowledge → API Documentation`;
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Fodda_API_Documentation_v1.6.md'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Base Config */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <h3 className="eyebrow mb-0">Base URL</h3>
        <CodeBlock code="https://api.fodda.ai" colorClass="text-purple-300" />
        <p className="text-xs text-ink-2 leading-relaxed">Hybrid Search architecture (Vector + Keyword) for deterministic, evidence-backed results. Includes 22 supplemental data sources, unified context endpoint, and semantic statistics search.</p>
      </section>

      {/* Access Tiers */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <h3 className="eyebrow mb-0">Access Tiers</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-cream rounded-xl border border-line space-y-2">
            <p className="text-sm font-bold text-ink">Public</p>
            <p className="text-[10px] text-ink-3">No API key • 10 req/min</p>
            <p className="text-[10px] text-ink-3 mt-1"><code className="bg-paper px-1 py-0.5 rounded text-ink-2 font-mono border border-line">POST /v1/psfk/overview</code> only</p>
          </div>
          <div className="p-5 bg-cream rounded-xl border border-line space-y-2">
            <p className="text-sm font-bold text-ink">Private</p>
            <p className="text-[10px] text-ink-3"><code className="bg-paper px-1 py-0.5 rounded text-ink-2 font-mono border border-line">X-API-Key</code> required • Credit managed</p>
            <p className="text-[10px] text-ink-3 mt-1">Full graph access (Search, Traversal, Evidence)</p>
          </div>
        </div>
      </section>

      {/* Authentication */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <h3 className="eyebrow mb-0">Authentication</h3>
        <CodeBlock code="X-API-Key: YOUR_API_KEY" colorClass="text-amber-300" />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-center">
            <p className="text-xs font-bold text-red-700">401</p>
            <p className="text-[10px] text-red-600">Missing/invalid key</p>
          </div>
          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-center">
            <p className="text-xs font-bold text-amber-700">402</p>
            <p className="text-[10px] text-amber-600">Insufficient credits</p>
          </div>
          <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 text-center">
            <p className="text-xs font-bold text-orange-700">403</p>
            <p className="text-[10px] text-orange-600">Vertical not in plan</p>
          </div>
        </div>
      </section>

      {/* Core Endpoints */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-6 shadow-sm">
        <h3 className="eyebrow mb-0">Core Endpoints</h3>
        <div className="space-y-6 divide-y divide-line [&>div:not(:first-child)]:pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1"><MethodBadge method="GET" /><h5 className="font-bold text-ink">/v1/graphs</h5></div>
            <p className="text-ink-3 text-xs">List available knowledge graphs and schemas.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1"><MethodBadge method="POST" /><h5 className="font-bold text-ink">/v1/graphs/:graph_id/search</h5></div>
            <p className="text-ink-3 text-xs mb-2">Hybrid search (vector + keyword).</p>
            <CodeBlock code={`POST /v1/graphs/psfk/search\n{\n  "query": "omnichannel retail",\n  "limit": 10,\n  "use_semantic": true\n}`} colorClass="text-green-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1"><MethodBadge method="POST" /><h5 className="font-bold text-ink">/v1/graphs/:graph_id/neighbors</h5></div>
            <p className="text-ink-3 text-xs mb-2">Graph traversal — find connected nodes.</p>
            <CodeBlock code={`POST /v1/graphs/psfk/neighbors\n{\n  "seed_node_ids": ["NODE_123"],\n  "depth": 1,\n  "direction": "out",\n  "limit": 20\n}`} colorClass="text-green-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1"><MethodBadge method="POST" /><h5 className="font-bold text-ink">/v1/graphs/:graph_id/evidence</h5></div>
            <p className="text-ink-3 text-xs mb-2">Fetch source articles backing a trend.</p>
            <CodeBlock code={`POST /v1/graphs/psfk/evidence\n{\n  "for_node_id": "TREND_456",\n  "top_k": 5\n}`} colorClass="text-green-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1"><MethodBadge method="GET" /><h5 className="font-bold text-ink">/v1/graphs/:graph_id/statistics</h5></div>
            <p className="text-ink-3 text-xs">Semantic search over curated data points (Metric nodes).</p>
          </div>
        </div>
      </section>

      {/* Supplemental */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <h3 className="eyebrow mb-0">Supplemental Context</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1"><MethodBadge method="POST" /><h5 className="font-bold text-ink">/v1/supplemental/context</h5></div>
          <p className="text-ink-3 text-xs mb-2">Unified access to 22 authoritative institutional sources (FRED, Census, BLS, PubMed, Google Trends, Amazon, Wikipedia, etc.). Routes and queries relevant sources in parallel based on domain context.</p>
          <CodeBlock code={`POST /v1/supplemental/context\n{\n  "query": "plant-based protein growth",\n  "domain": "food",\n  "graph_ids": ["retail"]\n}`} colorClass="text-green-400" />
        </div>
      </section>

      {/* Response Envelope */}
      <section className="p-6 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <h3 className="eyebrow mb-0">Response Envelope</h3>
        <CodeBlock code={`{\n  "ok": true,\n  "data": { ... },\n  "meta": {\n    "requestId": "req_123...",\n    "version": "v1.1",\n    "search_path": "vector",\n    "deterministic": true\n  },\n  "rows": [\n    { "trendName": "...", "_score": 0.82 }\n  ],\n  "usage": {\n    "total_billable_units": 1\n  }\n}`} colorClass="text-purple-300" />
      </section>

      <div className="pt-4 pb-2">
        <button onClick={handleDownloadDocs} className="px-6 py-2.5 bg-ink text-paper hover:bg-black text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download OpenAPI spec (.MD)
        </button>
      </div>
    </div>
  );
};

// ─── Reliability Content ───
const ReliabilityContent: React.FC = () => (
  <div className="max-w-3xl space-y-8">
    <section className="p-6 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
      <h2 className="font-serif italic text-xl text-ink">Deterministic Mode</h2>
      <p className="text-xs text-ink-2 leading-relaxed">Deterministic Mode ensures that every response generated by the AI is strictly grounded in the knowledge graph. If the required information is not present in the graph, the system will not "hallucinate" or generate synthetic facts.</p>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">Technical Safeguards</h3>
      <ul className="space-y-4">
        {[
          { title: 'NO_MATCH Fallback', desc: 'When graph retrieval returns zero-confidence matches, the API returns a structured NO_MATCH code.' },
          { title: 'Evidence-First Prompting', desc: 'The orchestration layer is instructed to use only the provided evidence nodes from the graph.' },
          { title: 'Source Attribution', desc: 'Every fact in a deterministic response is linked to a permanent ArticleID or TrendID.' },
        ].map(item => (
          <li key={item.title} className="flex gap-3 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
            <div>
              <span className="font-bold text-ink text-xs">{item.title}</span>
              <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">How it Works</h3>
      <div className="space-y-3">
        {['Query Parsing & Vertical Identification', 'Directed Graph Traversal in Neo4j', 'Strict Synthesis using Filtered Evidence Nodes'].map((step, i) => (
          <div key={i} className="flex items-center gap-3 bg-cream p-3 rounded-xl border border-line">
            <span className="w-6 h-6 flex items-center justify-center bg-paper rounded-lg text-[10px] font-bold text-ink border border-line shadow-sm">{i + 1}</span>
            <span className="text-xs font-semibold text-ink-2 leading-none">{step}</span>
          </div>
        ))}
      </div>
    </section>
    <p className="text-[10px] text-ink-4 font-bold uppercase tracking-widest pl-1">Integrity Engine v1.6.0</p>
  </div>
);

// ─── Security Content ───
const SecurityContent: React.FC = () => (
  <div className="max-w-3xl space-y-8">
    <section className="p-6 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
      <h2 className="font-serif italic text-xl text-ink">Security & Hardening</h2>
      <p className="text-xs text-ink-2 leading-relaxed">Fodda is a privacy-first intelligence layer. We provide deterministic access to proprietary Knowledge Graphs, ensuring that AI responses are grounded in verified data, not synthetic generation.</p>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">Where Google Fits (and Doesn't)</h3>
      <p className="text-xs text-ink-2 leading-relaxed">Fodda is hosted on Google Cloud Platform, but Google does not have access to your queries or data.</p>
      <div className="overflow-hidden border border-line rounded-xl shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-cream border-b border-line text-ink font-bold uppercase text-[9px] tracking-wider">
              <th className="py-3 px-4">Access Method</th>
              <th className="py-3 px-4">Google Involvement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-paper text-ink-2 leading-relaxed">
            <tr>
              <td className="py-3.5 px-4 font-bold text-ink align-top">API</td>
              <td className="py-3.5 px-4 align-top">None. Queries go directly to Neo4j.</td>
            </tr>
            <tr>
              <td className="py-3.5 px-4 font-bold text-ink align-top">App / MCP</td>
              <td className="py-3.5 px-4 align-top">Lightweight orchestration agent via Gemini, receives task instructions only.</td>
            </tr>
            <tr>
              <td className="py-3.5 px-4 font-bold text-ink align-top">BYOK (Roadmap)</td>
              <td className="py-3.5 px-4 align-top">Enterprise clients supply their own Gemini API key.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">Technical Hardening</h3>
      <ul className="space-y-4">
        {[
          { title: 'Strict Authentication & API Key Handling', desc: 'All API access requires a valid X-API-Key. Raw keys are never stored — SHA-256 hashed into fingerprints.' },
          { title: 'Identity Separation', desc: 'Audit logs distinguish between System Identity (API Keys) and Human Identity (User interactions).' },
          { title: 'Structured Audit Logging', desc: 'Tracking of requestId, latency, and graphId.' },
          { title: 'Prompt Injection Prevention', desc: 'The API rejects request bodies containing prompt, messages, or history fields at schema level.' },
          { title: 'DDoS Protection', desc: 'Hard server-side limits on query depth, expansion rates, and result counts. Rate limiting on public endpoints.' },
          { title: 'Role-Based Access Control', desc: 'Admin, viewer, and public roles. Accounts restricted to licensed data verticals.' },
        ].map(item => (
          <li key={item.title} className="flex gap-3 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
            <div>
              <span className="font-bold text-ink text-xs">{item.title}</span>
              <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">Compliance & Certifications</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-cream border border-line rounded-xl space-y-1">
          <span className="text-[10px] font-black text-brand uppercase tracking-wider">Today</span>
          <p className="text-xs text-ink-3 leading-relaxed">NIST CSF 2.0 aligned, GDPR/CCPA compliant, metadata-only audit logging, DPA available.</p>
        </div>
        <div className="p-4 bg-cream border border-line rounded-xl space-y-1">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Roadmap</span>
          <p className="text-xs text-ink-3 leading-relaxed">SOC 2 Type II (Q4 2026), SAML 2.0 / OIDC for enterprise SSO, BYOK model.</p>
        </div>
      </div>
    </section>

    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
      <h3 className="eyebrow mb-0">Data Privacy</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-cream rounded-xl border border-line space-y-1">
          <p className="text-xs font-bold text-ink">Zero Retention</p>
          <p className="text-[10px] text-ink-3 leading-relaxed">We do not store prompt content by default.</p>
        </div>
        <div className="p-5 bg-cream rounded-xl border border-line space-y-1">
          <p className="text-xs font-bold text-ink">No Training</p>
          <p className="text-[10px] text-ink-3 leading-relaxed">We do not use client queries to train models.</p>
        </div>
      </div>
    </section>
    <p className="text-[10px] text-ink-4 font-bold uppercase tracking-widest pl-1">Contact: security@fodda.ai</p>
  </div>
);

// ─── Main KnowledgePage ───
export const KnowledgePage: React.FC<KnowledgePageProps> = ({ activeTab }) => {
  const tabLabels: Record<KnowledgeTab, { title: string; subtitle: string }> = {
    'api-docs': { title: 'API Documentation', subtitle: 'Endpoints, authentication, and integration guides' },
    'reliability': { title: 'Reliability', subtitle: 'Deterministic mode and data integrity safeguards' },
    'security': { title: 'Security & Hardening', subtitle: 'Privacy, compliance, and technical architecture' },
  };
  const { title, subtitle } = tabLabels[activeTab];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Knowledge</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">{title}</h1>
        <p className="text-sm text-ink-3 mt-1">{subtitle}</p>
      </div>
      <div className="px-8 pb-8 max-w-4xl">
        {activeTab === 'api-docs' && <ApiDocsContent />}
        {activeTab === 'reliability' && <ReliabilityContent />}
        {activeTab === 'security' && <SecurityContent />}
      </div>
    </div>
  );
};
