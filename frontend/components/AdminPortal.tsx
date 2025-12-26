
import React, { useState, useRef, useEffect } from 'react';
import { dataService } from '../../shared/dataService';
import { Trend, Article } from '../../shared/types';
import { MOCK_TRENDS, MOCK_ARTICLES } from '../../shared/constants';

interface AdminPortalProps {
  onBack: () => void;
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const { char, nextChar } = { char: text[i], nextChar: text[i + 1] };
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
  const [activeTab, setActiveTab] = useState<'graphs' | 'data' | 'utility'>('graphs');
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [importType, setImportType] = useState<'trends' | 'articles'>('trends');
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<{ ok: boolean; details?: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      dataService.checkHealth().then(setHealthInfo);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'psfk') setIsAuthenticated(true);
    else alert('Invalid Password');
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
    setProcessStatus('Sending to Graph...');
    try {
      const data = parseCSV(csvInput);
      if (data.length < 2) throw new Error("Empty CSV.");
      const headers = data[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9#\s]/g, ''));
      
      if (importType === 'trends') {
        const idIdx = headers.indexOf('trendid') !== -1 ? headers.indexOf('trendid') : headers.indexOf('trend id');
        const nameIdx = headers.indexOf('trend name');
        const descIdx = headers.indexOf('summary') !== -1 ? headers.indexOf('summary') : headers.indexOf('trend description');
        // Fix: Use trendName and trendDescription to match interface
        const trends: Trend[] = data.slice(1).map(row => ({
          trendId: (row[idIdx] || '').trim(),
          vertical: selectedGraphId as any,
          trendName: (row[nameIdx] || 'Untitled').trim(),
          trendDescription: (row[descIdx] || '').trim()
        })).filter(t => t.trendId);
        await dataService.importTrends(selectedGraphId, trends);
        setProcessStatus(`Success: ${trends.length} trends committed.`);
      } else {
        const idIdx = headers.indexOf('articleid') !== -1 ? headers.indexOf('articleid') : headers.indexOf('article id');
        const titleIdx = headers.indexOf('title');
        const urlIdx = headers.indexOf('source url');
        const trendIdIdx = headers.indexOf('trendid') !== -1 ? headers.indexOf('trendid') : headers.indexOf('trend id');
        const snippetIdx = headers.indexOf('summary') !== -1 ? headers.indexOf('summary') : headers.indexOf('snippet');
        // Fix: Populate Article with correct fields
        const articles: Article[] = data.slice(1).map(row => ({
          articleId: (row[idIdx] || '').trim(),
          trendIds: (row[trendIdIdx] || '').split(/[,;]/).map(i => i.trim()).filter(i => i),
          title: (row[titleIdx] || 'Untitled').trim(),
          sourceUrl: (row[urlIdx] || '#').trim(),
          summary: (row[snippetIdx] || '').trim(),
          snippet: (row[snippetIdx] || '').trim()
        })).filter(a => a.articleId);
        await dataService.importArticles(selectedGraphId, articles);
        setProcessStatus(`Success: ${articles.length} articles committed.`);
      }
      setCsvInput('');
      dataService.checkHealth().then(setHealthInfo);
    } catch (err: any) { setProcessStatus(`Error: ${err.message}`); }
  };

  const handleSeedData = async () => {
    setProcessStatus('Initializing Seed Process...');
    try {
      // Helper for batching
      const batchRequest = async <T,>(items: T[], importer: (v: string, i: T[]) => Promise<any>, vertical: string, typeName: string) => {
        const BATCH_SIZE = 15;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          setProcessStatus(`Phase: ${vertical} ${typeName} (${i + batch.length}/${items.length})`);
          await importer(vertical, batch);
        }
      };

      // 1. Seed Trends (Batched)
      await batchRequest(MOCK_TRENDS.filter(t => t.vertical === 'Retail'), dataService.importTrends.bind(dataService), 'Retail', 'Trends');
      await batchRequest(MOCK_TRENDS.filter(t => t.vertical === 'Sports'), dataService.importTrends.bind(dataService), 'Sports', 'Trends');
      await batchRequest(MOCK_TRENDS.filter(t => t.vertical === 'Beauty'), dataService.importTrends.bind(dataService), 'Beauty', 'Trends');
      
      // 2. Seed Articles (Batched)
      await batchRequest(MOCK_ARTICLES.filter(a => (a as any).vertical === 'Retail'), dataService.importArticles.bind(dataService), 'Retail', 'Articles');
      await batchRequest(MOCK_ARTICLES.filter(a => (a as any).vertical === 'Sports'), dataService.importArticles.bind(dataService), 'Sports', 'Articles');
      await batchRequest(MOCK_ARTICLES.filter(a => (a as any).vertical === 'Beauty'), dataService.importArticles.bind(dataService), 'Beauty', 'Articles');

      setProcessStatus('Seeding Complete! Graph is populated.');
      dataService.checkHealth().then(setHealthInfo);
    } catch (err: any) {
      console.error('[Seeding Error]', err);
      setProcessStatus(`Seeding Failed: ${err.message || 'Check browser console for details'}`);
    }
  };

  if (!isAuthenticated) return (
    <div className="fixed inset-0 z-[200] bg-stone-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-200 text-center">
        <h2 className="font-serif text-2xl font-bold text-stone-900 mb-6 uppercase tracking-widest">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access Key" className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-center" autoFocus />
          <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-xl font-bold">Sign In</button>
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
          <nav className="flex space-x-4">
            <button onClick={() => setActiveTab('graphs')} className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'graphs' ? 'text-fodda-accent' : 'text-stone-400'}`}>Datasets</button>
            <button onClick={() => setActiveTab('data')} className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'data' ? 'text-fodda-accent' : 'text-stone-400'}`}>Ingestion</button>
            <button onClick={() => setActiveTab('utility')} className={`text-xs font-bold uppercase tracking-widest ${activeTab === 'utility' ? 'text-fodda-accent' : 'text-stone-400'}`}>Demo Utility</button>
          </nav>
        </div>
        <button onClick={onBack} className="text-xs font-bold text-stone-500 hover:text-stone-900">Exit</button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full">
        <div className="mb-8 p-4 bg-white border border-stone-200 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${healthInfo?.ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Neo4j Connection</p>
              <p className="text-sm font-bold text-stone-800">{healthInfo?.ok ? 'Operational' : 'Disconnected / Empty'}</p>
            </div>
          </div>
          <button 
            onClick={() => dataService.checkHealth().then(setHealthInfo)}
            className="text-[10px] font-bold text-fodda-accent uppercase hover:underline"
          >
            Refresh Health
          </button>
        </div>

        {activeTab === 'graphs' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dataService.getGraphs().map(g => (
              <div key={g.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="text-lg font-bold text-stone-900">{g.name}</h3>
                <p className="text-xs text-stone-500 mb-4">{g.description}</p>
                <button onClick={() => { setSelectedGraphId(g.id); setActiveTab('data'); }} className="w-full py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold text-fodda-accent uppercase hover:bg-purple-50">Ingest New CSV</button>
              </div>
            ))}
          </div>
        ) : activeTab === 'data' ? (
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
                    </div>
                    {csvInput && (
                      <div className="space-y-4">
                        <textarea value={csvInput} readOnly className="w-full h-48 p-4 bg-stone-50 border border-stone-100 rounded-xl font-mono text-[9px] text-stone-400 resize-none" />
                        <button onClick={handleProcessData} className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Commit to {selectedGraphId} Graph</button>
                      </div>
                    )}
                    {processStatus && <p className="text-xs font-bold text-fodda-accent uppercase animate-pulse">{processStatus}</p>}
                 </div>
               ) : ( <div className="h-64 flex items-center justify-center text-stone-300 italic border border-dashed border-stone-200 rounded-3xl">Select a graph</div> )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl border border-stone-200 shadow-xl space-y-8">
            <div className="text-center">
              <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">Demo Seeding Utility</h2>
              <p className="text-sm text-stone-500">This tool will automatically populate your Neo4j Knowledge Graph with the curated projects datasets for Retail, Sports, and Beauty.</p>
            </div>
            
            <div className="p-6 bg-purple-50 border border-purple-100 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-purple-900 uppercase tracking-widest">Included Data</h3>
              <ul className="text-[11px] text-purple-700 space-y-1.5">
                <li>• 40+ Curated Industry Trends</li>
                <li>• 50+ Linked Source Articles & Proof Points</li>
                <li>• Retail, Sports, and Beauty Vertical Mappings</li>
              </ul>
              <button 
                onClick={handleSeedData}
                className="w-full py-4 bg-fodda-accent text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-200 hover:scale-[1.02] transition-transform"
              >
                Seed Knowledge Graph
              </button>
            </div>

            {processStatus && (
              <div className="p-4 bg-stone-900 text-white rounded-xl font-mono text-[10px] animate-fade-in-up">
                {processStatus}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
