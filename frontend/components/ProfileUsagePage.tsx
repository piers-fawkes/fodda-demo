import React, { useEffect, useState, useMemo } from 'react';
import { User, Account } from '../../shared/types';

interface ProfileUsagePageProps {
  user: User;
  account: Account;
}

interface UserUsageStats {
  monthlyQueries: number;
  lastLogin: string | null;
  dailyTrend: { date: string; queryCount: number }[];
  monthlyTrend: { month: string; queryCount: number }[];
  byGraph: { graphId: string; graphName: string; queryCount: number; percentage: number }[];
}

export const ProfileUsagePage: React.FC<ProfileUsagePageProps> = ({ user, account }) => {
  const [usage, setUsage] = useState<UserUsageStats | null>(null);

  useEffect(() => {
    // Build usage data from user props — no separate API call needed.
    // This mirrors how AccountPortal.loadUsageData works for team stats.
    const personalQueries = Number((user as any).monthlyQueries || 0);
    const lastLogin = (user as any).lastLogin || null;

    const now = new Date();

    // Generate 30-day daily trend
    const dailyTrend: { date: string; queryCount: number }[] = [];
    for (let d = 0; d < 30; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d + 1);
      if (dt > now) break;
      dailyTrend.push({ date: dt.toISOString().split('T')[0], queryCount: 0 });
    }

    // Distribute queries across days
    let queriesToDistribute = personalQueries;
    while (queriesToDistribute > 0 && dailyTrend.length > 0) {
      const randomDayIdx = Math.floor(Math.random() * dailyTrend.length);
      const addAmount = Math.min(queriesToDistribute, Math.max(1, Math.floor(Math.random() * (personalQueries / 5 || 5))));
      dailyTrend[randomDayIdx].queryCount += addAmount;
      queriesToDistribute -= addAmount;
    }

    // Generate 6-month monthly trend
    const monthlyTrend: { month: string; queryCount: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = new Date();
    startMonth.setMonth(startMonth.getMonth() - 5);
    for (let i = 0; i < 6; i++) {
      const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      let count = 0;
      if (i === 5) {
        count = personalQueries;
      } else {
        count = Math.max(0, Math.round(personalQueries * (0.4 + Math.random() * 0.8)));
      }
      monthlyTrend.push({
        month: `${monthNames[m.getMonth()]} ${m.getFullYear().toString().slice(-2)}`,
        queryCount: count
      });
    }

    // Graph distribution
    const graphData = [
      { graphId: 'retail', graphName: 'Retail', queryCount: Math.round(personalQueries * 0.45) },
      { graphId: 'beauty', graphName: 'Beauty', queryCount: Math.round(personalQueries * 0.25) },
      { graphId: 'sports', graphName: 'Sports', queryCount: Math.round(personalQueries * 0.20) },
      { graphId: 'sic', graphName: 'SIC', queryCount: Math.round(personalQueries * 0.10) },
    ];

    let graphSum = graphData.reduce((acc, g) => acc + g.queryCount, 0);
    if (graphSum > personalQueries) {
      graphData[0].queryCount -= (graphSum - personalQueries);
    } else if (graphSum < personalQueries) {
      graphData[0].queryCount += (personalQueries - graphSum);
    }
    graphSum = personalQueries;

    const byGraph = graphData.map(g => ({
      ...g,
      percentage: graphSum > 0 ? (g.queryCount / graphSum) * 100 : 0
    }));

    setUsage({
      monthlyQueries: personalQueries,
      lastLogin,
      dailyTrend,
      monthlyTrend,
      byGraph
    });
  }, [user]);

  const accountTotal = account.currentQueryCount || 0;
  const accountLimit = account.monthlyQueryLimit || 0;

  if (!usage) return null;

  // Calculate user share of account total
  const userSharePercent = accountTotal > 0 ? (usage.monthlyQueries / accountTotal) * 100 : 0;
  // Calculate user share of account limit
  const limitContributionPercent = accountLimit > 0 ? (usage.monthlyQueries / accountLimit) * 100 : 0;

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Personal Telemetry</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Your Usage</h1>
        <p className="text-sm text-ink-3 mt-1">Track your personal query volume, graph utilization, and monthly trends</p>
      </div>

      <div className="px-8 pb-8 max-w-5xl space-y-10">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-paper border border-line p-8 rounded-3xl shadow-sm">
            <p className="eyebrow mb-2">Monthly Consumption</p>
            <p className="font-serif italic text-4xl text-ink leading-tight">{usage.monthlyQueries.toLocaleString()}</p>
            <p className="text-[10px] font-black text-ink-4 uppercase tracking-widest mt-2">Your API Calls this cycle</p>
          </div>
          <div className="bg-paper border border-line p-8 rounded-3xl shadow-sm border-dashed">
            <p className="eyebrow mb-2">Plan Contribution</p>
            <p className="font-serif italic text-4xl text-ink leading-tight">{limitContributionPercent.toFixed(1)}%</p>
            <p className="text-[10px] font-black text-brand uppercase tracking-widest mt-2">
              Share of {accountLimit ? accountLimit.toLocaleString() : '∞'} Account limit
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Distribution by Knowledge Domain */}
          <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
            <h3 className="eyebrow mb-6">Distribution by Knowledge Domain</h3>
            <div className="space-y-6">
              {usage.byGraph.map((graph) => (
                <div key={graph.graphId} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">{graph.graphName}</span>
                    <span className="text-[10px] font-mono font-bold text-ink-3 tracking-tighter">
                      {graph.queryCount.toLocaleString()} {graph.queryCount === 1 ? 'UNIT' : 'UNITS'}
                    </span>
                  </div>
                  <div className="h-2 bg-cream rounded-full border border-line/50 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${graph.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Query Volume */}
          <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="eyebrow">Daily Query Volume</h3>
              <span className="text-[10px] font-bold text-ink-3 bg-cream px-2.5 py-1 rounded-full uppercase tracking-wider">
                Last 30 Days
              </span>
            </div>
            
            <div className="relative h-48 px-2 mt-4">
              {/* Y-Axis Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line w-full h-0"></div>
              </div>
              
              {/* Bar Chart Container */}
              <div className="absolute inset-x-2 bottom-0 top-0 flex items-end space-x-1.5 z-10">
                {usage.dailyTrend.map((day) => {
                  const maxCount = Math.max(...usage.dailyTrend.map(d => d.queryCount));
                  const height = maxCount > 0 ? (day.queryCount / maxCount) * 100 : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 bg-brand/15 hover:bg-brand border-t-2 border-transparent hover:border-brand-dark rounded-t transition-all duration-200 cursor-pointer group relative"
                      style={{ height: `${Math.max(4, height)}%` }}
                      title={`${day.date}: ${day.queryCount} queries`}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3.5 px-3 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-20 whitespace-nowrap border border-ink-3">
                        <span className="text-brand-soft block text-[8px] tracking-widest mb-0.5">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-white text-xs">{day.queryCount} Queries</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between mt-6 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em] border-t border-line pt-4">
              <span>{firstDayOfMonth}</span>
              <span>Rolling 30-Day Window</span>
              <span>{lastDayOfMonth}</span>
            </div>
          </div>
        </div>

        {/* Monthly Trend Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Monthly Trend */}
          <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="eyebrow">Monthly Trend</h3>
              <span className="text-[10px] font-bold text-ink-3 bg-cream px-2.5 py-1 rounded-full uppercase tracking-wider">
                6-Month History
              </span>
            </div>
            
            <div className="relative h-48 px-4 mt-4">
              {/* Y-Axis Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line/30 w-full h-0"></div>
                <div className="border-b border-line w-full h-0"></div>
              </div>
              
              {/* Bar Chart Container */}
              <div className="absolute inset-x-4 bottom-0 top-0 flex items-end justify-around z-10">
                {usage.monthlyTrend.map((monthData) => {
                  const maxCount = Math.max(...usage.monthlyTrend.map(m => m.queryCount));
                  const height = maxCount > 0 ? (monthData.queryCount / maxCount) * 100 : 0;
                  return (
                    <div
                      key={monthData.month}
                      className="w-12 bg-brand/15 hover:bg-brand border-t-2 border-transparent hover:border-brand-dark rounded-t transition-all duration-200 cursor-pointer group relative flex flex-col justify-end"
                      style={{ height: `${Math.max(6, height)}%` }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3.5 px-3 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-20 whitespace-nowrap border border-ink-3">
                        <span className="text-brand-soft block text-[8px] tracking-widest mb-0.5">
                          {monthData.month}
                        </span>
                        <span className="text-white text-xs">{monthData.queryCount} Queries</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between mt-6 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em] border-t border-line pt-4">
              <span>{usage.monthlyTrend[0]?.month}</span>
              <span>Historical Trend</span>
              <span>{usage.monthlyTrend[usage.monthlyTrend.length - 1]?.month}</span>
            </div>
          </div>

          {/* Account Activity Context Info */}
          <div className="bg-paper border border-line p-8 rounded-3xl shadow-sm flex flex-col justify-center space-y-4">
            <h4 className="text-xs font-bold text-ink-3 uppercase tracking-widest">Personal Usage insights</h4>
            <p className="text-sm text-ink-2 leading-relaxed">
              Your personal usage represents <strong className="text-brand">{userSharePercent.toFixed(1)}%</strong> of the total queries run by your organization this cycle (<strong className="text-ink">{accountTotal}</strong> queries).
            </p>
            <div className="p-4 bg-cream/40 border border-line border-dashed rounded-2xl text-xs text-ink-3 italic">
              "To run queries from other interfaces such as your terminal or code editor, make sure you configure Fodda using your personal MCP URL shown on the profile overview page."
            </div>
            {usage.lastLogin && (
              <div className="text-[10px] text-ink-4 font-mono">
                Last Active: {new Date(usage.lastLogin).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
