import React from 'react';
import { User, Account } from '../../shared/types';
import { AccountPortal } from './AccountPortal';

export type ConnectionTab = 'claude' | 'chatgpt' | 'notion' | 'copilot' | 'gemini' | 'mcp' | 'api' | 'perplexity';

interface ConnectionsPageProps {
  activeTab: ConnectionTab;
  user: User;
  account: Account;
  onUpdate?: (account: Account) => void;
  onViewPlans?: () => void;
  onViewApiDocs?: () => void;
}

const tabLabels: Record<ConnectionTab, { title: string; subtitle: string }> = {
  claude: { title: 'Claude Connector', subtitle: 'Connect your Fodda graphs to Anthropic Claude via MCP' },
  chatgpt: { title: 'ChatGPT Connector', subtitle: 'Connect your Fodda graphs to OpenAI ChatGPT via MCP' },
  perplexity: { title: 'Perplexity Integration', subtitle: 'Access Fodda graphs inside Perplexity search and workspaces' },
  notion: { title: 'Notion Connector', subtitle: 'Surface Fodda insights directly inside Notion pages' },
  copilot: { title: 'Microsoft Copilot', subtitle: 'Connect Fodda to Microsoft 365 Copilot via MCP or Teams plugin' },
  gemini: { title: 'Gemini / Vertex', subtitle: 'Connect Fodda to Google Gemini and Vertex AI agents' },
  mcp: { title: 'MCP Server', subtitle: 'Model Context Protocol server configuration, transports, and tools' },
  api: { title: 'API Access', subtitle: 'REST API keys, rate limits, and endpoint configuration' },
};

/**
 * ConnectionsPage renders a header + the AccountPortal inline
 * for the selected connection tab.
 */
export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  activeTab,
  user,
  account,
  onUpdate,
  onViewPlans,
  onViewApiDocs,
}) => {
  const { title, subtitle } = tabLabels[activeTab];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <p className="eyebrow mb-1">Connections</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">{title}</h1>
        <p className="text-sm text-ink-3 mt-1">{subtitle}</p>
      </div>
      {/* Content via AccountPortal inline */}
      <AccountPortal
        isOpen={true}
        onClose={() => { /* no-op: inline mode */ }}
        user={user}
        account={account}
        onUpdate={onUpdate}
        onViewPlans={onViewPlans}
        onViewApiDocs={onViewApiDocs}
        initialTab={activeTab}
        inline={true}
      />
    </div>
  );
};
