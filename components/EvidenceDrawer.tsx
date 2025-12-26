
import React, { useState, useEffect } from 'react';
// Update: Align types with shared/types
import { Article, Trend, Vertical } from '../shared/types';

interface EvidenceDrawerProps {
  articles: Article[];
  trends: Trend[];
  vertical: Vertical;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onTrendLearnMore: (trendName: string) => void;
  highlightedItem?: { type: 'trend' | 'article', id: string } | null;
  hasMessages: boolean;
}

const TrendCard: React.FC<{ trend: Trend; onLearnMore: (name: string) => void; isHighlighted: boolean }> = ({ trend, onLearnMore, isHighlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setIsExpanded(true);
    }
  }, [isHighlighted]);

  return (
    <div 
      // Fix: Access trendId
      id={`trend-${trend.trendId}`}
      className={`p-4 rounded-lg border transition-all duration-500
        ${isHighlighted 
          ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' 
          : 'bg-stone-50 border-stone-200/60 hover:border-stone-300'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono text-fodda-accent bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100/50">
          {/* Fix: Access trendId */}
          ID: {trend.trendId}
        </span>
      </div>
      {/* Fix: Access trendName */}
      <h4 className="text-sm font-semibold text-stone-800 leading-tight mb-2">{trend.trendName}</h4>
      
      <div className={`relative`}>
        {/* Fix: Access trendDescription */}
        <p className={`text-xs text-stone-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
          {trend.trendDescription}
        </p>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-[10px] text-stone-400 hover:text-stone-600 font-medium mt-2 focus:outline-none"
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
            // Fix: Access trendName
            onClick={() => onLearnMore(trend.trendName)}
            className="w-full text-center text-xs font-medium text-fodda-accent hover:text-white hover:bg-fodda-accent py-1.5 rounded transition-colors duration-200 border border-fodda-accent/20 hover:border-fodda-accent"
          >
            Learn more about this trend
          </button>
        </div>
      )}
    </div>
  );
};

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ articles, trends, vertical, isOpen, onClose, isLoading, onTrendLearnMore, highlightedItem, hasMessages }) => {
  useEffect(() => {
    if (highlightedItem && isOpen && !isLoading) {
      setTimeout(() => {
        const elementId = `${highlightedItem.type}-${highlightedItem.id}`;
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightedItem, isOpen, isLoading]);

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 right-0 z-50 w-80 h-full bg-white border-l border-stone-200 shadow-xl overflow-y-auto flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:shadow-none md:z-10
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-16 px-6 border-b border-stone-100 bg-stone-50/50 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-center shrink-0">
          <div className="flex flex-col justify-center">
            <h2 className="font-serif font-bold text-lg text-stone-900 leading-none">Evidence</h2>
            <p className="text-[10px] text-stone-500 mt-1 leading-none">Grounding Graph</p>
          </div>
          <button onClick={onClose} className="md:hidden p-2 text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {isLoading ? (
             <div className="space-y-8 animate-pulse">
               <div>
                  <div className="h-3 w-24 bg-stone-200 rounded mb-4"></div>
                  <div className="h-32 bg-stone-100 rounded-lg"></div>
               </div>
               <div>
                  <div className="h-3 w-24 bg-stone-200 rounded mb-4"></div>
                  <div className="h-24 bg-stone-100 rounded-lg mb-3"></div>
               </div>
             </div>
          ) : (
            <>
              {!hasMessages && (
                  <div className="text-center py-10 px-4 opacity-60">
                      <p className="text-sm text-stone-400 font-medium italic leading-relaxed">Evidence for the results of this {vertical} graph will be displayed here</p>
                  </div>
              )}

              {hasMessages && trends.length === 0 && articles.length === 0 && (
                  <div className="text-center py-10 text-stone-400">
                      <p className="text-sm italic">No specific evidence retrieved for the last query.</p>
                  </div>
              )}

              {trends.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center">
                    <span className="w-1.5 h-1.5 bg-stone-300 rounded-full mr-2"></span>
                    Referenced Trends
                  </h3>
                  <div className="space-y-4">
                    {trends.map((trend) => (
                      <TrendCard 
                        key={trend.trendId} 
                        trend={trend} 
                        onLearnMore={onTrendLearnMore}
                        isHighlighted={highlightedItem?.type === 'trend' && highlightedItem?.id === trend.trendId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {articles.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center">
                    <span className="w-1.5 h-1.5 bg-stone-300 rounded-full mr-2"></span>
                    Source Articles
                  </h3>
                  <div className="space-y-4">
                    {articles.map((article) => {
                      // Fix: Access articleId
                      const isHighlighted = highlightedItem?.type === 'article' && highlightedItem?.id === article.articleId;
                      return (
                        <div 
                          key={article.articleId} 
                          id={`article-${article.articleId}`}
                          className={`group p-4 rounded-lg border transition-all duration-500
                            ${isHighlighted 
                              ? 'bg-purple-50 border-fodda-accent shadow-md ring-1 ring-fodda-accent/20' 
                              : 'bg-white border-stone-200 hover:border-fodda-accent/30 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            {/* Fix: Access articleId */}
                            <span className="text-[10px] font-mono text-stone-400">ID: {article.articleId}</span>
                            <a 
                              href={article.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-fodda-accent hover:underline flex items-center bg-purple-50/50 px-2 py-0.5 rounded-full"
                            >
                              Source Link
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          </div>
                          <h4 className="text-sm font-medium text-stone-900 leading-snug mb-2 group-hover:text-fodda-accent transition-colors">
                            {article.title}
                          </h4>
                          {/* Fix: Access snippet or summary */}
                          <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded italic leading-relaxed border border-stone-100">"{article.snippet || article.summary || ""}"</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Demo Capability Box (Moved here) */}
        <div className="p-6 mt-auto border-t border-stone-100 bg-stone-50/30">
          <div className="bg-white p-3.5 rounded-lg border border-stone-200 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-1.5 h-1.5 bg-fodda-accent rounded-full"></div>
              <h3 className="font-serif font-bold text-stone-800 text-xs">Demo Capability</h3>
            </div>
            <p className="text-[10px] text-stone-500 leading-relaxed font-medium">
              This demo proves how structured context improves LLM accuracy. Every insight and example above is grounded in the PSFK-curated {vertical} dataset, preventing hallucinations and ensuring traceable, expert-led intelligence.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
