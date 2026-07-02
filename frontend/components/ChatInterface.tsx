import React, { useRef, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { LayoutDashboard, Search, Building2, Briefcase } from 'lucide-react';
import { Message, Vertical, KnowledgeGraph } from '../../shared/types';
import { SUGGESTED_QUESTIONS } from '../../shared/constants';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  vertical: Vertical;
  inputValue: string;
  onInputChange: (val: string) => void;
  onSendMessage: (msg: string, terms?: string[], promptSource?: string) => void;
  onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string, text?: string) => void;
  onToggleSidebar: () => void;
  onToggleEvidence: () => void;
  contextChips?: React.ReactNode;
  graphCatalog?: KnowledgeGraph[];
  isExpertChat?: boolean;
}

const StaggeredMessageContent: React.FC<{
  messageId: string;
  content: string;
  isNew: boolean;
  onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string, text?: string) => void
}> = ({ messageId, content, isNew, onAnchorClick }) => {
  const sections = useMemo(() => content ? content.split(/(?=\n#|(?<=^)#)/g) : [], [content]);

  const markdownComponents = {
    h1: ({ node: _node, ...props }: React.ComponentPropsWithoutRef<'h1'> & { node?: any }) => (
      <h1 className="font-mono text-[10px] font-semibold text-ink-3 uppercase tracking-[0.22em] mt-4 mb-1.5 border-b border-line pb-1" {...props} />
    ),
    h2: ({ node: _node, ...props }: React.ComponentPropsWithoutRef<'h2'> & { node?: any }) => (
      <h2 className="font-serif italic text-[18px] font-medium text-ink tracking-tight mt-6 mb-2 leading-snug block last:mb-0" {...props} />
    ),
    h3: ({ node: _node, ...props }: React.ComponentPropsWithoutRef<'h3'> & { node?: any }) => (
      <h3 className="font-serif italic text-[15px] font-medium text-ink tracking-tight mt-4 mb-1.5 leading-snug block last:mb-0" {...props} />
    ),
    a: ({ node: _node, href, children, ...props }: React.ComponentPropsWithoutRef<'a'> & { node?: any }) => {
      if (!href) return <span className="text-brand underline font-medium" {...props}>{children}</span>;

      const isAnchor = href.startsWith('#') || href.startsWith('trend-') || href.startsWith('article-');

      if (isAnchor) {
        const hash = href.replace(/^#/, '');
        let type: 'trend' | 'article' = 'article';
        let id = hash;

        const lowerHash = hash.toLowerCase();
        if (lowerHash.startsWith('trend-')) {
          type = 'trend';
          id = hash.split('-').slice(1).join('-');
        } else if (lowerHash.startsWith('article-')) {
          type = 'article';
          id = hash.split('-').slice(1).join('-');
        }

        const textContent = React.Children.toArray(children).join('');

        return (
          <span
            onClick={(e) => {
              e.preventDefault();
              onAnchorClick?.(messageId, type, id, textContent);
            }}
            className="hover:text-brand cursor-pointer transition-all underline underline-offset-2 decoration-brand/40 decoration-solid hover:decoration-brand/80 inline-flex items-baseline group/link decoration-1 border-b border-transparent font-medium"
          >
            <span className="leading-none">{children}</span>
            <svg className="w-2.5 h-2.5 ml-0.5 opacity-40 group-hover/link:opacity-100 transform group-hover/link:translate-x-0.5 transition-all text-brand shrink-0 relative top-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        );
      }
      return <a href={href} className="text-brand underline font-medium hover:text-brand-dark transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
    code: ({ node: _node, inline: _inline, className: _className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { node?: any, inline?: boolean }) => {
      const content = String(children).trim();
      // Check for markdown link pattern: [Title](#id) or [Title](id) using regex
      const linkMatch = content.match(/\[(.*?)\]\((#?)(.*?)\)/);

      if (linkMatch) {
        const [_, text, hashPrefix, hash] = linkMatch;
        let type: 'trend' | 'article' = 'article';
        let id = hash;

        const lowerHash = hash.toLowerCase();
        if (lowerHash.startsWith('trend-')) {
          type = 'trend';
          id = hash.split('-').slice(1).join('-');
        } else if (lowerHash.startsWith('article-')) {
          type = 'article';
          id = hash.split('-').slice(1).join('-');
        }

        // Clean up text if it starts with ## or similar artifacts
        const cleanText = text.replace(/^##\s*/, '');

        if (id) {
          return (
            <span
              onClick={(e) => {
                e.preventDefault();
                onAnchorClick?.(messageId, type, id, cleanText);
              }}
              className="hover:text-brand cursor-pointer transition-all underline underline-offset-2 decoration-brand/40 decoration-solid hover:decoration-brand/80 inline-flex items-baseline group/link decoration-1 border-b border-transparent font-medium"
            >
              <span className="leading-none">{cleanText}</span>
              <svg className="w-2.5 h-2.5 ml-0.5 opacity-40 group-hover/link:opacity-100 transform group-hover/link:translate-x-0.5 transition-all text-brand shrink-0 relative top-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          );
        }
      }

      return (
        <code className="bg-line-soft text-ink-2 px-1.5 py-0.5 rounded font-mono text-[11px] border border-line" {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="space-y-1">
      {sections.map((section, index) => (
        <div key={index} className={isNew ? "opacity-0 animate-fade-in-up" : ""} style={isNew ? { animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' } : {}}>
          <div className="prose prose-sm max-w-none 
            prose-p:font-sans prose-p:text-ink-2 prose-p:leading-relaxed prose-p:mb-3 last:prose-p:mb-0
            prose-li:text-ink-2 prose-li:leading-relaxed prose-li:mb-1
            prose-ul:my-2 prose-ul:pl-4
            prose-strong:text-ink prose-strong:font-semibold 
            marker:text-ink-4
            prose-headings:text-ink prose-headings:font-serif">
            <ReactMarkdown components={markdownComponents}>
              {section}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isProcessing,
  vertical,
  inputValue,
  onInputChange,
  onSendMessage,
  onAnchorClick,
  onToggleSidebar,
  onToggleEvidence,
  contextChips,
  graphCatalog,
  isExpertChat = false
}) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isBaseline = vertical === Vertical.Baseline;
  const isSIC = vertical === Vertical.SIC;
  const isWaldo = vertical === Vertical.Waldo;
  const isRetail = vertical === Vertical.Retail;
  const isSports = vertical === Vertical.Sports;
  const isBeauty = vertical === Vertical.Beauty;

  const VerticalIcon = useMemo(() => {
    if (isBaseline) return LayoutDashboard;
    if (isWaldo) return Search;
    if (isSIC) return Building2;
    return Briefcase; // Default/PSFK
  }, [isBaseline, isWaldo, isSIC]);

  const headerLabel = useMemo(() => {
    const catalogItem = graphCatalog?.find(g => g.id === vertical);
    if (catalogItem?.name) return catalogItem.name;

    if (isBaseline) return 'Pew Public Beliefs Graph';
    if (isSIC) return 'SIC Graph (Beta)';
    if (isWaldo) return 'Waldo Trends Graph';
    if (isRetail) return 'Future of Retail Graph';
    if (isSports) return 'Future of Sports Graph';
    if (isBeauty) return 'Future of Beauty Graph';
    return `${vertical} Graph`;
  }, [vertical, isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty, graphCatalog]);

  const welcomeTitle = useMemo(() => {
    const catalogItem = graphCatalog?.find(g => g.id === vertical);
    if (catalogItem?.headline) return catalogItem.headline;

    if (isBaseline) return 'Measured Public Reality.';
    if (isSIC) return 'Contemporary Intelligence, Mapped.';
    if (isWaldo) return 'Multi-Industry Sector Trends & Evidence.';
    if (isRetail) return 'Retail Sector Future Trends & Current Signals.';
    if (isSports) return 'Sports Sector Future Trends & Current Signals.';
    if (isBeauty) return 'Beauty Sector Future Trends & Current Signals.';
    return 'Traceable Strategic Discovery.';
  }, [vertical, isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty, graphCatalog]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;
    onSendMessage(inputValue);
  };

  useEffect(() => {
    if (messages.length > 0) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const handleCopy = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = (message: Message, format: 'txt' | 'json') => {
    let content = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (format === 'txt') {
      content = message.content;
    } else {
      content = JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        vertical: vertical,
        evidence: message.evidence,
        trends: message.relatedTrends
      }, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fodda-export-${message.id}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cream relative overflow-hidden">
      <div className="h-16 border-b border-line flex items-center justify-center bg-paper/95 backdrop-blur-md sticky top-0 z-30 shrink-0 md:hidden">
        <div className="w-full max-w-3xl flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center">
            <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 mr-2 text-ink-3 hover:text-ink hover:bg-line-soft rounded-md transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center h-16 relative">
              <span className="font-serif italic text-sm tracking-tight text-ink">{headerLabel}</span>
            </div>
          </div>
          <button onClick={onToggleEvidence} className="p-2 text-brand hover:bg-brand-soft rounded-lg transition-all flex items-center space-x-2 md:hidden">
            <span className="text-[10px] font-bold uppercase tracking-widest">{isBaseline ? 'Method' : 'Evidence'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 space-y-0 scroll-smooth pb-32 bg-cream">


        {messages.map((msg, index) => (
          <div key={msg.id} className="w-full border-b border-line/60 py-4">
            <div className="max-w-3xl mx-auto px-4 md:px-8">

              {msg.role === 'user' ? (
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-md bg-line-soft flex items-center justify-center text-ink-3">
                    <span className="text-[10px] font-medium font-sans">You</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="bg-cream border border-line rounded-[14px] px-4 py-3 text-sm text-ink-2 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white ${isBaseline ? 'bg-ink-3' : 'bg-brand'}`}>
                    <VerticalIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <StaggeredMessageContent
                      messageId={msg.id}
                      content={msg.content}
                      isNew={index === messages.length - 1}
                      onAnchorClick={onAnchorClick}
                    />

                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2 animate-fade-in-up justify-start pl-1" style={{ animationDelay: '500ms' }}>
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSendMessage(q, undefined, 'followup')}
                            className="px-3 py-1.5 bg-paper border border-line rounded-md text-[10px] font-medium text-ink-3 hover:text-brand hover:border-brand/30 hover:bg-brand-soft transition-all shadow-sm active:scale-95 text-left font-mono"
                          >
                            {"›"} {q}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 pt-3 border-t border-line flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex items-center space-x-2">
                        {/* Index diagnostic hidden — available via Diagnostic Console instead
                        {msg.diagnostic && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-ink-4 uppercase tracking-widest">Index:</span>
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${msg.diagnostic.dataStatus.includes('TREND') ? 'text-green-600' : 'text-ink-3'}`}>
                              {msg.diagnostic.dataStatus}
                            </span>
                          </div>
                        )}
                        */}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleDownload(msg, 'txt')}
                          className="text-[9px] font-bold uppercase tracking-widest font-mono text-ink-4 hover:text-ink transition-colors"
                        >
                          TXT
                        </button>
                        <button
                          onClick={() => handleDownload(msg, 'json')}
                          className="text-[9px] font-bold uppercase tracking-widest font-mono text-ink-4 hover:text-ink transition-colors"
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => handleCopy(msg)}
                          className={`text-[9px] font-bold uppercase tracking-widest font-mono flex items-center group transition-colors ${copiedId === msg.id ? 'text-green-600' : 'text-ink-4 hover:text-ink'}`}
                        >
                          {copiedId === msg.id ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start w-full max-w-3xl mx-auto px-4 md:px-8 mt-4">
            <div className="bg-brand-soft px-4 py-3 rounded-md border border-brand/10 flex items-center space-x-3 animate-pulse">
              <VerticalIcon className="w-4 h-4 text-brand" />
              <span className="text-[10px] font-mono text-brand font-bold uppercase tracking-widest">
                {isBaseline ? 'PROCESSING_DATA' : 'ANALYZING_GRAPH'}
              </span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div >

      <div className="px-4 md:px-8 py-4 bg-paper border-t border-line z-10 shrink-0 pb-safe">
        {messages.length === 0 && (
          <div className="max-w-3xl mx-auto mb-3 pl-0.5 animate-fade-in-up">
            <div className="flex flex-wrap gap-2">
              {(() => {
                // Perform a case-insensitive search in graphCatalog
                const catalogGraph = graphCatalog?.find(
                  g => g.id.toLowerCase() === vertical.toLowerCase()
                );
                const dynamicQueries = catalogGraph?.example_queries;

                if (dynamicQueries && dynamicQueries.length > 0) {
                  return dynamicQueries.map((q: string, i: number) => (
                    <button key={i} onClick={() => onSendMessage(q, undefined, 'welcome_catalog')} className="px-3 py-1.5 bg-paper border border-line rounded-full text-xs font-medium text-ink-2 hover:text-brand hover:border-brand/30 hover:bg-brand-soft transition-all shadow-sm">
                      {q}
                    </button>
                  ));
                } else if (isBaseline) {
                  return ["How often do older Americans use TikTok?", "Perceptions of crime safety by age", "Broadband access among urban populations", "Trust in government protection"].map((q, i) => (
                    <button key={i} onClick={() => onSendMessage(q)} className="px-3 py-1.5 bg-paper border border-line rounded-full text-xs font-medium text-ink-2 hover:text-brand hover:border-brand/30 hover:bg-brand-soft transition-all shadow-sm">
                      {q}
                    </button>
                  ));
                } else {
                  // In Expert Chat, never fall back to static PSFK domain questions (only show expert's own example queries)
                  if (isExpertChat) {
                    return null;
                  }

                  // Also block static fallback if the active catalog graph is an expert or industry report
                  const isExpertOrReport = catalogGraph && (catalogGraph.graph_type === 'expert' || catalogGraph.graph_type === 'industry_report' || catalogGraph.graph_type === 'industry report');
                  if (isExpertOrReport) {
                    return null;
                  }

                  // Case-insensitive lookup in SUGGESTED_QUESTIONS
                  const staticQuestionsKey = Object.keys(SUGGESTED_QUESTIONS).find(
                    k => k.toLowerCase() === vertical.toLowerCase()
                  );
                  const staticQuestions = staticQuestionsKey
                    ? SUGGESTED_QUESTIONS[staticQuestionsKey as Exclude<Vertical, Vertical.Baseline>]
                    : undefined;

                  if (staticQuestions?.length) {
                    return staticQuestions.map((q, i) => (
                      <button key={i} onClick={() => onSendMessage(q.text, q.terms, 'welcome_static')} className="px-3 py-1.5 bg-paper border border-line rounded-full text-xs font-medium text-ink-2 hover:text-brand hover:border-brand/30 hover:bg-brand-soft transition-all shadow-sm">
                        {q.text}
                      </button>
                    ));
                  }
                  return null;
                }
              })()}
            </div>
          </div>
        )}
        {contextChips && (
          <div className="max-w-3xl mx-auto mb-2 pl-0.5">
            {contextChips}
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex items-center bg-paper border border-line rounded-[14px] shadow-sm focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/20 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isBaseline ? "Ask a question..." : `Identify signals in ${vertical.toLowerCase()}...`}
            className="flex-1 bg-transparent border-none rounded-[14px] px-3 py-2.5 text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:ring-0 transition-all h-10 font-sans"
            disabled={isProcessing}
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing} className="p-2 mr-1 text-ink-4 hover:text-brand disabled:opacity-20 transition-all shrink-0 rounded hover:bg-brand-soft">
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-ink-4 border-t-brand rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
            )}
          </button>
        </form>
        <div className="max-w-3xl mx-auto mt-2 text-[10px] text-ink-4 text-center font-sans">
          Fodda can make mistakes. Verify important information.
        </div>
      </div>
    </div >
  );
};
