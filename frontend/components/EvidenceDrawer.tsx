
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Article, Trend, Vertical, RetrievedRow } from '../../shared/types';
import { LayoutDashboard } from 'lucide-react';

interface EvidenceDrawerProps {
  articles: Article[];
  trends: Trend[];
  baselineRows: RetrievedRow[];
  vertical: Vertical;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onTrendLearnMore: (trendName: string) => void | Promise<void>;
  highlightedItem?: { type: 'trend' | 'article', id: string } | null;
  hasMessages: boolean;
}

const SignalSnippet: React.FC<{ snippet: string }> = ({ snippet }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const words = snippet.trim().split(/\s+/);
  const isLong = words.length > 12;

  const displaySnippet = isExpanded || !isLong
    ? snippet
    : words.slice(0, 12).join(' ') + '...';

  return (
    <div className="bg-zinc-900/30 p-2 rounded-md border border-zinc-800 hover:border-zinc-700 transition-colors">
      <p className="text-[10px] font-mono text-zinc-400 italic leading-relaxed">
        {"\u201C"}{displaySnippet}{"\u201D"}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[8px] font-bold text-fodda-accent uppercase tracking-widest mt-1 hover:text-white transition-colors flex items-center"
        >
          {isExpanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
};

const TrendCard: React.FC<{
  trend: Trend;
  onLearnMore: (name: string) => void;
  isHighlighted: boolean
}> = ({ trend, onLearnMore, isHighlighted }) => {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const isExpanded = isExpandedInternal || isHighlighted;

  return (
    <div
      id={`trend-${trend.id}`}
      className={`p-3 rounded-lg border transition-all duration-300
        ${isHighlighted
          ? 'bg-fodda-accent/10 border-fodda-accent ring-1 ring-fodda-accent/20'
          : 'bg-black border-zinc-800 hover:border-zinc-700'
        }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className="text-[8px] font-mono text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded-sm border border-zinc-800/50">
          ID: {trend.id}
        </span>
      </div>
      <h4 className="text-sm font-bold text-white leading-tight mb-2 tracking-tight">{trend.name}</h4>

      <div className="relative">
        <p className={`text-xs text-zinc-400 leading-snug ${isExpanded ? '' : 'line-clamp-3'}`}>
          {trend.summary}
        </p>
        <button
          onClick={() => setIsExpandedInternal(!isExpandedInternal)}
          className="flex items-center text-[9px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest mt-2 focus:outline-none"
        >
          {isExpanded ? "LESS" : "EXPAND"}
        </button>

        {trend.evidence_counts && Object.keys(trend.evidence_counts).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(trend.evidence_counts).map(([label, count]) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-sm flex items-center gap-1.5">
                <span className="text-[8px] font-bold text-fodda-accent uppercase tracking-tighter">{label}</span>
                <span className="text-[9px] font-mono text-white font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 pt-2 border-t border-zinc-800 animate-fade-in-up">
          <button
            onClick={() => onLearnMore(trend.name)}
            className="w-full text-center text-[9px] font-bold uppercase tracking-widest text-fodda-accent hover:text-white hover:bg-fodda-accent/10 py-1.5 rounded-md transition-all duration-200 border border-fodda-accent/20 hover:border-fodda-accent"
          >
            Explore Trend
          </button>
        </div>
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
      <div className="bg-black rounded-lg border border-zinc-800 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="bg-zinc-900/50 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-bold text-zinc-500 uppercase tracking-widest">Segment</th>
              <th className="px-4 py-3 font-bold text-zinc-500 uppercase tracking-widest">Answer</th>
              <th className="px-4 py-3 font-bold text-zinc-500 uppercase tracking-widest text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/[0.4]">
            {tableData.map((d, i) => (
              <tr key={i} className="hover:bg-zinc-900/30">
                <td className="px-4 py-2.5 font-bold text-zinc-300">{d.segment}</td>
                <td className="px-4 py-2.5 text-zinc-400 font-medium">{d.answer}</td>
                <td className="px-4 py-2.5 font-mono text-white text-right font-bold">{d.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 px-1">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Relative Proportions</p>
        <div className="space-y-3">
          {tableData.map((d, i) => (
            <div key={i} className="space-y-1.5 group">
              <div className="flex justify-between items-center text-[9px]">
                <span className="font-bold text-zinc-500 uppercase tracking-tighter">{d.segment} &bull; {d.answer}</span>
                <span className="font-bold text-zinc-300 tabular-nums">{d.share}</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                <div className="h-full bg-zinc-600 transition-all duration-1000" style={{ width: `${(d.shareValue / maxShare) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ articles, trends, baselineRows, vertical, isOpen, onClose, isLoading, onTrendLearnMore, highlightedItem }) => {
  const isBaseline = vertical === Vertical.Baseline;
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {isOpen && <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div ref={scrollRef} className={`fixed inset-y-0 right-0 z-50 w-80 h-full bg-black border-l border-white/10 shadow-xl overflow-y-auto flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-zinc-500" />
            <span className="font-semibold text-sm tracking-tight text-zinc-300">Evidence</span>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {isLoading ? (
            <div className="animate-pulse space-y-8 pt-4">
              <div className="h-32 bg-stone-100 rounded-lg"></div>
              <div className="h-32 bg-stone-100 rounded-lg"></div>
            </div>
          ) : (
            <div className="pt-4">
              {isBaseline ? (
                <div className="space-y-8">
                  {baselineRows.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.3em] mb-4">Retrieved Distribution</h3>
                      <BaselineTable rows={baselineRows} />
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                    <h3 className="text-[10px] font-bold text-stone-900 uppercase tracking-widest mb-4">Operational Constraints</h3>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-stone-300 mt-1.5 shrink-0"></div>
                        <p className="text-[11px] text-stone-500 leading-tight italic">This layer provides reference facts to constrain agent reasoning within measured reality.</p>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  {trends.length > 0 && (
                    <div className="mb-10">
                      <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 text-zinc-500">Referenced Trends</h3>
                      <div className="space-y-4">
                        {trends.map(t => (
                          <TrendCard
                            key={t.id}
                            trend={t}
                            onLearnMore={onTrendLearnMore}
                            isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === t.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {articles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest mb-4 text-zinc-500">Innovation Signals</h3>
                      <div className="space-y-4">
                        {articles.map(a => {
                          const isHighlighted = highlightedItem?.type === 'article' && highlightedItem?.id === a.id;
                          return (
                            <div
                              key={a.id}
                              id={`article-${a.id}`}
                              className={`p-4 rounded-xl border transition-all duration-300 ${isHighlighted ? 'bg-fodda-accent/10 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' : 'bg-black border-zinc-800'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-mono text-zinc-500">ID: {a.id}</span>
                                {a.sourceUrl && a.sourceUrl !== '#' && (
                                  <a
                                    href={a.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-fodda-accent hover:underline flex items-center bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 font-bold uppercase tracking-tighter transition-colors hover:bg-zinc-800 hover:text-white"
                                  >
                                    Source
                                    <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-white mb-2 leading-snug">{a.title}</h4>
                              {a.snippet && <SignalSnippet snippet={a.snippet} />}

                              {a.sourceUrl && a.sourceUrl !== '#' && (
                                <div className="mt-3 pt-2 border-t border-zinc-800/50">
                                  <a
                                    href={a.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 py-1.5 rounded-md transition-all duration-200 border border-zinc-800 hover:border-zinc-700"
                                  >
                                    Visit Source
                                    <svg className="w-2.5 h-2.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
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
        <div className="px-6 py-4 mt-auto border-t border-zinc-800 bg-black shrink-0 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
          <span>Knowledge Integrity Layer</span>
          <span className="text-[9px] opacity-50">v1.0</span>
        </div>
      </div>
    </>
  );
};
