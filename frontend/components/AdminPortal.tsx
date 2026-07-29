
import React, { useState, useRef, useEffect } from 'react';
import { dataService, UserLog } from '../../shared/dataService';
import { Trend, Article, SupplementalSource } from '../../shared/types';
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
  const [activeTab, setActiveTab] = useState<'data' | 'engagement' | 'system' | 'referrals' | 'partners' | 'users' | 'offers'>('users');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
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

  // Partner Invite state
  const STRIPE_LINK = 'https://buy.stripe.com/cNi28qbhT2l7gmY9c76g80b';
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerFirstName, setPartnerFirstName] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');
  const [partnerEmailBody, setPartnerEmailBody] = useState('');
  const [partnerSending, setPartnerSending] = useState(false);
  const [partnerResult, setPartnerResult] = useState<{ ok: boolean; message?: string; apiKey?: string; error?: string } | null>(null);

  // User Lookup state
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ ok: boolean; user?: any; account?: any; plan?: any; apiKey?: string | null; error?: string } | null>(null);
  const [lookupMcpConn, setLookupMcpConn] = useState<any>(null);
  const [trialMcpConn, setTrialMcpConn] = useState<any>(null);

  useEffect(() => {
    if (lookupResult?.user?.email) {
      dataService.getMcpConnection(lookupResult.user.email, password).then(conn => setLookupMcpConn(conn)).catch(() => {});
    } else {
      setLookupMcpConn(null);
    }
  }, [lookupResult?.user?.email, password]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [planChangeResult, setPlanChangeResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);

  // Trial MCP URL Generator state
  const [trialEmail, setTrialEmail] = useState('');
  const [trialKey, setTrialKey] = useState('sk_trial_all');
  const [trialGenerated, setTrialGenerated] = useState(false);
  const [copiedTrialMcp, setCopiedTrialMcp] = useState(false);
  const [copiedTrialClaude, setCopiedTrialClaude] = useState(false);
  
  // Custom Offer state
  const [offerEmail, setOfferEmail] = useState('');
  const [offerPlanCode, setOfferPlanCode] = useState<number>(3); // Default to Starter
  const [offerTrialDays, setOfferTrialDays] = useState<number>(7);
  const [offerGenerating, setOfferGenerating] = useState(false);
  const [offerResult, setOfferResult] = useState<{ ok: boolean; checkout_url?: string; error?: string } | null>(null);
  const [copiedOfferLink, setCopiedOfferLink] = useState(false);

  // Generate default partner email text with dynamic values
  const generatePartnerEmail = (name: string, email: string, company: string) => {
    const displayName = name || email.split('@')[0];
    return `Hi ${displayName} 👋

Thanks for joining the Fodda Studio Beta! You now have access to query across ALL Fodda knowledge graphs — trend intelligence, expert opinions, and real-time supplemental data from 20+ institutional sources.

🔑 YOUR ACCESS
• App Login: https://app.fodda.ai (use ${email})
• API Key: [will be generated and included below after account creation]
• MCP URL: will be sent separately with your API key

💳 ACTIVATE YOUR STUDIO PLAN ($1/month)
To lock in your Studio Beta access with 25,000 API calls/month, activate here:
👉 ${STRIPE_LINK}?prefilled_email=${encodeURIComponent(email)}

You can start exploring right away on our Base plan (100 API calls/month). When you're ready for the full Studio allocation, just click the link above.

📖 GETTING STARTED
1. Log into app.fodda.ai and explore the graph catalog
2. Try a query in the chat sandbox
3. Connect via MCP in Claude Desktop — paste the MCP URL above into your settings
4. Or call the API directly — docs at https://app.fodda.ai/Fodda_Quickstart.md

🤖 AGENT-FRIENDLY SETUP GUIDE
Feed this markdown doc to your AI agent (Claude, Codex, Cursor, etc.) for automated setup:
👉 https://app.fodda.ai/Fodda_Quickstart.md

📋 PROMPTING GUIDE
For tips on getting the best results, there's a prompting guide at https://app.fodda.ai

👥 ADD TEAM MEMBERS
To add colleagues from your company, go to https://app.fodda.ai → Account Settings → Team Members and follow the instructions. Team members must use a matching company email domain.

I'll check in next week to see how things are going. If anything isn't working, just reply here.

Piers
Founder, Fodda`.trim();
  };

  // Supplemental Data Sources state
  const [supplementalSources, setSupplementalSources] = useState<SupplementalSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; data?: any; error?: string }>>({});

  // Graph Trial Credentials state
  const [graphTrials, setGraphTrials] = useState<Record<string, any>>({});
  const [isLoadingTrials, setIsLoadingTrials] = useState(false);
  const [showTrialKey, setShowTrialKey] = useState<string | null>(null);
  const [copiedTrialKey, setCopiedTrialKey] = useState<string | null>(null);
  const [copiedGraphMcpUrl, setCopiedGraphMcpUrl] = useState<string | null>(null);

  // System Health Dashboard state
  const [apiHealth, setApiHealth] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; data?: any; error?: string }>({ status: 'idle' });
  const [mcpHealth, setMcpHealth] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; data?: any; error?: string }>({ status: 'idle' });
  const [airtableHealth, setAirtableHealth] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message?: string }>({ status: 'idle' });
  const [neo4jHealth, setNeo4jHealth] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; data?: any; error?: string }>({ status: 'idle' });

  // Helper: Get the actual API graphId used in API/MCP calls
  const getApiGraphId = (verticalId: string): string => {
    const v = verticalId.toLowerCase();
    if (v.includes('waldo')) return 'waldo';
    if (v.includes('sic')) return 'sic';
    if (v.includes('baseline')) return 'pew';
    // PSFK verticals use the vertical name directly
    return v; // 'retail', 'beauty', 'sports'
  };

  // Helper: Check if graph is a PSFK vertical (accessible via MCP with vertical-specific search)
  const isPsfkVertical = (verticalId: string): boolean => {
    const v = verticalId.toLowerCase();
    return ['retail', 'beauty', 'sports'].includes(v);
  };

  // Health check functions
  const checkApiHealth = async () => {
    setApiHealth({ status: 'checking' });
    try {
      const res = await fetch('https://api.fodda.ai/v1/health');
      const data = await res.json();
      setApiHealth({ status: data.status === 'ok' ? 'ok' : 'error', data });
    } catch (e: any) {
      setApiHealth({ status: 'error', error: e.message });
    }
  };

  const checkMcpHealth = async () => {
    setMcpHealth({ status: 'checking' });
    try {
      const res = await fetch('https://mcp.fodda.ai/mcp/tools');
      const data = await res.json();
      setMcpHealth({ status: data.tools ? 'ok' : 'error', data });
    } catch (e: any) {
      setMcpHealth({ status: 'error', error: e.message });
    }
  };

  const checkAirtableHealth = async () => {
    setAirtableHealth({ status: 'checking' });
    try {
      const res = await dataService.logToAirtable(userId, 'HEALTH_CHECK', 'SYSTEM', 'admin-health', 'ADMIN');
      await new Promise(r => setTimeout(r, 400));
      setAirtableHealth({ status: res.ok ? 'ok' : 'error', message: res.ok ? 'Connection verified' : 'Connection failed' });
    } catch (e: any) {
      setAirtableHealth({ status: 'error', message: e.message });
    }
  };

  const checkNeo4jHealth = async () => {
    setNeo4jHealth({ status: 'checking' });
    try {
      const result = await dataService.checkHealth();
      setNeo4jHealth({ status: result?.ok ? 'ok' : 'error', data: result?.details, error: result?.error });
      setHealthInfo(result);
    } catch (e: any) {
      setNeo4jHealth({ status: 'error', error: e.message });
    }
  };

  const checkAllHealth = () => {
    checkNeo4jHealth();
    checkApiHealth();
    checkMcpHealth();
    checkAirtableHealth();
  };

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
      if (activeTab === 'data') {
        fetchSupplementalSources();
        fetchGraphTrials();
      }
      if (activeTab === 'offers' || activeTab === 'users') {
        dataService.getPlans().then(res => {
          if (res.ok && res.plans) setAvailablePlans(res.plans);
        });
      }
    }
  }, [isAuthenticated, activeTab]);


  const fetchLogs = async () => {
    setIsRefreshingLogs(true);
    const data = await dataService.getLogs();
    setLogs(data);
    setIsRefreshingLogs(false);
  };

  const fetchSupplementalSources = async () => {
    setIsLoadingSources(true);
    const sources = await dataService.getSupplementalSources();
    setSupplementalSources(sources);
    setIsLoadingSources(false);
  };

  const fetchGraphTrials = async () => {
    setIsLoadingTrials(true);
    const trials = await dataService.fetchGraphTrials(password);
    setGraphTrials(trials);
    setIsLoadingTrials(false);
  };

  const handleTestSource = async (source: SupplementalSource) => {
    setTestResults(prev => ({ ...prev, [source.id]: { loading: true } }));
    try {
      const res = await fetch(`https://api.fodda.ai${source.endpoint}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [source.id]: { loading: false, data } }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [source.id]: { loading: false, error: err.message } }));
    }
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      // Validate against the server — no hardcoded passwords
      const testRes = await fetch('/api/graph-trials', {
        headers: { 'X-Admin-Secret': password },
      });
      if (testRes.ok) {
        setIsAuthenticated(true);
      } else {
        alert('Invalid Password');
      }
    } catch {
      alert('Unable to verify password — server unreachable');
    }
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
    <div className="fixed inset-0 z-[1100] bg-[#fdfcf2] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white p-12 rounded-[2rem] shadow-2xl border border-[#e8e6d9] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1a1a1a]"></div>
        <div className="mb-10">
          <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Institutional Access</p>
          <h2 className="font-serif italic text-4xl text-[#1a1a1a]">Registry Gate</h2>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest block text-left px-1">Network Passkey</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              className="w-full px-6 py-4 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl focus:outline-none focus:border-[#1a1a1a] text-center text-[#1a1a1a] text-lg tracking-widest placeholder:text-[#b4b1a1]/50 shadow-sm" 
              autoFocus 
            />
          </div>
          <button type="submit" className="w-full py-4.5 bg-[#1a1a1a] text-white rounded-2xl font-bold uppercase tracking-[0.15em] text-[10px] hover:bg-black transition-all shadow-xl shadow-black/10">
            Authorize Entry
          </button>
          <button type="button" onClick={onBack} className="text-[11px] text-[#b4b1a1] hover:text-[#1a1a1a] font-serif italic transition-colors">
            Return to Public Demo
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1100] bg-[#fdfcf2] flex flex-col font-sans selection:bg-[#1a1a1a] selection:text-white">
      {/* Header */}
      <header className="h-20 bg-white border-b border-[#e8e6d9] flex items-center justify-between px-10 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-white font-bold text-xl">F</div>
          <div>
            <h1 className="text-sm font-bold text-[#1a1a1a] uppercase tracking-[0.2em]">Institutional Console</h1>
            <p className="text-[10px] text-[#b4b1a1] font-serif italic">Global Registry & Network Intelligence</p>
          </div>
        </div>
        <button onClick={onBack} className="group flex items-center gap-3">
          <span className="text-[10px] font-bold text-[#b4b1a1] group-hover:text-[#1a1a1a] uppercase tracking-widest transition-colors">Terminate Session</span>
          <div className="w-8 h-8 rounded-full border border-[#e8e6d9] group-hover:border-[#1a1a1a] flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-[#b4b1a1] group-hover:text-[#1a1a1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
          </div>
        </button>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <nav className="w-72 border-r border-[#e8e6d9] bg-white p-8 space-y-8">
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.3em] mb-4 pl-4">Network Protocols</p>
            {[
              { id: 'users', label: 'User Lookup', icon: '👤' },
              { id: 'data', label: 'Graph Registry', icon: '🧠' },
              { id: 'engagement', label: 'Intelligence Monitor', icon: '📊' },
              { id: 'system', label: 'Nodes & Health', icon: '⚡' },
              { id: 'referrals', label: 'API Call Channels', icon: '🎫' },
              { id: 'offers', label: 'Custom Offers', icon: '🎁' },
              { id: 'partners', label: 'Collaborations', icon: '🤝', special: true },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-xs font-bold transition-all group ${
                  activeTab === tab.id 
                    ? tab.special ? 'bg-amber-50 text-amber-900 shadow-sm border border-amber-100' : 'bg-[#1a1a1a] text-white shadow-xl shadow-black/5 scale-[1.02]' 
                    : 'text-[#6a6a6a] hover:bg-[#fdfcf2] hover:text-[#1a1a1a]'
                }`}
              >
                <span className={`text-base group-hover:scale-125 transition-transform ${activeTab === tab.id ? 'opacity-100' : 'opacity-50'}`}>{tab.icon}</span>
                <span className="uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="pt-8 border-t border-[#f3f1e8]">
            <div className="p-5 bg-[#fdfcf2] rounded-2xl border border-[#e8e6d9]">
              <p className="text-[9px] font-bold text-[#1a1a1a] uppercase tracking-widest mb-1">Authenticated</p>
              <p className="text-[11px] text-[#6a6a6a] font-serif italic mb-3">Admin Cluster • NYC-01</p>
              <div className="w-full h-1.5 bg-[#e8e6d9] rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-[#1a1a1a]"></div>
              </div>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#fdfcf2]/30 relative">
          <div className="max-w-6xl mx-auto">

          {activeTab === 'users' && (
            <div className="max-w-4xl space-y-12 animate-fade-in-up pb-20">
              <header className="max-w-3xl">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Account Intelligence</p>
                <h2 className="text-4xl font-serif italic text-[#1a1a1a] mb-4">User Lookup</h2>
                <p className="text-sm text-[#6a6a6a] font-serif italic leading-relaxed">Search by email or handle to view a user's full profile, API credentials, plan details, and generate their MCP connection URL.</p>
              </header>

              {/* Search Bar */}
              <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!lookupEmail.trim()) return;
                  setLookupLoading(true);
                  setLookupResult(null);
                  setShowApiKey(false);
                  setCopiedMcpUrl(false);
                  setCopiedApiKey(false);
                  setPlanChangeResult(null);
                  const result = await dataService.adminLookupUser(lookupEmail.trim(), password);
                  setLookupResult(result);
                  setLookupLoading(false);
                  // Also fetch plans if not already loaded
                  if (availablePlans.length === 0) {
                    const plansRes = await dataService.getPlans();
                    if (plansRes.ok && plansRes.plans) setAvailablePlans(plansRes.plans);
                  }
                }} className="flex gap-4">
                  <div className="flex-1 relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#b4b1a1]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLookupEmail(e.target.value)}
                      placeholder="user@company.com or handle"
                      className="w-full pl-14 pr-6 py-4.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl text-sm text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner font-mono"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupEmail.trim()}
                    className="px-10 py-4.5 bg-[#1a1a1a] text-white font-bold text-[9px] uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center gap-3 disabled:opacity-40"
                  >
                    {lookupLoading ? (
                      <><div className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full"></div> Scanning...</>
                    ) : (
                      <>Resolve Identity →</>
                    )}
                  </button>
                </form>
              </div>

              {/* Error State */}
              {lookupResult && !lookupResult.ok && (
                <div className="p-8 rounded-[2rem] border border-red-100 bg-red-50 flex items-center gap-6 animate-fade-in-up">
                  <div className="w-12 h-12 rounded-2xl bg-red-100/50 flex items-center justify-center text-xl">!</div>
                  <div>
                    <p className="text-sm font-bold text-red-800 uppercase tracking-wider">Identity Not Resolved</p>
                    <p className="text-xs text-red-600 font-serif italic">{lookupResult.error}</p>
                  </div>
                </div>
              )}

              {/* Success: User Profile Card */}
              {lookupResult?.ok && lookupResult.user && (
                <div className="space-y-8 animate-fade-in-up">
                  {/* User Identity Card */}
                  <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                      <div className="text-[150px] font-serif italic text-[#1a1a1a] select-none">U</div>
                    </div>

                    <div className="border-b border-[#f3f1e8] pb-8 relative z-10">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">User Profile</p>
                          <h3 className="text-3xl font-serif italic text-[#1a1a1a] mb-1">{lookupResult.user.fullName || lookupResult.user.firstName || lookupResult.user.email}</h3>
                          <p className="text-sm text-[#6a6a6a] font-mono">{lookupResult.user.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border shadow-sm ${
                            lookupResult.user.emailConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {lookupResult.user.emailConfirmed ? '✓ Confirmed' : '⏳ Unconfirmed'}
                          </span>
                          <span className="text-[9px] font-mono text-[#6a6a6a] bg-[#fdfcf2] px-3 py-1.5 rounded-full border border-[#e8e6d9] shadow-sm">
                            {lookupResult.user.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User Details Grid */}
                    <div className="grid grid-cols-4 gap-8 pt-8">
                      {[
                        { label: 'Handle', val: lookupResult.user.handle || '—' },
                        { label: 'Platform', val: lookupResult.user.apiUse || '—' },
                        { label: 'Buyer Type', val: lookupResult.user.buyerType || '—' },
                        { label: 'Joined', val: lookupResult.user.createdAt ? new Date(lookupResult.user.createdAt).toLocaleDateString() : '—' },
                      ].map(stat => (
                        <div key={stat.label} className="space-y-1">
                          <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">{stat.label}</p>
                          <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wide">{stat.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* API Key & MCP URL */}
                  {lookupResult.apiKey && (
                    <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm space-y-8">
                      <h3 className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-[0.2em] border-b border-[#f3f1e8] pb-4">Credentials & Connection</h3>

                      {/* API Key */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">API Key</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner font-mono text-sm text-[#1a1a1a] flex items-center justify-between">
                            <span>{showApiKey ? lookupResult.apiKey : '••••••••••••••••••••' + (lookupResult.apiKey?.slice(-6) || '')}</span>
                            <button
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="text-[8px] font-bold text-[#b4b1a1] hover:text-[#1a1a1a] uppercase tracking-widest transition-colors ml-4"
                            >
                              {showApiKey ? 'Hide' : 'Reveal'}
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(lookupResult.apiKey || '');
                              setCopiedApiKey(true);
                              setTimeout(() => setCopiedApiKey(false), 2000);
                            }}
                            className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                              copiedApiKey
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                            }`}
                          >
                            {copiedApiKey ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* MCP URL */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">MCP Server URL</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner">
                            <p className="text-[11px] font-mono text-[#1a1a1a] break-all">
                              {lookupMcpConn?.mcpUrl || (lookupMcpConn?.token ? `https://mcp.fodda.ai/c/${lookupMcpConn.token}` : 'https://mcp.fodda.ai/c/:token')}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const mcpUrl = lookupMcpConn?.mcpUrl || (lookupMcpConn?.token ? `https://mcp.fodda.ai/c/${lookupMcpConn.token}` : 'https://mcp.fodda.ai/c/:token');
                              await navigator.clipboard.writeText(mcpUrl);
                              setCopiedMcpUrl(true);
                              setTimeout(() => setCopiedMcpUrl(false), 2000);
                            }}
                            className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                              copiedMcpUrl
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                            }`}
                          >
                            {copiedMcpUrl ? '✓ Copied' : 'Copy URL'}
                          </button>
                        </div>
                        <p className="text-[10px] text-[#b4b1a1] font-serif italic pl-1">Paste this URL into Claude Desktop, Cursor, or any MCP-compatible client.</p>
                      </div>

                      {/* Claude Connector Link */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1 flex items-center gap-2">
                          Claude Connector Link
                          <span className="text-[8px] font-normal text-[#6a6a6a] normal-case tracking-normal font-serif italic">— one-click install</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner">
                            <p className="text-[11px] font-mono text-[#1a1a1a] break-all">
                              {lookupMcpConn?.claudeConnectorUrl || `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(lookupMcpConn?.mcpUrl || 'https://mcp.fodda.ai/c/:token')}`}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const claudeUrl = lookupMcpConn?.claudeConnectorUrl || `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(lookupMcpConn?.mcpUrl || 'https://mcp.fodda.ai/c/:token')}`;
                              await navigator.clipboard.writeText(claudeUrl);
                              setCopiedMcpUrl(true);
                              setTimeout(() => setCopiedMcpUrl(false), 2000);
                            }}
                            className="px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account & Plan */}
                  {lookupResult.account && (
                    <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm space-y-8">
                      <h3 className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-[0.2em] border-b border-[#f3f1e8] pb-4">Account & Plan</h3>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                          { label: 'Account Name', val: lookupResult.account.name || '—' },
                          { label: 'Status', val: lookupResult.account.status || '—' },
                          { label: 'Vertical', val: lookupResult.account.vertical || '—' },
                          { label: 'Signup Code', val: lookupResult.account.signupCode || '—' },
                        ].map(stat => (
                          <div key={stat.label} className="space-y-1">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">{stat.label}</p>
                            <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wide">{stat.val}</p>
                          </div>
                        ))}
                      </div>

                      {/* API Call Usage Bar */}
                      <div className="p-6 bg-[#fdfcf2] rounded-2xl border border-[#e8e6d9] space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest">API Call Usage This Cycle</p>
                          <p className="text-xs font-mono text-[#1a1a1a] font-bold">
                            {lookupResult.account.tokensUsed?.toLocaleString()} / {(lookupResult.account.monthlyLimit + (lookupResult.account.bonusTokens || 0)).toLocaleString()}
                          </p>
                        </div>
                        <div className="w-full h-3 bg-[#e8e6d9] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              lookupResult.account.limitReached ? 'bg-red-500' : 'bg-[#1a1a1a]'
                            }`}
                            style={{ width: `${Math.min(100, (lookupResult.account.tokensUsed / Math.max(1, lookupResult.account.monthlyLimit + (lookupResult.account.bonusTokens || 0))) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-[#b4b1a1]">
                          <span>Remaining: {lookupResult.account.tokensRemaining?.toLocaleString()} API calls</span>
                          <span>Bonus: {lookupResult.account.bonusTokens || 0} API calls</span>
                          {lookupResult.account.nextRenewalDate && <span>Resets: {lookupResult.account.nextRenewalDate}</span>}
                        </div>
                      </div>

                      {/* Current Plan + Change Plan */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-6">
                          <div className="flex-1 space-y-1">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Current Plan</p>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-[#1a1a1a]">{lookupResult.plan?.name || 'No Plan'}</span>
                              {lookupResult.plan && (
                                <span className="text-[9px] font-mono text-[#6a6a6a] bg-[#fdfcf2] px-2.5 py-1 rounded-lg border border-[#e8e6d9]">
                                  Code {lookupResult.plan.planCode} · {lookupResult.plan.monthlyQueryLimit?.toLocaleString()} API calls/mo · {lookupResult.plan.price}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Plan Change Dropdown */}
                        <div className="flex items-end gap-4">
                          <div className="flex-1 space-y-2">
                            <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Change Plan</p>
                            <select
                              id="admin-plan-select"
                              defaultValue={lookupResult.plan?.planCode || ''}
                              className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-xs text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner appearance-none cursor-pointer"
                            >
                              <option value="" disabled>Select a plan...</option>
                              {availablePlans.map((p: any) => (
                                <option key={p.planCode} value={p.planCode}>
                                  {p.name} — {p.monthlyQueryLimit?.toLocaleString()} API calls/mo — {p.price}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={async () => {
                              const select = document.getElementById('admin-plan-select') as HTMLSelectElement;
                              const newPlanCode = Number(select.value);
                              if (!newPlanCode && newPlanCode !== 0) return;
                              if (newPlanCode === lookupResult.plan?.planCode) return;
                              setChangingPlan(true);
                              setPlanChangeResult(null);
                              const result = await dataService.adminChangePlan(lookupResult.user.email, newPlanCode, password);
                              setChangingPlan(false);
                              setPlanChangeResult(result);
                              if (result.ok) {
                                // Re-fetch the user to update the display
                                const refreshed = await dataService.adminLookupUser(lookupResult.user.email, password);
                                setLookupResult(refreshed);
                              }
                            }}
                            disabled={changingPlan}
                            className="px-8 py-3.5 bg-[#1a1a1a] text-white font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center gap-3 disabled:opacity-40 shrink-0"
                          >
                            {changingPlan ? (
                              <><div className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full"></div> Updating...</>
                            ) : (
                              <>Apply Plan Change</>
                            )}
                          </button>
                        </div>

                        {/* Plan Change Result */}
                        {planChangeResult && (
                          <div className={`p-4 rounded-xl text-xs font-bold animate-fade-in-up border flex items-center gap-3 ${
                            planChangeResult.ok
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {planChangeResult.ok ? (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                            <span>{planChangeResult.message || planChangeResult.error}</span>
                          </div>
                        )}
                      </div>

                      {/* Source Attribution */}
                      {lookupResult.account.sourceGraphId && (
                        <div className="pt-6 border-t border-[#f3f1e8]">
                          <div className="flex items-center gap-3">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Source Graph:</p>
                            <span className="text-[10px] font-bold text-[#1a1a1a] bg-[#fdfcf2] px-3 py-1.5 rounded-lg border border-[#e8e6d9] font-mono">{lookupResult.account.sourceGraphId}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Trial MCP URL Generator */}
              <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm space-y-8">
                <div className="border-b border-[#f3f1e8] pb-6">
                  <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Quick Tool</p>
                  <h3 className="text-2xl font-serif italic text-[#1a1a1a]">Trial MCP URL Generator</h3>
                  <p className="text-[11px] text-[#6a6a6a] font-serif italic mt-1">Generate an MCP URL and Claude connector link for trial users who don't have an account yet.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">User Email</label>
                    <input
                      type="email"
                      value={trialEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrialEmail(e.target.value)}
                      placeholder="jess@company.com"
                      className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-sm font-mono text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Trial API Key</label>
                    <input
                      type="text"
                      value={trialKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrialKey(e.target.value)}
                      placeholder="sk_trial_all"
                      className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-sm font-mono text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                    />
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!trialEmail.trim() || !trialKey.trim()) return;
                    setTrialGenerated(true);
                    setCopiedTrialMcp(false);
                    setCopiedTrialClaude(false);
                    try {
                      const conn = await dataService.getMcpConnection(trialEmail.trim(), password);
                      setTrialMcpConn(conn);
                    } catch (e) {}
                  }}
                  disabled={!trialEmail.trim() || !trialKey.trim()}
                  className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-bold uppercase tracking-[0.15em] text-[9px] hover:bg-black transition-all shadow-xl shadow-black/10 disabled:opacity-40"
                >
                  Generate URLs →
                </button>

                {trialGenerated && trialEmail.trim() && trialKey.trim() && (() => {
                  const mcpUrl = trialMcpConn?.mcpUrl || (trialMcpConn?.token ? `https://mcp.fodda.ai/c/${trialMcpConn.token}` : 'https://mcp.fodda.ai/c/:token');
                  const claudeUrl = trialMcpConn?.claudeConnectorUrl || `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(mcpUrl)}`;
                  return (
                    <div className="space-y-6 pt-4 border-t border-[#f3f1e8] animate-fade-in-up">
                      {/* MCP URL */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">MCP Server URL</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner">
                            <p className="text-[11px] font-mono text-[#1a1a1a] break-all">{mcpUrl}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(mcpUrl);
                              setCopiedTrialMcp(true);
                              setTimeout(() => setCopiedTrialMcp(false), 2000);
                            }}
                            className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                              copiedTrialMcp
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                            }`}
                          >
                            {copiedTrialMcp ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Claude Connector Link */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1 flex items-center gap-2">
                          Claude Connector Link
                          <span className="text-[8px] font-normal text-[#6a6a6a] normal-case tracking-normal font-serif italic">— opens one-click install modal in Claude</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner">
                            <p className="text-[11px] font-mono text-[#1a1a1a] break-all">{claudeUrl}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(claudeUrl);
                              setCopiedTrialClaude(true);
                              setTimeout(() => setCopiedTrialClaude(false), 2000);
                            }}
                            className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                              copiedTrialClaude
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                            }`}
                          >
                            {copiedTrialClaude ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[10px] text-[#b4b1a1] font-serif italic pl-1">Send this link to the user — clicking it opens Claude's MCP integration modal with the URL pre-filled.</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'offers' && (
            <div className="max-w-4xl space-y-12 animate-fade-in-up pb-20">
              <header className="max-w-3xl">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Sales Enablement</p>
                <h2 className="text-4xl font-serif italic text-[#1a1a1a] mb-4">Custom Offer Generator</h2>
                <p className="text-sm text-[#6a6a6a] font-serif italic leading-relaxed">Generate a one-time Stripe checkout link with a custom trial period and pre-filled customer details.</p>
              </header>

              <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 shadow-sm space-y-10">
                <div className="grid grid-cols-2 gap-8">
                  {/* Plan Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Target Plan</label>
                    <select
                      value={offerPlanCode}
                      onChange={(e) => setOfferPlanCode(Number(e.target.value))}
                      className="w-full px-5 py-4 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] transition-all cursor-pointer appearance-none shadow-inner"
                    >
                      {availablePlans.length > 0 ? availablePlans.filter(p => p.billingMode === 'subscription').map((p: any) => (
                        <option key={p.planCode} value={p.planCode}>
                          {p.name} ({p.price})
                        </option>
                      )) : (
                        <>
                          <option value={3}>Starter ($79/mo)</option>
                          <option value={4}>Team ($349/mo)</option>
                          <option value={5}>Studio ($1500/mo)</option>
                          <option value={6}>Business ($4600/mo)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Trial Days */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Trial Period (Days)</label>
                    <div className="flex items-center gap-4">
                      {[0, 7, 14, 30].map(days => (
                        <button
                          key={days}
                          onClick={() => setOfferTrialDays(days)}
                          className={`flex-1 py-4 rounded-2xl border text-[10px] font-bold transition-all ${
                            offerTrialDays === days 
                              ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg scale-105' 
                              : 'bg-white text-[#6a6a6a] border-[#e8e6d9] hover:border-[#1a1a1a]'
                          }`}
                        >
                          {days === 0 ? 'NO TRIAL' : `${days} DAYS`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Customer Email */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Customer Email (Optional)</label>
                  <input
                    type="email"
                    value={offerEmail}
                    onChange={(e) => setOfferEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full px-6 py-4.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl text-sm font-mono text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={async () => {
                    setOfferGenerating(true);
                    setOfferResult(null);
                    setCopiedOfferLink(false);
                    try {
                      const res = await dataService.createCustomCheckout(offerPlanCode, offerEmail.trim(), offerTrialDays);
                      setOfferResult(res);
                    } catch (e: any) {
                      setOfferResult({ ok: false, error: e.message });
                    } finally {
                      setOfferGenerating(false);
                    }
                  }}
                  disabled={offerGenerating}
                  className="w-full py-5 bg-[#1a1a1a] text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {offerGenerating ? (
                    <><div className="w-4 h-4 border-2 border-white/20 border-t-white animate-spin rounded-full"></div> Generating Offer...</>
                  ) : (
                    'Generate Custom Offer Link →'
                  )}
                </button>

                {/* Result Section */}
                {offerResult && offerResult.ok && offerResult.checkout_url && (
                  <div className="pt-10 border-t border-[#f3f1e8] space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between pl-1">
                      <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest">Shareable Checkout URL</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Link Active
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl px-6 py-4.5 shadow-inner overflow-hidden">
                        <p className="text-[11px] font-mono text-[#1a1a1a] truncate">{offerResult.checkout_url}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(offerResult.checkout_url!);
                          setCopiedOfferLink(true);
                          setTimeout(() => setCopiedOfferLink(false), 2000);
                        }}
                        className={`px-8 py-4.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          copiedOfferLink 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a] shadow-sm'
                        }`}
                      >
                        {copiedOfferLink ? '✓ Copied' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                )}

                {offerResult && !offerResult.ok && (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 font-serif italic animate-fade-in-up">
                    Error generating offer: {offerResult.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-3">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-4 pl-1">Registry Folders</p>
                {dataService.getGraphs().map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGraphId(g.id)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all group ${
                      selectedGraphId === g.id 
                        ? 'bg-white border-[#1a1a1a] shadow-xl shadow-black/5 ring-1 ring-[#1a1a1a]' 
                        : 'bg-white/50 border-[#e8e6d9] hover:border-[#b4b1a1] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold uppercase tracking-wider ${selectedGraphId === g.id ? 'text-[#1a1a1a]' : 'text-[#6a6a6a]'}`}>{g.name}</span>
                      {selectedGraphId === g.id && <span className="text-[#1a1a1a]">→</span>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="lg:col-span-8">
                {selectedGraphId ? (() => {
                  const g = dataService.getGraphs().find(graph => graph.id === selectedGraphId);
                  return (
                    <div className="bg-white border border-[#e8e6d9] p-10 rounded-[2.5rem] space-y-10 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                        <div className="text-[150px] font-serif italic text-[#1a1a1a] select-none">V</div>
                      </div>

                      <div className="border-b border-[#f3f1e8] pb-8 relative z-10">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Graph Identifier Profile</p>
                            <h2 className="text-3xl font-serif italic text-[#1a1a1a] mb-2">{g?.name}</h2>
                            {g?.headline && <p className="text-sm text-[#6a6a6a] font-serif italic leading-relaxed max-w-xl">{g.headline}</p>}
                          </div>
                          <span className="text-[9px] font-mono text-[#6a6a6a] bg-[#fdfcf2] px-3 py-1.5 rounded-full border border-[#e8e6d9] shadow-sm">UID: {selectedGraphId}</span>
                        </div>
                      </div>

                      {/* Access Protocols */}
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-2 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          Network Active
                        </span>
                        <span className="px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border bg-[#1a1a1a] text-white border-[#1a1a1a] flex items-center gap-2 shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          API Ready
                        </span>
                        {isPsfkVertical(selectedGraphId) && (
                          <span className="px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border bg-[#fdfcf2] text-[#1a1a1a] border-[#e8e6d9] flex items-center gap-2 shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            MCP Integration
                          </span>
                        )}
                      </div>

                      {/* System Identifiers */}
                      <div className="p-8 bg-[#fdfcf2]/80 rounded-3xl border border-[#e8e6d9] space-y-6">
                        <h4 className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Deployment Specifications</h4>
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-1">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Protocol ID</p>
                            <p className="text-base font-bold text-[#1a1a1a] font-mono tracking-tighter">{getApiGraphId(selectedGraphId)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Cluster Assignment</p>
                            <p className="text-base font-bold text-[#1a1a1a]">{g?.verticalName || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Search Access Point</p>
                            <div className="flex items-center gap-3">
                              <p className="text-[11px] font-mono text-[#1a1a1a] bg-white px-4 py-2 rounded-xl border border-[#e8e6d9] flex-1 shadow-sm">
                                POST /v1/graphs/<span className="font-bold underlineDecoration-black">{getApiGraphId(selectedGraphId)}</span>/search
                              </p>
                              <button className="p-2 text-[#b4b1a1] hover:text-[#1a1a1a] transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg></button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Knowledge Ingestion (Evidence)</p>
                            <div className="flex items-center gap-3">
                              <p className="text-[11px] font-mono text-[#1a1a1a] bg-white px-4 py-2 rounded-xl border border-[#e8e6d9] flex-1 shadow-sm">
                                POST /v1/graphs/<span className="font-bold underlineDecoration-black">{getApiGraphId(selectedGraphId)}</span>/evidence
                              </p>
                              <button className="p-2 text-[#b4b1a1] hover:text-[#1a1a1a] transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg></button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Trial API Key & MCP URL */}
                      {(() => {
                        const trial = graphTrials[selectedGraphId] || graphTrials[getApiGraphId(selectedGraphId)];
                        if (!trial) return (
                          <div className="p-6 bg-[#fdfcf2]/50 rounded-2xl border border-dashed border-[#e8e6d9]">
                            <p className="text-[10px] text-[#b4b1a1] font-serif italic text-center">No trial credentials provisioned for this graph.</p>
                          </div>
                        );
                        const isRevealed = showTrialKey === selectedGraphId;
                        return (
                          <div className="p-8 bg-white rounded-3xl border border-[#e8e6d9] space-y-6 shadow-sm">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-[0.2em]">Graph Credentials</h4>
                              <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[0.2em] border shadow-sm ${
                                  trial.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                  {trial.status === 'active' ? '● Active' : '○ Exhausted'}
                                </span>
                                <span className="text-[9px] font-mono text-[#6a6a6a] bg-[#fdfcf2] px-2.5 py-1 rounded-lg border border-[#e8e6d9]">
                                  {trial.credits_remaining}/{trial.credits_total} credits
                                </span>
                              </div>
                            </div>

                            {/* API Key */}
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Trial API Key</p>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner font-mono text-sm text-[#1a1a1a] flex items-center justify-between">
                                  <span className="break-all">{isRevealed ? trial.trial_key : '••••••••••••••••••••' + (trial.trial_key?.slice(-6) || '')}</span>
                                  <button
                                    onClick={() => setShowTrialKey(isRevealed ? null : selectedGraphId)}
                                    className="text-[8px] font-bold text-[#b4b1a1] hover:text-[#1a1a1a] uppercase tracking-widest transition-colors ml-4 shrink-0"
                                  >
                                    {isRevealed ? 'Hide' : 'Reveal'}
                                  </button>
                                </div>
                                <button
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(trial.trial_key);
                                    setCopiedTrialKey(selectedGraphId);
                                    setTimeout(() => setCopiedTrialKey(null), 2000);
                                  }}
                                  className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                                    copiedTrialKey === selectedGraphId
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                                  }`}
                                >
                                  {copiedTrialKey === selectedGraphId ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            {/* MCP URL */}
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">MCP Server URL</p>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-5 py-3.5 shadow-inner">
                                  <p className="text-[11px] font-mono text-[#1a1a1a] break-all">
                                    {isRevealed ? (trial.mcp_url || 'https://mcp.fodda.ai/c/:token') : 'https://mcp.fodda.ai/c/••••••••…'}
                                  </p>
                                </div>
                                <button
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(trial.mcp_url);
                                    setCopiedGraphMcpUrl(selectedGraphId);
                                    setTimeout(() => setCopiedGraphMcpUrl(null), 2000);
                                  }}
                                  className={`px-5 py-3.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${
                                    copiedGraphMcpUrl === selectedGraphId
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                                  }`}
                                >
                                  {copiedGraphMcpUrl === selectedGraphId ? '✓ Copied' : 'Copy URL'}
                                </button>
                              </div>
                              <p className="text-[10px] text-[#b4b1a1] font-serif italic pl-1">Paste this URL into Claude Desktop, Cursor, or any MCP-compatible client.</p>
                            </div>

                            {/* Owner Info */}
                            {trial.owner_email && (
                              <div className="pt-4 border-t border-[#f3f1e8] flex items-center gap-3">
                                <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">Trial Owner:</p>
                                <span className="text-[10px] font-bold text-[#1a1a1a] bg-[#fdfcf2] px-3 py-1.5 rounded-lg border border-[#e8e6d9] font-mono">{trial.owner_email}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Graph metadata */}
                      <div className="grid grid-cols-4 gap-6">
                        {[
                          { label: 'Originator', val: g?.curator || g?.owner || 'Fodda Network' },
                          { label: 'Refresh Rate', val: g?.updateFrequency || 'Ongoing' },
                          { label: 'Current State', val: 'Q1-2026 Stable' },
                          { label: 'Source Material', val: 'Institutional Feed', link: g?.sourceURL }
                        ].map(stat => (
                          <div key={stat.label} className="space-y-1">
                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">{stat.label}</p>
                            {stat.link ? (
                              <a href={stat.link} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#1a1a1a] hover:underline block truncate uppercase tracking-wide">Documentation ↗</a>
                            ) : (
                              <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wide">{stat.val}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })() : (<div className="h-64 flex items-center justify-center text-stone-300 italic border border-dashed border-stone-200 rounded-3xl">Select a graph to view details</div>)}
              </div>
            </div>

            {/* Supplemental Data Sources Section */}
            <div className="mt-20 pt-12 border-t border-[#e8e6d9]">
              <header className="mb-10">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Supplemental Intelligence</p>
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-serif italic text-[#1a1a1a]">Network Data Feeds</h2>
                  <div className="h-0.5 bg-[#e8e6d9] flex-1"></div>
                </div>
                <p className="text-xs text-[#6a6a6a] mt-3 font-serif italic">External structured datasets providing quantitative context from 20+ institutional sources.</p>
              </header>

              {isLoadingSources ? (
                <div className="flex items-center gap-4 py-16 justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-[#1a1a1a]/10 border-t-[#1a1a1a] animate-spin"></div>
                  <p className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-widest">Decrypting Data Registry...</p>
                </div>
              ) : supplementalSources.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-[#e8e6d9] rounded-[2.5rem]">
                  <p className="text-[11px] text-[#b4b1a1] font-serif italic">No supplemental telemetry detected from the central cluster.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  {supplementalSources.map(source => {
                    const test = testResults[source.id];
                    return (
                      <div
                        key={source.id}
                        className={`bg-white border rounded-[2rem] p-8 space-y-6 transition-all shadow-sm group hover:shadow-xl hover:-translate-y-1 ${
                          source.status === 'active' ? 'border-[#e8e6d9]' : 'border-[#f3f1e8] opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-[#fdfcf2] border border-[#e8e6d9] flex items-center justify-center text-2xl shadow-sm">📊</div>
                            <div>
                              <h4 className="text-sm font-bold text-[#1a1a1a] mb-1">{source.name}</h4>
                              <p className="text-[10px] text-[#b4b1a1] uppercase tracking-widest">Source Cluster: {source.source}</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[0.2em] border shadow-sm ${
                            source.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-[#fdfcf2] text-[#b4b1a1] border-[#e8e6d9]'
                          }`}>
                            {source.status}
                          </span>
                        </div>

                        <p className="text-xs text-[#6a6a6a] font-serif italic leading-relaxed">{source.description}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-[#fdfcf2] text-[#1a1a1a] border border-[#e8e6d9]">
                            {source.frequency}
                          </span>
                          {source.categories.slice(0, 3).map(cat => (
                            <span key={cat} className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-[#b4b1a1] border border-[#f3f1e8]">
                              {cat}
                            </span>
                          ))}
                        </div>

                        {source.status === 'active' && (
                          <div className="pt-4 border-t border-[#f3f1e8] space-y-4">
                            <button
                              onClick={() => handleTestSource(source)}
                              disabled={test?.loading}
                              className="text-[9px] font-bold text-[#1a1a1a] hover:text-black uppercase tracking-widest flex items-center gap-3 transition-colors disabled:opacity-50"
                            >
                              {test?.loading ? 'Synchronizing Nodes...' : 'Query Test Endpoint →'}
                            </button>
                            {test?.data && (
                              <div className="p-5 bg-[#fdfcf2] rounded-2xl border border-[#e8e6d9] shadow-inner overflow-hidden relative">
                                <p className="text-[8px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-3">TELEMETRY_SNAPSHOT_V2</p>
                                <pre className="text-[10px] text-[#1a1a1a]/80 font-mono whitespace-pre-wrap break-words leading-tight">
                                  {JSON.stringify(test.data.snapshot || test.data, null, 2).slice(0, 500)}...
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>
          )}

          {activeTab === 'engagement' && (
            <div className="space-y-10 animate-fade-in-up max-w-6xl">
              <header>
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Network Activity</p>
                <h2 className="text-4xl font-serif italic text-[#1a1a1a]">Intelligence Monitor</h2>
              </header>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white border border-[#e8e6d9] p-8 rounded-[2rem] shadow-sm flex items-center justify-between">
                  <div className="space-y-4 flex-1 pr-12">
                    <h3 className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Network Requests (30d)</h3>
                    <div className="flex items-end space-x-1 h-32 pl-1">
                      {[3, 5, 2, 8, 4, 6, 9, 11, 7, 5, 8, 12, 15, 12, 10, 14, 18, 22, 19, 25, 22, 28, 24, 30, 35, 32, 28, 30, 38, 42].map((h, i) => (
                        <div key={i} className="flex-1 bg-[#1a1a1a]/5 rounded-t-lg hover:bg-[#1a1a1a] transition-all cursor-pointer group relative shadow-sm" style={{ height: `${h}%` }}>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] text-white text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">{h} req</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right pl-6 border-l border-[#f3f1e8]">
                    <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Total Signals</p>
                    <p className="text-5xl font-mono font-bold text-[#1a1a1a] tracking-tighter">1,284</p>
                    <div className="flex items-center justify-end gap-1.5 mt-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                       <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">+12.4% vs prev</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-8 bg-white border border-[#e8e6d9] rounded-[2rem] shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg font-serif italic text-[#1a1a1a]">Registry Telemetry</h2>
                  <p className="text-[11px] text-[#6a6a6a]">Real-time synchronization of network node interactions.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handlePingAirtable}
                    disabled={isPinging}
                    className="px-6 py-3 bg-[#fdfcf2] border border-[#e8e6d9] text-[#1a1a1a] rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-[#1a1a1a] transition-all flex items-center gap-3 disabled:opacity-40"
                  >
                    {isPinging ? <div className="w-3 h-3 border-2 border-[#1a1a1a]/10 border-t-[#1a1a1a] animate-spin rounded-full"></div> : '⚡'}
                    {isPinging ? 'Synchronizing...' : 'Diagnostic Ping'}
                  </button>
                  <button
                    onClick={fetchLogs}
                    disabled={isRefreshingLogs}
                    className="px-6 py-3 bg-[#1a1a1a] text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center gap-3 disabled:opacity-40 shadow-xl shadow-black/10"
                  >
                    {isRefreshingLogs ? <div className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full"></div> : '⟳'}
                    {isRefreshingLogs ? 'Decrypting...' : 'Refresh Logs'}
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

              <div className="bg-white rounded-[2rem] border border-[#e8e6d9] shadow-sm overflow-hidden animate-fade-in-up">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#fdfcf2] border-b border-[#e8e6d9]">
                      <tr>
                        <th className="px-8 py-5 text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Network Identity</th>
                        <th className="px-8 py-5 text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Registry Folder</th>
                        <th className="px-8 py-5 text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Telemetry Query</th>
                        <th className="px-8 py-5 text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Protocol Status</th>
                        <th className="px-8 py-5 text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f1e8]">
                      {logs.length > 0 ? logs.map((log, i) => (
                        <tr key={i} className="hover:bg-[#fdfcf2]/50 transition-colors group">
                          <td className="px-8 py-6">
                            <span className="text-[11px] font-bold text-[#1a1a1a]">{log.email}</span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-tighter bg-[#fdfcf2] px-2.5 py-1 rounded-lg border border-[#e8e6d9] shadow-sm group-hover:border-[#1a1a1a] transition-colors">{log.vertical}</span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] text-[#6a6a6a] font-serif italic line-clamp-1 max-w-xs group-hover:text-[#1a1a1a] transition-colors" title={log.query}>{log.query}</p>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.1em] border shadow-sm ${
                              log.dataStatus.includes('TREND') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              log.dataStatus.includes('SIGNAL') ? 'bg-purple-50 text-[#8B5CF6] border-purple-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {log.dataStatus.replace('_MATCH', '')}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-[10px] text-[#b4b1a1] font-mono group-hover:text-[#6a6a6a] transition-colors">
                              {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center text-[#b4b1a1] font-serif italic text-xs">No engagement telemetry recorded in current cluster cycle.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="max-w-4xl space-y-12 animate-fade-in-up">
              <header className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em]">Maintenance & Telemetry</p>
                  <h2 className="text-4xl font-serif italic text-[#1a1a1a]">Node Connectivity</h2>
                </div>
                <button
                  onClick={checkAllHealth}
                  className="px-8 py-3.5 bg-[#1a1a1a] text-white font-bold text-[9px] rounded-xl hover:bg-black transition-all uppercase tracking-widest shadow-xl shadow-black/10 flex items-center gap-3"
                >
                  <span className="text-sm">⚡</span>
                  Global Re-sync
                </button>
              </header>

              {/* Health Check Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { label: 'Neo4j Knowledge Engine', endpoint: 'neo4j+s://337edc3e.io', state: neo4jHealth, checkFn: checkNeo4jHealth, icon: '🧠' },
                  { label: 'Fodda Core API Cluster', endpoint: 'api.fodda.ai', state: apiHealth, checkFn: checkApiHealth, icon: '📡' },
                  { label: 'MCP Universal Link', endpoint: 'mcp.fodda.ai', state: mcpHealth, checkFn: checkMcpHealth, icon: '⚡' },
                  { label: 'Telemetry Sink (Airtable)', endpoint: 'Sync Pipeline', state: airtableHealth, checkFn: checkAirtableHealth, icon: '📊' }
                ].map((service, idx) => (
                  <div key={idx} className="bg-white border border-[#e8e6d9] p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
                    <div className="flex items-start justify-between relative z-10 mb-6">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#fdfcf2] border border-[#e8e6d9] flex items-center justify-center text-2xl shadow-sm">{service.icon}</div>
                        <div>
                          <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">{service.label}</p>
                          <p className="text-[10px] text-[#b4b1a1] font-mono mt-0.5">{service.endpoint}</p>
                        </div>
                      </div>
                      <div className={`w-3 h-3 rounded-full border shadow-sm ${
                        service.state.status === 'ok' ? 'bg-emerald-500 border-emerald-200 animate-pulse' :
                        service.state.status === 'error' ? 'bg-red-500 border-red-200' :
                        service.state.status === 'checking' ? 'bg-amber-400 border-amber-200 animate-pulse' : 'bg-[#e8e6d9] border-[#f3f1e8]'
                      }`}></div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-[#f3f1e8]">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${
                        service.state.status === 'ok' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                        service.state.status === 'error' ? 'text-red-700 bg-red-50 border-red-100' :
                        service.state.status === 'checking' ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-[#b4b1a1] bg-[#fdfcf2] border-[#e8e6d9]'
                      }`}>
                        {service.state.status === 'ok' ? 'Synchronized' : service.state.status === 'error' ? 'Transmission Error' : service.state.status === 'checking' ? 'Handshaking...' : 'Pending'}
                      </span>
                      <button 
                        onClick={service.checkFn} 
                        disabled={service.state.status === 'checking'} 
                        className="p-2.5 rounded-full border border-[#e8e6d9] hover:border-[#1a1a1a] text-[#b4b1a1] hover:text-[#1a1a1a] transition-all disabled:opacity-30"
                        title="Re-verify connectivity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2.5} /></svg>
                      </button>
                    </div>

                    {service.state.status === 'ok' && service.state.data && (
                      <div className="mt-6 p-4 bg-[#fdfcf2] rounded-2xl border border-[#e8e6d9] shadow-inner">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#6a6a6a]">
                          <span>VER: {service.state.data.version || '2026.1'}</span>
                          <span>NODE: Nominal</span>
                        </div>
                      </div>
                    )}
                    
                    {service.state.status === 'error' && (service.state.error || service.state.message) && (
                      <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl">
                        <p className="text-[10px] text-red-600 font-mono break-words leading-relaxed">{service.state.error || service.state.message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-8 bg-white border-2 border-dashed border-[#e8e6d9] rounded-[2.5rem] text-center">
                <p className="text-[11px] text-[#6a6a6a] font-serif italic">Governance protocols, credential management, and cluster scaling are synchronized in <span className="text-[#1a1a1a] font-bold border-b border-[#1a1a1a]">Master Account Settings</span>.</p>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="space-y-12 animate-fade-in-up">
              <header className="max-w-3xl">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">Team Access</p>
                <h2 className="text-4xl font-serif italic text-[#1a1a1a] mb-4">Referral Channels</h2>
                <p className="text-sm text-[#6a6a6a] font-serif italic leading-relaxed">Generate shareable signup vectors that scope new users to a specific knowledge graph. Entry via these channels limits initial access to the designated vertical cluster.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {dataService.getGraphs().map((g) => {
                  const slug = g.id.toLowerCase();
                  const refUrl = `https://app.fodda.ai?graph=${slug}`;
                  const isCopied = copiedLink === slug;
                  return (
                    <div key={g.id} className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-8 space-y-8 hover:shadow-xl transition-all shadow-sm group">
                      {/* Graph header */}
                      <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#fdfcf2] border border-[#e8e6d9] flex items-center justify-center text-2xl shadow-sm">📑</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-1">{g.name}</p>
                          <p className="text-[10px] text-[#b4b1a1] uppercase tracking-widest">Maintained by {g.owner}</p>
                        </div>
                      </div>

                      {/* URL + Copy */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest ml-1">Distribution URL</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl px-4 py-3 shadow-inner">
                            <p className="text-[11px] font-mono text-[#1a1a1a] truncate">{refUrl}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(refUrl);
                              setCopiedLink(slug);
                              setTimeout(() => setCopiedLink(null), 2000);
                            }}
                            className={`px-5 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all shrink-0 ${isCopied
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              : 'bg-white border-[#e8e6d9] text-[#1a1a1a] hover:border-[#1a1a1a]'
                              }`}
                          >
                            {isCopied ? 'Synchronized' : 'Copy Link'}
                          </button>
                        </div>
                      </div>

                      {/* Badge Preview */}
                      <div className="pt-6 border-t border-[#f3f1e8]">
                        <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-4 ml-1">Onboarding Badge Preview</p>
                        <div className="p-6 bg-white border border-[#1a1a1a]/5 rounded-3xl shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1a1a1a]/5 rounded-bl-[4rem] pointer-events-none"></div>
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a]/5 flex items-center justify-center text-lg">💡</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#1a1a1a] mb-0.5">{g.name}</p>
                              <p className="text-[10px] text-[#6a6a6a] font-serif italic line-clamp-1">{g.headline || g.description}</p>
                              <p className="text-[8px] text-[#b4b1a1] uppercase tracking-widest mt-1.5 font-bold">Registry Node • Curated by {g.owner}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-8 mt-12 bg-white/50 border border-[#e8e6d9] rounded-[2rem] p-8 shadow-inner">
                <header className="flex items-center gap-4 mb-4">
                  <div className="h-0.5 bg-[#e8e6d9] flex-1"></div>
                  <p className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-[0.3em]">Operational Protocol</p>
                  <div className="h-0.5 bg-[#e8e6d9] flex-1"></div>
                </header>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-[11px] text-[#6a6a6a] font-serif italic">
                  <li className="flex items-start gap-4">
                    <span className="text-[#1a1a1a] font-bold">01.</span>
                    <span>Distribute unique referral vectors to designated audiences.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-[#1a1a1a] font-bold">02.</span>
                    <span>System automatically identifies intake node and scopes user cluster.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-[#1a1a1a] font-bold">03.</span>
                    <span>Primary knowledge graph is prioritized; secondary nodes remain inert.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-[#1a1a1a] font-bold">04.</span>
                    <span>Onboarding protocols favor high-intelligence LLM models (Claude-3).</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'partners' && (
            <div className="max-w-4xl space-y-12 animate-fade-in-up pb-20">
              <header className="max-w-3xl">
                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-[0.2em] mb-2">External Collaborations</p>
                <h2 className="text-4xl font-serif italic text-[#1a1a1a] mb-4">Partner Onboarding</h2>
                <p className="text-sm text-[#6a6a6a] font-serif italic leading-relaxed">Commission new Studio Beta credentials for institutional partners. Partners are initialized with Base clearance and can elevate to Studio protocols via the integrated transaction link.</p>
              </header>

              {/* Partner Form */}
              <div className="bg-white border border-[#e8e6d9] rounded-[2.5rem] p-10 space-y-10 shadow-sm">
                <div>
                  <h3 className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-[0.2em] mb-8 border-b border-[#f3f1e8] pb-4">Institutional Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Network Identity (Email) *</label>
                      <input
                        type="email"
                        value={partnerEmail}
                        onChange={(e) => {
                          setPartnerEmail(e.target.value);
                          setPartnerResult(null);
                          const name = partnerFirstName || e.target.value.split('@')[0];
                          const company = partnerCompany || '';
                          setPartnerEmailBody(generatePartnerEmail(name, e.target.value, company));
                        }}
                        placeholder="identity@institution.com"
                        className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-xs text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Given Name</label>
                      <input
                        type="text"
                        value={partnerFirstName}
                        onChange={(e) => {
                          setPartnerFirstName(e.target.value);
                          const name = e.target.value || partnerEmail.split('@')[0];
                          setPartnerEmailBody(generatePartnerEmail(name, partnerEmail, partnerCompany));
                        }}
                        placeholder="E.g. Alexander"
                        className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-xs text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Organization Cluster</label>
                      <input
                        type="text"
                        value={partnerCompany}
                        onChange={(e) => {
                          setPartnerCompany(e.target.value);
                          const name = partnerFirstName || partnerEmail.split('@')[0];
                          setPartnerEmailBody(generatePartnerEmail(name, partnerEmail, e.target.value));
                        }}
                        placeholder="Institutional Entity"
                        className="w-full px-5 py-3.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl text-xs text-[#1a1a1a] placeholder-[#b4b1a1]/50 focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Preview Area */}
                {partnerEmail && (
                  <div className="space-y-6 pt-6 border-t border-[#f3f1e8] animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-[0.2em]">Communication Manifest</h3>
                        <p className="text-[10px] text-[#b4b1a1] font-serif italic">Subject: Your Fodda Studio Beta access is ready</p>
                      </div>
                      <button
                        onClick={() => {
                          const name = partnerFirstName || partnerEmail.split('@')[0];
                          setPartnerEmailBody(generatePartnerEmail(name, partnerEmail, partnerCompany));
                        }}
                        className="text-[8px] font-bold text-[#b4b1a1] hover:text-[#1a1a1a] uppercase tracking-widest transition-colors"
                      >
                        Reset Manifest →
                      </button>
                    </div>

                    <textarea
                      value={partnerEmailBody}
                      onChange={(e) => setPartnerEmailBody(e.target.value)}
                      rows={18}
                      className="w-full px-8 py-8 bg-[#fdfcf2] border border-[#e8e6d9] rounded-[2rem] text-[11px] text-[#1a1a1a]/80 font-mono leading-relaxed focus:outline-none focus:border-[#1a1a1a] transition-all shadow-inner resize-none custom-scrollbar"
                    />

                    <div className="flex items-center justify-end gap-6">
                      <button
                        onClick={async () => {
                          if (!partnerEmail) return;
                          setPartnerSending(true);
                          setPartnerResult(null);
                          const result = await dataService.partnerInvite({
                            email: partnerEmail,
                            firstName: partnerFirstName || undefined,
                            companyName: partnerCompany || undefined,
                            emailBody: partnerEmailBody,
                            adminSecret: password,
                          });
                          setPartnerSending(false);
                          if (result.ok) {
                            setPartnerResult({ ok: true, message: `Account created for ${partnerEmail}`, apiKey: result.apiKey });
                            setTimeout(() => {
                              setPartnerEmail('');
                              setPartnerFirstName('');
                              setPartnerCompany('');
                              setPartnerEmailBody('');
                            }, 5000);
                          } else {
                            setPartnerResult({ ok: false, error: result.error });
                          }
                        }}
                        disabled={partnerSending || !partnerEmail}
                        className="px-10 py-4 bg-[#1a1a1a] text-white font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center gap-4 disabled:opacity-40"
                      >
                        {partnerSending ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full"></div>
                            Processing Invitation...
                          </>
                        ) : (
                          <>
                            Authorize & Dispatch Signal
                            <span className="text-white/50">→</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Result Notifications */}
              {partnerResult && (
                <div className={`p-8 rounded-[2rem] border animate-fade-in-up flex items-start gap-6 shadow-sm ${partnerResult.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${partnerResult.ok ? 'bg-emerald-100/50 text-emerald-600' : 'bg-red-100/50 text-red-600'}`}>
                    {partnerResult.ok ? '✓' : '!'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${partnerResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                      {partnerResult.ok ? 'Partner Integration Successful' : 'Signal Transmission Failed'}
                    </p>
                    <p className={`text-xs font-serif italic ${partnerResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{partnerResult.message || partnerResult.error}</p>
                    {partnerResult.apiKey && (
                       <div className="mt-4 p-4 bg-white/50 rounded-xl border border-emerald-100 inline-block">
                          <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Assigned API Access Key</p>
                          <p className="text-xs font-mono text-emerald-900 select-all">{partnerResult.apiKey}</p>
                       </div>
                    )}
                  </div>
                </div>
              )}

              {/* Educational Manifesto */}
              <div className="p-10 bg-white/50 border border-[#e8e6d9] rounded-[2.5rem] shadow-inner">
                <p className="text-[10px] text-[#1a1a1a] font-bold uppercase tracking-[0.3em] mb-6 border-b border-[#e8e6d9] pb-4 pl-1">Protocol: Studio Beta Expansion</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { label: 'Baseline Intake', desc: 'Identities are initialized with Base clearance (100 API calls/mo) across all registry nodes.' },
                    { label: 'Studio Elevation', desc: 'Communication includes an exclusive $1/mo transaction vector for Studio Beta activation.' },
                    { label: 'Automated Upgrade', desc: 'Transaction webhooks trigger immediate elevation to Studio (25,000 API calls/mo) clearance.' }
                  ].map(rule => (
                    <div key={rule.label} className="space-y-2">
                       <p className="text-[9px] font-bold text-[#1a1a1a] uppercase tracking-widest">{rule.label}</p>
                       <p className="text-[11px] text-[#6a6a6a] font-serif italic leading-relaxed">{rule.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
