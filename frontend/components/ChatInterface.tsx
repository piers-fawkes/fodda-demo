import React, { useRef, useEffect, useMemo, useState } from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import ReactMarkdown from 'react-markdown';
import { LayoutDashboard, Search, Building2, Briefcase, Sparkles } from 'lucide-react';
import { Message, Vertical, KnowledgeGraph } from '../../shared/types';
import { SUGGESTED_QUESTIONS } from '../../shared/constants';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  vertical: Vertical | string;
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

  // ─── Dynamic 4 Catalog Chips (Selected Graph + Popular Categories) ───
  const welcomeChips = useMemo(() => {
    if (!graphCatalog || graphCatalog.length === 0) {
      // Fallback to static questions when Airtable is unreachable
      const staticQuestionsKey = Object.keys(SUGGESTED_QUESTIONS).find(
        k => k.toLowerCase() === (vertical || '').toLowerCase()
      );
      const staticQuestions = staticQuestionsKey
        ? SUGGESTED_QUESTIONS[staticQuestionsKey as Exclude<Vertical, Vertical.Baseline>]
        : SUGGESTED_QUESTIONS[Vertical.Retail] || [];
      return staticQuestions.slice(0, 4).map(q => ({ text: q.text, terms: q.terms, source: 'welcome_static' as const }));
    }

    const currentId = (vertical || '').toLowerCase();
    const catalogGraph = graphCatalog.find(
      g => g.id.toLowerCase() === currentId || (g.verticalName && g.verticalName.toLowerCase() === currentId)
    );

    const chips: Array<{ text: string; terms?: string[]; source: 'welcome_catalog' | 'welcome_static' }> = [];

    // 1. Up to 2 chips from the user's selected graph
    const selectedQueries = (catalogGraph?.example_queries || []).filter(q => q && q.trim().length > 0);
    if (selectedQueries.length > 0) {
      chips.push(...selectedQueries.slice(0, 2).map(q => ({ text: q, source: 'welcome_catalog' as const })));
    }

    // 2. 2 chips from graphs the log shows people actually ask about next:
    // Gen Z / Culture (sic/culture), Health & Longevity (beauty/health/longevity), F&B (food/f&b), Sports (sports)
    const priorityCategories = ['sic', 'beauty', 'food', 'sport', 'health', 'longevity', 'retail', 'culture', 'gen z'];
    const otherGraphs = graphCatalog.filter(g => {
      const gid = g.id.toLowerCase();
      const dom = (g.domain || '').toLowerCase();
      const vname = (g.verticalName || '').toLowerCase();
      const gTopics = (g.topics || []).map(t => t.toLowerCase());
      if (gid === currentId) return false;
      if (!g.example_queries || g.example_queries.length === 0) return false;
      return priorityCategories.some(cat => gid.includes(cat) || dom.includes(cat) || vname.includes(cat) || gTopics.some(t => t.includes(cat)));
    });

    for (const g of otherGraphs) {
      if (chips.length >= 4) break;
      const gQueries = (g.example_queries || []).filter(q => q && q.trim().length > 0 && !chips.some(c => c.text === q));
      if (gQueries.length > 0) {
        chips.push({ text: gQueries[0], source: 'welcome_catalog' as const });
      }
    }

    // If still under 4 chips, backfill from any remaining catalog graph example_queries
    if (chips.length < 4) {
      for (const g of graphCatalog) {
        if (chips.length >= 4) break;
        for (const q of (g.example_queries || [])) {
          if (chips.length >= 4) break;
          if (q && q.trim().length > 0 && !chips.some(c => c.text === q)) {
            chips.push({ text: q, source: 'welcome_catalog' as const });
          }
        }
      }
    }

    // Final fallback only if no catalog queries existed at all
    if (chips.length === 0) {
      const staticQuestionsKey = Object.keys(SUGGESTED_QUESTIONS).find(
        k => k.toLowerCase() === (vertical || '').toLowerCase()
      );
      const staticQuestions = staticQuestionsKey
        ? SUGGESTED_QUESTIONS[staticQuestionsKey as Exclude<Vertical, Vertical.Baseline>]
        : SUGGESTED_QUESTIONS[Vertical.Retail] || [];
      return staticQuestions.slice(0, 4).map(q => ({ text: q.text, terms: q.terms, source: 'welcome_static' as const }));
    }

    return chips.slice(0, 4);
  }, [graphCatalog, vertical]);

  // Cycle orb state through the MCP pipeline phases while processing
  const ORB_CYCLE: OrbState[] = ['searching', 'solving', 'composing'];
  const ORB_LABELS: Record<OrbState, string> = {
    searching:  'SEARCHING_GRAPH',
    solving:    'SOLVING_QUERY',
    composing:  'COMPOSING_ANSWER',
    working:    'WORKING',
    listening:  'LISTENING',
    connecting: 'CONNECTING',
    weaving:    'WEAVING',
    breathing:  'BREATHING',
    shaping:    'SHAPING',
  };
  const [orbStateIdx, setOrbStateIdx] = useState(0);
  const orbState = ORB_CYCLE[orbStateIdx % ORB_CYCLE.length]!;

  useEffect(() => {
    if (!isProcessing) {
      setOrbStateIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setOrbStateIdx(prev => (prev + 1) % ORB_CYCLE.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const isUnscoped = !vertical || vertical === 'all';
  const isBaseline = vertical === Vertical.Baseline;
  const isSIC = vertical === Vertical.SIC;
  const isWaldo = vertical === Vertical.Waldo;
  const isRetail = vertical === Vertical.Retail;
  const isSports = vertical === Vertical.Sports;
  const isBeauty = vertical === Vertical.Beauty;

  const VerticalIcon = useMemo(() => {
    if (isUnscoped) return Sparkles;
    if (isBaseline) return LayoutDashboard;
    if (isWaldo) return Search;
    if (isSIC) return Building2;
    return Briefcase; // Default/PSFK
  }, [isUnscoped, isBaseline, isWaldo, isSIC]);

  const headerLabel = useMemo(() => {
    if (isUnscoped) return 'All Graphs';
    const catalogItem = graphCatalog?.find(g => g.id === vertical);
    if (catalogItem?.name) return catalogItem.name;

    if (isBaseline) return 'Pew Public Beliefs Graph';
    if (isSIC) return 'SIC Graph (Beta)';
    if (isWaldo) return 'Waldo Trends Graph';
    if (isRetail) return 'Future of Retail Graph';
    if (isSports) return 'Future of Sports Graph';
    if (isBeauty) return 'Future of Beauty Graph';
    return `${vertical} Graph`;
  }, [vertical, isUnscoped, isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty, graphCatalog]);

  const welcomeTitle = useMemo(() => {
    if (isUnscoped) return 'Traceable Strategic Discovery.';
    const catalogItem = graphCatalog?.find(g => g.id === vertical);
    if (catalogItem?.headline) return catalogItem.headline;

    if (isBaseline) return 'Measured Public Reality.';
    if (isSIC) return 'Contemporary Intelligence, Mapped.';
    if (isWaldo) return 'Multi-Industry Sector Trends & Evidence.';
    if (isRetail) return 'Retail Sector Future Trends & Current Signals.';
    if (isSports) return 'Sports Sector Future Trends & Current Signals.';
    if (isBeauty) return 'Beauty Sector Future Trends & Current Signals.';
    return 'Traceable Strategic Discovery.';
  }, [vertical, isUnscoped, isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty, graphCatalog]);

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
                    {/* Message Content (suppress raw 'No response generated.' if a classified failure card is shown) */}
                    {!(msg.content === 'No response generated.' && (msg as any).failureType) && (
                      <StaggeredMessageContent
                        messageId={msg.id}
                        content={msg.content}
                        isNew={index === messages.length - 1}
                        onAnchorClick={onAnchorClick}
                      />
                    )}

                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-4 space-y-1.5 animate-fade-in-up pl-1" style={{ animationDelay: '300ms' }}>
                        {msg.suggestedQuestions.slice(0, 3).map((line, idx) => {
                          const sources = ['next_moves_thread', 'next_moves_specific', 'next_moves_scope'];
                          const source = sources[idx] || 'next_moves_thread';
                          return (
                            <button
                              key={idx}
                              onClick={() => onSendMessage(line, undefined, source)}
                              className="w-full text-left px-3.5 py-2 bg-paper hover:bg-brand-soft border border-line hover:border-brand/30 rounded-xl text-xs text-ink-2 hover:text-brand transition-all flex items-center justify-between group shadow-2xs"
                            >
                              <span className="font-sans font-medium">{line}</span>
                              <span className="text-ink-4 group-hover:text-brand text-xs font-mono ml-2 shrink-0 transition-transform group-hover:translate-x-0.5">→</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Classified Failure States */}
                    {(msg as any).failureType === 'NO_COVERAGE' && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-red-800">No coverage found in this domain today.</p>
                        <p className="text-xs text-red-600">We don't have indexed evidence nodes matching this topic yet.</p>
                        <button onClick={() => onSendMessage(`[Coverage Request] ${msg.content}`)} className="px-3 py-1.5 bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-red-700 transition-colors">
                          Request Coverage
                        </button>
                      </div>
                    )}

                    {(msg as any).failureType === 'DIDNT_ROUTE' && (
                      <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-purple-900">Unable to route query to an available graph or tool.</p>
                        <p className="text-xs text-purple-700">Try selecting a specific expert graph from the dropdown above, or phrase your prompt around a specific domain or topic (e.g. &ldquo;Show me signals on sustainability in retail&rdquo;).</p>
                      </div>
                    )}

                    {(msg as any).failureType === 'TIMEOUT' && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-amber-900">Execution cap reached (45s timeout).</p>
                        <p className="text-xs text-amber-700">The deep evidence loop timed out. You can retry with a specific graph scope.</p>
                        <button onClick={() => onSendMessage(msg.content)} className="px-3 py-1.5 bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-amber-800 transition-colors">
                          Retry Query
                        </button>
                      </div>
                    )}

                    {/* Footer Receipts & Actions */}
                    <div className="mt-6 pt-3 border-t border-line flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-wider bg-cream px-2 py-0.5 rounded border border-line">
                          {((msg as any).stepCount || (msg as any).toolCalls?.length || 1)} {((msg as any).stepCount || (msg as any).toolCalls?.length || 1) === 1 ? 'step' : 'steps'} · {((msg as any).stepCount || (msg as any).toolCalls?.length || 1)} queries
                        </span>
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
          <div className="flex items-start gap-3 w-full max-w-3xl mx-auto px-4 md:px-8 mt-4 animate-fade-in">
            {/* Orb sits in the same avatar slot as assistant messages */}
            <div className="shrink-0 w-16 h-16 -ml-1 -mt-1 flex items-center justify-center">
              <ThinkingOrb
                state={orbState}
                size={64}
                theme="light"
                aria-label={`Fodda is ${orbState}…`}
              />
            </div>
            <div className="flex flex-col justify-center pt-3 min-h-[40px]">
              <span
                key={orbState}
                className="text-[10px] font-mono text-brand font-bold uppercase tracking-widest opacity-0 animate-fade-in-up"
                style={{ animationDuration: '0.4s', animationFillMode: 'forwards' }}
              >
                {ORB_LABELS[orbState]}
              </span>
              <span className="text-[9px] font-mono text-ink-4 uppercase tracking-widest mt-0.5">
                {isBaseline ? 'via Pew Data Graph' : isUnscoped ? 'across all live graphs' : `via ${headerLabel}`}
              </span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div >

      <div className="px-4 md:px-8 py-4 bg-paper border-t border-line z-10 shrink-0 pb-safe">
        {contextChips && (
          <div className="max-w-3xl mx-auto mb-2 pl-0.5">
            {contextChips}
          </div>
        )}

        {/* Main Prompt Input */}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex items-center bg-paper border border-line rounded-[14px] shadow-sm focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/20 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isBaseline ? "Ask a question..." : isUnscoped ? "Ask anything — research across all live graphs..." : `Identify signals in ${vertical.toLowerCase()}...`}
            className="flex-1 bg-transparent border-none rounded-[14px] px-3 py-2.5 text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:ring-0 transition-all h-10 font-sans"
            disabled={isProcessing}
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing} className="p-2 mr-1 text-ink-4 hover:text-brand disabled:opacity-20 transition-all shrink-0 rounded hover:bg-brand-soft">
            {isProcessing ? (
              <ThinkingOrb
                state={orbState}
                size={20}
                theme="light"
                aria-label="Processing…"
                className="block"
              />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
            )}
          </button>
        </form>

        {/* Suggested Prompts (Chips) below the main prompt */}
        {messages.length === 0 && (
          <div className="max-w-3xl mx-auto mt-3 space-y-2 pl-0.5 animate-fade-in-up">
            <div className="flex flex-wrap gap-2">
              {welcomeChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(chip.text, chip.terms, chip.source)}
                  className="px-3 py-1.5 bg-paper border border-line rounded-full text-xs font-medium text-ink-2 hover:text-brand hover:border-brand/30 hover:bg-brand-soft transition-all shadow-sm active:scale-95 text-left"
                >
                  {chip.text}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto mt-2 text-[10px] text-ink-4 text-center font-sans">
          Fodda can make mistakes. Verify important information.
        </div>
      </div>
    </div >
  );
};
