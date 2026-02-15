
import React, { useState, useRef, useEffect } from 'react';
import { dataService, UserLog } from '../../shared/dataService';
import { Trend, Article } from '../../shared/types';
interface AdminPortalProps {
  onBack: () => void;
  userId: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) { row.push(current.trim()); current = ''; }
    else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (current !== '' || row.length > 0) { row.push(current.trim()); result.push(row); row = []; current = ''; }
      if (char === '\r' && nextChar === '\n') i++;
    } else current += char;
  }
  if (current !== '' || row.length > 0) { row.push(current.trim()); result.push(row); }
  return result;
}

export function AdminPortal({ onBack, userId }: AdminPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'graphs' | 'data' | 'engagement' | 'system'>('graphs');
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [importType, _setImportType] = useState<'trends' | 'articles'>('trends');
  const [_processStatus, _setProcessStatus] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<{ ok: boolean; details?: any; error?: string } | null>(null);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; message: string } | null>(null);
  const [retentionMode, setRetentionMode] = useState<'METADATA_ONLY' | 'DEBUG'>('METADATA_ONLY');
  const _fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      dataService.checkHealth().then(setHealthInfo);
      if (window.aistudio) {
        window.aistudio.hasSelectedApiKey().then(setHasUserKey);
      }
      if (activeTab === 'engagement') {
        fetchLogs();
      }
      if (activeTab === 'system') {
        fetchAccountSettings();
      }
    }
  }, [isAuthenticated, activeTab]);

  const [authPolicy, setAuthPolicy] = useState<'STRICT' | 'RELAXED'>('RELAXED');
  const [accountId, setAccountId] = useState<string | null>(null);

  const fetchAccountSettings = async () => {
    // We need the account ID. Since AdminPortal is currently userId based, we need to fetch info.
    // For now, let's assume we can get it from localStorage or pass it in.
    // Actually, AdminPortal is opened from Sidebar, which has access.
    // But AdminPortal only takes userId.
    // Let's fetch user stats to get account ID? Or just list accounts if we were a super admin.
    // For this demo, let's assume we are editing the "current" account.
    // We'll trust that `dataService.getUserStats(email)` returns account info?
    // Let's try to fetch user stats via `dataService.getUserStats` which returns `user` and `account`?
    // Wait, `getUserStats` in `dataService` returns `api/user/stats`.
    // Let's add a utility to `dataService` to get current context if possible, OR
    // pass `currentAccount` to AdminPortal.
    // For now, I will use a hack: Fetch all users for a known account? No.
    // I will modify AdminPortal props to accept `accountId` or `account`.
    // BUT I cannot change the signature easily without changing App.tsx too.
    // Let's check `App.tsx`... it passes `userId`.
    // I will rely on `localStorage` for now to get the current account ID if available,
    // or fetch it.
    const storedAccount = sessionStorage.getItem('fodda_account');
    if (storedAccount) {
      const acc = JSON.parse(storedAccount);
      setAccountId(acc.id);
      const policy = acc.authPolicy || 'RELAXED';
      setAuthPolicy(policy);
    }
  };

  const handlePolicyToggle = async () => {
    if (!accountId) return;
    const newPolicy = authPolicy === 'STRICT' ? 'RELAXED' : 'STRICT';
    setAuthPolicy(newPolicy); // Optimistic update

    // Save to DB
    const res = await dataService.updateAccount(accountId, { authPolicy: newPolicy });
    if (!res.ok) {
      alert("Failed to update policy: " + res.error);
      setAuthPolicy(authPolicy); // Revert
    } else {
      // Update session storage to reflect change
      const storedAccount = sessionStorage.getItem('fodda_account');
      if (storedAccount) {
        const acc = JSON.parse(storedAccount);
        acc.authPolicy = newPolicy;
        sessionStorage.setItem('fodda_account', JSON.stringify(acc));
      }
    }
  };

  const fetchLogs = async () => {
    setIsRefreshingLogs(true);
    const data = await dataService.getLogs();
    setLogs(data);
    setIsRefreshingLogs(false);
  };

  const handlePingAirtable = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await dataService.logToAirtable(
        userId,
        'TEST_PING_CONNECTION',
        'WALDO',
        'admin-diagnostic',
        'ADMIN'
      );
      // Wait for a moment to ensure user sees spinner if fast
      await new Promise(r => setTimeout(r, 500));
      setPingResult({ success: !!res.ok, message: res.ok ? 'SUCCESS' : 'FAILED' });
    } catch (e: any) {
      console.error("[Admin] Ping Failed:", e);
      setPingResult({ success: false, message: 'ERROR: ' + e.message });
    } finally {
      setIsPinging(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'psfk') setIsAuthenticated(true);
    else alert('Invalid Password');
  };

  const handleKeySelect = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasUserKey(true);
    }
  };

  const _handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
      setCsvInput(text);
      _setProcessStatus(`Staged: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const _handleProcessData = async () => {
    if (!selectedGraphId || !csvInput) return;
    _setProcessStatus('Processing...');
    try {
      const data = parseCSV(csvInput);
      if (data.length < 2) throw new Error("Empty CSV.");
      const headers = data[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9#\s]/g, ''));

      if (importType === 'trends') {
        const idIdx = headers.findIndex(h => h === 'trendid' || h === 'id');
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const descIdx = headers.findIndex(h => h.includes('summary') || h.includes('description') || h === 'excerpt');

        const trends: Trend[] = data.slice(1).map(row => ({
          id: (row[idIdx] || '').trim(),
          vertical: selectedGraphId as any,
          name: (row[nameIdx] || 'Untitled').trim(),
          summary: (row[descIdx] || '').trim()
        })).filter(t => t.id);
        await dataService.importTrends(selectedGraphId, trends);
        _setProcessStatus(`Success: ${trends.length} trends committed.`);
      } else {
        const idIdx = headers.findIndex(h => h === 'articleid' || h === 'id');
        const titleIdx = headers.findIndex(h => h === 'title');
        const urlIdx = headers.findIndex(h => h.includes('url') || h === 'link');
        const trendIdIdx = headers.findIndex(h => h === 'trendid');
        const snippetIdx = headers.findIndex(h => h === 'summary' || h === 'snippet' || h === 'excerpt');
        const brandIdx = headers.findIndex(h => h === 'brandnames');

        const articles: Article[] = data.slice(1).map(row => ({
          id: (row[idIdx] || '').trim(),
          trendIds: (row[trendIdIdx] || '').split(/[,;]/).map(i => i.trim()).filter(i => i),
          title: (row[titleIdx] || 'Untitled').trim(),
          sourceUrl: (row[urlIdx] || '#').trim(),
          snippet: (row[snippetIdx] || '').trim(),
          brandNames: brandIdx !== -1 ? (row[brandIdx] || '').trim() : '',
          vertical: selectedGraphId as any
        })).filter(a => a.id);
        await dataService.importArticles(selectedGraphId, articles);
        _setProcessStatus(`Success: ${articles.length} articles committed.`);
      }
      setCsvInput('');
    } catch (err: any) { _setProcessStatus(`Error: ${err.message}`); }
  };

  if (!isAuthenticated) return (
    <div className="fixed inset-0 z-[200] bg-stone-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-200 text-center">
        <h2 className="font-serif text-2xl font-bold text-stone-900 mb-6 uppercase tracking-widest">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Access Key" className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-center text-stone-900" autoFocus />
          <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Sign In</button>
          <button type="button" onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600 underline">Back to Demo</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-stone-50 flex flex-col">
      <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-8">
        <div className="flex items-center space-x-6">
          <h1 className="font-serif text-xl font-bold text-stone-900">Graph Admin</h1>
          <nav className="flex space-x-6">
            <button onClick={() => setActiveTab('graphs')} className={`text-[10px] font-bold uppercase tracking-widest ${activeTab === 'graphs' ? 'text-fodda-accent' : 'text-stone-400'}`}>Datasets</button>
            <button onClick={() => setActiveTab('data')} className={`text-[10px] font-bold uppercase tracking-widest ${activeTab === 'data' ? 'text-fodda-accent' : 'text-stone-400'}`}>Ingestion</button>
            <button onClick={() => setActiveTab('engagement')} className={`text-[10px] font-bold uppercase tracking-widest ${activeTab === 'engagement' ? 'text-fodda-accent' : 'text-stone-400'}`}>Engagement</button>
            <button onClick={() => setActiveTab('system')} className={`text-[10px] font-bold uppercase tracking-widest ${activeTab === 'system' ? 'text-fodda-accent' : 'text-stone-400'}`}>Configuration</button>
          </nav>
        </div>
        <button onClick={onBack} className="text-xs font-bold text-stone-500 hover:text-stone-900 uppercase tracking-widest">Exit</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'graphs' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dataService.getGraphs().map(g => (
              <div key={g.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-stone-900">{g.name}</h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full border border-stone-200 uppercase tracking-tighter">Active</span>
                  </div>
                  <p className="text-xs text-stone-500 mb-4">{g.description}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-stone-400 uppercase font-bold tracking-widest">Type</span>
                      <span className="text-stone-700 font-medium">Knowledge Graph</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-stone-400 uppercase font-bold tracking-widest">Owner</span>
                      <span className="text-stone-700 font-medium">{g.owner}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedGraphId(g.id); setActiveTab('data'); }} className="w-full py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold text-fodda-accent uppercase hover:bg-purple-50 transition-colors mt-auto">View Details</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-2">
              {dataService.getGraphs().map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGraphId(g.id)}
                  className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${selectedGraphId === g.id ? 'bg-white border-fodda-accent shadow-md text-stone-900' : 'bg-stone-50 border-stone-200 text-stone-400 hover:text-stone-600'}`}
                >
                  <span className="text-sm font-bold">{g.name}</span>
                </button>
              ))}
            </div>
            <div className="lg:col-span-8">
              {selectedGraphId ? (() => {
                const g = dataService.getGraphs().find(graph => graph.id === selectedGraphId);
                return (
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                    <div className="border-b border-stone-100 pb-4 mb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-xl font-bold text-stone-900 mb-1">Graph Metadata</h2>
                          {g?.headline && <p className="text-xs text-stone-500 font-medium italic">{g.headline}</p>}
                        </div>
                        <span className="text-[10px] font-mono text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-100">ID: {selectedGraphId}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Graph ID</p>
                        <p className="text-sm font-bold text-stone-700 font-mono">
                          {(() => {
                            const v = selectedGraphId.toLowerCase();
                            if (v.includes('waldo')) return 'WALDO';
                            if (v.includes('sic')) return 'SIC';
                            if (v.includes('baseline')) return 'PEW';
                            return 'PSFK';
                          })()}
                        </p>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Vertical</p>
                        <p className="text-sm font-bold text-stone-900">{g?.verticalName || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Price Per Query</p>
                        <p className="text-sm font-bold text-stone-900">{g?.pricePerQuery || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Frequency of Updates</p>
                        <p className="text-sm font-bold text-stone-900">{g?.updateFrequency || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">More info</p>
                        <a href={g?.sourceURL} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-fodda-accent hover:underline truncate block">
                          {g?.sourceURL || 'N/A'}
                        </a>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-sm font-bold text-stone-900">Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-xl border border-fodda-accent/20">
                      <p className="text-[11px] text-fodda-accent font-medium text-center italic">
                        Technical configuration for this graph is managed by the system administrator.
                      </p>
                    </div>
                  </div>
                );
              })() : (<div className="h-64 flex items-center justify-center text-stone-300 italic border border-dashed border-stone-200 rounded-3xl">Select a graph to view details</div>)}
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Requests (30d)</h3>
                <div className="flex items-end space-x-1 h-24 mb-2">
                  {[3, 5, 2, 8, 4, 6, 9, 11, 7, 5, 8, 12, 15, 12, 10, 14, 18, 22, 19, 25].map((h, i) => (
                    <div key={i} className="flex-1 bg-fodda-accent/20 rounded-t-sm hover:bg-fodda-accent transition-all cursor-pointer" style={{ height: `${h * 4}%` }} title={`Day ${i + 1}: ${h} requests`}></div>
                  ))}
                </div>
                <div className="flex justify-between items-center text-stone-900">
                  <span className="text-2xl font-bold">1,284</span>
                  <span className="text-[10px] font-bold text-green-500">+12% vs last month</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Graph Distribution</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-stone-500">Retail Innovation</span>
                    <span className="text-[10px] font-mono text-stone-900">42%</span>
                  </div>
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-fodda-accent h-full" style={{ width: '42%' }}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-stone-500">Consumer Trends</span>
                    <span className="text-[10px] font-mono text-stone-900">38%</span>
                  </div>
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-400 h-full" style={{ width: '38%' }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Avg. Latency</h3>
                <div className="flex-1 flex flex-col justify-center items-center">
                  <span className="text-3xl font-bold text-stone-900">1,240<span className="text-sm font-normal text-stone-400 ml-1">ms</span></span>
                  <p className="text-[9px] text-stone-400 mt-2 text-center">Optimized via deterministic query caching</p>
                  <div className="w-full h-1 bg-stone-100 mt-4 rounded-full">
                    <div className="bg-green-500 h-full w-[85%]"></div>
                  </div>
                  <span className="text-[8px] text-green-600 font-bold uppercase mt-1">SLA Compliant (99.9%)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Engagement Monitoring</h2>
                <p className="text-xs text-stone-500">Real-time tracking of sessions and questions.</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handlePingAirtable}
                  disabled={isPinging}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-fodda-accent disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  {isPinging ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  )}
                  <span>{isPinging ? 'Pinging...' : 'Send Test Ping to Airtable'}</span>
                </button>
                <button
                  onClick={fetchLogs}
                  disabled={isRefreshingLogs}
                  className="px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 uppercase hover:bg-stone-100 disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  <svg className={`w-3.5 h-3.5 ${isRefreshingLogs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span>{isRefreshingLogs ? 'Refreshing...' : 'Refresh Logs'}</span>
                </button>
              </div>
            </div>

            {pingResult && (
              <div className={`p-4 rounded-xl text-xs font-bold animate-fade-in-up border ${pingResult.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                <div className="flex items-center space-x-2">
                  {pingResult.success ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  <span>{pingResult.message}</span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">User Email</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Graph</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Prompt</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {logs.length > 0 ? logs.map((log, i) => (
                      <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-stone-900">{log.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">{log.vertical}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-stone-600 line-clamp-1 max-w-xs" title={log.query}>{log.query}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${log.dataStatus.includes('TREND') ? 'bg-green-50 text-green-700 border border-green-100' :
                            log.dataStatus.includes('SIGNAL') ? 'bg-purple-50 text-fodda-accent border border-purple-100' :
                              'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                            {log.dataStatus.replace('_MATCH', '')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic text-xs">No engagement logs recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="max-w-2xl mx-auto space-y-8">

            {/* Security Policy Section */}
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Enterprise Security Policies</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">Persistent Sessions</p>
                    <p className="text-xs text-stone-500 mt-1 max-w-xs">
                      {authPolicy === 'RELAXED'
                        ? "Users stay logged in for 24 hours (Convenient)."
                        : "Users must log in via Magic Link every time (Strict)."}
                    </p>
                  </div>
                  <button
                    onClick={handlePolicyToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fodda-accent focus:ring-offset-2 ${authPolicy === 'RELAXED' ? 'bg-green-500' : 'bg-stone-300'}`}
                  >
                    <span className={`${authPolicy === 'RELAXED' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">Retention Mode</p>
                    <p className="text-xs text-stone-500 mt-1 max-w-xs">
                      {retentionMode === 'METADATA_ONLY'
                        ? "Privacy Mode: Metadata only (No query storage)."
                        : "Debug Mode: Temporary full tracing enabled."}
                    </p>
                  </div>
                  <button
                    onClick={() => setRetentionMode(retentionMode === 'METADATA_ONLY' ? 'DEBUG' : 'METADATA_ONLY')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fodda-accent focus:ring-offset-2 ${retentionMode === 'DEBUG' ? 'bg-amber-500' : 'bg-stone-300'}`}
                  >
                    <span className={`${retentionMode === 'DEBUG' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                  </button>
                </div>
              </div>
            </div>

            {/* System Access Control (Managed Identities) */}
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900 mb-2">System Access Control</h2>
              <p className="text-xs text-stone-500 mb-6">Manage API keys for MCP and custom integrations. <span className="text-fodda-accent font-bold">System Identity</span> is separated from human user accounts.</p>

              <div className="space-y-4">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active API Key</span>
                    <span className="text-[9px] font-bold text-fodda-accent bg-purple-50 px-2 py-0.5 rounded border border-fodda-accent/10">SYSTEM_IDENTITY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-stone-700">sk_live_••••••••••••••••3a9c</code>
                    <div className="flex space-x-2">
                      <button className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase">Revoke</button>
                      <button className="text-[10px] font-bold text-fodda-accent hover:text-fodda-accent/80 uppercase">Rotate</button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-200/50 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-stone-400 uppercase">Tenant ID</p>
                      <p className="text-[10px] font-mono text-stone-600">acc_prod_fodda_882</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-stone-400 uppercase">Last Used</p>
                      <p className="text-[10px] font-mono text-stone-600">2 minutes ago</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/30 flex items-start space-x-3">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <div>
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Security Alert</p>
                    <p className="text-[10px] text-amber-700">API Key rotation is recommended every 90 days. Last rotated 102 days ago.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900 mb-2">Intelligence API Configuration</h2>
              <p className="text-xs text-stone-500 mb-6 italic">Exhausted shared quota? Use a personal API key from a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-fodda-accent underline font-bold">paid GCP project</a>.</p>

              <button
                onClick={handleKeySelect}
                className={`w-full flex items-center justify-center space-x-3 py-4 rounded-xl border transition-all font-bold uppercase tracking-widest text-xs ${hasUserKey ? 'border-fodda-accent/20 bg-purple-50 text-fodda-accent' : 'border-stone-200 bg-stone-50 text-stone-400 hover:border-fodda-accent/50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                <span>{hasUserKey ? 'Personal API Key Active' : 'Select Personal API Key'}</span>
              </button>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Graph Engine Health</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${healthInfo?.ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-bold text-stone-700 uppercase tracking-wider">Neo4j Connection</span>
                  </div>
                  <span className="text-xs font-mono text-stone-400">{healthInfo?.ok ? 'Operational' : 'Disconnected'}</span>
                </div>
                {!healthInfo?.ok && healthInfo?.error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-1">Error Details</p>
                    <p className="text-xs text-red-600 font-mono break-words">{healthInfo.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
