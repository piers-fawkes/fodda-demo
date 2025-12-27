
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
// Update: Align types with shared/types
import { Message, Vertical } from '../shared/types';
import { SUGGESTED_QUESTIONS } from '../constants';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  vertical: Vertical;
  onSendMessage: (msg: string) => void;
  onAnchorClick?: (type: 'trend' | 'article', id: string) => void;
  onToggleSidebar: () => void;
  onToggleEvidence: () => void;
}

// Added messageId to the props type definition to match its usage in ChatInterface and resolve the reported error.
const StaggeredMessageContent: React.FC<{ messageId: string; content: string; isNew: boolean; onAnchorClick?: (type: 'trend' | 'article', id: string) => void }> = ({ messageId, content, isNew, onAnchorClick }) => {
  const sections = useMemo(() => {
    if (!content) return [];
    return content.split(/(?=\n#|(?<=^)#)/g);
  }, [content]);

  const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="font-serif text-sm font-bold text-stone-900 uppercase tracking-widest mt-4 mb-3 border-b border-stone-100 pb-1" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="font-serif text-xs font-bold text-stone-900 uppercase tracking-widest mt-6 mb-2" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wide mt-4 mb-2" {...props} />,
    
    a: ({node, href, children, ...props}: any) => {
      if (href?.startsWith('#trend-') || href?.startsWith('#article-')) {
        return (
          <a 
            href={href} 
            onClick={(e) => {
              e.preventDefault();
              if (onAnchorClick && href) {
                const cleanRef = href.substring(1); 
                const [type, id] = cleanRef.split('-');
                if ((type === 'trend' || type === 'article') && id) {
                  onAnchorClick(type, id);
                }
              }
            }}
            className="text-stone-900 font-bold hover:text-fodda-accent cursor-pointer transition-colors decoration-dotted underline hover:decoration-solid underline-offset-2"
            title="Click to locate in Evidence Drawer"
            {...props}
          >
            {children}
          </a>
        )
      }
      return <a href={href} className="text-fodda-accent underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
    }
  };

  if (!isNew) {
    return (
      /* Fix: Moved className from ReactMarkdown to a wrapping div to resolve TypeScript errors with newer ReactMarkdown versions */
      <div className="prose prose-sm max-w-none prose-p:text-stone-600 prose-p:leading-relaxed prose-li:text-stone-600 prose-ul:pl-4 prose-ol:pl-4 prose-strong:text-stone-900 prose-strong:font-semibold prose-blockquote:border-l-2 prose-blockquote:border-fodda-accent prose-blockquote:bg-stone-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-stone-500">
        <ReactMarkdown components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sections.map((section, index) => (
        <div 
          key={index} 
          className="opacity-0 animate-fade-in-up"
          style={{ animationDelay: `${index * 400}ms`, animationFillMode: 'forwards' }}
        >
          {/* Fix: Moved className from ReactMarkdown to a wrapping div to resolve TypeScript errors with newer ReactMarkdown versions */}
          <div className="prose prose-sm max-w-none prose-p:text-stone-600 prose-p:leading-relaxed prose-li:text-stone-600 prose-ul:pl-4 prose-ol:pl-4 prose-strong:text-stone-900 prose-strong:font-semibold prose-blockquote:border-l-2 prose-blockquote:border-fodda-accent prose-blockquote:bg-stone-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-stone-500">
            <ReactMarkdown components={markdownComponents}>
              {section}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isProcessing, vertical, onSendMessage, onAnchorClick, onToggleSidebar, onToggleEvidence }) => {
  const [input, setInput] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput('');
  };

  const handleBlur = () => {
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
    }, 10);
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isUser = lastMsg?.role === 'user';
    if (isProcessing || isUser) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const suggestions = SUGGESTED_QUESTIONS[vertical];

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50/30 relative overflow-hidden">
      <div className="h-16 border-b border-stone-200 flex items-center justify-between px-4 md:px-6 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center">
          <button 
            onClick={onToggleSidebar}
            className="md:hidden p-2 -ml-2 mr-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-serif font-bold text-lg text-stone-900 mr-3 md:hidden tracking-tight">Fodda</span>
          <span className="text-xs font-bold bg-stone-900 text-white px-2 py-0.5 rounded mr-3 uppercase tracking-wider inline-block">
            {vertical}
          </span>
          <span className="text-sm text-stone-600 font-medium inline-block whitespace-nowrap">Graph Assistant</span>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <button 
            onClick={onToggleEvidence}
            className="md:hidden flex items-center space-x-1 p-2 text-fodda-accent hover:bg-purple-50 rounded-md transition-colors"
          >
            <span className="text-xs font-bold uppercase hidden sm:inline">Evidence</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 focus:outline-none group"
            >
              <div className="w-8 h-8 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center text-xs font-bold text-stone-600 group-hover:bg-fodda-accent group-hover:text-white group-hover:border-fodda-accent transition-all">
                JD
              </div>
            </button>
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-stone-200 z-50 overflow-hidden animate-fade-in-up origin-top-right">
                  <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                    <p className="text-sm font-semibold text-stone-900">John Doe</p>
                    <p className="text-xs text-stone-500 truncate">demo@fodda.ai</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Account
                    </button>
                    <button onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Token Use
                    </button>
                    <button onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      Billing
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-8 scroll-smooth pb-10">
        {messages.length === 0 && (
          <div className="min-h-full flex flex-col items-center justify-start max-w-2xl mx-auto py-12 md:py-20">
             <div className="mb-8 text-center animate-fade-in-up">
                <div className="inline-block p-4 rounded-2xl bg-fodda-accent/5 mb-4 border border-fodda-accent/10 shadow-sm">
                   <svg className="w-8 h-8 text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                </div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-stone-900 mb-2 tracking-tight">Explore the {vertical} Graph</h2>
                <p className="text-stone-500 text-sm md:text-xs max-w-sm mx-auto leading-relaxed">
                   Structured intelligence grounded in curated datasets. Choose a starter inquiry or type your own below.
                </p>
             </div>

             <div className="w-full max-w-xl mx-auto space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-3 text-center">Suggested Inquiries</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {suggestions.map((q, i) => (
                      <button
                         key={i}
                         onClick={() => onSendMessage(q)}
                         className="group text-left px-4 py-3 md:py-3 bg-white border border-stone-200 rounded-xl hover:border-fodda-accent/40 hover:shadow-lg hover:bg-purple-50/10 transition-all duration-300 animate-fade-in-up"
                         style={{ animationDelay: `${200 + (i * 100)}ms`, animationFillMode: 'forwards' }}
                      >
                         <span className="text-sm md:text-xs font-medium text-stone-600 group-hover:text-stone-900 leading-tight block">"{q}"</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>
        )}
        
        {messages.map((msg, index) => {
          const isLatest = index === messages.length - 1;
          const shouldAnimate = isLatest && msg.role === 'assistant';

          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] md:max-w-2xl bg-stone-900 text-white rounded-2xl rounded-tr-none px-5 py-3 shadow-lg">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div className="max-w-full md:max-w-3xl w-full bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                   <div className="h-1 bg-fodda-accent w-full"></div>
                   <div className="p-4 md:p-5">
                      <StaggeredMessageContent 
                        messageId={msg.id}
                        content={msg.content} 
                        isNew={shouldAnimate} 
                        onAnchorClick={onAnchorClick}
                      />
                   </div>
                   <div className="bg-stone-50 px-4 md:px-5 py-3 border-t border-stone-100 flex flex-wrap gap-y-2 justify-between items-center">
                      <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Fodda Intelligence</span>
                      </div>
                      <div className="flex items-center">
                        <div className="h-4 w-px bg-stone-200 mx-3 hidden xs:block"></div>
                        <div className="flex items-center -space-x-px">
                          <button 
                            onClick={() => downloadText(msg.content, `fodda-export-${msg.id}.txt`)}
                            className="group flex items-center justify-center px-2 py-1 bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 hover:z-10 rounded-l transition-all"
                            title="Download as TXT"
                          >
                            <span className="text-[9px] font-bold text-stone-500 group-hover:text-stone-800">TXT</span>
                          </button>
                        </div>
                      </div>
                   </div>
                </div>
              )}
            </div>
          );
        })}
        
        {isProcessing && (
          <div className="flex justify-start w-full max-w-3xl">
            <div className="bg-white px-6 py-4 rounded-xl border border-stone-200 shadow-sm flex items-center space-x-3 w-full">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-fodda-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-fodda-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-fodda-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">Synthesizing {vertical} Data...</span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 md:p-6 bg-white border-t border-stone-200 z-20 safe-pb shrink-0">
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={handleBlur}
            placeholder={`Ask about ${vertical.toLowerCase()}...`}
            className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-[16px] md:text-sm rounded-lg pl-5 pr-12 py-4 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:border-stone-400 transition-all shadow-sm placeholder:text-stone-400"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white text-stone-400 hover:text-fodda-accent disabled:opacity-30 rounded-md transition-colors border border-stone-100 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
