import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { KnowledgeGraph, CreatorAnalytics } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { GraphCard } from './GraphCard';

export type GraphCategory = 'domain' | 'expert' | 'industry_report' | 'supplemental' | 'user' | 'skill';

interface OwnedGraph {
  graph_id: string;
  name: string;
  status: string;
  curator: string;
  owner_email: string;
  trial?: {
    api_key: string;
    mcp_url: string;
    api_header: string;
    note: string;
    credits_remaining: number;
    credits_total: number;
  };
}

interface MyGraphsPageProps {
  graphs: KnowledgeGraph[];
  loading?: boolean;
  supplementalSources?: any[];
  userVertical?: string; // 'all', 'retail', 'beauty', 'fashion', 'design', etc.
  userEmail?: string; // Needed for persisting disabled graphs
  disabledGraphs?: string; // Comma-separated graph IDs from user record
  ownedGraphs?: OwnedGraph[];  // From GET /v1/graphs/mine
  accountId?: string; // Account ID for team graph queries
  mode?: 'personal' | 'team' | 'skills'; // 'personal' = My Graphs, 'team' = Team Graphs, 'skills' = My Skills
  onNavigate?: (view: string) => void; // Navigate to other views (e.g. create-graph)
}

const categoryLabels: Record<GraphCategory, { label: string; description: string; color: string }> = {
  domain: { 
    label: 'Domain Context', 
    description: 'Vertical-deep knowledge graphs by PSFK.', 
    color: 'text-purple-700 bg-purple-50 border-purple-200' 
  },
  expert: { 
    label: 'Expert Graphs', 
    description: 'Strategists, twins & synthetic specialists.', 
    color: 'text-violet-700 bg-violet-50 border-violet-200' 
  },
  industry_report: { 
    label: 'Industry Research', 
    description: 'Foddafied research & living graphs.', 
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200' 
  },
  supplemental: { 
    label: 'Supplemental Data', 
    description: 'Real-time institutional data. Included free — no API calls charged.', 
    color: 'text-teal-700 bg-teal-50 border-teal-200' 
  },
  user: { 
    label: 'Custom', 
    description: 'Graphs of your uploaded reports and linked research resources.', 
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200' 
  },
  skill: { 
    label: 'Skills', 
    description: 'Modular tools your AI can use.', 
    color: 'text-cyan-700 bg-cyan-50 border-cyan-200' 
  },
};

/**
 * Determine if a graph is accessible to the user based on their account vertical.
 */
function isGraphAccessibleForVertical(g: KnowledgeGraph, userVertical: string): boolean {
  if (!userVertical || userVertical.toLowerCase() === 'all') return true;
  const topics = (g.topics || []).map(t => t.toLowerCase());
  // Graphs with 'all' in topics are universal — accessible to every vertical
  if (topics.includes('all')) return true;
  return topics.includes(userVertical.toLowerCase());
}

/** Parse comma-separated disabled graph IDs into a Set */
function parseDisabledSet(disabledGraphs?: string): Set<string> {
  if (!disabledGraphs || !disabledGraphs.trim()) return new Set();
  return new Set(disabledGraphs.split(',').map(s => s.trim()).filter(Boolean));
}

interface TrendChartProps {
  dailyTrend: Array<{ date: string; count: number }>;
}

const TrendChart: React.FC<TrendChartProps> = ({ dailyTrend }) => {
  const width = 600;
  const height = 120;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const maxCount = Math.max(...dailyTrend.map(d => d.count), 0);
  const yMax = maxCount > 0 ? Math.ceil(maxCount * 1.15) : 5;
  
  const barWidth = dailyTrend.length > 0 ? Math.max(1, Math.floor(chartWidth / dailyTrend.length) - 3) : 10;
  
  const gridValues = [0, Math.round(yMax / 2), yMax];
  
  return (
    <div className="w-full">
      <svg className="w-full h-auto font-sans" viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {gridValues.map((val, idx) => {
          const y = height - paddingBottom - (val / yMax) * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#e6e3dd"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 5}
                y={y + 3}
                textAnchor="end"
                style={{ fontSize: '9px' }}
                className="font-mono fill-ink-3"
              >
                {val}
              </text>
            </g>
          );
        })}
        
        {/* Bars */}
        {dailyTrend.map((d, idx) => {
          const barHeight = yMax > 0 ? (d.count / yMax) * chartHeight : 0;
          const step = dailyTrend.length > 0 ? chartWidth / dailyTrend.length : 0;
          const x = paddingLeft + idx * step + 1.5;
          const y = height - paddingBottom - barHeight;
          const dateObj = new Date(d.date);
          const label = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
          
          const showLabel = idx % 7 === 0 || idx === dailyTrend.length - 1;
          
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1.5)}
                rx={2}
                className={`transition-all duration-300 ${
                  d.count > 0 ? 'fill-brand hover:fill-brand-dark' : 'fill-line-soft'
                }`}
              />
              <rect
                x={x - 1}
                y={paddingTop}
                width={barWidth + 2}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
              >
                <title>{`${d.date}: ${d.count} queries`}</title>
              </rect>
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={height - 5}
                  textAnchor="middle"
                  style={{ fontSize: '8px' }}
                  className="font-mono fill-ink-4"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const MyGraphsPage: React.FC<MyGraphsPageProps> = ({ graphs, loading, supplementalSources = [], userVertical = 'all', userEmail, disabledGraphs: disabledGraphsProp, ownedGraphs = [], accountId, mode = 'personal', onNavigate }) => {
  const isTeamMode = mode === 'team';
  const isSkillsMode = mode === 'skills';
  // Initialize toggle state from the server-persisted disabledGraphs
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => parseDisabledSet(disabledGraphsProp));
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeCategory, setActiveCategory] = useState<GraphCategory | 'all' | 'new'>('all');
  const [activeSubLevel, setActiveSubLevel] = useState<string>('All');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expandedGraphId, setExpandedGraphId] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Record<string, CreatorAnalytics>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});
  const [statsError, setStatsError] = useState<Record<string, string | null>>({});

  const handleToggleStats = useCallback(async (graphId: string) => {
    if (expandedGraphId === graphId) {
      setExpandedGraphId(null);
      return;
    }

    setExpandedGraphId(graphId);

    // Fetch stats if not already cached
    if (!statsCache[graphId]) {
      setStatsLoading(prev => ({ ...prev, [graphId]: true }));
      setStatsError(prev => ({ ...prev, [graphId]: null }));

      try {
        const res = await dataService.fetchCreatorAnalytics(graphId);
        if (res.ok && res.stats) {
          setStatsCache(prev => ({ ...prev, [graphId]: res.stats! }));
        } else {
          setStatsError(prev => ({ ...prev, [graphId]: res.error || "Failed to load stats" }));
        }
      } catch (err: any) {
        setStatsError(prev => ({ ...prev, [graphId]: err.message || "Failed to load stats" }));
      } finally {
        setStatsLoading(prev => ({ ...prev, [graphId]: false }));
      }
    }
  }, [expandedGraphId, statsCache]);

  const getSubLevels = (category: GraphCategory | 'all' | 'new') => {
    if (category === 'expert') return ['All', 'Human Agent', 'Synthetic Expert', 'Synthetic Executive'];
    if (category === 'industry_report') return ['All', 'Industry Report', 'Living Graph'];
    if (category === 'supplemental') return ['All', 'Economic Indicators', 'Market Data', 'Financial Reporting', 'Demand Signals', 'Demographic Context', 'Research Signals'];
    return [];
  };

  const handleCategoryChange = (cat: GraphCategory | 'all' | 'new') => {
    setActiveCategory(cat);
    setActiveSubLevel('All');
  };

  // Team submissions state
  const [teamSubmissions, setTeamSubmissions] = useState<any[]>([]);
  const [teamSubmissionsLoading, setTeamSubmissionsLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setTeamSubmissionsLoading(true);
    fetch(`/api/expert-graph/team-submissions?accountId=${encodeURIComponent(accountId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setTeamSubmissions(data.submissions || []);
      })
      .catch(() => {})
      .finally(() => setTeamSubmissionsLoading(false));
  }, [accountId]);

  // Debounced persist to Airtable
  const persistDisabledGraphs = useCallback((newSet: Set<string>) => {
    if (!userEmail) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavingStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      const csv = Array.from(newSet).join(',');
      const res = await dataService.updateDisabledGraphs(userEmail, csv);
      setSavingStatus(res.ok ? 'saved' : 'error');
      setTimeout(() => setSavingStatus('idle'), 2000);
    }, 600); // 600ms debounce
  }, [userEmail]);

  const toggleGraph = useCallback((id: string) => {
    setDisabledSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistDisabledGraphs(next);
      return next;
    });
  }, [persistDisabledGraphs]);

  /** Toggle ALL graphs in a group on or off */
  const toggleCategoryAll = useCallback((graphIds: string[], enable: boolean) => {
    setDisabledSet(prev => {
      const next = new Set(prev);
      graphIds.forEach(id => {
        if (enable) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      persistDisabledGraphs(next);
      return next;
    });
  }, [persistDisabledGraphs]);

  /** Disable graphs whose published_date is older than 90 days */
  const zapStaleGraphs = useCallback((graphList: KnowledgeGraph[]) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const staleIds = graphList
      .filter(g => {
        const pub = (g as any).published_date || (g as any).last_updated;
        if (!pub) return false;
        return new Date(pub).getTime() < cutoff;
      })
      .map(g => g.id);
    if (staleIds.length === 0) return;
    setDisabledSet(prev => {
      const next = new Set(prev);
      staleIds.forEach(id => next.add(id));
      persistDisabledGraphs(next);
      return next;
    });
  }, [persistDisabledGraphs]);

  /** Count stale graphs (published > 90 days ago) in a list */
  const countStale = useCallback((graphList: KnowledgeGraph[]): number => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return graphList.filter(g => {
      const pub = (g as any).published_date || (g as any).last_updated;
      if (!pub) return false;
      return new Date(pub).getTime() < cutoff;
    }).length;
  }, []);

  // Clipboard copy feedback state: key = 'mcp-<graphId>' or 'api-<graphId>'
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => {});
  }, []);

  /** Get credits bar color class based on remaining percentage */
  const getCreditsColor = (remaining: number, total: number): string => {
    if (total <= 0) return 'bg-zinc-600';
    const pct = remaining / total;
    if (pct > 0.5) return 'bg-green-500';
    if (pct >= 0.25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Mock Add Research Resource state
  const [showAddForm, setShowAddForm] = useState(false);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', apiKey: '', mcpUrl: '', type: 'url' as 'url' | 'mcp' });
  const [savedResources, setSavedResources] = useState<Array<{ name: string; url: string; apiKey?: string; type: string }>>(() => {
    try {
      const stored = localStorage.getItem('fodda_linked_research');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fodda_linked_research', JSON.stringify(savedResources));
    } catch {}
  }, [savedResources]);

  const visibleGraphs = useMemo(() =>
    graphs.filter(g => {
      const isSkill = (g.graph_type || '').toLowerCase().trim() === 'skill';
      if (isSkill) return true; // Skills bypass status check so draft/beta/coming_soon skills always show up
      const s = g.status || 'live';
      if (s === 'coming_soon' || (s as string) === 'coming-soon') return false;
      return s === 'live' || s === 'beta';
    }),
    [graphs]
  );

  // Group by graph_type from API — strictly use the API field, no heuristic
  const grouped = useMemo(() => {
    const groups: Record<GraphCategory, KnowledgeGraph[]> = { domain: [], expert: [], industry_report: [], supplemental: [], user: [], skill: [] };

    visibleGraphs.forEach(g => {
      const gt = (g.graph_type || '').toLowerCase().trim();
      if (gt === 'domain') groups.domain.push(g);
      else if (gt === 'industry_report' || gt === 'industry report') groups.industry_report.push(g);
      else if (gt === 'supplemental' || gt === 'baseline') groups.supplemental.push(g);
      else if (gt === 'user') groups.user.push(g);
      else if (gt === 'skill') groups.skill.push(g);
      else if (gt === 'expert') groups.expert.push(g);
      else groups.domain.push(g);
    });

    // Sort each category alphabetically by name
    const sortAlpha = (a: KnowledgeGraph, b: KnowledgeGraph) => a.name.localeCompare(b.name);
    Object.values(groups).forEach(arr => arr.sort(sortAlpha));

    return groups;
  }, [visibleGraphs]);



  const handleSaveResource = () => {
    if (!resourceForm.name || (!resourceForm.url && !resourceForm.mcpUrl)) return;
    setSavedResources(prev => [...prev, {
      name: resourceForm.name,
      url: resourceForm.type === 'mcp' ? resourceForm.mcpUrl : resourceForm.url,
      apiKey: resourceForm.apiKey || undefined,
      type: resourceForm.type
    }]);
    setResourceForm({ name: '', url: '', apiKey: '', mcpUrl: '', type: 'url' });
    setShowAddForm(false);
  };

  const handleDeleteResource = (index: number) => {
    setSavedResources(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };
  // "New" graphs — approved within the last 30 days (uses approved_date from Airtable)
  const NEW_DAYS = 30;
  const newCutoff = useMemo(() => Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000, []);
  const isNewGraph = useCallback((g: KnowledgeGraph): boolean => {
    const dateStr = g.approved_date || g.published_date;
    if (!dateStr) return false;
    try { return new Date(dateStr).getTime() >= newCutoff; } catch { return false; }
  }, [newCutoff]);
  const newGraphs = useMemo(() => visibleGraphs.filter(isNewGraph), [visibleGraphs, isNewGraph]);

  const newGrouped = useMemo(() => {
    const groups: Record<GraphCategory, KnowledgeGraph[]> = { domain: [], expert: [], industry_report: [], supplemental: [], user: [], skill: [] };
    newGraphs.forEach(g => {
      const gt = (g.graph_type || '').toLowerCase().trim();
      if (gt === 'domain') groups.domain.push(g);
      else if (gt === 'industry_report' || gt === 'industry report') groups.industry_report.push(g);
      else if (gt === 'supplemental' || gt === 'baseline') groups.supplemental.push(g);
      else if (gt === 'user') groups.user.push(g);
      else if (gt === 'skill') groups.skill.push(g);
      else if (gt === 'expert') groups.expert.push(g);
      else groups.domain.push(g);
    });
    const sortAlpha = (a: KnowledgeGraph, b: KnowledgeGraph) => a.name.localeCompare(b.name);
    Object.values(groups).forEach(arr => arr.sort(sortAlpha));
    return groups;
  }, [newGraphs]);

  // Utility for finding accessible and status states
  const getGraphStates = useCallback((g: KnowledgeGraph) => {
    const topicAccessible = isGraphAccessibleForVertical(g, userVertical);
    const isAccessible = g.accessible !== false && topicAccessible;
    const isEnabled = !disabledSet.has(g.id) && isAccessible;
    const isNew = isNewGraph(g);
    return { isAccessible, isEnabled, isNew };
  }, [userVertical, disabledSet, isNewGraph]);

  // Sort supplemental sources alphabetically
  const sortedSupplemental = useMemo(() =>
    [...supplementalSources].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')),
    [supplementalSources]
  );
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1">
            <h1 className="font-serif italic text-4xl font-normal text-ink tracking-tight mb-3">
              {isTeamMode ? 'Team Graphs.' : isSkillsMode ? 'Skills.' : 'My Graphs.'}
            </h1>
            <p className="text-sm text-ink-2 leading-relaxed max-w-xl">
              {isTeamMode
                ? 'Every knowledge graph available to your team — organized by what they are, curated by who. Toggle any row to include or exclude it from the next answer.'
                : isSkillsMode
                  ? 'Agentic skills that are applied during the Fodda workflow.'
                  : 'Every knowledge graph this workspace can reach — organized by what they are, curated by who. Toggle any row to include or exclude it from the next answer.'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {savingStatus === 'saving' && <span className="text-[9px] text-ink-3 animate-pulse font-mono">Saving...</span>}
              {savingStatus === 'saved' && <span className="text-[9px] text-green-600 font-mono">✓ Saved</span>}
              {savingStatus === 'error' && <span className="text-[9px] text-red-500 font-mono">Save failed</span>}
            </div>
            {userVertical && userVertical.toLowerCase() !== 'all' && (
              <p className="text-[10px] text-ink-3 mt-2">
                Your plan grants access to <span className="text-ink font-bold capitalize">{userVertical}</span> graphs. <span className="text-amber-600">Locked graphs</span> require a plan upgrade.
              </p>
            )}
          </div>
        </div>
        <div className="border-b border-line mt-6" />
      </div>

      {/* Category Pills Navigation */}
      {!isSkillsMode && (
        <div className="px-8 pb-4 pt-2 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button 
            onClick={() => handleCategoryChange('all')} 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap border ${activeCategory === 'all' ? 'bg-ink text-white border-ink' : 'bg-paper text-ink-3 border-line hover:text-ink hover:border-line-strong'}`}
          >
            All
          </button>
          {(['domain', 'expert', 'supplemental', 'industry_report', 'user', 'skill'] as GraphCategory[]).map(cat => (
            <button 
              key={cat}
              onClick={() => handleCategoryChange(cat)} 
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap border ${activeCategory === cat ? 'bg-ink text-white border-ink' : 'bg-paper text-ink-3 border-line hover:text-ink hover:border-line-strong'}`}
            >
              {categoryLabels[cat].label}
            </button>
          ))}
          {newGraphs.length > 0 && (
            <button
              onClick={() => handleCategoryChange('new')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 border ${activeCategory === 'new' ? 'bg-ink text-white border-ink' : 'bg-paper text-ink-3 border-line hover:text-ink hover:border-line-strong'}`}
            >
              New
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeCategory === 'new' ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand'}`}>{newGraphs.length}</span>
            </button>
          )}
        </div>

        {/* Sub-Level Pills Navigation */}
        {(() => {
          const subLevels = getSubLevels(activeCategory);
          if (subLevels.length === 0) return null;
          return (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {subLevels.map(sub => (
                <button 
                  key={sub}
                  onClick={() => setActiveSubLevel(sub)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap border ${activeSubLevel === sub || (activeSubLevel === 'all' && sub === 'All') ? 'bg-ink-3 text-white border-ink-3 shadow-inner' : 'bg-paper text-ink-3 border-line hover:text-ink hover:border-line-strong'}`}
                >
                  {sub}
                </button>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      <div className="px-8 pb-8 max-w-4xl space-y-8">

        {/* ═══ New — Graphs Approved in the Last 30 Days ═══ */}
        {(activeCategory === 'all' || activeCategory === 'new') && newGraphs.length > 0 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-[0.2em]">New</span>
                <span className="font-serif italic text-lg text-ink">Recently Added.</span>
              </div>
              <div className="border-l-2 border-brand/30 pl-4 mb-4">
                <p className="text-xs text-ink-3 italic">Approved in the last 30 days.</p>
              </div>
            </div>
            {(Object.keys(newGrouped) as GraphCategory[]).map(cat => {
              const catGraphs = newGrouped[cat];
              if (catGraphs.length === 0) return null;
              const { label, color } = categoryLabels[cat];
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${color}`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-ink-4 font-mono font-bold">({catGraphs.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {catGraphs.map(g => (
                      <GraphCard 
                        key={g.id} 
                        graph={g} 
                        {...getGraphStates(g)} 
                        userVertical={userVertical} 
                        onToggle={toggleGraph} 
                        formatDate={formatDate} 
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Your Graphs — Owned Expert Graphs Section ═══ */}
        {ownedGraphs.length > 0 && (activeCategory === 'all' || activeCategory === 'expert') && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-[0.2em]">Owned</span>
              <span className="font-serif italic text-lg text-ink">Your Graphs.</span>
            </div>
            <div className="border-l-2 border-amber-300 pl-4 mb-4">
              <p className="text-xs text-ink-3 italic">Graphs you own — share trial access with your network.</p>
            </div>
            <div className="space-y-3">
              {ownedGraphs.map((og) => {
                const isEnabled = !disabledSet.has(og.graph_id);
                const hasTrial = !!og.trial;
                const creditsRemaining = og.trial?.credits_remaining ?? 0;
                const creditsTotal = og.trial?.credits_total ?? 0;
                const creditsPct = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;

                return (
                  <div
                    key={og.graph_id}
                    className={`relative rounded-xl border transition-all overflow-hidden ${
                      isEnabled
                        ? 'bg-paper border-line shadow-sm'
                        : 'bg-cream border-line opacity-60'
                    }`}
                  >
                    {/* Top bar with name, badges, toggle */}
                    <div className="flex items-center justify-between p-4 pb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center text-amber-700 text-sm font-bold border border-amber-200 shrink-0">
                          {(og.curator || og.name || '?')[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-bold text-ink truncate">{og.name}</h4>
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                              Owner
                            </span>
                            {og.status === 'live' && <span className="flex items-center gap-1 text-[9px] font-bold text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Live</span>}
                            {og.status === 'beta' && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Beta</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] text-ink-3">Curator: <span className="text-ink-2">{og.curator}</span></span>
                            <span className="text-[9px] font-mono text-ink-4 bg-cream px-1.5 py-0.5 rounded border border-line">{og.graph_id}</span>
                          </div>
                        </div>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => toggleGraph(og.graph_id)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${isEnabled ? 'bg-brand' : 'bg-ink-5'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Trial Access Panel */}
                    {hasTrial && (
                      <div className="px-4 pb-4 pt-1 space-y-3">
                        {/* Credits Bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="w-full h-1.5 bg-line-soft rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${getCreditsColor(creditsRemaining, creditsTotal)}`}
                                style={{ width: `${Math.min(creditsPct, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-ink-3 whitespace-nowrap font-medium">
                            {creditsRemaining} of {creditsTotal} trial API calls remaining
                          </span>
                        </div>

                        {/* Copy Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          {/* MCP URL — Primary */}
                          <button
                            onClick={() => handleCopy(og.trial!.mcp_url, `mcp-${og.graph_id}`)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              copiedKey === `mcp-${og.graph_id}`
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-brand-soft text-brand border-brand/20 hover:bg-brand-softer hover:border-brand/40'
                            }`}
                          >
                            {copiedKey === `mcp-${og.graph_id}` ? (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied ✓</>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>Copy MCP URL</>
                            )}
                          </button>
                          {/* API Key — Secondary */}
                          <button
                            onClick={() => handleCopy(og.trial!.api_key, `api-${og.graph_id}`)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              copiedKey === `api-${og.graph_id}`
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-cream text-ink-3 border-line hover:bg-line-soft hover:text-ink-2'
                            }`}
                          >
                            {copiedKey === `api-${og.graph_id}` ? (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied ✓</>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>Copy API Key</>
                            )}
                          </button>
                          {/* View Stats Button */}
                          <button
                            onClick={() => handleToggleStats(og.graph_id)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                              expandedGraphId === og.graph_id
                                ? 'bg-ink text-white border-ink'
                                : 'bg-cream text-ink-3 border-line hover:bg-line-soft hover:text-ink-2'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {expandedGraphId === og.graph_id ? 'Hide Stats' : 'View Stats'}
                          </button>
                        </div>

                        {/* Sharing Tip */}
                        <p className="text-[10px] text-ink-3 italic">
                          Share this URL for trial access. Add <code className="text-ink-2 bg-cream px-1 py-0.5 rounded font-mono border border-line">&userId=email</code> to track who is using it.
                        </p>

                        {/* Inline Stats Dashboard Section */}
                        {expandedGraphId === og.graph_id && (
                          <div className="border-t border-line-soft mt-4 pt-4 space-y-4">
                            {statsLoading[og.graph_id] && (
                              <div className="flex flex-col items-center justify-center py-8 gap-2">
                                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                <span className="text-[10px] text-ink-3 font-mono">Loading analytics...</span>
                              </div>
                            )}

                            {statsError[og.graph_id] && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                                {statsError[og.graph_id]}
                              </div>
                            )}

                            {!statsLoading[og.graph_id] && !statsError[og.graph_id] && statsCache[og.graph_id] && (() => {
                              const stats = statsCache[og.graph_id];
                              const recentMisses = stats.recentQueries.filter(q => q.quality === 'MISS').length;
                              const missRate = stats.recentQueries.length > 0 ? Math.round((recentMisses / stats.recentQueries.length) * 100) : 0;
                              
                              return (
                                <div className="space-y-5">
                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-3 gap-2.5">
                                    <div className="bg-cream border border-line rounded-lg p-2.5">
                                      <div className="text-[9px] uppercase tracking-wider text-ink-3 font-mono font-bold mb-0.5">Queries (30d)</div>
                                      <div className="text-lg font-serif text-ink">{stats.totalQueries}</div>
                                    </div>
                                    <div className="bg-cream border border-line rounded-lg p-2.5">
                                      <div className="text-[9px] uppercase tracking-wider text-ink-3 font-mono font-bold mb-0.5">Unique Users</div>
                                      <div className="text-lg font-serif text-ink">{stats.uniqueUsers}</div>
                                    </div>
                                    <div className="bg-cream border border-line rounded-lg p-2.5">
                                      <div className="text-[9px] uppercase tracking-wider text-ink-3 font-mono font-bold mb-0.5">Recent Miss Rate</div>
                                      <div className="text-lg font-serif text-ink">{missRate}%</div>
                                    </div>
                                  </div>

                                  {/* Daily Trend SVG Chart */}
                                  <div className="bg-cream border border-line rounded-lg p-3">
                                    <div className="text-[10px] font-bold text-ink mb-2.5 font-mono uppercase tracking-wider">Query Volume Trend (Last 30 Days)</div>
                                    <TrendChart dailyTrend={stats.dailyTrend} />
                                  </div>

                                  {/* Split View */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {/* Recent Queries */}
                                    <div className="bg-cream border border-line rounded-lg p-3 flex flex-col max-h-[280px]">
                                      <div className="text-[10px] font-bold text-ink mb-2 font-mono uppercase tracking-wider">Recent Queries</div>
                                      <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                          <thead>
                                            <tr className="border-b border-line text-[9px] text-ink-3 uppercase tracking-wider">
                                              <th className="pb-1 font-mono font-bold">Query</th>
                                              <th className="pb-1 font-mono font-bold text-right">Quality</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-line-soft">
                                            {stats.recentQueries.length === 0 ? (
                                              <tr>
                                                <td colSpan={2} className="py-4 text-[11px] text-ink-3 text-center italic">No queries yet</td>
                                              </tr>
                                            ) : (
                                              stats.recentQueries.map((q, idx) => (
                                                <tr key={idx} className="text-[11px]">
                                                  <td className="py-2 pr-2 font-medium text-ink break-words max-w-[150px]" title={q.query}>{q.query}</td>
                                                  <td className="py-2 text-right whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                      q.quality === 'STRONG' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                      q.quality === 'WEAK' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                      'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>{q.quality}</span>
                                                  </td>
                                                </tr>
                                              ))
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Top Audience */}
                                    <div className="bg-cream border border-line rounded-lg p-3 flex flex-col max-h-[280px]">
                                      <div className="text-[10px] font-bold text-ink mb-2 font-mono uppercase tracking-wider">Top Audience</div>
                                      <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                          <thead>
                                            <tr className="border-b border-line text-[9px] text-ink-3 uppercase tracking-wider">
                                              <th className="pb-1 font-mono font-bold">User (Masked)</th>
                                              <th className="pb-1 font-mono font-bold text-right">Queries</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-line-soft">
                                            {stats.topUsers.length === 0 ? (
                                              <tr>
                                                <td colSpan={2} className="py-4 text-[11px] text-ink-3 text-center italic">No audience activity yet</td>
                                              </tr>
                                            ) : (
                                              stats.topUsers.slice(0, 10).map((u, idx) => (
                                                <tr key={idx} className="text-[11px]">
                                                  <td className="py-2 pr-2 font-mono text-ink-2 truncate max-w-[140px]" title={u.email}>{u.email}</td>
                                                  <td className="py-2 text-right text-ink font-bold">{u.count}</td>
                                                </tr>
                                              ))
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-3 p-4 bg-cream border border-line rounded-xl animate-pulse">
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-ink-3">Loading graph catalog...</span>
          </div>
        )}

        {/* Graph Categories — Domain, Expert, Industry Papers, Skill (not User — handled separately in Custom) */}
        {(['domain', 'expert', 'industry_report', 'skill'] as GraphCategory[]).map(cat => {
          if (activeCategory === 'new' || (activeCategory !== 'all' && activeCategory !== cat)) return null;
          let catGraphs = grouped[cat];
          if (activeCategory === cat && activeSubLevel !== 'All' && activeSubLevel !== 'all') {
             catGraphs = catGraphs.filter(g => ((g as any).graph_sub_type || '').toLowerCase() === activeSubLevel.toLowerCase());
          }
          if (catGraphs.length === 0) return null;
          const { label, description, color } = categoryLabels[cat];
          const catIds = catGraphs.map(g => g.id);
          const allEnabled = catIds.every(id => !disabledSet.has(id));
          const staleCount = countStale(catGraphs);

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-[0.2em]">{label}</span>
                  <span className="text-[9px] font-mono text-ink-4">{String(catGraphs.length).padStart(2, '0')}</span>
                  <span className="font-serif italic text-lg text-ink">{label}.</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Zap Stale button */}
                  {staleCount > 0 && (
                    <button
                      onClick={() => zapStaleGraphs(catGraphs)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300"
                      title={`Disable ${staleCount} graph${staleCount > 1 ? 's' : ''} published over 90 days ago`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Zap {staleCount} Stale
                    </button>
                  )}
                  {/* Group toggle */}
                  <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">All</span>
                  <button
                    onClick={() => toggleCategoryAll(catIds, !allEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${allEnabled ? 'bg-brand' : 'bg-ink-5'}`}
                    title={allEnabled ? `Disable all ${label}` : `Enable all ${label}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${allEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              
              {/* Sub-level Pills */}
              {(() => {
                const catSubLevels = activeCategory === cat ? getSubLevels(cat) : [];
                if (catSubLevels.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {catSubLevels.map(sub => (
                      <button 
                        key={sub}
                        onClick={() => setActiveSubLevel(sub)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${activeSubLevel === sub || (activeSubLevel === 'all' && sub === 'All') ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-3 border-line hover:border-ink-2'}`}
                      >{sub}</button>
                    ))}
                  </div>
                );
              })()}

              <div className="border-l-2 border-line-strong pl-4 mb-4">
                <p className="text-xs text-ink-3 italic">{description}</p>
              </div>
              <div className="space-y-1.5">
                {catGraphs.map(g => (
                  <GraphCard 
                    key={g.id} 
                    graph={g} 
                    {...getGraphStates(g)} 
                    userVertical={userVertical} 
                    onToggle={toggleGraph} 
                    formatDate={formatDate} 
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* ═══ Custom Section — User Reports + Linked Research ═══ */}
        {activeCategory !== 'new' && (activeCategory === 'all' || activeCategory === 'user') && (activeCategory === 'user' || grouped.user.length > 0 || savedResources.length > 0 || showAddForm) && (() => {
          const customIds = grouped.user.map(g => g.id);
          const customAllEnabled = customIds.length > 0 && customIds.every(id => !disabledSet.has(id));
          const customStaleCount = countStale(grouped.user);
          return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-[0.2em]">Custom</span>
                <span className="font-serif italic text-lg text-ink">{categoryLabels.user.label}.</span>
              </div>
              {customIds.length > 0 && (
                <div className="flex items-center gap-2">
                  {customStaleCount > 0 && (
                    <button
                      onClick={() => zapStaleGraphs(grouped.user)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Zap {customStaleCount} Stale
                    </button>
                  )}
                  <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">All</span>
                  <button
                    onClick={() => toggleCategoryAll(customIds, !customAllEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${customAllEnabled ? 'bg-brand' : 'bg-ink-5'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${customAllEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
            </div>
            <div className="border-l-2 border-line-strong pl-4 mb-4">
              <p className="text-xs text-ink-3 italic">{categoryLabels.user.description}</p>
            </div>

            <div className="space-y-6">
              {/* Sub-section: User Reports — graphs added through the pipeline */}
              {grouped.user.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                    <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    User Reports
                    <span className="text-[9px] text-ink-4 font-normal normal-case">— uploaded through the graph pipeline</span>
                  </h4>
                  <div className="space-y-2">
                    {grouped.user.map(g => (
                      <GraphCard 
                        key={g.id} 
                        graph={g} 
                        {...getGraphStates(g)} 
                        userVertical={userVertical} 
                        onToggle={toggleGraph} 
                        formatDate={formatDate} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-section: Team Reports — graphs shared by teammates */}
              {(() => {
                // In personal mode, filter out user's own submissions (shown in User Reports above)
                const displaySubmissions = isTeamMode
                  ? teamSubmissions
                  : teamSubmissions.filter(s => s.ownerId !== userEmail);

                if (displaySubmissions.length === 0 && !teamSubmissionsLoading) return null;

                return (
                  <div>
                    <h4 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Team Reports
                      <span className="text-[9px] text-ink-4 font-normal normal-case">— shared by team members</span>
                    </h4>
                    {teamSubmissionsLoading ? (
                      <p className="text-xs text-ink-3 animate-pulse">Loading team graphs...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {displaySubmissions.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-line bg-paper transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-sm font-bold text-ink truncate">{s.graphName}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  s.status === 'active' || s.status === 'live' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : s.status === 'pending_review' || s.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-cream text-ink-3 border border-line'
                                }`}>{
                                  s.status === 'pending_review' ? 'Pending'
                                  : s.status === 'active' || s.status === 'live' ? 'Live'
                                  : s.status
                                }</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200">Team</span>
                              </div>
                              <p className="text-[10px] text-ink-3">{s.description || s.graphSlug} · by {s.creator || s.ownerId}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sub-section: Linked Research — API/MCP connected resources */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.15em] flex items-center gap-2">
                    <svg className="w-3 h-3 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Linked Research
                    <span className="text-[9px] text-ink-4 font-normal normal-case">— external sources connected via API or MCP</span>
                  </h4>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100 hover:border-teal-300 flex items-center gap-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add
                  </button>
                </div>

                {/* Add Research Resource Form */}
                {showAddForm && (
                  <div className="bg-paper border border-line rounded-xl p-6 mb-3">
                    <h3 className="text-sm font-bold text-ink mb-4">Add a Research Resource</h3>
                    <p className="text-xs text-ink-3 mb-4">Connect a new data source via URL & API Key or MCP endpoint.</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">Resource Name</label>
                        <input type="text" value={resourceForm.name} onChange={e => setResourceForm({ ...resourceForm, name: e.target.value })} placeholder="e.g., McKinsey Retail Insights" className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setResourceForm({ ...resourceForm, type: 'url' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${resourceForm.type === 'url' ? 'bg-brand-soft text-brand border-brand/30' : 'text-ink-3 border-line hover:border-line-strong'}`}>URL + API Key</button>
                        <button onClick={() => setResourceForm({ ...resourceForm, type: 'mcp' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${resourceForm.type === 'mcp' ? 'bg-brand-soft text-brand border-brand/30' : 'text-ink-3 border-line hover:border-line-strong'}`}>MCP URL</button>
                      </div>
                      {resourceForm.type === 'url' ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">Endpoint URL</label>
                            <input type="url" value={resourceForm.url} onChange={e => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://api.example.com/v1/data" className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">API Key</label>
                            <input type="password" value={resourceForm.apiKey} onChange={e => setResourceForm({ ...resourceForm, apiKey: e.target.value })} placeholder="sk-..." className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">MCP Server URL</label>
                            <input type="url" value={resourceForm.mcpUrl} onChange={e => setResourceForm({ ...resourceForm, mcpUrl: e.target.value })} placeholder="https://mcp.example.com/sse" className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">API Key / Access Token (Optional)</label>
                            <input type="password" value={resourceForm.apiKey} onChange={e => setResourceForm({ ...resourceForm, apiKey: e.target.value })} placeholder="Optional token" className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-ink-3 text-sm font-medium hover:text-ink">Cancel</button>
                        <button onClick={handleSaveResource} className="px-5 py-2 bg-brand text-white font-bold text-xs rounded-lg hover:bg-brand-dark">Save Resource</button>
                      </div>
                    </div>
                    <p className="text-[10px] text-ink-4 italic mt-3">This is a preview feature. Resources saved here will be stored locally for now.</p>
                  </div>
                )}

                {/* Saved Linked Research Resources */}
                {savedResources.length > 0 && (
                  <div className="space-y-1.5">
                    {savedResources.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-paper border-line">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${r.type === 'mcp' ? 'bg-purple-50 text-brand border-brand/20' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                            {r.name[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-sm font-bold text-ink truncate">{r.name}</h4>
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded ${r.type === 'mcp' ? 'bg-brand-soft text-brand border border-brand/20' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>{r.type === 'mcp' ? 'MCP' : 'API'}</span>
                            </div>
                            <span className="text-[10px] text-ink-4 font-mono truncate block">{r.url}</span>
                            {r.apiKey && (
                              <span className="text-[9px] text-ink-3 mt-0.5 block font-mono">Key: ••••••••</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] text-amber-600 font-bold uppercase">Pending</span>
                          <button
                            onClick={() => handleDeleteResource(i)}
                            className="p-1.5 text-ink-4 hover:text-red-500 transition-colors rounded hover:bg-red-50/50"
                            title="Delete resource"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state for Linked Research when no resources and form is closed */}
                {savedResources.length === 0 && !showAddForm && (
                  <div className="p-4 rounded-xl border border-dashed border-line text-center">
                    <p className="text-xs text-ink-3">No linked research resources yet. Click <span className="text-teal-700 font-bold">+ Add</span> to connect an external data source.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );})()}

        {/* Supplemental Data — graphs with graph_type 'supplemental'/'baseline' + institutional sources */}
        {activeCategory !== 'new' && (activeCategory === 'all' || activeCategory === 'supplemental') && (() => {
          let catGraphs = grouped.supplemental;
          if (activeCategory === 'supplemental' && activeSubLevel !== 'All' && activeSubLevel !== 'all') {
             catGraphs = catGraphs.filter(g => ((g as any).graph_sub_type || '').toLowerCase() === activeSubLevel.toLowerCase());
          }
          const hasSupplemental = catGraphs.length > 0 || sortedSupplemental.length > 0;
          if (!hasSupplemental) return null;

          const suppIds = catGraphs.map(g => g.id);
          const suppAllEnabled = suppIds.length > 0 && suppIds.every(id => !disabledSet.has(id));
          return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold text-ink-3 uppercase tracking-[0.2em]">Supplemental</span>
                <span className="font-serif italic text-lg text-ink">Supplemental.</span>
              </div>
              {suppIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">All</span>
                  <button
                    onClick={() => toggleCategoryAll(suppIds, !suppAllEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${suppAllEnabled ? 'bg-brand' : 'bg-ink-5'}`}
                    title={suppAllEnabled ? 'Disable all Institutional' : 'Enable all Institutional'}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${suppAllEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
            </div>
            <div className="border-l-2 border-line-strong pl-4 mb-4">
              <p className="text-xs text-ink-3 italic">{categoryLabels.supplemental.description}</p>
            </div>
            <div className="space-y-2">
              {/* Graphs with graph_type supplemental/baseline */}
              {grouped.supplemental.map(g => (
                <GraphCard 
                  key={g.id} 
                  graph={g} 
                  {...getGraphStates(g)} 
                  userVertical={userVertical} 
                  onToggle={toggleGraph} 
                  formatDate={formatDate} 
                />
              ))}

              {/* Institutional data sources from supplemental_sources API array */}
              {sortedSupplemental.map((s: any) => (
                <div key={s.source_id || s.name} className="flex items-center justify-between p-4 rounded-lg border bg-paper border-line">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 text-xs font-bold border border-cyan-200 shrink-0">
                      {(s.name || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-bold text-ink truncate">{s.name}</h4>
                        <span className="text-[9px] font-mono text-ink-4 bg-cream px-1.5 py-0.5 rounded border border-line">{s.source_id || s.id}</span>
                      </div>
                      <p className="text-xs text-ink-3 italic">{s.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] text-ink-3">Source: <span className="text-ink-2">{s.provider || s.owner}</span></span>
                        {s.update_frequency && <span className="text-[9px] text-ink-3">{s.update_frequency}</span>}
                        <span className="flex items-center gap-1 text-[9px] text-green-600 font-bold uppercase"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Available</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Fallback institutional data if API didn't return supplemental_sources */}
              {sortedSupplemental.length === 0 && grouped.supplemental.length === 0 && (
                <>
                  {[
                    { id: 'census_retail', name: 'US Census Retail Sales Indicators', headline: 'Monthly retail sales and economic indicators', owner: 'US Census Bureau', freq: 'Monthly' },
                    { id: 'census_demographics', name: 'US Census Demographics & Economics', headline: 'Annual demographic, economic, education, and housing data', owner: 'US Census Bureau', freq: 'Annual' },
                    { id: 'fred_economic', name: 'FRED Economic Indicators', headline: 'Key US economic indicators from the Federal Reserve', owner: 'Federal Reserve', freq: 'Daily' },
                    { id: 'wikipedia_pageviews', name: 'Wikipedia Cultural Attention Tracker', headline: 'Daily pageview data for any Wikipedia article', owner: 'Wikimedia', freq: 'Daily' },
                    { id: 'worldbank_global', name: 'World Bank Global Economics', headline: 'Economic and development indicators across 189 countries', owner: 'World Bank', freq: 'Annual' },
                    { id: 'openfda_safety', name: 'openFDA Ingredient & Product Safety', headline: 'FDA adverse event reports, product recalls, and enforcement actions', owner: 'FDA', freq: 'Weekly' },
                    { id: 'clinical_trials', name: 'ClinicalTrials.gov Research Tracker', headline: 'Track clinical trial activity for any ingredient, condition, or intervention', owner: 'National Library of Medicine', freq: 'Daily' },
                    { id: 'bls_economic', name: 'BLS Labor & Price Statistics', headline: 'Consumer Price Index (CPI), employment, and average wages', owner: 'US Bureau of Labor Statistics', freq: 'Monthly' },
                    { id: 'bea_spending', name: 'BEA Consumer Spending Breakdowns', headline: 'Personal Consumption Expenditure (PCE) data broken down by category', owner: 'US Bureau of Economic Analysis', freq: 'Quarterly' },
                    { id: 'pubmed_research', name: 'PubMed Scientific Literature Tracker', headline: 'Scientific publication trends for ingredients, health topics, and interventions', owner: 'National Library of Medicine', freq: 'Daily' },
                    { id: 'cdc_health', name: 'CDC Health & Wellness Data', headline: 'Health behavior, chronic disease, and wellness data', owner: 'CDC', freq: 'Annual' },
                    { id: 'pew_survey', name: 'Pew Research Survey Data', headline: 'Behavioral and attitudinal survey data', owner: 'Pew Research Center', freq: 'Annual' },
                    { id: 'wto_trade', name: 'WTO International Trade Statistics', headline: 'Merchandise trade values, services trade, and tariff rates', owner: 'World Trade Organization', freq: 'Annual' },
                    { id: 'openfoodfacts_products', name: 'Open Food Facts Product Database', headline: 'Crowdsourced global product database with ingredient composition', owner: 'Open Food Facts', freq: 'Daily' },
                    { id: 'ridb_recreation', name: 'Recreation.gov RIDB', headline: 'US federal recreation areas, facilities, and activities', owner: 'US Federal Government', freq: 'Weekly' },
                    { id: 'osm_locations', name: 'OpenStreetMap Commerce Infrastructure', headline: 'Global retail and commercial location data', owner: 'OpenStreetMap', freq: 'Daily' },
                    { id: 'google_trends', name: 'Google Trends Demand Signals', headline: 'Relative search interest data over time', owner: 'Google Trends', freq: 'Daily' },
                    { id: 'amazon_products', name: 'Amazon Product & Pricing Reality', headline: 'Real-time product listings, pricing, and brand distribution', owner: 'Amazon', freq: 'Daily' },
                    { id: 'oecd_economic', name: 'OECD Economic Indicators', headline: 'Key short-term economic indicators across 38 OECD member countries', owner: 'OECD', freq: 'Monthly' },
                    { id: 'openalex_research', name: 'OpenAlex Academic Research Tracker', headline: 'Academic publication trends across ALL scholarly disciplines', owner: "OpenAlex", freq: "Daily" },
                    { id: "s2_research", name: "Semantic Scholar Research Influence", headline: "Citation influence analysis across 200M+ academic papers", owner: "Semantic Scholar", freq: "Daily" },
                    { id: "apisports_football", name: "API-Sports Football & Multi-Sport Data", headline: "Real-time sports structure data covering global leagues", owner: "API-Sports", freq: "Daily" },
                    { id: "ticketmaster_events", name: "Ticketmaster Live Event Discovery", headline: "Live event, venue, and attraction data", owner: "Ticketmaster", freq: "Daily" },
                    { id: "youtube_attention", name: "YouTube Cultural Attention Tracker", headline: "Video and channel attention signals from YouTube", owner: "YouTube", freq: "Daily" },
                    { id: 'usda_ers', name: 'USDA ERS Food Economics', headline: 'Food prices, expenditure, and environment indicators', owner: 'USDA ERS', freq: 'Monthly' },
                    { id: 'usda_nass', name: 'USDA NASS Agricultural Production', headline: 'Crop production, livestock, and commodity statistics', owner: 'USDA NASS', freq: 'Daily' },
                    { id: 'usda_fdc', name: 'USDA FoodData Central Nutrition', headline: 'Nutritional data and food ingredient composition', owner: 'USDA', freq: 'Daily' },
                    { id: 'usda_ams', name: 'USDA AMS Commodity Market Reports', headline: 'Commodity pricing, terminal market reports, and wholesale data', owner: 'USDA AMS', freq: 'Daily' }
                  ].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border bg-paper border-line">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 text-xs font-bold border border-cyan-200 shrink-0">
                          {s.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-bold text-ink truncate">{s.name}</h4>
                            <span className="text-[9px] font-mono text-ink-4 bg-cream px-1.5 py-0.5 rounded border border-line">{s.id}</span>
                          </div>
                          <p className="text-xs text-ink-3 italic">{s.headline}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[9px] text-ink-3">Source: <span className="text-ink-2">{s.owner}</span></span>
                            <span className="text-[9px] text-ink-3">{s.freq}</span>
                            <span className="flex items-center gap-1 text-[9px] text-green-600 font-bold uppercase"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Available</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );})()}
      </div>
    </div>
  );
};
