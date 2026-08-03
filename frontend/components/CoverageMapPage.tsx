import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { KnowledgeGraph, User, Account } from '../../shared/types';

interface CoverageMapPageProps {
  graphs: KnowledgeGraph[];
  userVertical?: string;
  disabledGraphs?: string[];
  onToggleGraph?: (graphId: string) => void;
  onNavigate?: (view: string) => void;
  onAskGraph?: (graphId: string, query?: string) => void;
  user?: User | null;
  account?: Account | null;
}

export const CoverageMapPage: React.FC<CoverageMapPageProps> = ({
  graphs,
  userVertical,
  disabledGraphs = [],
  onToggleGraph,
  onNavigate,
  onAskGraph,
  user,
  account
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestTopic, setRequestTopic] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track auto-logged search misses to prevent duplicate network calls
  const loggedMissesRef = useRef<Set<string>>(new Set());

  // Show Toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter active graphs from catalog (include all live/active graphs)
  const validGraphs = useMemo(() => {
    if (!graphs || !Array.isArray(graphs)) return [];
    return graphs.filter(g => {
      const status = (g.status || 'live').toLowerCase().trim();
      if (status === 'coming_soon' || status === 'coming-soon' || status === 'disabled' || status === 'archived') return false;
      return true;
    });
  }, [graphs]);

  // Separate Trend Graphs vs Supplemental Institutional Sources
  const { trendGraphs, supplementalSources } = useMemo(() => {
    const trends: KnowledgeGraph[] = [];
    const supplementals: KnowledgeGraph[] = [];

    validGraphs.forEach(g => {
      const type = (g.graph_type || '').toLowerCase().trim();
      if (type === 'supplemental' || type === 'baseline') {
        supplementals.push(g);
      } else {
        trends.push(g);
      }
    });

    return { trendGraphs: trends, supplementalSources: supplementals };
  }, [validGraphs]);

  // Normalize tag helper (splits on commas/dashes, trims, lowercases)
  const normalizeTags = (rawTopics?: any): string[] => {
    if (!rawTopics) return [];
    if (Array.isArray(rawTopics)) {
      return rawTopics.flatMap(t => String(t).split(/[,-]/)).map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    return String(rawTopics).split(/[,-]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  };

  // Filter graphs by Search Query
  const filteredTrendGraphs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trendGraphs;

    return trendGraphs.filter(g => {
      const name = (g.name || '').toLowerCase();
      const headline = (g.headline || g.description || '').toLowerCase();
      const domain = (g.domain || g.verticalName || '').toLowerCase();
      const curator = (g.curator || g.owner || '').toLowerCase();
      const topics = normalizeTags(g.topics);

      return name.includes(q) ||
        headline.includes(q) ||
        domain.includes(q) ||
        curator.includes(q) ||
        topics.some(t => t.includes(q));
    });
  }, [trendGraphs, searchQuery]);

  // Auto-log search miss as a demand signal to backend (debounced 1s on settled zero-result state)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3 || filteredTrendGraphs.length > 0) return;

    const term = q.toLowerCase();
    if (loggedMissesRef.current.has(term)) return;

    const timer = setTimeout(() => {
      loggedMissesRef.current.add(term);

      fetch('/api/coverage/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchedTerm: q,
          source: 'search_miss',
          email: user?.email,
          accountId: account?.id
        })
      }).catch(err => console.warn('[CoverageMap] Search miss logging failed:', err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery, filteredTrendGraphs.length, user?.email, account?.id]);

  // Group trend graphs by Vertical (Domain)
  const verticalGroups = useMemo(() => {
    const groups: Record<string, { name: string; graphs: KnowledgeGraph[]; totalEvidence: number }> = {};

    filteredTrendGraphs.forEach(g => {
      const domainName = g.domain || g.verticalName || 'Other Verticals';
      if (!groups[domainName]) {
        groups[domainName] = { name: domainName, graphs: [], totalEvidence: 0 };
      }
      groups[domainName].graphs.push(g);
      const ev = g.evidence_count || (g as any).evidenceCount || 0;
      groups[domainName].totalEvidence += ev;
    });

    return Object.values(groups).sort((a, b) => b.totalEvidence - a.totalEvidence);
  }, [filteredTrendGraphs]);

  // Per-Vertical Depth Badge Helper (calibrated against real evidence node distribution)
  const getVerticalDepthBadge = (totalEvidence: number) => {
    if (totalEvidence >= 300) {
      return { label: 'Strong Coverage', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    }
    if (totalEvidence >= 50) {
      return { label: 'Partial Coverage', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    if (totalEvidence > 0) {
      return { label: 'Thin Coverage', color: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
    }
    return { label: 'Not Covered Today', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' };
  };

  // Freshness Marker Helper (checks if last_synced or last_updated is within 7 days)
  const isUpdatedThisWeek = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const diffMs = Date.now() - d.getTime();
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  // Submit Coverage Request (via button or pre-filled search miss)
  const handleSendRequest = async (topicToSend?: string) => {
    const term = (topicToSend || requestTopic || searchQuery).trim();
    if (!term) return;

    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/coverage/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: term,
          source: 'button',
          email: user?.email,
          accountId: account?.id
        })
      });

      const data = await res.json();
      if (data.ok) {
        showToast(`Coverage request for "${term}" submitted! Our research team has been notified.`);
        setRequestModalOpen(false);
        setRequestTopic('');
      } else {
        showToast(`Failed to submit request: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      showToast(`Error submitting request: ${err.message || err}`);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const isGraphDisabled = (id: string) => disabledGraphs.includes(id);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-white p-6 md:p-10 space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[300] bg-ink text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 animate-fade-in">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow text-brand">Domain Intelligence & Knowledge Index</span>
            <span className="text-xs text-ink-4">•</span>
            <span className="text-xs text-ink-3 font-mono">{validGraphs.length} Knowledge Graphs</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-ink">Coverage Map & Knowledge Index</h1>
          <p className="text-xs text-ink-3 mt-1 max-w-2xl leading-relaxed">
            <strong>What is Coverage?</strong> The Coverage Map is your complete directory of all active knowledge graphs, trend feeds, expert digital twins, and supplemental data sources connected to your account. It shows research depth (node counts) and update frequency for every domain. Click any graph card below to launch queries directly in the Test Bench.
          </p>
        </div>

        <button
          onClick={() => { setRequestTopic(searchQuery); setRequestModalOpen(true); }}
          className="px-5 py-2.5 bg-brand text-white font-bold text-xs rounded-xl shadow-lg hover:bg-brand-dark transition-all flex items-center gap-2 shrink-0 self-start md:self-auto uppercase tracking-wider"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Request Coverage
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by topic, keyword, domain, or curator..."
          className="w-full pl-11 pr-10 py-3 bg-cream border border-line rounded-2xl text-xs text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand shadow-sm font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs text-ink-4 hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {/* ZERO-RESULT SEARCH-MISS STATE */}
      {searchQuery && filteredTrendGraphs.length === 0 && (
        <div className="p-8 bg-paper border border-line rounded-3xl space-y-6 text-center max-w-2xl mx-auto my-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto text-xl font-bold">
            🔍
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
              Not Covered Today
            </span>
            <h3 className="text-lg font-serif italic text-ink">No graphs matched "{searchQuery}"</h3>
            <p className="text-xs text-ink-3 mt-1 leading-relaxed">
              We logged your search term <code className="bg-cream px-1.5 py-0.5 rounded font-mono text-ink">{searchQuery}</code> as a demand signal to prioritize our next ingestion cycle.
            </p>
          </div>

          {/* Adjacent Verticals */}
          {verticalGroups.length > 0 && (
            <div className="pt-2 border-t border-line text-left">
              <p className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-3 text-center">Available Adjacent Verticals</p>
              <div className="flex flex-wrap justify-center gap-2">
                {verticalGroups.slice(0, 4).map(v => (
                  <button
                    key={v.name}
                    onClick={() => setSearchQuery(v.name)}
                    className="px-3 py-1.5 bg-cream border border-line hover:border-brand rounded-xl text-xs text-ink font-medium transition-all"
                  >
                    {v.name} ({v.graphs.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => handleSendRequest(searchQuery)}
              disabled={submittingRequest}
              className="px-6 py-3 bg-brand text-white font-bold text-xs rounded-xl shadow-lg hover:bg-brand-dark disabled:opacity-50 transition-all uppercase tracking-wider"
            >
              {submittingRequest ? 'Submitting...' : `Submit Request for "${searchQuery}" →`}
            </button>
          </div>
        </div>
      )}

      {/* VERTICAL GROUPS */}
      {verticalGroups.length > 0 && (
        <section className="space-y-8">
          {verticalGroups.map(v => {
            const badge = getVerticalDepthBadge(v.totalEvidence);
            return (
              <div key={v.name} className="space-y-4">
                {/* Vertical Section Header */}
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-serif italic text-ink">{v.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${badge.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-ink-4">
                    {v.totalEvidence.toLocaleString()} total nodes • {v.graphs.length} {v.graphs.length === 1 ? 'graph' : 'graphs'}
                  </div>
                </div>

                {/* Graph Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {v.graphs.map(g => {
                    const disabled = isGraphDisabled(g.id);
                    const fresh = isUpdatedThisWeek(g.last_synced || g.last_updated);
                    const evCount = g.evidence_count || (g as any).evidenceCount || 0;
                    const trCount = g.trend_count || (g as any).trendCount || 0;

                    return (
                      <div
                        key={g.id}
                        onClick={() => onAskGraph?.(g.id)}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 group cursor-pointer ${
                          disabled
                            ? 'bg-paper/40 border-line/60 opacity-60'
                            : 'bg-white border-line hover:border-brand hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-ink truncate flex-1 group-hover:text-brand transition-colors">{g.name}</h3>
                            {fresh && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[8px] font-bold uppercase tracking-wider shrink-0">
                                Updated this week
                              </span>
                            )}
                          </div>
                          {(g.headline || g.description) && (
                            <p className="text-xs text-ink-3 line-clamp-2 leading-relaxed font-serif italic">
                              {g.headline || g.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-line-soft flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-mono text-ink-3">
                            <span><strong className="text-ink">{evCount}</strong> nodes</span>
                            <span>•</span>
                            <span><strong className="text-ink">{trCount}</strong> trends</span>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            {onAskGraph && (
                              <button
                                onClick={() => onAskGraph(g.id)}
                                className="px-2.5 py-1 bg-ink hover:bg-brand text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                              >
                                Ask →
                              </button>
                            )}
                            {onToggleGraph && (
                              <button
                                onClick={() => onToggleGraph(g.id)}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                  disabled
                                    ? 'bg-paper text-ink-4 border-line hover:text-ink'
                                    : 'bg-brand-soft text-brand border-brand/20 hover:bg-brand-softer'
                                }`}
                              >
                                {disabled ? 'Disabled' : 'Enabled'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* SUPPLEMENTAL DATA SOURCES SECTION */}
      {supplementalSources.length > 0 && !searchQuery && (
        <section className="pt-8 border-t border-line space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-serif italic text-ink">Supplemental Data & Institutional Sources</h2>
              <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[9px] font-bold uppercase tracking-wider">
                {supplementalSources.length} Institutional Sources
              </span>
            </div>
            <span className="text-[10px] font-mono text-ink-4">Counted separately from live trend graphs</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {supplementalSources.map(s => (
              <div
                key={s.id}
                onClick={() => onAskGraph?.(s.id)}
                className="p-4 bg-paper/60 border border-line rounded-xl space-y-2 hover:border-brand hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-ink truncate group-hover:text-brand transition-colors">{s.name}</h4>
                  {s.curator && <p className="text-[10px] text-ink-4 font-mono">Curator: {s.curator}</p>}
                  {(s.headline || s.description) && (
                    <p className="text-[11px] text-ink-3 line-clamp-1 italic font-serif">{s.headline || s.description}</p>
                  )}
                </div>
                {onAskGraph && (
                  <div className="pt-2 border-t border-line-soft flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAskGraph(s.id); }}
                      className="px-2.5 py-1 bg-ink hover:bg-brand text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    >
                      Ask →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REQUEST COVERAGE MODAL OVERLAY */}
      {requestModalOpen && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setRequestModalOpen(false)}
        >
          <div
            className="bg-white p-8 rounded-3xl border border-line shadow-2xl max-w-md w-full mx-4 space-y-6 animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            <header>
              <span className="eyebrow text-brand mb-1">Demand Signal</span>
              <h3 className="text-xl font-serif italic text-ink">Request Topic Coverage</h3>
              <p className="text-xs text-ink-3 mt-1">
                Tell our research team what industry vertical, report, or topic graph you need.
              </p>
            </header>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest">Requested Topic / Niche</label>
              <textarea
                value={requestTopic}
                onChange={e => setRequestTopic(e.target.value)}
                placeholder="e.g., Commercial Construction, EV Infrastructure, Luxury Fashion 2026..."
                className="w-full px-4 py-3 bg-cream border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-brand min-h-[90px] resize-y"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-ink-3 hover:text-ink font-serif italic"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendRequest()}
                disabled={submittingRequest || !requestTopic.trim()}
                className="px-6 py-2.5 bg-brand text-white font-bold text-xs rounded-xl shadow-md hover:bg-brand-dark disabled:opacity-40 transition-all uppercase tracking-wider"
              >
                {submittingRequest ? 'Submitting...' : 'Submit Request →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
