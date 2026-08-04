import React, { useEffect, useState } from 'react';
import { User, Account, KnowledgeGraph } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { UsageMeter } from './UsageMeter';
import { PageShell } from './PageShell';

interface HomeDashboardProps {
  user: User;
  account: Account;
  onNavigate: (view: string, extra?: any) => void;
  onTryPrompt: (promptText: string, graphId?: string) => void;
  onOpenReceipt?: (receiptId: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  account,
  onNavigate,
  onTryPrompt,
  onOpenReceipt
}) => {
  const [mcpConn, setMcpConn] = useState<any>(null);
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [promptPicks, setPromptPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dataService.getMcpConnection(user?.email || '').catch(() => null),
      dataService.fetchGraphs(account?.apiKey || '').catch(() => []),
      fetch('/api/prompts').then(r => r.json()).catch(() => null)
    ]).then(([conn, graphList, promptRes]) => {
      if (isMounted) {
        if (conn) setMcpConn(conn);
        if (graphList) setGraphs(graphList);
        if (promptRes?.ok && promptRes?.jobs) {
          const picks: any[] = [];
          Object.keys(promptRes.promptsByJob || {}).forEach(jobId => {
            const list = promptRes.promptsByJob[jobId] || [];
            if (list.length > 0) picks.push({ ...list[0], jobLabel: jobId });
          });
          setPromptPicks(picks.slice(0, 4));
        }
      }
    }).finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [user?.email, account?.apiKey]);

  const activeGraphCount = graphs.length || 93;
  const expertCount = graphs.filter(g => (g.graph_type || '').toLowerCase() === 'expert').length || 7;
  const categoriesCount = new Set(graphs.map(g => g.domain || g.verticalName)).size || 21;

  const monthlyQueries = account?.currentQueryCount || 0;
  const monthlyQueryLimit = account?.monthlyQueryLimit || 100;
  const remainingQueries = Math.max(0, monthlyQueryLimit - monthlyQueries);
  const totalQueries = account?.lifetimeQueries || account?.totalQueries || monthlyQueries;

  const firstName = user?.name ? user.name.split(' ')[0] : (user?.email?.split('@')[0] || 'Partner');

  return (
    <PageShell
      eyebrow="Home"
      title={`Welcome back, ${firstName}`}
      subtitle={`${account?.name || 'Your Org'} · ${account?.planName || 'Free plan'} · ${remainingQueries.toLocaleString()} queries remaining`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTryPrompt("What are the key market signals and emerging trends across retail, beauty, and consumer electronics?", "global")}
            className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>Ask Fodda Assistant</span>
            <span>💬</span>
          </button>
          <button
            onClick={() => onNavigate('sandbox')}
            className="px-3.5 py-2 bg-cream border border-line text-ink font-bold text-xs rounded-xl hover:bg-paper transition-colors shadow-2xs"
          >
            Open Test Bench
          </button>
        </div>
      }
    >
      {/* ── System Status Strip ── */}
      <div className="p-3 bg-white border border-line rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="font-bold text-ink">{activeGraphCount}</span>
          <span className="text-ink-3">graphs live</span>
        </div>
        <div className="text-ink-4">·</div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink">{expertCount}</span>
          <span className="text-ink-3">Human Agents</span>
        </div>
        <div className="text-ink-4">·</div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink">{categoriesCount}</span>
          <span className="text-ink-3 font-sans">categories</span>
        </div>
        <div className="text-ink-4">·</div>
        <div className="flex items-center gap-2 text-ink-2 font-sans font-medium">
          <span>Evidence within 120 days</span>
        </div>
        <div className="text-ink-4">·</div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[10px]">
            {mcpConn ? 'Token Issued' : 'MCP Ready'}
          </span>
        </div>
      </div>

      {/* ── Headline Stat Cards (3 Columns) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Queries Used</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{monthlyQueries.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">This month ({monthlyQueryLimit ? Math.round((monthlyQueries / monthlyQueryLimit) * 100) : 0}% limit)</p>
        </div>

        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Queries Remaining</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{remainingQueries.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">Available until renewal</p>
        </div>

        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">All-Time Queries</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{totalQueries.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">Lifetime account volume</p>
        </div>
      </div>

      {/* ── MCP URL Card & Get Started Card ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* MCP Connector */}
        <div className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">MCP Connector</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Token Issued
              </span>
            </div>
            <h3 className="font-serif italic text-xl text-ink font-bold">Claude & Desktop Connector</h3>
            <p className="text-xs text-ink-3 leading-relaxed">
              Your token is issued and ready. Connect Claude or your local AI client to query Fodda knowledge graphs directly inside your workflow.
            </p>
          </div>

          <div className="pt-2 border-t border-line/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-ink-3 truncate max-w-[200px]">
              {mcpConn?.connectorUrl ? `${mcpConn.connectorUrl.substring(0, 26)}...` : 'https://mcp.fodda.ai/c/...'}
            </span>
            <button
              onClick={() => onNavigate('connections-claude')}
              className="px-3.5 py-1.5 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
            >
              Install Guide →
            </button>
          </div>
        </div>

        {/* Get Started / Query Knowledge Index Card */}
        <div className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand">Get Started</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                120-Day Evidence Discipline
              </span>
            </div>
            <h3 className="font-serif italic text-xl text-ink font-bold">Query Knowledge Index & Human Agents</h3>
            <p className="text-xs text-ink-3 leading-relaxed">
              Find ideas & signals across retail, beauty, consumer electronics, macro trends, and directly from human expert twins.
            </p>
          </div>

          <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium text-ink-3">Interactive Assistant</span>
            <button
              onClick={() => onTryPrompt("What are the key market signals and emerging trends across retail, beauty, and consumer electronics?", "global")}
              className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <span>Launch Assistant Chat</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── What to Ask Section ── */}
      <div className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Sample Workflows</p>
            <h3 className="font-serif italic text-xl text-ink font-bold">What to Ask</h3>
          </div>
          <button
            onClick={() => onNavigate('library')}
            className="text-xs font-bold text-brand hover:underline"
          >
            Browse Full Library →
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-ink-3 italic bg-cream/40 rounded-xl border border-line">
            Loading prompt workflows…
          </div>
        ) : (
          <div className="space-y-2">
            {promptPicks.map((p, idx) => (
              <div key={idx} className="p-3 bg-cream/60 border border-line/60 rounded-xl flex items-center justify-between gap-4 hover:border-brand/40 transition-all">
                <div className="min-w-0 flex-1">
                  <p className="font-serif italic text-sm text-ink truncate">"{p.text}"</p>
                  <p className="text-[10px] font-mono text-ink-4 mt-0.5">
                    {p.jobLabel || 'Research Workflow'} {p.graphId ? `· Target: ${p.graphId}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onTryPrompt(p.text, p.graphId)}
                  className="px-3 py-1.5 bg-ink hover:bg-brand text-white font-bold text-xs rounded-lg transition-colors shrink-0 shadow-sm"
                >
                  Run →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Usage Meter ── */}
      <div className="pt-2">
        <UsageMeter
          user={user}
          account={account}
          onOpenReceipt={onOpenReceipt}
        />
      </div>
    </PageShell>
  );
};
