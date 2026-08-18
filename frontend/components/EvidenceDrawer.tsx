
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Article, Trend, Vertical, RetrievedRow, AdjacentTrend } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface EvidenceDrawerProps {
  articles: Article[];
  trends: Trend[];
  baselineRows: RetrievedRow[];
  vertical: Vertical | string;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onTrendLearnMore: (trendName: string) => void | Promise<void>;
  highlightedItem?: { type: 'trend' | 'article', id: string } | null;
  hasMessages: boolean;
  citedTrendIds?: string[];
  onOpenGraph?: (trendId: string) => void;
}

const SignalSnippet: React.FC<{ snippet: string }> = ({ snippet }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const words = snippet.trim().split(/\s+/);
  const isLong = words.length > 12;

  const displaySnippet = isExpanded || !isLong
    ? snippet
    : words.slice(0, 12).join(' ') + '...';

  return (
    <div className="bg-cream p-2 rounded-lg border border-line hover:border-line-strong transition-all">
      <p className="text-[12px] font-mono text-ink-2 italic leading-relaxed">
        {"\u201C"}{displaySnippet}{"\u201D"}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[9px] font-bold text-brand uppercase tracking-widest mt-1.5 hover:text-brand-dark transition-colors flex items-center"
        >
          {isExpanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
};

// ── Similarity Badge ──────────────────────────────────────────────────
const SimilarityBadge: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const colorClass = score >= 0.90
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : score >= 0.85
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-line-soft text-ink-3 border-line';

  return (
    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${colorClass}`}>
      {pct}%
    </span>
  );
};

// ── Adjacent Trend Card ───────────────────────────────────────────────
const AdjacentTrendCard: React.FC<{
  adj: AdjacentTrend;
  onLearnMore: (name: string) => void;
  index: number;
}> = ({ adj, onLearnMore, index }) => {
  const descSnippet = adj.description && adj.description.length > 100
    ? adj.description.substring(0, 100) + '…'
    : adj.description || '';

  return (
    <div
      className="p-2.5 rounded-lg bg-cream border border-line hover:border-teal-300 transition-all duration-200 opacity-0 animate-fade-in-up cursor-pointer group"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
      onClick={() => onLearnMore(adj.trendName)}
    >
      <div className="flex justify-between items-start gap-2 mb-1">
        <span className="text-[12px] font-semibold text-ink leading-tight group-hover:text-teal-700 transition-colors flex-1">
          {adj.trendName}
        </span>
        <SimilarityBadge score={adj.similarity} />
      </div>
      {descSnippet && (
        <p className="text-[11px] text-ink-3 leading-relaxed line-clamp-2">{descSnippet}</p>
      )}
    </div>
  );
};

// ── Trend Card ────────────────────────────────────────────────────────
const TrendCard: React.FC<{
  trend: Trend;
  vertical: Vertical | string;
  onLearnMore: (name: string) => void;
  isHighlighted: boolean;
  onExploreGraph?: (trendId: string) => void;
}> = ({ trend, vertical, onLearnMore, isHighlighted, onExploreGraph }) => {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const isExpanded = isExpandedInternal || isHighlighted;

  // Adjacent Possibilities state (lazy-loaded)
  const [adjacentTrends, setAdjacentTrends] = useState<AdjacentTrend[]>([]);
  const [adjacentLoading, setAdjacentLoading] = useState(false);
  const [adjacentFetched, setAdjacentFetched] = useState(false);
  const [showAdjacent, setShowAdjacent] = useState(false);

  // Fetch adjacent trends when user first expands the section
  useEffect(() => {
    if (!showAdjacent || adjacentFetched) return;

    const fetchAdjacent = async () => {
      setAdjacentLoading(true);
      try {
        const nodeId = String(trend.trendId || trend.id);
        const res = await dataService.getAdjacentTrends(vertical, nodeId, { limit: 5 });
        setAdjacentTrends(res.adjacent || []);
      } catch (err) {
        console.error('[TrendCard] Failed to fetch adjacent trends:', err);
      } finally {
        setAdjacentLoading(false);
        setAdjacentFetched(true);
      }
    };

    fetchAdjacent();
  }, [showAdjacent, adjacentFetched, trend.id, trend.trendId, vertical]);

  return (
    <div
      id={`trend-${trend.id}`}
      className={`p-3 rounded-xl border transition-all duration-300 card-hover
        ${isHighlighted
          ? 'bg-brand-soft border-brand ring-1 ring-brand/20'
          : 'bg-paper border-line hover:border-line-strong'
        }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className="text-[9px] font-mono text-ink-4 bg-cream px-1 py-0.5 rounded-sm border border-line">
          ID: {trend.id}
        </span>
      </div>
      <h4 className="text-[15px] font-bold text-ink leading-tight mb-2.5 tracking-tight">{trend.name}</h4>

      <div className="relative">
        <p className={`text-[13px] text-ink-2 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
          {trend.summary}
        </p>
        <button
          onClick={() => setIsExpandedInternal(!isExpandedInternal)}
          className="flex items-center text-[10px] text-ink-3 hover:text-ink font-bold uppercase tracking-widest mt-2.5 focus:outline-none"
        >
          {isExpanded ? "LESS" : "EXPAND"}
        </button>

        {trend.evidence_counts && Object.keys(trend.evidence_counts).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(trend.evidence_counts).map(([label, count]) => (
              <div key={label} className="bg-cream border border-line px-1.5 py-0.5 rounded-sm flex items-center gap-1.5">
                <span className="text-[8px] font-bold text-brand uppercase tracking-tighter">{label}</span>
                <span className="text-[9px] font-mono text-ink font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          <div className="mt-3 pt-2 border-t border-line animate-fade-in-up flex gap-2">
            <button
              onClick={() => onLearnMore(trend.name)}
              className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest text-brand hover:text-white hover:bg-brand py-1.5 rounded-md transition-all duration-200 border border-brand/20 hover:border-brand"
            >
              Query Trend
            </button>
            {onExploreGraph && (
              <button
                onClick={() => onExploreGraph(trend.id)}
                className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest text-ink-3 hover:text-ink hover:bg-line-soft py-1.5 rounded-md transition-all duration-200 border border-line hover:border-line-strong flex items-center justify-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
                  <line x1="12" y1="7.5" x2="5" y2="16.5" /><line x1="12" y1="7.5" x2="19" y2="16.5" />
                </svg>
                Connections
              </button>
            )}
          </div>

          {/* ── Adjacent Possibilities ──────────────────────────── */}
          <div className="mt-3 pt-2 border-t border-line/60">
            <button
              onClick={() => setShowAdjacent(!showAdjacent)}
              className="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-ink-4 hover:text-teal-600 transition-colors py-1"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-teal-300 bg-teal-50 inline-flex items-center justify-center text-[7px] text-teal-600">↗</span>
                Adjacent Possibilities
              </span>
              <span className="text-[8px] font-mono text-ink-4 bg-cream px-1.5 py-0.5 rounded border border-line">
                {showAdjacent ? 'Hide' : adjacentFetched ? `${adjacentTrends.length}` : '…'}
              </span>
            </button>

            {showAdjacent && (
              <div className="mt-2 space-y-2 animate-fade-in-up">
                {adjacentLoading ? (
                  <div className="flex items-center gap-2 py-3 justify-center">
                    <div className="w-3 h-3 border border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                    <span className="text-[9px] text-ink-4 font-mono">Discovering adjacent trends…</span>
                  </div>
                ) : adjacentTrends.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 justify-center text-[10px] text-ink-4">
                    <svg className="w-3.5 h-3.5 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    No adjacent possibilities found
                  </div>
                ) : (
                  adjacentTrends.map((adj, idx) => (
                    <AdjacentTrendCard
                      key={adj.trendId}
                      adj={adj}
                      onLearnMore={onLearnMore}
                      index={idx}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const BaselineTable: React.FC<{ rows: RetrievedRow[] }> = ({ rows }) => {
  const tableData = useMemo(() => {
    return rows.map(row => {
      const parts = row.summary.split(':');
      const share = parts.pop()?.trim() || '0%';
      const answer = parts.join(':').trim();
      return { segment: row.name, answer, share, shareValue: parseFloat(share) || 0 };
    });
  }, [rows]);

  const maxShare = Math.max(...tableData.map(d => d.shareValue), 100);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-paper rounded-lg border border-line shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="bg-cream border-b border-line">
            <tr>
              <th className="px-4 py-3 font-bold text-ink-3 uppercase tracking-widest">Segment</th>
              <th className="px-4 py-3 font-bold text-ink-3 uppercase tracking-widest">Answer</th>
              <th className="px-4 py-3 font-bold text-ink-3 uppercase tracking-widest text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/50">
            {tableData.map((d, i) => (
              <tr key={i} className="hover:bg-cream/50">
                <td className="px-4 py-2.5 font-bold text-ink">{d.segment}</td>
                <td className="px-4 py-2.5 text-ink-2 font-medium">{d.answer}</td>
                <td className="px-4 py-2.5 font-mono text-ink text-right font-bold">{d.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 px-1">
        <p className="text-[9px] font-bold text-ink-3 uppercase tracking-widest">Relative Proportions</p>
        <div className="space-y-3">
          {tableData.map((d, i) => (
            <div key={i} className="space-y-1.5 group">
              <div className="flex justify-between items-center text-[9px]">
                <span className="font-bold text-ink-3 uppercase tracking-tighter">{d.segment} &bull; {d.answer}</span>
                <span className="font-bold text-ink tabular-nums">{d.share}</span>
              </div>
              <div className="h-1.5 w-full bg-line-soft rounded-full overflow-hidden border border-line/50">
                <div className="h-full bg-ink-3 transition-all duration-1000" style={{ width: `${(d.shareValue / maxShare) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ articles, trends, baselineRows, vertical, isOpen, onClose, isLoading, onTrendLearnMore, highlightedItem, hasMessages, citedTrendIds = [], onOpenGraph }) => {
  const isBaseline = vertical === Vertical.Baseline;
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalEvidence = articles.length + trends.length;

  // Split trends into cited (referenced in response) vs uncited (also retrieved)
  const citedSet = useMemo(() => new Set(citedTrendIds), [citedTrendIds]);
  const citedTrends = useMemo(() => trends.filter(t => citedSet.has(String(t.id))), [trends, citedSet]);
  const uncitedTrends = useMemo(() => trends.filter(t => !citedSet.has(String(t.id))), [trends, citedSet]);
  const hasCitedSplit = citedTrendIds.length > 0 && citedTrends.length > 0;
  const [showUncited, setShowUncited] = useState(false);

  useEffect(() => {
    if (highlightedItem && isOpen && !isLoading) {
      // Small delay to ensure content is rendered in the drawer
      const timer = setTimeout(() => {
        const elementId = `${highlightedItem.type}-${highlightedItem.id}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.warn(`[EvidenceDrawer] Element ${elementId} not found in DOM`);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedItem, isOpen, isLoading]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div ref={scrollRef} className={`fixed inset-y-0 right-0 z-50 w-80 h-full bg-paper border-l border-line shadow-sm overflow-y-auto flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-14 px-6 border-b border-line flex items-center justify-between shrink-0 bg-paper">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Evidence</span>
            {totalEvidence > 0 && (
              <span className="bg-brand-soft text-brand text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border border-brand/20">{totalEvidence}</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-ink-4 hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {/* Clarity header */}
          <div className="pt-2">
            <p className="text-[10px] font-mono text-ink-4 uppercase tracking-wider leading-relaxed">
              All claims trace to curated graph nodes.
            </p>
          </div>

          {isLoading ? (
            <div className="animate-pulse space-y-8 pt-4">
              <div className="h-32 bg-line-soft rounded-lg"></div>
              <div className="h-32 bg-line-soft rounded-lg"></div>
            </div>
          ) : !hasMessages || (trends.length === 0 && articles.length === 0 && baselineRows.length === 0) ? (
            /* Empty state — shown before first query */
            <div className="flex flex-col items-center justify-center text-center py-16 space-y-4 animate-fade-in-up">
              <div className="w-14 h-14 rounded-xl bg-cream border border-line flex items-center justify-center">
                <svg className="w-7 h-7 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-2 mb-1">No evidence yet</p>
                <p className="text-[12px] text-ink-3 leading-relaxed max-w-[220px]">
                  Submit a question and the supporting graph nodes will appear here.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-mono text-ink-4 pt-2">
                <span className="px-1.5 py-0.5 bg-cream rounded border border-line">Query</span>
                <span>→</span>
                <span className="px-1.5 py-0.5 bg-cream rounded border border-line">Graph Search</span>
                <span>→</span>
                <span className="px-1.5 py-0.5 bg-cream rounded border border-line">Evidence</span>
              </div>
            </div>
          ) : (
            <div>
              {isBaseline ? (
                <div className="space-y-8">
                  {baselineRows.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.3em] mb-4">Retrieved Distribution</h3>
                      <BaselineTable rows={baselineRows} />
                    </div>
                  )}

                  <div className="bg-paper p-6 rounded-2xl border border-line shadow-sm">
                    <h3 className="text-[10px] font-bold text-ink uppercase tracking-widest mb-4">Operational Constraints</h3>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-ink-4 mt-1.5 shrink-0"></div>
                        <p className="text-[11px] text-ink-3 leading-tight italic">This layer provides reference facts to constrain agent reasoning within measured reality.</p>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  {trends.length > 0 && (
                    <div className="mb-10">
                      {hasCitedSplit ? (
                        <>
                          {/* Cited trends — referenced in the AI response */}
                          <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 text-brand">Referenced in Response</h3>
                          <div className="space-y-4 mb-6">
                            {citedTrends.map((t, idx) => (
                              <div key={t.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'forwards' }}>
                                <TrendCard
                                  trend={t}
                                  vertical={vertical}
                                  onLearnMore={onTrendLearnMore}
                                  isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === t.id}
                                  onExploreGraph={onOpenGraph}
                                />
                              </div>
                            ))}
                          </div>
                          {/* Uncited trends — collapsed by default to reduce noise */}
                          {uncitedTrends.length > 0 && (
                            <>
                              <div className="border-t border-line my-4" />
                              <button
                                onClick={() => setShowUncited(!showUncited)}
                                className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-widest mb-2 text-ink-4 hover:text-ink-2 transition-colors"
                              >
                                <span>Also Retrieved</span>
                                <span className="text-[9px] font-mono text-ink-4 bg-cream px-1.5 py-0.5 rounded border border-line">
                                  {showUncited ? 'Hide' : `Show ${uncitedTrends.length}`}
                                </span>
                              </button>
                              {showUncited && (
                                <div className="space-y-4">
                                  {uncitedTrends.map((t, idx) => (
                                    <div key={t.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'forwards' }}>
                                      <TrendCard
                                        trend={t}
                                        vertical={vertical}
                                        onLearnMore={onTrendLearnMore}
                                        isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === t.id}
                                        onExploreGraph={onOpenGraph}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 text-ink-3">Referenced Trends</h3>
                          <div className="space-y-4">
                            {trends.map((t, idx) => (
                              <div key={t.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'forwards' }}>
                                <TrendCard
                                  trend={t}
                                  vertical={vertical}
                                  onLearnMore={onTrendLearnMore}
                                  isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === t.id}
                                  onExploreGraph={onOpenGraph}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {articles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 text-ink-3">Evidence Signals</h3>
                      <div className="space-y-4">
                        {articles.map((a, idx) => {
                          const isHighlighted = highlightedItem?.type === 'article' && highlightedItem?.id === a.id;
                          return (
                            <div
                              key={a.id}
                              id={`article-${a.id}`}
                              className={`p-4 rounded-xl border transition-all duration-300 opacity-0 animate-fade-in-up card-hover ${isHighlighted ? 'bg-brand-soft border-brand shadow-md ring-1 ring-brand/20' : 'bg-paper border-line'}`}
                              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'forwards' }}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-mono text-ink-4">ID: {a.id}</span>
                                {a.sourceUrl && a.sourceUrl !== '#' && (
                                  <a
                                    href={a.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-brand hover:underline flex items-center bg-cream px-2 py-0.5 rounded-full border border-line font-bold uppercase tracking-tighter transition-colors hover:bg-brand-soft hover:border-brand/20"
                                  >
                                    Source ↗
                                  </a>
                                )}
                              </div>
                              <h4 className="text-[15px] font-bold text-ink mb-2.5 leading-snug">{a.title}</h4>
                              {a.snippet && <SignalSnippet snippet={a.snippet} />}

                              {a.sourceUrl && a.sourceUrl !== '#' && (
                                <div className="mt-3 pt-2 border-t border-line/50">
                                  <a
                                    href={a.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center text-[9px] font-bold uppercase tracking-widest text-ink-3 hover:text-brand hover:bg-brand-soft py-1.5 rounded-md transition-all duration-200 border border-line hover:border-brand/20"
                                  >
                                    Visit Source ↗
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 mt-auto border-t border-line bg-cream shrink-0 text-[10px] text-ink-4 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
          <span>Knowledge Integrity Layer</span>
          <span className="text-[9px] opacity-50">v1.0</span>
        </div>
      </div>
    </>
  );
};
