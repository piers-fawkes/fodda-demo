import React, { useState } from 'react';

export type AppView =
  | 'home'
  | 'profile'
  | 'profile-context'
  | 'profile-usage'
  | 'expert-twin'
  | 'account-billing'
  | 'account-overview'
  | 'account-team'
  | 'account-usage'
  | 'account-context'
  | 'account-governance'
  | 'connections'
  | 'connections-claude'
  | 'connections-chatgpt'
  | 'connections-perplexity'
  | 'connections-notion'
  | 'connections-copilot'
  | 'connections-gemini'
  | 'connections-mcp'
  | 'connections-api'
  | 'connections-a2a'
  | 'my-graphs'
  | 'team-graphs'
  | 'skills'
  | 'sandbox'
  | 'library'
  | 'directory'
  | 'coverage'
  | 'live-requests'
  | 'expert-chat'
  | 'knowledge-api-docs'
  | 'knowledge-reliability'
  | 'knowledge-security';

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onLogout?: () => void;
}

// Collapsible section header
const SectionHeader: React.FC<{
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}> = ({ label, isExpanded, onToggle, icon }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-2 mb-0.5 mt-0.5 rounded-lg hover:bg-line-soft transition-all group cursor-pointer"
  >
    <div className="flex items-center gap-2.5">
      {icon && <div className="w-4 h-4 flex items-center justify-center text-ink-4 group-hover:text-ink-2 transition-colors">{icon}</div>}
      <span className="text-sm font-medium text-ink-2 group-hover:text-ink transition-colors">{label}</span>
    </div>
    <svg
      className={`w-3.5 h-3.5 text-ink-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

// Nav item
const NavItem: React.FC<{
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  badge?: string;
  indent?: boolean;
  icon?: React.ReactNode;
}> = ({ label, onClick, isActive, disabled, badge, indent, icon }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group border border-transparent text-sm
      ${indent ? 'ml-3' : ''}
      ${disabled ? 'text-ink-4 cursor-not-allowed opacity-50' : ''}
      ${isActive && !disabled ? 'bg-brand-soft text-brand border-brand/10 font-medium' : ''}
      ${!isActive && !disabled ? 'text-ink-2 hover:text-ink hover:bg-line-soft' : ''}
    `}
  >
    {icon && <div className="w-4 h-4 flex items-center justify-center text-ink-4 group-hover:text-ink-2 transition-colors shrink-0">{icon}</div>}
    <span className="font-medium truncate">{label}</span>
    {badge && (
      <span className="ml-auto text-[8px] font-mono font-bold uppercase tracking-wider text-ink-3 bg-line-soft px-1.5 py-0.5 rounded border border-line">{badge}</span>
    )}
  </button>
);


export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  isOpen,
  onClose,
  userRole,
  onLogout,
}) => {
  const isAdminOrOwner = userRole === 'Admin' || userRole === 'Owner';

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('fodda-sidebar-sections-v4');
      const base = saved ? JSON.parse(saved) : { profile: true, graphs: false, skills: false, account: false, connections: false, demo: false, knowledge: false };
      // Auto-expand the section containing the initial active view
      if (activeView === 'skills') base.skills = true;
      if (activeView === 'profile' || activeView === 'profile-context' || activeView === 'profile-usage' || activeView === 'expert-twin') base.profile = true;
      if (activeView === 'account-billing') base.account = true;
      if (activeView === 'my-graphs' || activeView === 'team-graphs') base.graphs = true;
      if (activeView.startsWith('account-')) base.account = true;
      if (activeView.startsWith('connections-')) base.connections = true;
      if (activeView === 'sandbox' || activeView === 'live-requests' || activeView === 'expert-chat') base.demo = true;
      if (activeView.startsWith('knowledge-')) base.knowledge = true;
      return base;
    } catch {
      return { profile: true, graphs: false, account: false, connections: false, demo: false, knowledge: false };
    }
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      try { localStorage.setItem('fodda-sidebar-sections-v4', JSON.stringify(next)); } catch { }
      return next;
    });
  };

  const isActive = (view: AppView) => activeView === view;
  const isInGroup = (prefix: string) => activeView.startsWith(prefix);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('fodda_unlocked');
      localStorage.removeItem('fodda_user');
      localStorage.removeItem('fodda_account');
      localStorage.removeItem('fodda_session_token');
      localStorage.removeItem('fodda_session_expiry');
      localStorage.removeItem('fodda.userId');
      localStorage.removeItem('fodda.apiKey');
      localStorage.removeItem('fodda.userContext');
      localStorage.removeItem('fodda.accountContext');
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}

      <div
        className={`fixed inset-y-0 left-0 z-[60] h-full bg-paper border-r border-line flex flex-col transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-64
        `}
      >
        {/* Header / Brand */}
        <div className="h-14 flex items-center px-4 border-b border-line shrink-0 relative">
          <div className="flex items-center gap-3 text-ink group cursor-pointer" onClick={() => onNavigate('profile')}>
            <div className="w-6 h-6 flex items-center justify-center rounded group-hover:opacity-90 transition-opacity shadow-sm overflow-hidden"><img src="https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png" alt="Fodda" className="w-6 h-6 object-contain" /></div>
            <span className="font-semibold text-sm tracking-tight text-ink group-hover:text-brand transition-colors">Fodda</span>
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="md:hidden p-2 -mr-2 text-ink-3 hover:text-ink transition-colors" title="Close Sidebar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation Sections — 7 Reconciled Destinations */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">

          {/* 1. HOME */}
          <NavItem
            label="Home"
            onClick={() => { onNavigate('home'); onClose(); }}
            isActive={isActive('home')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
          />

          {/* 2. ASK (Query Library + Test Bench) */}
          <div>
            <SectionHeader
              label="Ask"
              isExpanded={expandedSections.demo || activeView === 'sandbox' || activeView === 'library' || activeView === 'expert-chat'}
              onToggle={() => toggleSection('demo')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.demo || activeView === 'sandbox' || activeView === 'library' || activeView === 'expert-chat') ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="Query Library" onClick={() => { onNavigate('library'); onClose(); }} isActive={isActive('library')} indent />
              <NavItem label="Test Bench" onClick={() => { onNavigate('sandbox'); onClose(); }} isActive={isActive('sandbox') || isActive('expert-chat')} indent />
            </div>
          </div>

          {/* 3. EXPERTS */}
          <NavItem
            label="Experts"
            onClick={() => { onNavigate('directory'); onClose(); }}
            isActive={isActive('directory')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          />

          {/* 4. COVERAGE */}
          <NavItem
            label="Coverage"
            onClick={() => { onNavigate('coverage'); onClose(); }}
            isActive={isActive('coverage') || isActive('my-graphs')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
          />

          {/* 5. ACCESS */}
          <NavItem
            label="Access"
            onClick={() => { onNavigate('connections'); onClose(); }}
            isActive={isActive('connections') || isInGroup('connections-') || isActive('account-team')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
          />

          {/* 6. BILLING & USAGE */}
          <NavItem
            label="Billing & Usage"
            onClick={() => { onNavigate('account-billing'); onClose(); }}
            isActive={isActive('account-billing') || isActive('account-usage')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          />

          {/* 7. PROFILE */}
          <NavItem
            label="Profile"
            onClick={() => { onNavigate('profile'); onClose(); }}
            isActive={isActive('profile') || isActive('expert-twin')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          />

        </div>

        {/* Footer — Documentation Links + Logout */}
        <div className="px-3 py-3 border-t border-line shrink-0 space-y-2">
          <div className="flex items-center justify-between px-3 text-[10px] font-mono text-ink-3">
            <button onClick={() => { onNavigate('knowledge-api-docs'); onClose(); }} className="hover:text-ink">Docs</button>
            <span>·</span>
            <button onClick={() => { onNavigate('skills'); onClose(); }} className="hover:text-ink">Skills</button>
            <span>·</span>
            <button onClick={() => { onNavigate('knowledge-security'); onClose(); }} className="hover:text-ink">Security</button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-ink-4 hover:text-red-500 hover:bg-red-50 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Logout</span>
          </button>
          <p className="text-[9px] text-ink-4 font-mono px-3">Fodda</p>
        </div>

      </div>
    </>
  );
};
