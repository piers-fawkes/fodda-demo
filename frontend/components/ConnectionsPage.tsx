import React, { useState } from 'react';
import { User, Account } from '../../shared/types';
import { AccountPortal } from './AccountPortal';

export type ConnectionTab = 'claude' | 'chatgpt' | 'gemini' | 'copilot' | 'perplexity' | 'notion' | 'api' | 'team' | 'roadmap';

interface ConnectionsPageProps {
  activeTab?: ConnectionTab;
  user: User;
  account: Account;
  onUpdate?: (user?: User, account?: Account) => void;
  onNavigateTab?: (tab: ConnectionTab) => void;
  onTryPrompt?: (promptText: string, graphId?: string) => void;
  onSetupPayment?: () => void;
}

const tabLabels: Record<ConnectionTab, { title: string; subtitle: string; icon: string }> = {
  claude: { title: 'Claude Connector', subtitle: 'Connect your Fodda graphs to Anthropic Claude via MCP', icon: '🤖' },
  chatgpt: { title: 'ChatGPT Connector', subtitle: 'Connect your Fodda graphs to OpenAI ChatGPT via MCP', icon: '💬' },
  gemini: { title: 'Gemini / Vertex AI', subtitle: 'Connect Fodda to Google Gemini and Vertex AI agents', icon: '✨' },
  copilot: { title: 'Microsoft Copilot', subtitle: 'Connect Fodda to Microsoft 365 Copilot via MCP or Teams plugin', icon: '💼' },
  perplexity: { title: 'Perplexity Search', subtitle: 'Access Fodda graphs inside Perplexity search & workspaces', icon: '🔍' },
  notion: { title: 'Notion Integration', subtitle: 'Surface Fodda insights directly inside Notion pages', icon: '📝' },
  api: { title: 'Developer API & MCP Keys', subtitle: 'REST API keys, rate limits, and token lifecycle safety', icon: '🔑' },
  team: { title: 'Team Members & Access', subtitle: 'Manage team invites, roles, and per-user connector token safety', icon: '👥' },
  roadmap: { title: 'Add Your Own Source', subtitle: 'Connect your custom enterprise data source or proprietary graph', icon: '🚀' },
};

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  activeTab = 'claude',
  user,
  account,
  onUpdate,
  onNavigateTab,
  onSetupPayment
}) => {
  const [currentTab, setCurrentTab] = useState<ConnectionTab>(activeTab);
  const { title, subtitle } = tabLabels[currentTab] || tabLabels.claude;

  const handleTabChange = (t: ConnectionTab) => {
    setCurrentTab(t);
    onNavigateTab?.(t);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <p className="eyebrow mb-1">Team & Access</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">{title}</h1>
        <p className="text-sm text-ink-3 mt-1 max-w-2xl">{subtitle}</p>
      </div>

      {/* Tab Selector */}
      <div className="px-8 shrink-0 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 border-b border-line">
          {(Object.keys(tabLabels) as ConnectionTab[]).map(tKey => {
            const item = tabLabels[tKey];
            const isActive = currentTab === tKey;
            const isRoadmap = tKey === 'roadmap';

            return (
              <button
                key={tKey}
                onClick={() => handleTabChange(tKey)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-ink text-white shadow-sm'
                    : isRoadmap
                    ? 'bg-cream/80 text-ink-4 border border-line/60 hover:border-line'
                    : 'bg-paper text-ink-3 hover:text-ink hover:bg-cream border border-line'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.title}</span>
                {isRoadmap && (
                  <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                    Roadmap
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content View */}
      <div className="px-8 pb-10 flex-1">
        {currentTab === 'roadmap' ? (
          /* "Add Your Own Source" Roadmap Card */
          <div className="p-8 bg-paper border border-line/80 rounded-3xl max-w-3xl space-y-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif italic text-2xl text-ink font-bold">Add Your Own Source</h3>
                  <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    Enterprise Roadmap
                  </span>
                </div>
                <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                  Bring your enterprise knowledge graph, custom vector database, or proprietary API directly into the Fodda discovery engine.
                </p>
              </div>
            </div>

            <div className="p-5 bg-white border border-line rounded-2xl space-y-3 text-xs text-ink-2">
              <h4 className="font-bold text-ink text-sm">Supported Custom Source Architectures:</h4>
              <ul className="space-y-2 text-ink-3">
                <li className="flex items-center gap-2">
                  <span className="text-brand font-bold">✓</span>
                  <span>Custom Knowledge Graphs & RDF Triple Stores</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand font-bold">✓</span>
                  <span>Enterprise Vector Stores & Hybrid RAG Pipelines</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand font-bold">✓</span>
                  <span>Private REST & GraphQL Data Services</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-amber-900 font-medium">Interested in connecting a custom data source?</span>
              <a
                href="mailto:piers.fawkes@psfk.com?subject=Fodda%20Custom%20Source%20Integration"
                className="px-4 py-2 bg-ink text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-ink-2 transition-colors shadow-sm"
              >
                Inquire for Enterprise Beta →
              </a>
            </div>
          </div>
        ) : (
          /* Render inline AccountPortal for tab */
          <AccountPortal
            isOpen={true}
            onClose={() => {}}
            user={user}
            account={account}
            onUpdate={(u, a) => onUpdate?.(u, a)}
            onSetupPayment={onSetupPayment}
            initialTab={currentTab === 'team' ? 'users' : (currentTab as any)}
            inline={true}
          />
        )}
      </div>
    </div>
  );
};
