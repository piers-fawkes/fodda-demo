
import React, { useState, useEffect, useRef } from 'react';
import { Article, Trend, Vertical } from '../../shared/types';

interface EvidenceDrawerProps {
  articles: Article[];
  trends: Trend[];
  vertical: Vertical;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onTrendLearnMore: (trendName: string) => void;
  onOpenAbout: () => void;
  highlightedItem?: { type: 'trend' | 'article', id: string } | null;
  hasMessages: boolean;
}

const TrendCard: React.FC<{ trend: Trend; onLearnMore: (name: string) => void; isHighlighted: boolean }> = ({ trend, onLearnMore, isHighlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => { 
    if (isHighlighted) setIsExpanded(true); 
  }, [isHighlighted]);

  return (
    <div id={`trend-${trend.trendId}`} className={`p-4 rounded-lg border transition-all duration-500 ${isHighlighted ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' : 'bg-stone-50 border-stone-200/60 hover:border-stone-300'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono text-fodda-accent bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100/50">ID: {trend.trendId}</span>
      </div>
      {/* Fix: Access trendName */}
      <h4 className="text-sm font-semibold text-stone-800 leading-tight mb-2">{trend.trendName}</h4>
      {/* Fix: Access trendDescription */}
      <p className={`text-xs text-stone-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>{trend.trendDescription}</p>
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="flex items-center text-[10px] text-stone-400 hover:text-stone-600 font-bold uppercase tracking-tight mt-2"
      >
        {isExpanded ? 'Show Less' : 'Read Summary'}
      </button>

      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-stone-200/50 animate-fade-in-up">
          <button 
            // Fix: Access trendName
            onClick={() => onLearnMore(trend.trendName)}
            className="w-full text-center text-[11px] font-bold text-fodda-accent hover:text-white hover:bg-fodda-accent py-2 rounded-lg transition-all duration-200 border border-fodda-accent/30 hover:border-fodda-accent uppercase tracking-tighter"
          >
            Learn more about this trend
          </button>
        </div>
      )}
    </div>
  );
};

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ articles, trends, vertical, isOpen, onClose, isLoading, onTrendLearnMore, onOpenAbout, highlightedItem, hasMessages }) => {
  const scrollAttemptRef = useRef<number>(0);

  useEffect(() => {
    if (highlightedItem && isOpen && !isLoading) {
      const pollAndScroll = () => {
        const elementId = `${highlightedItem.type}-${highlightedItem.id}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrollAttemptRef.current = 0;
        } else if (scrollAttemptRef.current < 5) {
          scrollAttemptRef.current++;
          setTimeout(pollAndScroll, 100);
        }
      };
      pollAndScroll();
    }
  }, [highlightedItem, isOpen, isLoading, articles, trends]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 h-full bg-white border-l border-stone-200 shadow-xl overflow-y-auto flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-16 px-6 border-b border-stone-100 bg-stone-50/50 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-center shrink-0">
          <h2 className="font-serif font-bold text-lg text-stone-900">Evidence Panel</h2>
          <button onClick={onClose} className="md:hidden p-2 text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {isLoading ? (
            <div className="animate-pulse space-y-8">
              <div className="h-32 bg-stone-100 rounded-lg"></div>
              <div className="h-32 bg-stone-100 rounded-lg"></div>
            </div>
          ) : (
            <>
              {trends.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Referenced Trends</h3>
                  <div className="space-y-4">
                    {trends.map(t => (
                      <TrendCard key={t.trendId} trend={t} onLearnMore={onTrendLearnMore} isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === t.trendId} />
                    ))}
                  </div>
                </div>
              )}
              {articles.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Source Articles</h3>
                  <div className="space-y-4">
                    {articles.map(a => (
                      <div key={a.articleId} id={`article-${a.articleId}`} className={`p-4 rounded-lg border transition-all duration-500 ${highlightedItem?.type === 'article' && highlightedItem?.id === a.articleId ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' : 'bg-white border-stone-200 hover:border-fodda-accent/30'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-mono text-stone-400">ID: {a.articleId}</span>
                          <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-fodda-accent font-bold uppercase hover:underline flex items-center">
                            Source
                            <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        </div>
                        <h4 className="text-sm font-medium text-stone-900 mb-2 leading-snug">{a.title}</h4>
                        {/* Fix: Access snippet or summary */}
                        <p className="text-xs text-stone-600 italic bg-stone-50 p-2.5 rounded border border-stone-100 leading-relaxed">{a.snippet || a.summary || ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && trends.length === 0 && articles.length === 0 && hasMessages && (
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-stone-400 font-medium italic">No specific evidence records retrieved for this query.</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 mt-auto border-t border-stone-100 bg-stone-50/30 shrink-0">
          <div className="relative group">
            <p className="text-[9px] text-stone-400/80 leading-tight font-medium italic pr-7">
              This is a working demo of Fodda’s approach to grounded, traceable AI. It uses curated expert context to improve accuracy and eliminate hallucinations.
            </p>
            <button 
              onClick={onOpenAbout}
              className="absolute top-0 right-0 p-1 text-fodda-accent/70 hover:text-fodda-accent hover:bg-purple-50 rounded-full transition-all flex items-center justify-center"
              title="Learn more about this demo"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
