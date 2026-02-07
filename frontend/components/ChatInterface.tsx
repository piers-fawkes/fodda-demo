
import { Message, Vertical } from '../../shared/types';
import { SUGGESTED_QUESTIONS } from '../../shared/constants';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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
}

const StaggeredMessageContent: React.FC<{ 
    messageId: string; 
    content: string; 
    isNew: boolean; 
    onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string, text?: string) => void 
}> = ({ messageId, content, isNew, onAnchorClick }) => {
  const sections = useMemo(() => content ? content.split(/(?=\n#|(?<=^)#)/g) : [], [content]);
  
  const markdownComponents = {
    h1: ({node: _node, ...props}: any) => (
      <h1 className="font-serif text-[10px] font-bold text-stone-400 uppercase tracking-[0.4em] mt-8 mb-2 border-b border-stone-100 pb-2" {...props} />
    ),
    h2: ({node: _node, ...props}: any) => (
      <h2 className="font-serif text-xl font-bold text-stone-900 tracking-tight mt-10 mb-5 leading-tight block" {...props} />
    ),
    h3: ({node: _node, ...props}: any) => (
      <h3 className="font-serif text-base font-bold text-stone-900 tracking-tight mt-8 mb-3 leading-snug" {...props} />
    ),
    a: ({node: _node, href, children, ...props}: any) => {
      if (href?.includes('#')) {
        const hash = href.split('#').pop() || '';
        let type: 'trend' | 'article' = 'article';
        let id = hash;

        if (hash.startsWith('trend-')) {
          type = 'trend';
          id = hash.replace('trend-', '');
        } else if (hash.startsWith('article-')) {
          type = 'article';
          id = hash.replace('article-', '');
        }

        const textContent = React.Children.toArray(children).join('');
        
        return (
          <span 
            onClick={(e) => { 
              e.preventDefault(); 
              onAnchorClick?.(messageId, type, id, textContent); 
            }} 
            className="text-stone-800 font-semibold hover:text-fodda-accent cursor-pointer transition-all underline underline-offset-4 decoration-fodda-accent/20 decoration-solid hover:decoration-fodda-accent/60 inline-flex items-center group/link"
          >
            {children}
            <svg className="w-3 h-3 ml-1 opacity-20 group-hover/link:opacity-100 transform group-hover/link:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        );
      }
      return <a href={href} className="text-fodda-accent underline font-semibold" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
  };

  return (
    <div className="space-y-1">
      {sections.map((section, index) => (
        <div key={index} className={isNew ? "opacity-0 animate-fade-in-up" : ""} style={isNew ? { animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' } : {}}>
          <div className="prose prose-sm max-w-none prose-p:text-stone-700 prose-p:leading-relaxed prose-p:mb-6 prose-strong:text-stone-900 prose-li:text-stone-700">
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
  onToggleEvidence
}) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isBaseline = vertical === Vertical.Baseline;
  const isSIC = vertical === Vertical.SIC;
  const isWaldo = vertical === Vertical.Waldo;
  const isRetail = vertical === Vertical.Retail;
  const isSports = vertical === Vertical.Sports;
  const isBeauty = vertical === Vertical.Beauty;

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
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
      <div className="h-16 border-b border-stone-200 flex items-center justify-between px-4 md:px-6 bg-white/95 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center">
          <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 mr-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center h-16 relative">
            <span className="font-serif font-bold text-xl text-stone-900 tracking-tight">Fodda</span>
            <div className="flex items-center bg-stone-100 text-stone-600 rounded px-2 py-0.5 border border-stone-200 ml-2">
               <span className="text-[9px] font-bold uppercase tracking-widest">{headerLabel}</span>
            </div>
          </div>
        </div>
        <button onClick={onToggleEvidence} className="p-2 text-fodda-accent hover:bg-purple-50 rounded-lg transition-all flex items-center space-x-2 md:hidden">
          <span className="text-[10px] font-bold uppercase tracking-widest">{isBaseline ? 'Method' : 'Evidence'}</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-12 space-y-16 scroll-smooth pb-32 bg-stone-50/10">
        {messages.length === 0 && (
          <div className="min-h-full flex flex-col items-center justify-start max-w-2xl mx-auto pt-12">
             <div className="mb-12 text-center animate-fade-in-up">
                <div className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-bold mb-5">
                  {isBaseline ? 'Machine-Queryable Reference' : (isSIC ? 'Mapped Contemporary Intelligence' : 'Graph Intelligence')}
                </div>
                <h2 className="font-serif text-4xl font-bold text-stone-900 mb-5 tracking-tight">
                  {welcomeTitle}
                </h2>
                <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed">
                  {isBaseline 
                    ? "(\u03B2) Ask a question about public beliefs, attitudes, or behaviors. Responses are grounded strictly in weighted distributions from NPORS 2025. Please note this is test graph."
                    : (isSIC 
                        ? "Explore how shifts in culture, media, brands, and platforms are actually unfolding \u2014 grounded in real evidence you can trace."
                        : `Search the ${headerLabel} using natural language. Click headers to traverse supporting evidence.`)
                  }
                </p>
             </div>
             <div className="w-full max-w-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                {isBaseline ? (
                   ["How often do older Americans use TikTok?", "Perceptions of crime safety by age", "Broadband access among urban populations", "Trust in government protection"].map((q, i) => (
                      <button key={i} onClick={() => onSendMessage(q)} className="group text-left px-6 py-6 bg-white border border-stone-200 rounded-2xl hover:border-fodda-accent/40 hover:shadow-xl transition-all shadow-sm">
                         <span className="text-sm font-semibold text-stone-600 group-hover:text-stone-900 leading-snug block">{"\u201C"}{q}{"\u201D"}</span>
                      </button>
                   ))
                ) : (
                  SUGGESTED_QUESTIONS[vertical as Exclude<Vertical, Vertical.Baseline>].map((q, i) => (
                    <button key={i} onClick={() => onSendMessage(q.text, q.terms)} className="group text-left px-6 py-6 bg-white border border-stone-200 rounded-2xl hover:border-fodda-accent/40 hover:shadow-xl transition-all shadow-sm">
                       <span className="text-sm font-semibold text-stone-600 group-hover:text-stone-900 leading-snug block">{"\u201C"}{q.text}{"\u201D"}</span>
                    </button>
                 ))
                )}
             </div>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[95%] md:max-w-4xl ${msg.role === 'user' ? 'bg-stone-900 text-white px-6 py-4 rounded-2xl shadow-lg' : 'bg-white p-10 md:p-16 rounded-3xl border border-stone-200 shadow-sm w-full'}`}>
              {msg.role === 'assistant' && (
                <div className={`h-1.5 w-full absolute top-0 left-0 ${isBaseline ? 'bg-stone-400' : 'bg-fodda-accent'}`}></div>
              )}
              
              {msg.role === 'user' ? (
                <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
              ) : (
                <div className="flex flex-col h-full">
                  <StaggeredMessageContent 
                      messageId={msg.id}
                      content={msg.content} 
                      isNew={index === messages.length - 1} 
                      onAnchorClick={onAnchorClick} 
                  />
                  
                  <div className="mt-12 pt-6 border-t border-stone-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      {isBaseline ? (
                        <div className="bg-stone-50 px-2 py-0.5 rounded border border-stone-100 flex items-center">
                          <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mr-1.5">Layer:</span>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Baseline Grounding</span>
                        </div>
                      ) : (
                        msg.diagnostic && (
                          <div className="bg-stone-50 px-2 py-0.5 rounded border border-stone-200 ml-2">
                            <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mr-1.5">Index Match:</span>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${(msg.diagnostic.dataStatus.includes('TREND') || msg.diagnostic.dataStatus.includes('HYBRID')) ? 'text-green-600' : 'text-fodda-accent'}`}>
                              {msg.diagnostic.dataStatus.replace('_MATCH', '')}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => handleCopy(msg)}
                        className={`text-[10px] font-bold uppercase tracking-tighter flex items-center group transition-colors ${copiedId === msg.id ? 'text-green-600' : 'text-stone-400 hover:text-fodda-accent'}`}
                        title="Copy to clipboard"
                      >
                         <svg className={`w-3.5 h-3.5 mr-1 ${copiedId === msg.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                         {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                      <button 
                        onClick={() => handleDownload(msg, 'txt')}
                        className="text-[10px] font-bold uppercase tracking-tighter text-stone-400 hover:text-fodda-accent transition-colors flex items-center"
                        title="Download as TXT"
                      >
                         <span className="mr-1">TXT</span>
                      </button>
                      <button 
                        onClick={() => handleDownload(msg, 'json')}
                        className="text-[10px] font-bold uppercase tracking-tighter text-stone-400 hover:text-fodda-accent transition-colors flex items-center"
                        title="Download as JSON"
                      >
                         <span className="mr-1">JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start w-full max-w-4xl">
            <div className="bg-white px-10 py-8 rounded-2xl border border-stone-200 shadow-sm flex items-center space-x-4 w-full">
              <div className="flex space-x-2">
                <div className={`w-2 h-2 rounded-full animate-bounce ${isBaseline ? 'bg-stone-400' : 'bg-fodda-accent'}`}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${isBaseline ? 'bg-stone-400' : 'bg-fodda-accent'}`} style={{ animationDelay: '150ms' }}></div>
                <div className={`w-2 h-2 rounded-full animate-bounce ${isBaseline ? 'bg-stone-400' : 'bg-fodda-accent'}`} style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.3em]">
                {isBaseline ? 'Calibrating Reference Layer...' : 'Querying Graph Index...'}
              </span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 md:p-8 bg-white border-t border-stone-100 z-10 shrink-0 pb-safe">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex items-center bg-stone-50 border border-stone-200 rounded-2xl shadow-inner px-2">
          <input 
            type="text" 
            value={inputValue} 
            onChange={(e) => onInputChange(e.target.value)} 
            placeholder={isBaseline ? "Ask about public beliefs, attitudes, or behaviors…" : `Identify signals in ${vertical.toLowerCase()}...`} 
            className="flex-1 bg-transparent border-none rounded-2xl px-6 py-5 text-stone-900 text-sm focus:outline-none focus:ring-0 transition-all placeholder:text-stone-400" 
            disabled={isProcessing} 
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing} className="p-3 text-stone-300 hover:text-fodda-accent disabled:opacity-20 transition-all shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
