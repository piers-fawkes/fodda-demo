
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Article, Trend, Vertical, RetrievedRow } from '../../shared/types';

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
    <div className="bg-stone-50 p-3 rounded-lg border border-stone-100">
      <p className="text-xs text-stone-600 italic leading-relaxed">
        {"\u201C"}{displaySnippet}{"\u201D"}
      </p>
      {isLong && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[9px] font-bold text-fodda-accent uppercase tracking-tighter mt-1 hover:text-stone-900 transition-colors flex items-center"
        >
          {isExpanded ? "Show Less" : "Read More"}
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
      className={`p-4 rounded-lg border transition-all duration-500
        ${isHighlighted 
          ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' 
          : 'bg-stone-50 border-stone-200/60 hover:border-stone-300'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[9px] font-mono text-fodda-accent bg-purple-100/50 px-1.5 py-0.5 rounded border border-purple-200/30">
          ID: {trend.id}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-stone-800 leading-tight mb-2">{trend.name}</h4>
      
      <div className="relative">
        <p className={`text-xs text-stone-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
          {trend.summary}
        </p>
        <button 
          onClick={() => setIsExpandedInternal(!isExpandedInternal)}
          className="flex items-center text-[10px] text-stone-400 hover:text-stone-600 font-bold uppercase tracking-tighter mt-2 focus:outline-none"
        >
          {isExpanded ? (
            <>
              Show Less 
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </>
          ) : (
            <>
              Read Summary
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-stone-200/50 animate-fade-in-up">
          <button 
            onClick={() => onLearnMore(trend.name)}
            className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-fodda-accent hover:text-white hover:bg-fodda-accent py-2 rounded-lg transition-all duration-200 border border-fodda-accent/20 hover:border-fodda-accent"
          >
            Explore this trend further
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
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 font-bold text-stone-400 uppercase tracking-widest">Segment</th>
              <th className="px-4 py-3 font-bold text-stone-400 uppercase tracking-widest">Answer</th>
              <th className="px-4 py-3 font-bold text-stone-400 uppercase tracking-widest text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {tableData.map((d, i) => (
              <tr key={i} className="hover:bg-stone-50/50/50">
                <td className="px-4 py-3 font-bold text-stone-800">{d.segment}</td>
                <td className="px-4 py-3 text-stone-600 font-medium">{d.answer}</td>
                <td className="px-4 py-3 font-mono text-stone-900 text-right font-bold">{d.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="space-y-3 px-1">
        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Relative Proportions</p>
        <div className="space-y-3">
          {tableData.map((d, i) => (
            <div key={i} className="space-y-1.5 group">
              <div className="flex justify-between items-center text-[9px]">
                <span className="font-bold text-stone-500 uppercase tracking-tighter">{d.segment} &bull; {d.answer}</span>
                <span className="font-bold text-stone-900 tabular-nums">{d.share}</span>
              </div>
              <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-100">
                <div className="h-full bg-stone-400 transition-all duration-1000" style={{ width: `${(d.shareValue / maxShare) * 100}%` }} />
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
      setTimeout(() => {
        const elementId = `${highlightedItem.type}-${highlightedItem.id}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightedItem, isOpen, isLoading]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div ref={scrollRef} className={`fixed inset-y-0 right-0 z-50 w-80 h-full bg-white border-l border-stone-200 shadow-xl overflow-y-auto flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-16 px-6 border-b border-stone-100 bg-stone-50/50 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-center shrink-0">
          <h2 className="font-serif font-bold text-xl text-stone-900 tracking-tight leading-none">{isBaseline ? 'Method & Source' : 'Evidence'}</h2>
          <button onClick={onClose} className="md:hidden p-2 text-stone-400 hover:text-stone-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                      <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em] mb-4">Retrieved Distribution</h3>
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
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Referenced Trends</h3>
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
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Innovation Signals</h3>
                      <div className="space-y-4">
                        {articles.map(a => {
                          const isHighlighted = highlightedItem?.type === 'article' && highlightedItem?.id === a.id;
                          return (
                            <div 
                              key={a.id} 
                              id={`article-${a.id}`}
                              className={`p-4 rounded-xl border transition-all duration-300 ${isHighlighted ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' : 'bg-white border-stone-200'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-mono text-stone-400">ID: {a.id}</span>
                                {a.sourceUrl && a.sourceUrl !== '#' && (
                                  <a 
                                    href={a.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-fodda-accent hover:underline flex items-center bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100/50 font-bold uppercase tracking-tighter transition-colors hover:bg-purple-100"
                                  >
                                    Source
                                    <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-stone-900 mb-2 leading-snug">{a.title}</h4>
                              {a.snippet && <SignalSnippet snippet={a.snippet} />}
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
        <div className="px-6 py-4 mt-auto border-t border-stone-100 bg-stone-50/30 shrink-0 text-[9px] text-stone-400 font-bold uppercase tracking-[0.2em]">
          Knowledge Integrity Layer
        </div>
      </div>
    </>
  );
};
