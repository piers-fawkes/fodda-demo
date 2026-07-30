import React, { useState } from 'react';

export type AppView =
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
  | 'connections-claude'
  | 'connections-chatgpt'
  | 'connections-perplexity'
  | 'connections-notion'
  | 'connections-copilot'
  | 'connections-gemini'
  | 'connections-mcp'
  | 'connections-api'
  | 'my-graphs'
  | 'team-graphs'
  | 'skills'
  | 'sandbox'
  | 'library'
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
    className="w-full flex items-center justify-between px-3 py-2 mb-0.5 mt-2 rounded-lg hover:bg-brand-soft/50 transition-all group cursor-pointer"
  >
    <div className="flex items-center gap-2.5">
      {icon && <div className="w-4 h-4 flex items-center justify-center text-ink-4 group-hover:text-ink-2 transition-colors">{icon}</div>}
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-3 group-hover:text-ink-2 transition-colors">{label}</span>
    </div>
    <svg
      className={`w-3 h-3 text-ink-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
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

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 scrollbar-hide">

          {/* ── PROFILE ── */}
          <div>
            <SectionHeader
              label="Profile"
              isExpanded={expandedSections.profile || activeView === 'profile' || activeView === 'profile-context' || activeView === 'profile-usage'}
              onToggle={() => toggleSection('profile')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.profile || activeView === 'profile' || activeView === 'profile-context' || activeView === 'profile-usage' || activeView === 'expert-twin') ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="Overview" onClick={() => { onNavigate('profile'); onClose(); }} isActive={isActive('profile')} indent />
              <NavItem label="Context Wiki" onClick={() => { onNavigate('profile-context'); onClose(); }} isActive={isActive('profile-context')} indent />
              <NavItem label="Usage" onClick={() => { onNavigate('profile-usage'); onClose(); }} isActive={isActive('profile-usage')} indent />
              <NavItem label="My Twin" onClick={() => { onNavigate('expert-twin'); onClose(); }} isActive={isActive('expert-twin')} indent icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
            </div>
          </div>

          {/* ── COVERAGE ── */}
          <div>
            <SectionHeader
              label="Coverage"
              isExpanded={expandedSections.graphs || activeView === 'coverage' || activeView === 'my-graphs' || activeView === 'team-graphs'}
              onToggle={() => toggleSection('graphs')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.graphs || activeView === 'coverage' || activeView === 'my-graphs' || activeView === 'team-graphs') ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="Coverage Map" onClick={() => { onNavigate('coverage'); onClose(); }} isActive={isActive('coverage') || isActive('my-graphs')} indent />
              {(userRole === 'Owner' || userRole === 'Admin') && (
                <NavItem label="Team Graphs" onClick={() => { onNavigate('team-graphs'); onClose(); }} isActive={isActive('team-graphs')} indent />
              )}
            </div>
          </div>

          {/* ── SKILLS ── */}
          <div>
            <SectionHeader
              label="Skills"
              isExpanded={expandedSections.skills || activeView === 'skills'}
              onToggle={() => toggleSection('skills')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.skills || activeView === 'skills') ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="My Skills" onClick={() => { onNavigate('skills'); onClose(); }} isActive={isActive('skills')} indent />
            </div>
          </div>

          {/* ── ASK ── */}
          <div>
            <SectionHeader
              label="Ask"
              isExpanded={expandedSections.demo || isInGroup('sandbox') || activeView === 'library' || activeView === 'expert-chat'}
              onToggle={() => toggleSection('demo')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.demo || activeView === 'sandbox' || activeView === 'library' || activeView === 'expert-chat') ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="Query Library" onClick={() => { onNavigate('library'); onClose(); }} isActive={isActive('library')} indent />
              <NavItem label="Test Bench" onClick={() => { onNavigate('sandbox'); onClose(); }} isActive={isActive('sandbox') || isActive('expert-chat')} indent />
            </div>
          </div>

          {/* ── ACCOUNT (Owner/Admin only) ── */}
          {isAdminOrOwner && (
            <div>
              <SectionHeader
                label="Account"
                isExpanded={expandedSections.account || isInGroup('account-')}
                onToggle={() => toggleSection('account')}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              />
              <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${expandedSections.account ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <NavItem label="Overview" onClick={() => { onNavigate('account-overview'); onClose(); }} isActive={isActive('account-overview')} indent />
                <NavItem label="Team Members" onClick={() => { onNavigate('account-team'); onClose(); }} isActive={isActive('account-team')} indent />
                <NavItem label="Usage" onClick={() => { onNavigate('account-usage'); onClose(); }} isActive={isActive('account-usage')} indent />
                <NavItem label="Context Wiki" onClick={() => { onNavigate('account-context'); onClose(); }} isActive={isActive('account-context')} indent />
                <NavItem label="Governance" onClick={() => {}} disabled={true} badge="Soon" indent />
                <NavItem label="Billing" onClick={() => { onNavigate('account-billing'); onClose(); }} isActive={isActive('account-billing')} indent />
              </div>
            </div>
          )}

          {/* ── CONNECTIONS (alphabetical) ── */}
          <div>
            <SectionHeader
              label="Connections"
              isExpanded={expandedSections.connections}
              onToggle={() => toggleSection('connections')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${expandedSections.connections ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="API Access" onClick={() => { onNavigate('connections-api'); onClose(); }} isActive={isActive('connections-api')} indent />
              <NavItem label="Claude Connector" onClick={() => { onNavigate('connections-claude'); onClose(); }} isActive={isActive('connections-claude')} indent />
              <NavItem label="ChatGPT Connector" onClick={() => { onNavigate('connections-chatgpt'); onClose(); }} isActive={isActive('connections-chatgpt')} indent />
              <NavItem label="Perplexity Integration" onClick={() => { onNavigate('connections-perplexity'); onClose(); }} isActive={isActive('connections-perplexity')} indent />
              <NavItem label="Gemini / Vertex" onClick={() => { onNavigate('connections-gemini'); onClose(); }} isActive={isActive('connections-gemini')} indent />
              <NavItem label="MCP Server" onClick={() => { onNavigate('connections-mcp'); onClose(); }} isActive={isActive('connections-mcp')} indent />
              <NavItem label="Microsoft Copilot" onClick={() => { onNavigate('connections-copilot'); onClose(); }} isActive={isActive('connections-copilot')} indent />
              <NavItem label="Notion Connector" onClick={() => { onNavigate('connections-notion'); onClose(); }} isActive={isActive('connections-notion')} indent />
            </div>
          </div>

          {/* ── KNOWLEDGE ── */}
          <div>
            <SectionHeader
              label="Knowledge"
              isExpanded={expandedSections.knowledge || isInGroup('knowledge-')}
              onToggle={() => toggleSection('knowledge')}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
            />
            <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${(expandedSections.knowledge || isInGroup('knowledge-')) ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem label="API Documentation" onClick={() => { onNavigate('knowledge-api-docs'); onClose(); }} isActive={isActive('knowledge-api-docs')} indent />
              <NavItem label="Reliability" onClick={() => { onNavigate('knowledge-reliability'); onClose(); }} isActive={isActive('knowledge-reliability')} indent />
              <NavItem label="Security" onClick={() => { onNavigate('knowledge-security'); onClose(); }} isActive={isActive('knowledge-security')} indent />
            </div>
          </div>

        </div>

        {/* Footer — Logout + Version */}
        <div className="px-3 py-3 border-t border-line shrink-0 space-y-2">
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
