import React, { useMemo } from 'react';
import { dataService } from '../../shared/dataService';
import { Vertical, KnowledgeGraph } from '../../shared/types';

interface SidebarProps {
  currentVertical: string;
  onVerticalChange: (v: string) => void;
  onQuestionClick?: (q: string, terms?: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onAdminClick: () => void;
  onApiClick: () => void;
  onSecurityClick: () => void;
  onDeterministicClick: () => void;
  onDashboardClick: () => void;
  onDevModeClick: () => void;
  accessMode?: 'psfk' | 'waldo';
  isMcpMode: boolean;
  onToggleMcpMode: () => void;
}

// Logo Components (sized for rail)
const PSFKLogo = () => (
  <img src="https://ucarecdn.com/97231f29-210c-4df4-bcb7-80c2234779e8/psfklogo40x40.png" alt="PSFK" className="h-5 w-5 object-contain rounded-sm grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all bg-white/10" />
);

const WaldoLogo = () => (
  <img src="https://ucarecdn.com/da875842-b48e-44d3-9be6-771919842529/waldofyi_logo.jpeg" alt="Waldo" className="h-5 w-5 object-contain rounded-sm grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" />
);

const SICLogo = () => (
  <img src="https://ucarecdn.com/e1711558-ce22-46a2-9720-2423a35d8edf/BENDIETZ.png" alt="SIC" className="h-5 w-5 object-cover rounded-sm grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" />
);




export const Sidebar: React.FC<SidebarProps> = ({
  currentVertical,
  onVerticalChange,
  isOpen,
  onClose,
  onAdminClick,
  onApiClick,
  onSecurityClick,
  onDeterministicClick,
  onDashboardClick,
  onDevModeClick,
  accessMode = 'psfk',
  isMcpMode,
  onToggleMcpMode
}) => {
  /* Removed unused isHovered state */

  const { liveGraphs, playgroundGraphs } = useMemo(() => {
    const allGraphs = dataService.getGraphs();
    const live = allGraphs.filter((g: KnowledgeGraph) => [Vertical.Retail, Vertical.Sports, Vertical.Beauty].includes(g.id as Vertical));
    const playground = allGraphs.filter((g: KnowledgeGraph) => [Vertical.Baseline, Vertical.SIC, Vertical.Waldo].includes(g.id as Vertical));

    if (accessMode === 'waldo') {
      return {
        liveGraphs: [] as KnowledgeGraph[],
        playgroundGraphs: playground.filter((g: KnowledgeGraph) => g.id === Vertical.Waldo)
      };
    }

    return { liveGraphs: live, playgroundGraphs: playground };
  }, [accessMode]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}

      {/* Sidebar Container - FIXED WIDTH 64 (16rem/256px) */}
      <div
        className={`fixed inset-y-0 left-0 z-[60] h-full bg-black border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-64
        `}
      >
        {/* Header / Brand */}
        <div className="h-14 flex items-center px-4 border-b border-white/5 shrink-0 relative">
          <div className="flex items-center gap-3 text-white/90 group cursor-pointer" onClick={() => onVerticalChange(Vertical.Baseline)}>
            <div className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-white font-bold font-mono text-[10px] group-hover:bg-zinc-700 transition-colors">F</div>
            <span className="font-semibold text-sm tracking-tight text-zinc-300 group-hover:text-white transition-colors">Fodda</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="md:hidden p-2 -mr-2 text-zinc-500 hover:text-white transition-colors"
            title="Close Sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-6 scrollbar-hide">

          {/* Main Links */}



          {/* Live Graphs Section */}
          {liveGraphs.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2 group cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider">Live Graphs</span>
              </div>
              <div className="space-y-0.5">
                {liveGraphs.map((g) => {
                  const isSelected = currentVertical === g.id;
                  const isBaseline = g.id === Vertical.Baseline;
                  const isWaldo = g.id === Vertical.Waldo;
                  const isSIC = g.id === Vertical.SIC;

                  return (
                    <button
                      key={g.id}
                      onClick={() => { onVerticalChange(g.id); onClose(); }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all group border border-transparent
                        ${isSelected ? 'bg-zinc-800 text-white border-white/5 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}
                      `}
                    >
                      <div className="w-4 h-4 flex shrink-0 items-center justify-center">
                        {isBaseline ? <span className="font-mono font-bold text-[10px] w-4 h-4 flex items-center justify-center rounded bg-white/10 text-zinc-300">F</span>
                          : (isWaldo ? <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><WaldoLogo /></div>
                            : (isSIC ? <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><SICLogo /></div>
                              : <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><PSFKLogo /></div>))}
                      </div>

                      <span className="text-sm font-medium truncate">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Playground Section */}
          {playgroundGraphs.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2 group cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider">Playground</span>
              </div>
              <div className="space-y-0.5">
                {playgroundGraphs.map((g) => {
                  const isSelected = currentVertical === g.id;
                  const isBaseline = g.id === Vertical.Baseline;
                  const isWaldo = g.id === Vertical.Waldo;
                  const isSIC = g.id === Vertical.SIC;

                  return (
                    <button
                      key={g.id}
                      onClick={() => { onVerticalChange(g.id); onClose(); }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all group border border-transparent
                        ${isSelected ? 'bg-zinc-800 text-white border-white/5 shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}
                      `}
                    >
                      <div className="w-4 h-4 flex shrink-0 items-center justify-center">
                        {isBaseline ? <span className="font-mono font-bold text-[10px] w-4 h-4 flex items-center justify-center rounded bg-white/10 text-zinc-300">F</span>
                          : (isWaldo ? <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><WaldoLogo /></div>
                            : (isSIC ? <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><SICLogo /></div>
                              : <div className="w-4 h-4 opacity-70 group-hover:opacity-100"><PSFKLogo /></div>))}
                      </div>

                      <span className="text-sm font-medium truncate">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


        </div>

        {/* Mode Toggle */}
        <div className="px-2 py-3 bg-zinc-900 border-t border-white/5 space-y-2">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider px-1">Test Mode</div>
          <div className="flex bg-black rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => isMcpMode && onToggleMcpMode()}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${!isMcpMode ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              API
            </button>
            <button
              onClick={() => !isMcpMode && onToggleMcpMode()}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${isMcpMode ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              MCP
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-white/5 space-y-0.5 bg-black pb-safe md:pb-2">
          <button onClick={() => window.open('https://app.fodda.ai/#/knowledge-graphs', '_blank')} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-sm font-medium">Knowledge</span>
          </button>
          <button onClick={onDevModeClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all group">
            <svg className="w-4 h-4 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-sm font-medium group-hover:text-green-400 transition-colors">Developer</span>
          </button>
          <button onClick={onAdminClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button onClick={onApiClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            <span className="text-sm font-medium">API Docs</span>
          </button>
          <button onClick={onSecurityClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span className="text-sm font-medium">Security</span>
          </button>
          <button onClick={onDeterministicClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span className="text-sm font-medium">Reliability</span>
          </button>
          <button onClick={onDashboardClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-all">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-sm font-medium">Profile</span>
          </button>
        </div>

      </div >
    </>
  );
};
