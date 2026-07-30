import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface UsageMeterProps {
  user: User;
  account: Account;
  className?: string;
  onOpenReceipt?: (receiptId: string) => void;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({ user, account, className = '', onOpenReceipt }) => {
  const [usageData, setUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    dataService.getAccountUsage(account?.id).then(res => {
      if (isMounted && res?.ok && res?.usage) {
        setUsageData(res.usage);
      }
    }).catch(err => {
      console.error('[UsageMeter] Failed to load usage data:', err);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [account?.id]);

  // Headline numbers: Account record counters are canonical for Used & Remaining
  const monthlyQueries = usageData?.monthlyQueries ?? (account.currentQueryCount || 0);
  const monthlyQueryLimit = usageData?.monthlyQueryLimit ?? (account.monthlyQueryLimit || 100);
  const remainingQueries = usageData?.remainingQueries ?? Math.max(0, monthlyQueryLimit - monthlyQueries);
  const totalQueries = usageData?.totalQueries ?? (account as any).totalQueries ?? monthlyQueries;
  const costPerQuery = usageData?.costPerQuery || '—';

  const usagePercent = monthlyQueryLimit > 0 ? Math.min(100, Math.round((monthlyQueries / monthlyQueryLimit) * 100)) : 0;

  const dailyTrend: { date: string; queryCount: number }[] = usageData?.dailyTrend || [];
  const byGraph: { graphId: string; graphName: string; queryCount: number; percentage: number }[] = usageData?.byGraph || [];
  const recentQueries: { id: string; question: string; userEmail: string; graphId: string; timestamp: string; responseTimeMs: number | null; stepCount: number; source: string }[] = usageData?.recentQueries || [];

  const maxDaily = Math.max(1, ...dailyTrend.map(d => d.queryCount));
  const hasMultiStep = recentQueries.some(q => (q.stepCount || 1) > 1);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ─── Headline Cards (4 Stat Columns) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Queries Used This Month */}
        <div className="p-6 bg-paper border border-line rounded-2xl shadow-sm space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Queries Used</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{monthlyQueries.toLocaleString()}</p>
          <p className="text-xs font-medium text-ink-3">This month ({usagePercent}% of plan limit)</p>
          {monthlyQueryLimit > 0 && (
            <div className="mt-3 h-1.5 bg-cream rounded-full overflow-hidden border border-line/40">
              <div
                className={`h-full rounded-full transition-all duration-700 ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-brand'}`}
                style={{ width: `${usagePercent}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Queries Remaining */}
        <div className="p-6 bg-paper border border-line rounded-2xl shadow-sm space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Queries Remaining</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">
            {monthlyQueryLimit ? remainingQueries.toLocaleString() : '∞'}
          </p>
          <p className="text-xs font-medium text-ink-3">Available until cycle renewal</p>
        </div>

        {/* Cost per Query */}
        <div className="p-6 bg-paper border border-line rounded-2xl shadow-sm space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Cost per Query</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{costPerQuery}</p>
          <p className="text-xs font-medium text-ink-3">Derived plan unit rate</p>
        </div>

        {/* All Time Queries */}
        <div className="p-6 bg-paper border border-line rounded-2xl shadow-sm space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">All-Time Queries</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{totalQueries.toLocaleString()}</p>
          <p className="text-xs font-medium text-ink-3">Lifetime account volume</p>
        </div>
      </div>

      {/* ─── Charts Section: Daily Trend & Domain Breakdown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rolling 30-Day Daily Volume */}
        <div className="p-7 bg-white border border-line rounded-3xl shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Daily Query Volume</h3>
            <span className="text-[11px] font-bold text-ink-3 bg-cream border border-line px-3 py-1 rounded-full">
              Rolling 30 Days
            </span>
          </div>

          <div className="relative h-44 px-1 mt-2">
            {/* Gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-line/30 w-full"></div>
              <div className="border-b border-line/30 w-full"></div>
              <div className="border-b border-line/30 w-full"></div>
              <div className="border-b border-line w-full"></div>
            </div>

            {/* Bars */}
            <div className="absolute inset-x-1 bottom-0 top-0 flex items-end space-x-1 z-10">
              {dailyTrend.map((day) => {
                const height = (day.queryCount / maxDaily) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-brand/20 hover:bg-brand rounded-t transition-all duration-200 cursor-pointer group relative"
                    style={{ height: `${Math.max(6, height)}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-ink text-white rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">
                      {day.date}: {day.queryCount} queries
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Breakdown by Domain */}
        <div className="p-7 bg-white border border-line rounded-3xl shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Usage by Knowledge Domain</h3>

          {byGraph.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-2xl border border-line/50">
              No query breakdowns logged yet for this 30-day window.
            </div>
          ) : (
            <div className="space-y-4 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {byGraph.map((g) => (
                <div key={g.graphId} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-ink">
                    <span>{g.graphName}</span>
                    <span className="font-mono text-ink-3">{g.queryCount} queries ({g.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full border border-line/40 overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${g.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Query Executions ─── */}
      {recentQueries.length > 0 && (
        <div className="p-7 bg-white border border-line rounded-3xl shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Recent Executions</h3>
            <span className="text-[11px] font-bold text-ink-3 bg-cream border border-line px-3 py-1 rounded-full">
              Latest Activity
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-3">
                  <th className="pb-3 pr-4">Query</th>
                  <th className="pb-3 px-4">Domain</th>
                  <th className="pb-3 px-4">Date</th>
                  <th className="pb-3 px-4">Source</th>
                  {hasMultiStep && <th className="pb-3 pl-4 text-right">Steps</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 text-xs">
                {recentQueries.map((q) => {
                  const dateStr = q.timestamp ? new Date(q.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                  const isMulti = (q.stepCount || 1) > 1;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => onOpenReceipt?.(q.id)}
                      className="hover:bg-cream/50 transition-colors cursor-pointer group"
                      title="Click to view Answer Receipt"
                    >
                      <td className="py-3 pr-4 font-medium text-ink max-w-xs truncate" title={q.question}>
                        {q.question}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink-3 text-[11px]">
                        {q.graphId}
                      </td>
                      <td className="py-3 px-4 text-ink-3 text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${q.source === 'mcp' ? 'bg-purple-100 text-purple-800 border border-purple-200' : q.source === 'trial' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                          {q.source || 'api'}
                        </span>
                      </td>
                      {hasMultiStep && (
                        <td className="py-3 pl-4 text-right">
                          {isMulti ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {q.stepCount} steps
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-3">1 step</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
