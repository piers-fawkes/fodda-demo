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

const PSFKLogo = () => (
  <img 
    src="https://ucarecdn.com/97231f29-210c-4df4-bcb7-80c2234779e8/psfklogo40x40.png" 
    alt="PSFK" 
    className="mr-2 h-4 w-4 flex-shrink-0 object-contain rounded-sm" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

export const Sidebar: React.FC<SidebarProps> = ({ currentVertical, onVerticalChange, onQuestionClick, isOpen, onClose }) => {
  // Expert-led future verticals data using provided curator image URLs
  const futureVerticals = [
    { 
      name: 'Culture', 
      person: 'Ben Dietz', 
      label: 'The SIC Graph',
      img: 'https://ucarecdn.com/e1711558-ce22-46a2-9720-2423a35d8edf/BENDIETZ.png' 
    },
    { 
      name: 'Media', 
      person: 'Johanna Salazar', 
      label: 'Media Machine',
      img: 'https://ucarecdn.com/455c0584-e8f9-442d-8bb9-348bc12b03e4/JOHANNASALAZAR.png' 
    },
    { 
      name: 'Trends', 
      person: 'Rohit Bhargava', 
      label: 'Non-Obvious Graph',
      img: 'https://ucarecdn.com/a872c8c0-1b7b-4218-b4b6-3da3865c3e21/ROHITBHARGAVA.png' 
    },
  ];

  // Defined explicit order for verticals
  const orderedVerticals = [Vertical.Beauty, Vertical.Retail, Vertical.Sports];

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
            <div className="absolute left-6 -top-1 w-2 h-2 bg-stone-900 border-l border-t border-stone-700 transform rotate-45"></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-8 scrollbar-hide">
          {/* Active Verticals */}
          <div>
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Knowledge Graphs</h2>
            <div className="space-y-1.5">
              {orderedVerticals.map((v) => (
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
                  <div className="flex items-center">
                    <PSFKLogo />
                    <span>{v}</span>
                  </div>
                  {currentVertical === v && <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Graph Pipeline with Expert Curator Images */}
          <div>
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Graph Pipeline</h2>
            <div className="space-y-2.5">
              {futureVerticals.map((fv) => (
                <div
                  key={fv.name}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/30 transition-all duration-300 group cursor-not-allowed"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative h-10 w-10 shrink-0">
                      <img 
                        src={fv.img} 
                        alt={fv.person} 
                        className="h-full w-full rounded-lg border border-stone-100 object-cover shadow-sm bg-stone-200" 
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23a8a29e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"%3E%3C/path%3E%3Ccircle cx="12" cy="7" r="4"%3E%3C/circle%3E%3C/svg%3E';
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-stone-100">
                        <svg className="w-2.5 h-2.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="text-stone-800 font-bold text-xs leading-none">{fv.name}</span>
                        <span className="ml-1.5 text-[7px] font-bold text-stone-400 uppercase tracking-tighter">Coming Soon</span>
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 font-medium">Curated by {fv.person}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-stone-200">
          <button 
            className="w-full mb-3 flex items-center justify-between p-2.5 rounded-lg border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/50 hover:shadow-md transition-all group"
            onClick={() => alert(`API Integration for ${currentVertical} Graph coming soon.`)}
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