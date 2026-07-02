import React from 'react';
import { KnowledgeGraph } from '../../shared/types';

interface GraphCardProps {
  graph: KnowledgeGraph;
  userVertical: string;
  isEnabled: boolean;
  isAccessible: boolean;
  isNew: boolean;
  onToggle: (id: string) => void;
  formatDate: (date?: string) => string | null;
}

export const GraphCard: React.FC<GraphCardProps> = ({
  graph: g,
  userVertical,
  isEnabled,
  isAccessible,
  isNew,
  onToggle,
  formatDate
}) => {
  const isBeta = g.status === 'beta';
  const isSkill = g.graph_type === 'skill';

  // ── Status dot ────────────────────────────────────────────
  const dotColor = !isAccessible
    ? 'bg-ink-4'
    : g.status === 'live'
    ? 'bg-green-500'
    : g.status === 'coming_soon'
    ? 'bg-amber-500'
    : g.status === 'beta'
    ? 'bg-blue-500'
    : 'bg-ink-4';

  // Format "Updated X ago" for compact display
  const formattedUpdate = g.last_updated ? formatDate(g.last_updated) : null;

  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-lg border transition-all group ${
      !isAccessible
        ? 'bg-paper border-line opacity-50'
        : isSkill && isEnabled
        ? 'bg-purple-50/30 border-purple-200 hover:border-purple-300 hover:shadow-sm'
        : isSkill
        ? 'bg-cream border-purple-100 opacity-60'
        : isEnabled
        ? 'bg-paper border-line hover:border-brand/20 hover:shadow-sm'
        : 'bg-cream border-line opacity-60'
    }`}>
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

      {/* Name — Curator */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <h4 className={`text-sm font-semibold tracking-tight truncate ${!isAccessible ? 'text-ink-3' : 'text-ink'}`}>
          {g.name}
          {g.curator && <span className="text-ink-3 font-normal"> — {g.curator}</span>}
        </h4>
      </div>

      {/* BY label */}
      {g.curator && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">BY</span>
          <span className="text-[11px] text-ink-3">{g.curator}</span>
        </div>
      )}

      {/* Category abbreviation */}
      {g.graph_type && !isSkill && (
        <span className="hidden lg:inline text-[9px] font-mono text-ink-4 uppercase tracking-wider shrink-0">
          {g.graph_type === 'industry_report' ? 'Ind.' : g.graph_type === 'supplemental' ? 'Supp.' : g.graph_type === 'domain' ? 'Dom.' : g.graph_type === 'expert' ? 'Exp.' : g.graph_type.charAt(0).toUpperCase() + '.'}
        </span>
      )}

      {/* Nodes count */}
      {(g.trend_count !== undefined && g.trend_count > 0) && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">Nodes</span>
          <span className="text-[11px] font-mono font-bold text-ink-2">{g.trend_count.toLocaleString()}</span>
        </div>
      )}

      {/* Updated timestamp */}
      {formattedUpdate && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-bold text-ink-4 uppercase tracking-widest">Updated</span>
          <span className="text-[11px] font-mono text-ink-3">{formattedUpdate}</span>
        </div>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {g.graph_type === 'expert' && g.graph_sub_type && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
            g.graph_sub_type === 'Human Agent'
              ? 'text-violet-700 bg-violet-50 border-violet-200'
              : g.graph_sub_type === 'Synthetic Executive'
              ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
              : 'text-purple-700 bg-purple-50 border-purple-200'
          }`}>
            {g.graph_sub_type}
          </span>
        )}
        {isSkill && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase tracking-wider" title={g.description || 'Agentic skill'}>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Skill
          </span>
        )}
        {isSkill && (
          <span className="text-[9px] font-mono text-ink-4" title="Each skill invocation costs 2 API calls">
            2 API calls/use
          </span>
        )}
        {isNew && (
          <span className="text-[9px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded border border-brand/20 uppercase tracking-wider">
            New
          </span>
        )}
        {isBeta && (
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
            Beta
          </span>
        )}
        {!isAccessible && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            Upgrade
          </span>
        )}
      </div>

      {/* Toggle */}
      {isAccessible ? (
        <button
          onClick={() => onToggle(g.id)}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${isEnabled ? 'bg-brand' : 'bg-ink-5'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      ) : (
        <div className="relative w-10 h-5 rounded-full bg-ink-5 cursor-not-allowed opacity-50 shrink-0">
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-ink-4 rounded-full shadow" />
        </div>
      )}
    </div>
  );
};
