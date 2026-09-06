import React, { useState, useEffect } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { PageShell } from './PageShell';
import { AccountPortal } from './AccountPortal';

export type ConnectionTab =
  | 'index'
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'copilot'
  | 'perplexity'
  | 'notion'
  | 'mcp'
  | 'api'
  | 'a2a'
  | 'team'
  | 'roadmap';

interface ConnectionsPageProps {
  activeTab?: ConnectionTab;
  user: User;
  account: Account;
  onUpdate?: (user?: User, account?: Account) => void;
  onNavigateTab?: (tab: ConnectionTab) => void;
  onTryPrompt?: (promptText: string, graphId?: string) => void;
  onSetupPayment?: () => void;
  onViewApiDocs?: () => void;
}

export interface ClientStep {
  title: string;
  body: string;
  field?: 'endpoint' | 'tokenEndpoint' | 'apiKey' | 'vertexConfig';
  sample?: string;
}

export interface ClientTroubleshoot {
  symptom: string;
  fix: string;
}

export interface ClientConfig {
  id: ConnectionTab;
  name: string;
  mark: string;
  subtitle: string;
  oneLiner: string;
  tag: string;
  primaryAction?: { label: string; url: string };
  guideUrl?: string;
  steps: ClientStep[];
  troubleshooting: ClientTroubleshoot[];
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  activeTab = 'index',
  user,
  account,
  onUpdate,
  onNavigateTab,
  onSetupPayment,
  onViewApiDocs,
}) => {
  const [currentTab, setCurrentTab] = useState<ConnectionTab>(activeTab);
  const [mcpToken, setMcpToken] = useState<string | null>(account.mcpToken || null);
  const [loadingToken, setLoadingToken] = useState<boolean>(!account.mcpToken);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpToolCount, setMcpToolCount] = useState<number>(46);

  // Danger Zone / Account Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;
    if (!mcpToken && account?.id) {
      setLoadingToken(true);
      dataService.getMcpConnection(account.id, user.email)
        .then(conn => {
          if (isMounted && conn?.token) {
            setMcpToken(conn.token);
          }
        })
        .catch(err => console.warn('[ConnectionsPage] Token load warning:', err))
        .finally(() => {
          if (isMounted) setLoadingToken(false);
        });
    }
    return () => { isMounted = false; };
  }, [account?.id, user?.email, mcpToken]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/mcp/tools', { headers: { 'x-api-key': account.apiKey } })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.count) {
          setMcpToolCount(data.count);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [account.apiKey]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleNavigate = (tab: ConnectionTab) => {
    setCurrentTab(tab);
    onNavigateTab?.(tab);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await dataService.deleteAccount(user.email, 'DELETE');
      if (result.ok) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      } else {
        setDeleteError(result.error || 'Failed to delete account. Please try again.');
      }
    } catch (e: any) {
      setDeleteError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Base endpoints
  const stdEndpoint = 'https://mcp.fodda.ai/mcp';
  const rawToken = mcpToken || 'YOUR_TOKEN';
  const tokenEndpoint = `https://mcp.fodda.ai/c/${rawToken}`;
  const maskedTokenEndpoint = mcpToken
    ? `https://mcp.fodda.ai/c/${mcpToken.slice(0, 5)}••••••••••••••••••••••••`
    : 'https://mcp.fodda.ai/c/••••••••';

  const vertexConfigObj = {
    tools: [
      {
        type: 'mcp_server',
        name: 'fodda',
        url: tokenEndpoint,
      },
    ],
  };
  const vertexConfigStr = JSON.stringify(vertexConfigObj, null, 2);

  // Client configurations as specified in 04 §4
  const clientConfigs: Record<string, ClientConfig> = {
    claude: {
      id: 'claude',
      name: 'Claude',
      mark: 'CL',
      subtitle: 'Desktop, web and mobile. Three steps, about a minute.',
      oneLiner: 'Desktop, web and mobile. One-click connector install.',
      tag: 'Streamable HTTP',
      primaryAction: {
        label: 'Add to Claude',
        url: `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(stdEndpoint)}`,
      },
      steps: [
        {
          title: 'Choose connector settings',
          body: 'In Claude Pro or Max, go to Customize → Connectors → + → Add custom connector. For Team or Enterprise organizations, owners go to Organization settings → Connectors → Add → Custom → Web.',
        },
        {
          title: 'Paste your Fodda endpoint',
          body: 'Enter https://mcp.fodda.ai/mcp. Fodda configures client credentials automatically via dynamic registration.',
          field: 'endpoint',
        },
        {
          title: 'Add and sign in',
          body: 'Click Add, then sign in to your Fodda account when prompted by Claude.',
        },
        {
          title: 'Claude Code CLI',
          body: 'For Claude Code CLI, execute this single command in your terminal:',
          sample: `claude mcp add --transport http fodda ${stdEndpoint}`,
        },
      ],
      troubleshooting: [
        { symptom: 'Claude does not list the connector', fix: 'Restart the Claude desktop app or refresh your browser after adding it.' },
        { symptom: 'Tools appear but return nothing', fix: 'Check your account status to confirm your plan has queries remaining.' },
        { symptom: 'Answers ignore your graphs', fix: 'Explicitly state "Fodda" or the specific graph name in your prompt.' },
      ],
    },
    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      mark: 'GPT',
      subtitle: 'Connect Fodda as a custom connector inside ChatGPT on the web.',
      oneLiner: 'Add Fodda as a custom connector in settings.',
      tag: 'OAuth / Streamable HTTP',
      steps: [
        {
          title: 'Enable Developer Mode',
          body: 'In ChatGPT on the web, go to Settings → Security and login → Developer mode, and switch it on.',
        },
        {
          title: 'Create a developer-mode app',
          body: 'Go to Plugins → + → Create a developer-mode app for your remote MCP server.',
        },
        {
          title: 'Paste endpoint and sign in',
          body: 'Paste https://mcp.fodda.ai/mcp, select OAuth, and sign in to Fodda when prompted. (If OAuth is not offered by your client interface, select No authentication and use your tokenized URL).',
          field: 'endpoint',
        },
      ],
      troubleshooting: [
        { symptom: 'ChatGPT cannot connect to server', fix: 'Ensure Developer Mode is enabled in ChatGPT Settings before adding.' },
        { symptom: 'Authentication fails', fix: 'Verify your Fodda account has an active plan or use your tokenized URL.' },
      ],
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini / Vertex AI',
      mark: 'GM',
      subtitle: 'Drop the tool config into your Vertex AI project or Gemini CLI.',
      oneLiner: 'Drop the tool config into your Vertex AI project.',
      tag: 'mcp_server',
      steps: [
        {
          title: 'Copy your tokenized MCP URL',
          body: 'Google Gemini models connect via Streamable HTTP using your tokenized endpoint:',
          field: 'tokenEndpoint',
        },
        {
          title: 'Or paste the Vertex AI JSON config',
          body: 'In Google AI Studio or Vertex AI Agent Builder, register an MCP tool using this JSON configuration (note type is mcp_server):',
          field: 'vertexConfig',
        },
        {
          title: 'Execute queries',
          body: `Gemini models will automatically discover all ${mcpToolCount} Fodda research and synthesis tools.`,
        },
      ],
      troubleshooting: [
        { symptom: 'Vertex AI rejects JSON config', fix: 'Verify type is "mcp_server" (not "mcp") and that the URL contains your token.' },
        { symptom: 'SSE connection error', fix: 'Gemini supports Streamable HTTP only; SSE is not supported by Google Gemini.' },
      ],
    },
    perplexity: {
      id: 'perplexity',
      name: 'Perplexity',
      mark: 'PX',
      subtitle: 'Add Fodda to your Perplexity custom remote connectors.',
      oneLiner: 'Add Fodda to your Perplexity connectors.',
      tag: 'Streamable HTTP',
      steps: [
        {
          title: 'Open Connector Settings',
          body: 'In Perplexity Pro, Max, or Enterprise, go to Settings → Connectors → Add a custom remote connector.',
        },
        {
          title: 'Configure remote connector',
          body: 'Set Name to Fodda, Transport to Streamable HTTP, Authentication to OAuth, and URL to https://mcp.fodda.ai/mcp.',
          field: 'endpoint',
        },
        {
          title: 'Authorize connection',
          body: 'Tick the risk acknowledgement checkbox, click Add, and sign in to your Fodda account when prompted.',
        },
      ],
      troubleshooting: [
        { symptom: 'Perplexity does not call Fodda', fix: 'Ensure the Fodda connector is enabled in your active Perplexity search workspace.' },
      ],
    },
    notion: {
      id: 'notion',
      name: 'Notion',
      mark: 'NO',
      subtitle: 'Consult Fodda knowledge graphs directly from inside Notion AI.',
      oneLiner: 'Consult Fodda from inside Notion AI.',
      tag: 'Path Token',
      steps: [
        {
          title: 'Enable Custom MCP servers',
          body: 'Workspace admins first go to Settings → Notion AI → AI connectors → Enable Custom MCP servers.',
        },
        {
          title: 'Add custom MCP server',
          body: 'In Notion AI agent, go to Settings → Tools & Access → Add connection → Custom MCP server.',
        },
        {
          title: 'Paste connection URL',
          body: 'Set Name to Fodda, URL to your tokenized endpoint, and select No additional authentication.',
          field: 'tokenEndpoint',
        },
        {
          title: 'Save and query',
          body: 'Click Save. You can now prompt Notion AI to query your connected Fodda knowledge graphs.',
        },
      ],
      troubleshooting: [
        { symptom: 'Custom MCP option missing', fix: 'Notion AI Custom Agents require a Notion Business or Enterprise plan.' },
      ],
    },
    copilot: {
      id: 'copilot',
      name: 'Microsoft Copilot',
      mark: 'CP',
      subtitle: 'Register Fodda as a Microsoft Copilot Studio agent tool.',
      oneLiner: 'Register Fodda as a Microsoft Copilot agent tool.',
      tag: 'Copilot Studio',
      steps: [
        {
          title: 'Add a tool in Copilot Studio',
          body: 'In Microsoft Copilot Studio, go to Tools → Add a tool → New tool → Model Context Protocol.',
        },
        {
          title: 'Configure MCP Server',
          body: 'Set Server name to Fodda, add a brief description of Fodda research capabilities, and paste https://mcp.fodda.ai/mcp.',
          field: 'endpoint',
        },
        {
          title: 'Select Dynamic Discovery OAuth',
          body: 'Under Authentication, choose OAuth 2.0 → Dynamic discovery. Fodda configures client credentials automatically via DCR.',
        },
        {
          title: 'Create connection',
          body: 'Click Create → Create a new connection → Add to agent.',
        },
      ],
      troubleshooting: [
        { symptom: 'Copilot cannot reach server', fix: 'Ensure you are using Copilot Studio with the Streamable HTTP URL https://mcp.fodda.ai/mcp.' },
      ],
    },
    mcp: {
      id: 'mcp',
      name: 'Any MCP Client',
      mark: 'MC',
      subtitle: 'Raw Streamable HTTP endpoint for any MCP-compliant client or CLI.',
      oneLiner: 'Raw endpoint. Streamable HTTP.',
      tag: 'MCP Protocol',
      steps: [
        {
          title: 'OAuth Sign-In Clients',
          body: 'If your client supports OAuth sign-in, use the standard MCP endpoint:',
          field: 'endpoint',
        },
        {
          title: 'Path Token Clients',
          body: 'If your client does not support OAuth sign-in, use your tokenized URL:',
          field: 'tokenEndpoint',
        },
      ],
      troubleshooting: [
        { symptom: 'Handshake succeeds but tools fail', fix: 'Unauthenticated handshakes are allowed to list tools, but invoking graph tools requires signing in or passing your token.' },
      ],
    },
    api: {
      id: 'api',
      name: 'REST API',
      mark: 'API',
      subtitle: 'Direct HTTP REST API for custom software and backend services.',
      oneLiner: 'X-API-Key authenticated REST endpoints.',
      tag: 'HTTPS REST',
      steps: [
        {
          title: 'Base URL & Authentication',
          body: 'Base URL: https://api.fodda.ai. Pass your API key in the X-API-Key HTTP header.',
          field: 'apiKey',
        },
        {
          title: 'Quickstart Curl Command',
          body: 'Run a graph search query against Fodda REST API:',
          sample: `curl -X POST https://api.fodda.ai/v1/graphs/psfk/search \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${account.apiKey || 'YOUR_API_KEY'}" \\\n  -d '{"query": "retail innovation", "limit": 10}'`,
        },
      ],
      troubleshooting: [
        { symptom: '401 Unauthorized', fix: 'Ensure your X-API-Key header matches your active key.' },
        { symptom: '402 Payment Required', fix: 'Your account has exceeded its query quota. Please add a payment method.' },
      ],
    },
    a2a: {
      id: 'a2a',
      name: 'Agent-to-Agent (A2A)',
      mark: 'A2A',
      subtitle: 'JSON-RPC agent delegation protocol for multi-agent workflows.',
      oneLiner: 'JSON-RPC agent delegation protocol at /a2a.',
      tag: 'A2A v0.3.0',
      steps: [
        {
          title: 'A2A Endpoint',
          body: 'Delegate research tasks directly to Fodda via JSON-RPC POST requests to https://mcp.fodda.ai/a2a.',
          sample: 'https://mcp.fodda.ai/a2a',
        },
        {
          title: 'Agent Card Metadata',
          body: 'Inspect Fodda\'s A2A 0.3.0 capabilities and skill schema at https://mcp.fodda.ai/.well-known/agent-card.json.',
          sample: 'https://mcp.fodda.ai/.well-known/agent-card.json',
        },
      ],
      troubleshooting: [
        { symptom: 'GET request returns 404', fix: 'The A2A endpoint accepts POST JSON-RPC requests only. GET requests correctly return 404.' },
      ],
    },
  };

  // Render Team view directly via AccountPortal if activeTab === 'team'
  if (currentTab === 'team') {
    return (
      <PageShell
        eyebrow="Access"
        title="Team Members & Access"
        subtitle="Manage team invites, roles, and per-user connector token safety"
      >
        <AccountPortal
          isOpen={true}
          onClose={() => {}}
          user={user}
          account={account}
          onUpdate={onUpdate}
          onSetupPayment={onSetupPayment}
          initialTab="team"
          inline={true}
        />
      </PageShell>
    );
  }

  // Render Individual Client Setup Page if activeTab is a client ID
  if (currentTab !== 'index' && clientConfigs[currentTab]) {
    const cfg = clientConfigs[currentTab];

    const renderFieldValue = (field?: string) => {
      if (field === 'endpoint') return stdEndpoint;
      if (field === 'tokenEndpoint') return tokenEndpoint;
      if (field === 'apiKey') return account.apiKey;
      if (field === 'vertexConfig') return vertexConfigStr;
      return '';
    };

    return (
      <PageShell
        eyebrow="Connections"
        title={cfg.name}
        subtitle={cfg.subtitle}
        actions={
          cfg.primaryAction ? (
            <a
              href={cfg.primaryAction.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              {cfg.primaryAction.label}
            </a>
          ) : undefined
        }
      >
        {/* Breadcrumb */}
        <div className="mb-2">
          <button
            onClick={() => handleNavigate('index')}
            className="text-[11.5px] font-medium text-ink-3 hover:text-ink transition-colors flex items-center gap-1"
          >
            <span>←</span>
            <span>Connections / {cfg.name}</span>
          </button>
        </div>

        {/* Install Block */}
        <section className="bg-paper border border-line rounded-[14px] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line-soft pb-3">
            <div>
              <h2 className="text-[13.5px] font-bold text-ink">Install</h2>
              <p className="text-[11.5px] text-ink-3">In {cfg.name}, not here</p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-cream border border-line text-ink-3 px-2 py-0.5 rounded-full">
              {cfg.steps.length} steps
            </span>
          </div>

          <div className="space-y-4">
            {cfg.steps.map((st, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-soft border border-brand-line text-brand text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="text-[13px] font-bold text-ink">{st.title}</h3>
                  <p className="text-[11.5px] text-ink-2 leading-relaxed">{st.body}</p>

                  {st.field && (
                    <div className="relative group mt-2">
                      <pre className="p-3 bg-cream border border-line rounded-lg text-[11.5px] font-mono text-ink overflow-x-auto whitespace-pre-wrap leading-relaxed pr-16">
                        {renderFieldValue(st.field)}
                      </pre>
                      <button
                        onClick={() => handleCopy(renderFieldValue(st.field), `step-${idx}`)}
                        className="absolute top-2 right-2 px-2 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink hover:bg-cream transition-all shadow-2xs"
                      >
                        {copiedField === `step-${idx}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {st.sample && (
                    <div className="relative group mt-2">
                      <pre className="p-3 bg-ink text-green-400 rounded-lg text-[11.5px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed pr-16 border border-ink-2">
                        {st.sample}
                      </pre>
                      <button
                        onClick={() => handleCopy(st.sample!, `sample-${idx}`)}
                        className="absolute top-2 right-2 px-2 py-1 bg-ink-2 border border-ink-4/30 rounded text-[10px] font-bold text-paper hover:bg-ink-3 transition-all"
                      >
                        {copiedField === `sample-${idx}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Required Footer Note (02-client-setup.md §3 & 04 §6) */}
          <div className="p-3 bg-cream border border-line-soft rounded-lg text-[11.5px] text-ink-3 leading-relaxed mt-4">
            Fodda cannot see whether {cfg.name} loaded the connector, so this page will not show a connected state. If the query above returns sourced results, you are set up.
          </div>
        </section>

        {/* Endpoints & Authentication Block */}
        <section className="bg-paper border border-line rounded-[14px] p-4 sm:p-5 space-y-4">
          <h2 className="text-[13.5px] font-bold text-ink border-b border-line-soft pb-2">Endpoints & Authentication</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Standard MCP Endpoint */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">MCP Endpoint (OAuth)</label>
                <span className="text-[10px] text-brand font-medium">Streamable HTTP</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={stdEndpoint}
                  className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-[11.5px] font-mono text-ink pr-16 focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(stdEndpoint, 'cfg-std-ep')}
                  className="absolute top-1.5 right-1.5 px-2 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink transition-colors"
                >
                  {copiedField === 'cfg-std-ep' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Tokenized MCP Endpoint */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Tokenized URL (Path Token)</label>
                <span className="text-[10px] text-ink-3 font-medium">Client can't sign in?</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={showToken ? tokenEndpoint : maskedTokenEndpoint}
                  className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-[11.5px] font-mono text-ink pr-28 focus:outline-none"
                />
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="px-1.5 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink transition-colors"
                  >
                    {showToken ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => handleCopy(tokenEndpoint, 'cfg-tok-ep')}
                    className="px-2 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink transition-colors"
                  >
                    {copiedField === 'cfg-tok-ep' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">API Key (REST & Headers)</label>
              <span className="text-[10px] text-ink-3 font-medium">X-API-Key</span>
            </div>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={showApiKey ? account.apiKey : `${account.apiKey.slice(0, 7)}••••••••••••••••••••`}
                className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-[11.5px] font-mono text-ink pr-28 focus:outline-none"
              />
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-1.5 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink transition-colors"
                >
                  {showApiKey ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => handleCopy(account.apiKey, 'cfg-apikey')}
                  className="px-2 py-1 bg-paper border border-line rounded text-[10px] font-bold text-ink-3 hover:text-ink transition-colors"
                >
                  {copiedField === 'cfg-apikey' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Troubleshooting Block */}
        {cfg.troubleshooting && cfg.troubleshooting.length > 0 && (
          <section className="bg-paper border border-line rounded-[14px] p-4 sm:p-5 space-y-3">
            <h2 className="text-[13.5px] font-bold text-ink border-b border-line-soft pb-2">If it is not working</h2>
            <div className="divide-y divide-line-soft">
              {cfg.troubleshooting.map((tr, idx) => (
                <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-ink">{tr.symptom}</span>
                  <span className="text-ink-2 font-normal text-right sm:max-w-md">{tr.fix}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </PageShell>
    );
  }

  // Default: Render Connections Index Page (`activeTab === 'index'`)
  return (
    <PageShell
      eyebrow="Connections"
      title="Connect Fodda to your AI"
      subtitle="One credential works everywhere. Pick a client for its setup steps."
      actions={
        <button
          onClick={() => handleNavigate('api')}
          className="px-3.5 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-cream transition-colors"
        >
          API docs
        </button>
      }
    >
      {/* 1. Fireflies-style Top Cards: 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: MCP Card (OAuth) */}
        <section className="bg-paper border border-line rounded-[16px] p-5 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header / Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cream border border-line flex items-center justify-center text-sm shadow-2xs" title="ChatGPT &amp; Claude">
                  🤖
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#DE7356]/10 border border-[#DE7356]/20 flex items-center justify-center text-xs font-bold text-[#DE7356] shadow-2xs" title="Claude">
                  ✳
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                OAuth 2.0
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-ink">MCP (OAuth) — Claude</h2>
              <p className="text-xs text-ink font-medium">Supported on Claude, ChatGPT, Copilot</p>
            </div>

            {/* URL Input Box */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={stdEndpoint}
                  className="w-full bg-cream border border-line rounded-xl px-3.5 py-2.5 text-xs font-mono text-ink pr-16 focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(stdEndpoint, 'idx-std-ep')}
                  className="absolute top-1.5 right-1.5 px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs font-bold text-ink-3 hover:text-ink hover:bg-cream transition-colors shadow-2xs flex items-center gap-1"
                >
                  {copiedField === 'idx-std-ep' ? 'Copied!' : (
                    <>
                      <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 1-2-3 Simple Instructions */}
            <ol className="space-y-2 pt-1 text-xs text-ink-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Copy URL above and paste into app (Claude, ChatGPT, Copilot).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Sign in with Google, LinkedIn, or GitHub when prompted.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Pull Fodda graph intelligence &amp; research anywhere.</span>
              </li>
            </ol>
          </div>

          <div className="pt-2 border-t border-line-soft text-[11px] text-ink-3">
            Browser OAuth sign-in (Google, LinkedIn, or GitHub)
          </div>
        </section>

        {/* Card 2: MCP Card with Token */}
        <section className="bg-paper border border-line rounded-[16px] p-5 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header / Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 shadow-2xs" title="Gemini">
                  ✦
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-600 shadow-2xs" title="Cursor &amp; CLI">
                  ⚡
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2 py-0.5 rounded-full">
                Tokenized Path
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-ink">MCP (Token)</h2>
              <p className="text-xs text-ink font-medium">Supported on Cursor, Gemini, Perplexity, Notion</p>
            </div>

            {/* Tokenized URL Input Box */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={showToken ? tokenEndpoint : maskedTokenEndpoint}
                  className="w-full bg-cream border border-line rounded-xl px-3.5 py-2.5 text-xs font-mono text-ink pr-24 focus:outline-none"
                />
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="px-1.5 py-1 bg-paper border border-line rounded-md text-[10px] font-bold text-ink-3 hover:text-ink hover:bg-cream transition-colors shadow-2xs"
                  >
                    {showToken ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => handleCopy(tokenEndpoint, 'idx-tok-ep')}
                    className="px-2 py-1 bg-paper border border-line rounded-md text-[10px] font-bold text-ink-3 hover:text-ink hover:bg-cream transition-colors shadow-2xs"
                  >
                    {copiedField === 'idx-tok-ep' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* 1-2-3 Simple Instructions */}
            <ol className="space-y-2 pt-1 text-xs text-ink-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Copy your tokenized URL above.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Paste into clients without OAuth (Cursor, Gemini CLI, Perplexity).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Token embedded directly — no login prompt required.</span>
              </li>
            </ol>
          </div>

          <div className="pt-2 border-t border-line-soft text-[11px] text-ink-3">
            No-auth clients &amp; background agents (token embedded in URL)
          </div>
        </section>

        {/* Card 3: Developer Settings / API Key */}
        <section className="bg-paper border border-line rounded-[16px] p-5 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cream border border-line flex items-center justify-center text-xs font-mono font-bold text-ink shadow-2xs">
                  &lt;&gt;
                </div>
                <span className="text-xs font-bold text-ink-3 uppercase tracking-wider">Developer Settings</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-brand-soft text-brand border border-brand-line px-2 py-0.5 rounded-full">
                REST API
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-ink">API Key</h2>
              <p className="text-xs text-ink-3">Serverless functions &amp; custom pipelines</p>
            </div>

            {/* API Key Input Box */}
            <div className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={showApiKey ? account.apiKey : `${account.apiKey.slice(0, 7)}••••••••••••••••••••`}
                  className="w-full bg-cream border border-line rounded-xl px-3.5 py-2.5 text-xs font-mono text-ink pr-24 focus:outline-none"
                />
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-1.5 py-1 bg-paper border border-line rounded-md text-[10px] font-bold text-ink-3 hover:text-ink hover:bg-cream transition-colors shadow-2xs"
                  >
                    {showApiKey ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => handleCopy(account.apiKey, 'idx-apikey')}
                    className="px-2 py-1 bg-paper border border-line rounded-md text-[10px] font-bold text-ink-3 hover:text-ink hover:bg-cream transition-colors shadow-2xs"
                  >
                    {copiedField === 'idx-apikey' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* 1-2-3 REST API Steps */}
            <ol className="space-y-2 pt-1 text-xs text-ink-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-brand-soft border border-brand-line text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Header: <code className="font-mono bg-cream px-1 rounded text-[11px]">X-API-Key: {account.apiKey.slice(0, 7)}...</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-brand-soft border border-brand-line text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Call endpoints <code className="font-mono bg-cream px-1 rounded text-[11px]">/api/search</code> or <code className="font-mono bg-cream px-1 rounded text-[11px]">/api/graph</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-md bg-brand-soft border border-brand-line text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Receive graph JSON with citations.</span>
              </li>
            </ol>
          </div>

          <div className="pt-2 border-t border-line-soft text-[11px] flex items-center justify-between">
            <span className="text-ink-3">REST base: <code className="font-mono text-ink-2">https://api.fodda.ai</code></span>
            <button onClick={() => handleNavigate('api')} className="text-brand font-bold hover:underline">API Reference →</button>
          </div>
        </section>
      </div>

      {/* 2. Detailed Instructions / How to install Fodda as a tool inside an assistant */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Detailed Setup Guides</h2>
          <p className="text-xs text-ink-3">How to install Fodda as a tool inside an assistant</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['claude', 'chatgpt', 'gemini', 'perplexity', 'notion', 'copilot'] as ConnectionTab[]).map(cKey => {
            const cfg = clientConfigs[cKey];
            if (!cfg) return null;
            return (
              <button
                key={cKey}
                onClick={() => handleNavigate(cKey)}
                className="p-4 bg-paper border border-line hover:border-brand-line hover:shadow-md rounded-[16px] text-left transition-all group flex flex-col justify-between h-[126px]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-soft border border-brand-line text-brand font-bold text-xs flex items-center justify-center font-mono shadow-2xs">
                      {cfg.mark}
                    </div>
                    <span className="text-sm font-bold text-ink group-hover:text-brand transition-colors">
                      {cfg.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-ink-3 bg-cream px-2 py-0.5 rounded-md border border-line-soft">
                    {cfg.tag}
                  </span>
                </div>

                <p className="text-xs text-ink-3 line-clamp-2 mt-1 leading-relaxed">
                  {cfg.oneLiner}
                </p>

                <div className="flex items-center justify-end text-xs font-bold text-brand group-hover:translate-x-0.5 transition-transform mt-auto pt-1">
                  <span>Setup guide →</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Developer Protocols Section */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Developer Protocols</h2>
          <p className="text-xs text-ink-3">Direct API and protocol integrations for codebases</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['mcp', 'api', 'a2a'] as ConnectionTab[]).map(cKey => {
            const cfg = clientConfigs[cKey];
            if (!cfg) return null;
            return (
              <button
                key={cKey}
                onClick={() => handleNavigate(cKey)}
                className="p-4 bg-paper border border-line hover:border-brand-line hover:shadow-md rounded-[16px] text-left transition-all group flex flex-col justify-between h-[126px]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-100/70 border border-purple-200 text-purple-700 font-bold text-xs flex items-center justify-center font-mono shadow-2xs">
                      {cfg.mark}
                    </div>
                    <span className="text-sm font-bold text-ink group-hover:text-brand transition-colors">
                      {cfg.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-ink-3 bg-cream px-2 py-0.5 rounded-md border border-line-soft">
                    {cfg.tag}
                  </span>
                </div>

                <p className="text-xs text-ink-3 line-clamp-2 mt-1 leading-relaxed">
                  {cfg.oneLiner}
                </p>

                <div className="flex items-center justify-end text-xs font-bold text-brand group-hover:translate-x-0.5 transition-transform mt-auto pt-1">
                  <span>Setup guide →</span>
                </div>
              </button>
            );
          })}

          {/* Generic MCP fallback card */}
          <div className="p-4 bg-cream/50 border border-dashed border-line rounded-[16px] text-left flex flex-col justify-between h-[126px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-line-soft text-ink-4 font-bold text-xs flex items-center justify-center font-mono">
                ...
              </div>
              <span className="text-sm font-bold text-ink-3">Any MCP Client</span>
            </div>
            <p className="text-xs text-ink-4 leading-relaxed">
              If it speaks MCP, standard <code className="font-mono text-ink-3">https://mcp.fodda.ai/mcp</code> is all it needs.
            </p>
            <div className="text-[10px] font-mono text-ink-4 text-right">
              Streamable HTTP
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone / Account Offboarding */}
      <section className="pt-6 border-t border-line/80 mt-6">
        <div className="p-4 bg-red-50/40 border border-red-200/60 rounded-[14px] flex items-center justify-between">
          <div>
            <h4 className="text-[11px] font-bold text-red-900 uppercase tracking-wider mb-0.5">Danger Zone</h4>
            <p className="text-[11.5px] text-red-700/80">Permanently delete your account, saved graphs, and associated API keys.</p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs shrink-0"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-xs" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 m-4 border border-line" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-600">Delete Account</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-ink-4 hover:text-ink">
                ✕
              </button>
            </div>
            <p className="text-xs text-ink-3 leading-relaxed mb-4">
              This action is permanent and cannot be undone. All your account data, API keys, and connector tokens will be deleted.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-ink-3 mb-1">
                Type <span className="font-mono text-red-600 font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-cream border border-line rounded-lg text-xs font-mono text-ink focus:outline-none focus:border-red-500"
              />
            </div>
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-xs font-bold text-ink-3 hover:text-ink">
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || isDeleting}
                className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting…' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};
