
import React, { useState, useRef, useEffect } from 'react';
import { dataService, UserLog } from '../../shared/dataService';
import { Trend, Article } from '../../shared/types';

interface AdminPortalProps {
  onBack: () => void;
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

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBack }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'graphs' | 'data' | 'engagement' | 'system'>('graphs');
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [importType, setImportType] = useState<'trends' | 'articles'>('trends');
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<{ ok: boolean; details?: any } | null>(null);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) { 
        dataService.checkHealth().then(setHealthInfo); 
        // @ts-expect-error: window.aistudio is injected by the platform
        if (window.aistudio) {
            // @ts-expect-error: window.aistudio is injected by the platform
            window.aistudio.hasSelectedApiKey().then(setHasUserKey);
        }
        if (activeTab === 'engagement') {
          fetchLogs();
        }
    }
  }, [isAuthenticated, activeTab]);

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
        'admin-test@fodda.ai', 
        'TEST_PING_CONNECTION', 
        'WALDO', 
        'admin-diagnostic'
      );
      if (res?.ok) {
        setPingResult({ success: true, message: 'Ping successful! Check Airtable.' });
      } else {
        setPingResult({ success: false, message: `Ping failed: ${res.error || 'Unknown Error'}` });
      }
    } catch (e: any) {
      setPingResult({ success: false, message: `Critical Error: ${e.message}` });
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
    // @ts-expect-error: window.aistudio is injected by the platform
    if (window.aistudio) {
      // @ts-expect-error: window.aistudio is injected by the platform
      await window.aistudio.openSelectKey();
      setHasUserKey(true);
    }
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1); 
      setCsvInput(text);
      setProcessStatus(`Staged: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleProcessData = async () => {
    if (!selectedGraphId || !csvInput) return;
    setProcessStatus('Processing...');
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
        setProcessStatus(`Success: ${trends.length} trends committed.`);
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
        setProcessStatus(`Success: ${articles.length} articles committed.`);
      }
      setCsvInput('');
    } catch (err: any) { setProcessStatus(`Error: ${err.message}`); }
  };

  if (!isAuthenticated) return (
    <div className="fixed inset-0 z-[200] bg-stone-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-200 text-center">
        <h2 className="font-serif text-2xl font-bold text-stone-900 mb-6 uppercase tracking-widest">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access Key" className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-center" autoFocus />
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
              <div key={g.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="text-lg font-bold text-stone-900">{g.name}</h3>
                <p className="text-xs text-stone-500 mb-4">{g.description}</p>
                <button onClick={() => { setSelectedGraphId(g.id); setActiveTab('data'); }} className="w-full py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold text-fodda-accent uppercase hover:bg-purple-50">Manage CSV Data</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-2">
               {dataService.getGraphs().map(g => (
                 <button key={g.id} onClick={() => setSelectedGraphId(g.id)} className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${selectedGraphId === g.id ? 'bg-white border-fodda-accent shadow-md' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                   <span className="text-sm font-bold">{g.name}</span>
                 </button>
               ))}
            </div>
            <div className="lg:col-span-8">
               {selectedGraphId ? (
                 <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                    <div className="flex space-x-6 border-b border-stone-100">
                      <button onClick={() => setImportType('trends')} className={`pb-3 text-[10px] font-bold uppercase ${importType === 'trends' ? 'border-b-2 border-fodda-accent text-fodda-accent' : 'text-stone-300'}`}>Trends CSV</button>
                      <button onClick={() => setImportType('articles')} className={`pb-3 text-[10px] font-bold uppercase ${importType === 'articles' ? 'border-b-2 border-fodda-accent text-fodda-accent' : 'text-stone-300'}`}>Articles CSV</button>
                    </div>
                    <div className="border-2 border-dashed border-stone-100 rounded-2xl p-12 text-center cursor-pointer hover:border-fodda-accent bg-stone-50" onClick={() => fileInputRef.current?.click()}>
                      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])} accept=".csv" className="hidden" />
                      <p className="text-sm font-bold text-stone-700">Drop or Select {importType}.csv</p>
                      <p className="text-[10px] text-stone-400 mt-2">Required: {importType === 'trends' ? 'trendId, name, summary' : 'articleId, title, summary/excerpt'}</p>
                    </div>
                    {csvInput && (
                      <div className="space-y-4">
                        <textarea value={csvInput} readOnly className="w-full h-48 p-4 bg-stone-50 border border-stone-100 rounded-xl font-mono text-[9px] text-stone-400 resize-none" />
                        <button onClick={handleProcessData} className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Commit to {selectedGraphId} Graph</button>
                      </div>
                    )}
                    {processStatus && <p className="text-xs font-bold text-fodda-accent uppercase animate-pulse">{processStatus}</p>}
                 </div>
               ) : ( <div className="h-64 flex items-center justify-center text-stone-300 italic border border-dashed border-stone-200 rounded-3xl">Select a graph to begin ingestion</div> )}
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-6 animate-fade-in-up">
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
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            log.dataStatus.includes('TREND') ? 'bg-green-50 text-green-700 border border-green-100' :
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
