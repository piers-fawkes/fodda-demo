import React, { useRef, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { LayoutDashboard, Search, Building2, Briefcase } from 'lucide-react';
import { Message, Vertical } from '../../shared/types';
import { SUGGESTED_QUESTIONS } from '../../shared/constants';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  vertical: Vertical;
  inputValue: string;
  onInputChange: (val: string) => void;
  onSendMessage: (msg: string, terms?: string[]) => void;
  onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string, text?: string) => void;
  onToggleSidebar: () => void;
  onToggleEvidence: () => void;
  contextChips?: React.ReactNode;
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
      <h1 className="font-sans text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.3em] mt-4 mb-1.5 border-b border-zinc-800 pb-1" {...props} />
    ),
    h2: ({ node: _node, ...props }: React.ComponentPropsWithoutRef<'h2'> & { node?: any }) => (
      <h2 className="font-sans text-[17px] font-bold text-white tracking-tight mt-6 mb-2 leading-snug block last:mb-0" {...props} />
    ),
    h3: ({ node: _node, ...props }: React.ComponentPropsWithoutRef<'h3'> & { node?: any }) => (
      <h3 className="font-sans text-[14px] font-semibold text-zinc-100 tracking-tight mt-4 mb-1.5 leading-snug block last:mb-0" {...props} />
    ),
    a: ({ node: _node, href, children, ...props }: React.ComponentPropsWithoutRef<'a'> & { node?: any }) => {
      if (href?.includes('#')) {
        const hash = href.split('#').pop() || '';
        let type: 'trend' | 'article' = 'article';
        let id = hash;

        const lowerHash = hash.toLowerCase();
        if (lowerHash.startsWith('trend-')) {
          type = 'trend';
          id = hash.split('-').slice(1).join('-'); // Handle IDs containing hyphens
        } else if (lowerHash.startsWith('article-')) {
          type = 'article';
          id = hash.split('-').slice(1).join('-'); // Handle IDs containing hyphens
        }

        const textContent = React.Children.toArray(children).join('');

        return (
          <span
            onClick={(e) => {
              e.preventDefault();
              onAnchorClick?.(messageId, type, id, textContent);
            }}
            className="hover:text-fodda-accent cursor-pointer transition-all underline underline-offset-2 decoration-fodda-accent/40 decoration-solid hover:decoration-fodda-accent/80 inline-flex items-baseline group/link decoration-1 border-b border-transparent"
          >
            <span className="leading-none">{children}</span>
            <svg className="w-2.5 h-2.5 ml-0.5 opacity-40 group-hover/link:opacity-100 transform group-hover/link:translate-x-0.5 transition-all text-fodda-accent shrink-0 relative top-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        );
      }
      return <a href={href} className="text-fodda-accent underline font-medium hover:text-white transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
    code: ({ node: _node, inline: _inline, className: _className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { node?: any, inline?: boolean }) => {
      const content = String(children).trim();
      // Check for markdown link pattern: [Title](#id) using regex
      const linkMatch = content.match(/\[(.*?)\]\(#(.*?)\)/);

      if (linkMatch) {
        const [_, text, hash] = linkMatch;
        let type: 'trend' | 'article' = 'article';
        let id = hash;

        const lowerHash = hash.toLowerCase();
        if (lowerHash.startsWith('trend-')) {
          type = 'trend';
          id = hash.substring(6);
        } else if (lowerHash.startsWith('article-')) {
          type = 'article';
          id = hash.substring(8);
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
              className="hover:text-fodda-accent cursor-pointer transition-all underline underline-offset-2 decoration-fodda-accent/40 decoration-solid hover:decoration-fodda-accent/80 inline-flex items-baseline group/link decoration-1 border-b border-white/10"
            >
              <span className="leading-none">{cleanText}</span>
              <svg className="w-2.5 h-2.5 ml-0.5 opacity-40 group-hover/link:opacity-100 transform group-hover/link:translate-x-0.5 transition-all text-fodda-accent shrink-0 relative top-[0.5px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          );
        }
      }

      return (
        <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-zinc-700/50" {...props}>
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
            prose-p:font-sans prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-3 last:prose-p:mb-0
            prose-li:text-zinc-300 prose-li:leading-relaxed prose-li:mb-1
            prose-ul:my-2 prose-ul:pl-4
            prose-strong:text-white prose-strong:font-semibold 
            marker:text-zinc-600
            prose-headings:text-white">
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
  contextChips
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
    if (isBaseline) return 'Pew Public Beliefs Graph';
    if (isSIC) return 'SIC Graph (Beta)';
    if (isWaldo) return 'Waldo Trends Graph';
    if (isRetail) return 'Future of Retail Graph';
    if (isSports) return 'Future of Sports Graph';
    if (isBeauty) return 'Future of Beauty Graph';
    return `${vertical} Graph`;
  }, [vertical, isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty]);

  const welcomeTitle = useMemo(() => {
    if (isBaseline) return 'Measured Public Reality.';
    if (isSIC) return 'Contemporary Intelligence, Mapped.';
    if (isWaldo) return 'Multi-Industry Sector Trends & Evidence.';
    if (isRetail) return 'Retail Sector Future Trends & Current Signals.';
    if (isSports) return 'Sports Sector Future Trends & Current Signals.';
    if (isBeauty) return 'Beauty Sector Future Trends & Current Signals.';
    return 'Traceable Strategic Discovery.';
  }, [isBaseline, isSIC, isWaldo, isRetail, isSports, isBeauty]);

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
    <div className="flex-1 flex flex-col h-full bg-black relative overflow-hidden">
      <div className="h-16 border-b border-white/10 flex items-center justify-center bg-black/95 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="w-full max-w-3xl flex items-center justify-between px-4 md:px-0">
          <div className="flex items-center">
            <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 mr-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center h-16 relative">
              <span className="font-semibold text-sm tracking-tight text-zinc-300">{headerLabel}</span>
            </div>
          </div>
          <button onClick={onToggleEvidence} className="p-2 text-fodda-accent hover:bg-white/5 rounded-lg transition-all flex items-center space-x-2 md:hidden">
            <span className="text-[10px] font-bold uppercase tracking-widest">{isBaseline ? 'Method' : 'Evidence'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 space-y-0 scroll-smooth pb-32 bg-black">
        {messages.length === 0 && (
          <div className="w-full max-w-3xl mx-auto mt-8 animate-fade-in-up px-4 md:px-0">
            <div className="mb-4 opacity-60 hover:opacity-100 transition-opacity">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1 font-mono">
                {headerLabel}
              </h2>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
                {welcomeTitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isBaseline ? (
                ["How often do older Americans use TikTok?", "Perceptions of crime safety by age", "Broadband access among urban populations", "Trust in government protection"].map((q, i) => (
                  <button key={i} onClick={() => onSendMessage(q)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all shadow-sm">
                    {q}
                  </button>
                ))
              ) : (
                SUGGESTED_QUESTIONS[vertical as Exclude<Vertical, Vertical.Baseline>].map((q, i) => (
                  <button key={i} onClick={() => onSendMessage(q.text, q.terms)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all shadow-sm">
                    {q.text}
                  </button>
                ))
              )}
            </div>
          </div>

        )}

        {messages.map((msg, index) => (
          <div key={msg.id} className="w-full border-b border-zinc-800/50 py-4">
            <div className="max-w-3xl mx-auto px-4 md:px-0">

              {msg.role === 'user' ? (
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-md bg-zinc-800/50 flex items-center justify-center text-zinc-400">
                    <span className="text-[10px] font-medium font-sans">You</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white ${isBaseline ? 'bg-zinc-800' : 'bg-fodda-accent'}`}>
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
                            onClick={() => onSendMessage(q)}
                            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-medium text-zinc-400 hover:text-white hover:border-fodda-accent/40 hover:bg-zinc-800 transition-all shadow-sm active:scale-95 text-left font-mono"
                          >
                            {">"} {q}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 pt-3 border-t border-zinc-900 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex items-center space-x-2">
                        {msg.diagnostic && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Index:</span>
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${msg.diagnostic.dataStatus.includes('TREND') ? 'text-green-500' : 'text-zinc-400'}`}>
                              {msg.diagnostic.dataStatus}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleDownload(msg, 'txt')}
                          className="text-[9px] font-bold uppercase tracking-widest font-mono text-zinc-600 hover:text-white transition-colors"
                        >
                          TXT
                        </button>
                        <button
                          onClick={() => handleDownload(msg, 'json')}
                          className="text-[9px] font-bold uppercase tracking-widest font-mono text-zinc-600 hover:text-white transition-colors"
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => handleCopy(msg)}
                          className={`text-[9px] font-bold uppercase tracking-widest font-mono flex items-center group transition-colors ${copiedId === msg.id ? 'text-green-500' : 'text-zinc-600 hover:text-white'}`}
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
          <div className="flex justify-start w-full max-w-3xl mx-auto px-4 md:px-0 mt-4">
            <div className="bg-zinc-900/50 px-4 py-3 rounded-md border border-zinc-800 flex items-center space-x-3 animate-pulse">
              <VerticalIcon className="w-4 h-4 text-zinc-500" />
              <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                {isBaseline ? 'PROCESSING_DATA' : 'ANALYZING_GRAPH'}
              </span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div >

      <div className="p-4 bg-black border-t border-zinc-800 z-10 shrink-0 pb-safe">
        {contextChips && (
          <div className="max-w-3xl mx-auto mb-2 pl-0.5">
            {contextChips}
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto flex items-center bg-zinc-900 border border-zinc-800 rounded-md shadow-sm focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={isBaseline ? "Ask a question..." : `Identify signals in ${vertical.toLowerCase()}...`}
            className="flex-1 bg-transparent border-none rounded-md px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-0 transition-all h-10 font-sans"
            disabled={isProcessing}
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing} className="p-2 mr-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-all shrink-0 rounded hover:bg-zinc-800">
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
            )}
          </button>
        </form>
        <div className="max-w-3xl mx-auto mt-2 text-[10px] text-zinc-600 text-center font-sans">
          Fodda can make mistakes. Verify important information.
        </div>
      </div>
    </div >
  );
};
