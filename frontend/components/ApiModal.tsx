
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
# Fodda Developer API Documentation

## CORE CONCEPTS
**Base URL**: https://api.fodda.ai
**Authentication**: Read-only demo environment. No key required for public endpoints.

**Rule: All production and demo queries should explicitly include graphId.**
If omitted, the demo defaults to **psfk**.

- **graphId** is the primary selector for the source dataset.
- **vertical** is a soft filter. Trends may belong to multiple verticals; clients should not assume exclusivity.
- Response structure is consistent across trend graphs (PSFK, Waldo, SIC), but differs for baseline graphs.

---

## 1. QUERY MODES

### A) PSFK Trends Graph
Expert-curated, editorial, and category-anchored.
**graphId**: "psfk"

\`\`\`json
{
  "q": "store personalization",
  "graphId": "psfk",
  "vertical": "retail",
  "limit": 10
}
\`\`\`

### B) Waldo Trends Graph
Broad, multi-industry, and signal-dense analysis.
**graphId**: "waldo"
*Note: vertical is informational (general)*

\`\`\`json
{
  "q": "outdoor grilling",
  "graphId": "waldo",
  "vertical": "general"
}
\`\`\`

### C) Public Beliefs Baseline (Pew NPORS)
Parameter-driven distributions from Pew NPORS 2025.
**graphId**: "pew"
**Baseline graphs are grounding layers, not interpretive trend systems. No articles or evidence are returned.**

\`\`\`json
{
  "graphId": "pew",
  "vertical": "baseline",
  "questionId": "BBHOME",
  "segmentType": "AGEGRP"
}
\`\`\`

---

## PLATFORM INTEGRATION

### Snowflake
Sample Data Integration → https://www.fodda.ai/#/snowflake

---

## OPTIMIZATION TIPS

### PSFK + Waldo (Trends Graphs)
- Use concrete nouns for best retrieval (e.g., “automation” instead of “future things”).
- If a detailed query fails, fall back to the core Trend Name.

### Baseline Graph
- **questionId is required.**
- Use **excludeBlank=true** for clean distributions.
- Use higher limits (e.g., 200) to avoid truncating data.
- Narrative responses (if generated) should describe distributions, not introduce interpretation.

---

## WHAT THE API DOES NOT DO
- No automatic narrative generation
- No cross-graph blending unless explicitly requested
- No interpretation for baseline data

---

## SUPPORT
For integration help or enterprise inquiries, contact:
hello@psfk.com
    `;

    const blob = new Blob([markdownContent.trim()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Fodda_API_Documentation.md';
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
            <h3 className="font-serif text-xl font-bold text-stone-900">Developer API Documentation</h3>
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
                <li><span className="font-bold text-stone-700">graphId</span> is the primary selector for the source dataset.</li>
                <li><span className="font-bold text-stone-700">vertical</span> is a soft filter. Trends may belong to multiple verticals.</li>
                <li>Response structure is consistent across trend graphs (PSFK, Waldo, SIC), but differs for baseline graphs.</li>
              </ul>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Query Modes</h4>
            
            <div className="space-y-8 mt-4">
              <div>
                <h5 className="font-bold text-stone-900 mb-1">PSFK Trends Graph</h5>
                <p className="text-stone-500 text-xs mb-3">Expert-curated, editorial, category-anchored (graphId: &ldquo;psfk&rdquo;).</p>
                <CodeBlock code={`{"q":"store personalization","graphId":"psfk","vertical":"retail"}`} />
              </div>

              <div className="pt-4">
                <h5 className="font-bold text-stone-900 mb-1">Waldo Trends Graph</h5>
                <p className="text-stone-500 text-xs mb-3">Broad, multi-industry, signal-dense (graphId: &ldquo;waldo&rdquo;).</p>
                <CodeBlock code={`{"q":"outdoor grilling","graphId":"waldo","vertical":"general"}`} />
              </div>

              <div className="pt-4">
                <h5 className="font-bold text-stone-900 mb-1">Public Beliefs Baseline</h5>
                <p className="text-stone-500 text-xs mb-1">Parameter-driven distributions (graphId: &ldquo;pew&rdquo;).</p>
                <p className="text-[10px] font-bold text-fodda-accent uppercase tracking-widest mb-3">Grounding layers, not interpretive systems.</p>
                <CodeBlock code={`{"graphId":"pew","vertical":"baseline","questionId":"BBHOME","segmentType":"AGEGRP"}`} />
              </div>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Platform Integration</h4>
            <div className="grid grid-cols-1 gap-4">
              <a 
                href="https://www.fodda.ai/#/snowflake" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-4 bg-stone-50 rounded-xl border border-stone-200 hover:border-fodda-accent/30 transition-all group"
              >
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Snowflake</p>
                <p className="text-xs font-bold text-stone-900 group-hover:text-fodda-accent">Sample Data Integration</p>
              </a>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Optimization Tips</h4>
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest mb-2">Trends Graphs (PSFK + Waldo)</p>
                <ul className="space-y-1.5 text-xs text-stone-600 list-disc pl-4">
                  <li>Use concrete nouns for best retrieval (e.g., &ldquo;automation&rdquo;).</li>
                  <li>If detailed query fails, fall back to core Trend Name.</li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-900 uppercase tracking-widest mb-2">Baseline Graph</p>
                <ul className="space-y-1.5 text-xs text-stone-600 list-disc pl-4">
                  <li>questionId is required.</li>
                  <li>Use excludeBlank=true for clean distributions.</li>
                  <li>Use limits of 200+ to avoid truncating data.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-100">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">What the API does not do</h4>
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
              <ul className="space-y-2 text-xs text-stone-600">
                <li className="flex items-start">
                  <span className="text-fodda-accent mr-2 font-bold">•</span>
                  <span>No automatic narrative generation (returns structured data).</span>
                </li>
                <li className="flex items-start">
                  <span className="text-fodda-accent mr-2 font-bold">•</span>
                  <span>No cross-graph blending unless explicitly requested.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-fodda-accent mr-2 font-bold">•</span>
                  <span>No interpretation for baseline distribution data.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <div className="p-4 bg-stone-900 flex justify-between items-center shrink-0">
           <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest px-4">Integrity API v1.5</p>
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
