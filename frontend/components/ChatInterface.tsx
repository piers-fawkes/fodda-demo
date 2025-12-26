
import { Message, Vertical } from '../../shared/types';
import { SUGGESTED_QUESTIONS } from '../../shared/constants';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  messages: Message[];
  isProcessing: boolean;
  vertical: Vertical;
  onSendMessage: (msg: string) => void;
  onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string) => void;
  onToggleSidebar: () => void;
  onToggleEvidence: () => void;
}

const StaggeredMessageContent: React.FC<{ 
    messageId: string; 
    content: string; 
    isNew: boolean; 
    onAnchorClick?: (messageId: string, type: 'trend' | 'article', id: string) => void 
}> = ({ messageId, content, isNew, onAnchorClick }) => {
  const sections = useMemo(() => content ? content.split(/(?=\n#|(?<=^)#)/g) : [], [content]);
  
  const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="font-serif text-sm font-bold text-stone-900 uppercase tracking-widest mt-4 mb-3 border-b border-stone-100 pb-1" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="font-serif text-xs font-bold text-stone-900 uppercase tracking-widest mt-6 mb-2" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wide mt-4 mb-2" {...props} />,
    a: ({node, href, children, ...props}: any) => {
      // Handle #trend-ID or #article-ID patterns
      if (href?.includes('#')) {
        const parts = href.split('#');
        const hash = parts[parts.length - 1];
        const [type, id] = hash.split('-');
        
        if ((type === 'trend' || type === 'article') && id) {
          return (
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                onAnchorClick?.(messageId, type as 'trend' | 'article', id); 
              }} 
              className="text-fodda-accent font-bold hover:underline decoration-fodda-accent/30 underline-offset-4 cursor-pointer"
            >
              {children}
            </button>
          );
        }
      }
      return <a href={href} className="text-fodda-accent underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
  };

  return (
    <div className="space-y-1">
      {sections.map((section, index) => (
        <div key={index} className={isNew ? "opacity-0 animate-fade-in-up" : ""} style={isNew ? { animationDelay: `${index * 300}ms`, animationFillMode: 'forwards' } : {}}>
          <ReactMarkdown 
            className="prose prose-sm max-w-none prose-p:text-stone-600 prose-p:leading-relaxed prose-li:text-stone-600 prose-ul:pl-4 prose-ol:pl-4 prose-strong:text-stone-900 prose-strong:font-semibold prose-blockquote:border-l-2 prose-blockquote:border-fodda-accent prose-blockquote:bg-stone-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-stone-500" 
            components={markdownComponents}
          >
            {section}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isProcessing, vertical, onSendMessage, onAnchorClick, onToggleSidebar, onToggleEvidence }) => {
  const [input, setInput] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!input.trim() || isProcessing) return; 
    onSendMessage(input); 
    setInput(''); 
  };

  useEffect(() => { 
    if (messages.length > 0) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50/30 relative overflow-hidden">
      <div className="h-16 border-b border-stone-200 flex items-center justify-between px-4 md:px-6 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center">
          <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 mr-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center md:space-x-4">
            <span className="font-serif font-bold text-xl text-stone-900 hidden md:inline tracking-tight">Fodda</span>
            <div className="flex items-center bg-stone-900 text-white rounded-md px-2.5 py-1">
               <span className="text-[10px] font-bold uppercase tracking-widest">{vertical}</span>
            </div>
          </div>
        </div>
        
        <button onClick={onToggleEvidence} className="md:hidden p-2 text-fodda-accent hover:bg-purple-50 rounded-md transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8 space-y-8 scroll-smooth pb-20 no-bounce">
        {messages.length === 0 && (
          <div className="min-h-full flex flex-col items-center justify-start max-w-2xl mx-auto pt-12">
             <div className="mb-10 text-center animate-fade-in-up">
                <h2 className="font-serif text-3xl font-bold text-stone-900 mb-3 tracking-tight">Explore the {vertical} Graph</h2>
                <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">Choose a suggested question or ask your own to see grounded intelligence.</p>
             </div>
             <div className="w-full max-w-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUGGESTED_QUESTIONS[vertical].map((q, i) => (
                   <button key={i} onClick={() => onSendMessage(q)} className="text-left px-5 py-4 bg-white border border-stone-200 rounded-2xl hover:border-fodda-accent/40 hover:shadow-lg transition-all animate-fade-in-up">
                      <span className="text-sm font-medium text-stone-600 leading-snug block">"{q}"</span>
                   </button>
                ))}
             </div>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[85%] md:max-w-3xl ${msg.role === 'user' ? 'bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-lg' : 'bg-white p-6 rounded-2xl border border-stone-200 shadow-sm w-full overflow-hidden'}`}>
              {msg.role === 'assistant' && <div className="h-1 bg-fodda-accent w-full absolute top-0 left-0"></div>}
              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <StaggeredMessageContent 
                    messageId={msg.id}
                    content={msg.content} 
                    isNew={index === messages.length - 1} 
                    onAnchorClick={onAnchorClick} 
                />
              )}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start w-full max-w-3xl">
            <div className="bg-white px-6 py-5 rounded-2xl border border-stone-200 shadow-sm flex items-center space-x-4 w-full">
              <div className="flex space-x-1.5 animate-pulse">
                <div className="w-2 h-2 bg-fodda-accent rounded-full"></div>
                <div className="w-2 h-2 bg-fodda-accent rounded-full"></div>
                <div className="w-2 h-2 bg-fodda-accent rounded-full"></div>
              </div>
              <span className="text-xs text-stone-400 font-bold uppercase tracking-widest">Consulting Graph...</span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 md:p-6 bg-white border-t border-stone-200 safe-pb shrink-0">
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={`Ask ${vertical.toLowerCase()} graph...`} 
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-6 py-4 focus:outline-none focus:ring-1 focus:ring-fodda-accent/20 transition-all shadow-sm" 
            disabled={isProcessing} 
          />
          <button type="submit" disabled={!input.trim() || isProcessing} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-stone-400 hover:text-fodda-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
