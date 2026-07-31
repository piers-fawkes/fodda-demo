import React, { useEffect, useState } from 'react';
import { User, Account, KnowledgeGraph } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { UsageMeter } from './UsageMeter';

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
          // Pick top 4 prompts across jobs
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

  const activeGraphCount = graphs.filter(g => g.status === 'Active' || !g.status).length;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <p className="eyebrow mb-1">Overview</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">
          Welcome back, {user?.name || user?.email?.split('@')[0] || 'Partner'}
        </h1>
        <p className="text-sm text-ink-3 mt-1 max-w-2xl">
          Fodda Control Panel: Connection state, domain coverage, meter status, and prompt bank intelligence.
        </p>
      </div>

      <div className="px-8 pb-10 space-y-8 max-w-6xl">

        {/* ── BLOCK 1 & BLOCK 2: Connection State & Coverage Snapshot ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Block 1: Connection State Card */}
          <div className="p-6 bg-paper border border-line rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">MCP Connection State</span>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${mcpConn ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {mcpConn ? 'Connected & Active' : 'Setup Available'}
                </span>
              </div>
              <h3 className="font-serif italic text-xl text-ink font-bold">Claude Connector & API Token</h3>
              <p className="text-xs text-ink-3 leading-relaxed">
                {mcpConn
                  ? 'Your personal Claude MCP connector token is active and ready for one-click installation.'
                  : 'Connect your personal Claude desktop or web workspace to access Fodda knowledge graphs directly in conversation.'}
              </p>
            </div>

            <div className="pt-2 border-t border-line/60 flex items-center justify-between">
              <span className="text-xs font-mono text-ink-3">
                {mcpConn?.connectorUrl ? `${mcpConn.connectorUrl.substring(0, 32)}...` : 'Personal token masked'}
              </span>
              <button
                onClick={() => onNavigate('connections-claude')}
                className="px-4 py-2 bg-brand text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
              >
                {mcpConn ? 'Manage Connector →' : 'Connect Claude →'}
              </button>
            </div>
          </div>

          {/* Block 2: Coverage Snapshot Card */}
          <div className="p-6 bg-paper border border-line rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Domain Coverage</span>
                <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  {activeGraphCount} Active Verticals
                </span>
              </div>
              <h3 className="font-serif italic text-xl text-ink font-bold">Knowledge Graphs & Expert Twins</h3>
              <p className="text-xs text-ink-3 leading-relaxed">
                Active knowledge coverage across retail, beauty, consumer design, sports, and human expert twin domains.
              </p>
            </div>

            <div className="pt-2 border-t border-line/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-ink-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Active 120-Day Evidence Discipline</span>
              </div>
              <button
                onClick={() => onNavigate('coverage')}
                className="px-4 py-2 bg-ink text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-ink-2 transition-colors shadow-sm"
              >
                View Coverage Map →
              </button>
            </div>
          </div>

        </div>

        {/* ── BLOCK 3 & BLOCK 4: Usage Meter & Recent Activity ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif italic text-2xl text-ink">Usage & Execution Activity</h2>
            <button
              onClick={() => onNavigate('account-billing')}
              className="text-xs font-bold text-brand hover:underline"
            >
              View Full Billing & Usage →
            </button>
          </div>
          <UsageMeter
            user={user}
            account={account}
            onOpenReceipt={onOpenReceipt}
          />
        </div>

        {/* ── BLOCK 5: What to Ask Prompt Teasers ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="eyebrow mb-0.5">Prompt Bank</span>
              <h2 className="font-serif italic text-2xl text-ink">What to Ask</h2>
            </div>
            <button
              onClick={() => onNavigate('library')}
              className="text-xs font-bold text-brand hover:underline"
            >
              Browse Full Query Library →
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-2xl border border-line">
              Loading prompt teasers…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promptPicks.map((p, idx) => (
                <div key={idx} className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm hover:border-brand/40 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full inline-block">
                      {p.jobLabel || 'Query'}
                    </span>
                    <p className="font-serif italic text-sm text-ink font-bold">"{p.text}"</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/40 text-xs">
                    <span className="text-[10px] font-mono text-ink-4">{p.estimatedCalls || '15–20 calls'}</span>
                    <button
                      onClick={() => onTryPrompt(p.text, p.graphId)}
                      className="px-3 py-1.5 bg-ink hover:bg-ink-2 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg transition-colors"
                    >
                      Try in Test Bench →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
