
import React, { useState, useMemo } from 'react';
import { dataService } from '../../shared/dataService';
import { Vertical } from '../../shared/types';

interface SidebarProps {
  currentVertical: string;
  onVerticalChange: (v: string) => void;
  onQuestionClick: (q: string, terms?: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onAdminClick: () => void;
  onApiClick: () => void;
  accessMode?: 'psfk' | 'waldo';
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

const WaldoLogo = () => (
  <img 
    src="https://ucarecdn.com/da875842-b48e-44d3-9be6-771919842529/waldofyi_logo.jpeg" 
    alt="Waldo" 
    className="mr-2 h-4 w-4 flex-shrink-0 object-contain rounded-sm" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

const SICLogo = () => (
  <img 
    src="https://ucarecdn.com/e1711558-ce22-46a2-9720-2423a35d8edf/BENDIETZ.png" 
    alt="SIC" 
    className="mr-2 h-4 w-4 flex-shrink-0 object-cover rounded-sm border border-stone-200" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

const PewLogo = () => (
  <img 
    src="https://ucarecdn.com/3f988814-3344-4748-85ad-0be0588ebc07/pewcenterlow.jpg" 
    alt="Pew Research Center" 
    className="mr-2 h-4 w-4 flex-shrink-0 object-cover rounded-sm border border-stone-200" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

const FoddaLogo = () => (
  <img 
    src="https://ucarecdn.com/ce15371a-a0cd-4ef7-936a-2ef020126d4b/foddafavicon.png" 
    alt="Fodda" 
    className="mr-2 h-5 w-5 flex-shrink-0 object-contain" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

const SnowflakeLogo = () => (
  <img 
    src="https://ucarecdn.com/acd9cd52-8ee6-4970-b888-6405707232ed/snowflakelogo.png" 
    alt="Snowflake" 
    className="w-4 h-4 object-contain"
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.src = "https://www.snowflake.com/wp-content/themes/snowflake/assets/img/snowflake-logo-blue.svg";
    }}
  />
);

const GRAPH_INFO: Record<string, { text: string; url: string }> = {
  [Vertical.Beauty]: {
    text: "A structured way to explore how beauty is evolving across science, wellness, retail, and consumer behavior, using vetted examples and PSFK’s point of view.",
    url: "https://www.fodda.ai/#/graphs/psfk-beauty"
  },
  [Vertical.Retail]: {
    text: "A structured way to understand how commerce is being reshaped across physical, digital, and fulfillment-led retail, grounded in real-world examples.",
    url: "https://www.fodda.ai/#/graphs/psfk-retail"
  },
  [Vertical.Sports]: {
    text: "A structured way to explore how sports are changing as cultural, media, and business platforms, beyond teams, leagues, and scores.",
    url: "https://www.fodda.ai/#/graphs/psfk-sports"
  },
  [Vertical.SIC]: {
    text: "A beta intelligence graph for understanding how culture, media, brands, and platforms are shifting in real time — curated by Ben Dietz.",
    url: "https://www.fodda.ai/#/graphs/sic"
  },
  [Vertical.Waldo]: {
    text: "A multi-industry trends knowledge graph built from Waldo’s ongoing signal and analysis work. Query it via Fodda to power AI workflows, research, and decision-making with structured context.",
    url: "https://www.waldo.fyi"
  },
  [Vertical.Baseline]: {
    text: "This graph exposes structured distributions from the Pew Research Center’s National Public Opinion Reference Survey (NPORS, 2025). Designed for machine-queryable reference of public sentiment.",
    url: "https://www.pewresearch.org/methodology/u-s-survey-research/national-public-opinion-reference-survey-npors/"
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ currentVertical, onVerticalChange, onQuestionClick: _onQuestionClick, isOpen, onClose, onAdminClick, onApiClick, accessMode = 'psfk' }) => {
  const [expandedInfo, setExpandedInfo] = useState<string | null>(null);

  const graphs = useMemo(() => {
    const allGraphs = dataService.getGraphs();
    if (accessMode === 'waldo') {
      return allGraphs.filter(g => g.id === Vertical.Waldo);
    }
    return allGraphs;
  }, [accessMode]);

  const toggleInfo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedInfo(expandedInfo === id ? null : id);
  };

  const futureVerticals = [
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

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-stone-50 border-r border-stone-200 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 md:z-20 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-transparent">
          <div className="flex items-center h-16 relative">
            <FoddaLogo />
            <h1 className="font-serif text-xl font-bold text-stone-900 tracking-tight">Fodda</h1>
            <div className="absolute left-7 top-[44px] text-[9px] uppercase tracking-widest text-stone-400 font-medium whitespace-nowrap">Contextual Intelligence</div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 text-stone-400 h-16 flex items-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 p-6 pr-4 -mr-4 scrollbar-hide">
          <div className="pt-4">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Knowledge Graphs</h2>
            <div className="space-y-1.5">
              {graphs.map((g) => {
                const info = GRAPH_INFO[g.id];
                const isExpanded = expandedInfo === g.id;
                const isBaseline = g.id === Vertical.Baseline;
                const isWaldo = g.id === Vertical.Waldo;
                const isSIC = g.id === Vertical.SIC;
                
                return (
                  <div key={g.id} className="flex flex-col space-y-1">
                    <button
                      onClick={() => { onVerticalChange(g.id); onClose(); }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
                        currentVertical === g.id 
                          ? 'bg-white text-stone-900 shadow-sm border border-stone-200 ring-1 ring-stone-900/5' 
                          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                      }`}
                    >
                      <div className="flex items-center min-w-0">
                        {isBaseline ? <PewLogo /> : (isWaldo ? <WaldoLogo /> : (isSIC ? <SICLogo /> : <PSFKLogo />))}
                        <span className="truncate pr-1">{g.name}</span>
                        {info && (
                          <div 
                            onClick={(e) => toggleInfo(g.id, e)}
                            className={`ml-1.5 p-1 rounded-md transition-colors hover:bg-stone-200/50 ${isExpanded ? 'text-fodda-accent' : 'text-stone-300'}`}
                            title="Learn about this graph"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {currentVertical === g.id && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-fodda-accent"></div>}
                    </button>
                    
                    {isExpanded && info && (
                      <div className="mx-2 p-3 bg-stone-100/50 border border-stone-200/60 rounded-xl animate-fade-in-up">
                        <p className="text-[10px] text-stone-600 leading-relaxed mb-3 font-medium">
                          {info.text}
                        </p>
                        <a 
                          href={info.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] font-bold text-fodda-accent hover:underline flex items-center group/link"
                        >
                          <span>Learn how it works</span>
                          <svg className="w-2.5 h-2.5 ml-1.5 group-hover/link:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {accessMode !== 'waldo' && (
            <div>
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Graph Pipeline</h2>
              <div className="space-y-2.5">
                {futureVerticals.map((fv) => (
                  <div key={fv.name} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/30 transition-all group cursor-not-allowed opacity-80 hover:opacity-100">
                    <div className="flex items-center space-x-3">
                      <div className="relative h-10 w-10 shrink-0">
                        <img src={fv.img} alt={fv.person} className="h-full w-full rounded-lg border border-stone-100 object-cover bg-stone-200" />
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
          )}
        </div>

        <div className="mt-auto p-6 border-t border-stone-200 space-y-3">
          {/* Snowflake Button */}
          <a 
            href="https://www.fodda.ai/#/snowflake" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-stone-900 p-1.5 rounded-lg group-hover:bg-stone-800 transition-colors border border-stone-800 flex items-center justify-center">
                <SnowflakeLogo />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-stone-800 leading-none">Snowflake</p>
                <p className="text-[9px] text-stone-400 mt-0.5 font-medium">Sample Data</p>
              </div>
            </div>
            <svg className="w-3 h-3 text-stone-300 group-hover:text-fodda-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <button 
            onClick={onApiClick}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-stone-100 p-1.5 rounded-lg group-hover:bg-purple-50 transition-colors border border-stone-200/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-stone-400 group-hover:text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-stone-800 leading-none">Developer API</p>
                <p className="text-[9px] text-stone-400 mt-0.5 font-medium">Documentation</p>
              </div>
            </div>
            <svg className="w-3 h-3 text-stone-300 group-hover:text-fodda-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="flex items-center justify-between px-1 text-[10px] text-stone-400 font-bold tracking-widest uppercase mt-4">
             <div className="flex items-center space-x-2">
               <a href="https://www.fodda.ai" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">Fodda.ai</a>
               <span className="text-stone-300">•</span>
               {accessMode === 'waldo' ? (
                 <a href="https://www.waldo.fyi" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">Waldo</a>
               ) : (
                 <a href="https://www.psfk.com" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">PSFK</a>
               )}
               <span className="text-stone-300">•</span>
               <button onClick={onAdminClick} className="hover:text-fodda-accent transition-colors font-bold">Admin</button>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};
