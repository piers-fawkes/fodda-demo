import React from 'react';
import { Vertical } from '../types';
import { SUGGESTED_QUESTIONS } from '../constants';

interface SidebarProps {
  currentVertical: Vertical;
  onVerticalChange: (v: Vertical) => void;
  onQuestionClick: (q: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentVertical, onVerticalChange, onQuestionClick, isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 h-full bg-stone-50 border-r border-stone-200 flex flex-col p-6 shadow-xl transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:shadow-none md:z-10
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <div className="md:hidden flex justify-end mb-4">
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-8 relative group w-fit">
          <div className="cursor-help">
            <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">Fodda</h1>
            <p className="text-xs uppercase tracking-widest text-stone-500 mt-1 font-medium">Contextual Intelligence</p>
          </div>
          
          {/* Tooltip */}
          <div className="absolute left-0 top-full mt-2 w-56 p-3 bg-stone-900 text-stone-50 text-[11px] leading-relaxed rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-stone-700">
            Fodda turns curated insights into AI-ready knowledge graphs, enabling grounded answers with traceable evidence.
            {/* Arrow */}
            <div className="absolute left-6 -top-1 w-2 h-2 bg-stone-900 border-l border-t border-stone-700 transform rotate-45"></div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 pl-1">Select Vertical</h2>
          <div className="space-y-1.5">
            {Object.values(Vertical).map((v) => (
              <button
                key={v}
                onClick={() => {
                  onVerticalChange(v);
                  onClose();
                }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group
                  ${currentVertical === v 
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200 ring-1 ring-stone-900/5' 
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                  }`}
              >
                <span>{v} Mode</span>
                {currentVertical === v && <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent"></div>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 pl-1">Suggested Inquiries</h2>
          <div className="space-y-0.5">
            {SUGGESTED_QUESTIONS[currentVertical].map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  onQuestionClick(q);
                  onClose();
                }}
                className="w-full text-left p-2 rounded-md text-sm text-stone-600 hover:bg-white hover:shadow-sm hover:text-stone-900 transition-all duration-200 border border-transparent hover:border-stone-100 leading-tight"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-stone-200">
          
          {/* API Access Hint */}
          <button 
            className="w-full mb-3 flex items-center justify-between p-2.5 rounded-lg border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/50 hover:shadow-md transition-all group"
            onClick={() => alert(`API Integration for ${currentVertical} Graph coming soon.`)}
            title="Integrate this vertical's data graph via API"
          >
              <div className="flex items-center space-x-2.5">
                 <div className="bg-stone-100 p-1 rounded-md group-hover:bg-purple-50 transition-colors">
                    <svg className="w-3.5 h-3.5 text-stone-500 group-hover:text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                 </div>
                 <div className="text-left">
                    <div className="text-[11px] font-semibold text-stone-700 group-hover:text-stone-900">Developer API</div>
                    <div className="text-[9px] text-stone-400 group-hover:text-stone-500 leading-none">Call {currentVertical} Graph</div>
                 </div>
              </div>
              <svg className="w-2.5 h-2.5 text-stone-300 group-hover:text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </button>

          <div className="bg-stone-100 p-2.5 rounded-lg border border-stone-200/50">
            <h3 className="font-serif font-semibold text-stone-800 text-xs mb-1">Demo Capability</h3>
            <p className="text-[10px] text-stone-500 leading-snug">
              This demo proves how structured context improves LLM accuracy. Answers grounded in {currentVertical} data.
            </p>
          </div>
          
          <div className="flex justify-between items-center px-1 mt-3 text-[10px] text-stone-400 font-medium">
             <a href="https://www.fodda.ai" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">Fodda</a>
             <span className="text-stone-300">•</span>
             <a href="https://www.psfk.com" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">PSFK</a>
          </div>
        </div>
      </div>
    </>
  );
};