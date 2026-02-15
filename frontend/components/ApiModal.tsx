
import React from 'react';

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code }) => (
  <div className="relative group">
    <pre className="bg-stone-900 text-stone-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto border border-stone-800 my-3">
      <code>{code.trim()}</code>
    </pre>
    <button
      onClick={() => navigator.clipboard.writeText(code.trim())}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-stone-800 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
      title="Copy to clipboard"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    </button>
  </div>
);

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownloadDocs = () => {
    const markdownContent = `
# Fodda Developer API Documentation (v1.2)

## CORE CONCEPTS
**Base URL**: https://api.fodda.ai
**Authentication**: Read-only demo environment. No key required for public endpoints.

**Rule: Use Semantic Search for natural language discovery.**
The v1.2 architecture prioritizes vector-based semantic retrieval for higher conceptual accuracy.

- **graphId** selector: \`psfk\`, \`waldo\`, \`sic\`.
- **Standardized IDs**: Use \`trendId\` and \`articleId\` for precise resource identification.
- **Status Codes**: \`TREND_MATCH\` (Direct concept), \`ARTICLE_MATCH\` (Signal-only match), \`NO_MATCH\` (Deterministic fallback).
- **evidence_counts**: Shows proof volume (Signals, Metrics, Quotes).

---

## 1. DETERMINISTIC MODE (Enterprise)
Grounded retrieval ensuring zero hallucinations. Every response is strictly linked to verified graph nodes.

**Enable**: Set header \`X - Fodda - Deterministic: true\`.

- **Technical Safeguards**: NO_MATCH fallback for zero-confidence queries.
- **Evidence-First**: Orchestration uses only provided proof nodes.
- **Source Attribution**: Every fact linked to a permanent \`ArticleID\` or \`TrendID\`.

---

## 2. SEMANTIC SEARCH (v1.2)
Expert-curated, editorial, and category-anchored concepts.

**Endpoint**: \`POST / v1 / graphs /: id / search\`

\`\`\`json
    {
      "query": "future of sustainable retail",
        "limit": 10
    }
\`\`\`

---

## 3. SECURITY & HARDENING
Fodda is a privacy-first intelligence layer.

- **Strict Authentication**: All API access requires a valid \`X - API - Key\`.
- **Zero Retention**: Fodda does not store prompt content or client query data by default.
- **No Training**: We do not use client queries to train underlying models.
- **Identity Separation**: Audit logs distinguish between System and Human identities.

---

## 4. DYNAMIC DOMAIN DISCOVERY
Fetch real-time filter values directly from the graph.

**Endpoint**: \`GET / v1 / graphs /: id / labels /: label / values\`

---

## SUPPORT
For integration help or enterprise inquiries, contact:
hello@psfk.com
    `;

    const blob = new Blob([markdownContent.trim()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Fodda_API_Documentation_v1.2.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border border-stone-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-fodda-accent/10 p-2 rounded-lg">
              <svg className="w-5 h-5 text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h3 className="font-serif text-xl font-bold text-stone-900">Developer API Documentation (v1.2)</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto text-stone-600 leading-relaxed text-sm scrollbar-hide">
          <section>
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Core Integration</h4>
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-700 font-bold mb-2">Rule: All production and demo queries should explicitly include graphId.</p>
                <p className="text-[10px] text-stone-500 italic">If omitted, the system defaults to &ldquo;psfk&rdquo;.</p>
              </div>
              <ul className="space-y-2 text-xs">
                <li><span className="font-bold text-stone-700">graphId</span>: Selects source dataset (psfk, waldo, sic).</li>
                <li><span className="font-bold text-stone-700">IDs</span>: Use <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">trendId</code> and <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">articleId</code> for distinct resource access.</li>
                <li><span className="font-bold text-stone-700">Status</span>: Look for <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">TREND_MATCH</code>, <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">ARTICLE_MATCH</code>, or <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">NO_MATCH</code>.</li>
              </ul>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Deterministic Mode</h4>
            <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-fodda-accent/20 text-fodda-accent text-[9px] font-bold uppercase tracking-widest rounded border border-fodda-accent/30">Enterprise</span>
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Grounded Retrieval</p>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Ensure zero hallucinations by anchoring all responses in verified graph nodes. Set the <code className="text-fodda-accent">X-Fodda-Deterministic</code> header to <code className="text-fodda-accent">true</code>.
              </p>
              <ul className="space-y-2 text-xs text-stone-500 list-disc pl-4">
                <li><span className="font-bold text-stone-300">NO_MATCH Fallback</span>: Returns a structured code when confidence is below threshold.</li>
                <li><span className="font-bold text-stone-300">Source Attribution</span>: Every fact is linked to a permanent Article or Trend ID.</li>
              </ul>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">API v1.2 Implementation</h4>

            <div className="space-y-8 mt-4">
              <div>
                <h5 className="font-bold text-stone-900 mb-1">Semantic Search</h5>
                <p className="text-stone-500 text-xs mb-3">Natural language query with high-dimensional embedding matching.</p>
                <CodeBlock code={`POST /v1/graphs/psfk/search\n{"query":"future of retail","limit":10}`} />
              </div>

              <div className="pt-4">
                <h5 className="font-bold text-stone-900 mb-1">Domain Discovery</h5>
                <p className="text-stone-500 text-xs mb-3">Fetch real values (RetailerType, Technology, Audience) directly from the graph.</p>
                <CodeBlock code={`GET /v1/graphs/psfk/labels/RetailerType/values`} />
              </div>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Security & Hardening</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Privacy</p>
                <p className="text-xs font-bold text-stone-900">Zero Retention</p>
                <p className="text-[10px] text-stone-500 mt-1">Default metadata-only logging.</p>
              </div>
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Auth</p>
                <p className="text-xs font-bold text-stone-900">Standardized Keys</p>
                <p className="text-[10px] text-stone-500 mt-1">X-API-Key required for all calls.</p>
              </div>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Optimization Tips</h4>
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest mb-2">Trends Graphs (PSFK + Waldo)</p>
                <ul className="space-y-1.5 text-xs text-stone-600 list-disc pl-4">
                  <li>Use concrete nouns for best retrieval (e.g., &ldquo;automation&rdquo;).</li>
                  <li>Evidence counts now include Signals, Metrics, and Quotes.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 bg-stone-900 flex justify-between items-center shrink-0">
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest px-4">Integrity API v1.5.1</p>
          <div className="flex space-x-3">
            <button
              onClick={handleDownloadDocs}
              className="px-4 py-2 bg-stone-800 text-stone-100 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-fodda-accent transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download .MD
            </button>
            <button onClick={onClose} className="px-6 py-2 bg-stone-800 text-stone-100 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-fodda-accent transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
