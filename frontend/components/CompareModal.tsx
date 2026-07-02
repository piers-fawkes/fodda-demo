import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Vertical, RetrievalResult, ReasoningMode } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────

interface CompareColumn {
  mode: ReasoningMode;
  label: string;
  color: string;
  colorBg: string;
  answer: string;
  suggestedQuestions: string[];
  trendCount: number;
  articleCount: number;
  status: 'idle' | 'loading' | 'done' | 'error';
  durationMs: number;
  error?: string;
}

export interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  vertical: Vertical;
  onUseResponse: (mode: ReasoningMode, answer: string) => void;
  onRunCompare: (query: string) => void;
  columns: CompareColumn[];
  lastQuery?: string;
}

// ── Skeleton Shimmer ──────────────────────────────────────────────────

const ColumnSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-3 pt-4">
    <div className="h-3.5 w-full rounded-lg bg-line-soft" />
    <div className="h-3.5 w-[92%] rounded-lg bg-line-soft" style={{ animationDelay: '0.15s' }} />
    <div className="h-3.5 w-[78%] rounded-lg bg-line-soft" style={{ animationDelay: '0.3s' }} />
    <div className="h-3.5 w-[85%] rounded-lg bg-line-soft" style={{ animationDelay: '0.45s' }} />
    <div className="h-3.5 w-[60%] rounded-lg bg-line-soft" style={{ animationDelay: '0.6s' }} />
    <div className="h-3.5 w-[90%] rounded-lg bg-line-soft" style={{ animationDelay: '0.75s' }} />
    <div className="h-3.5 w-[45%] rounded-lg bg-line-soft" style={{ animationDelay: '0.9s' }} />
  </div>
);

// ── Single Column ─────────────────────────────────────────────────────

const CompareColumnView: React.FC<{
  col: CompareColumn;
  onUse: () => void;
  isOnly?: boolean;
}> = ({ col, onUse, isOnly }) => {
  return (
    <div className={`flex flex-col h-full border-r border-line last:border-r-0 ${isOnly ? 'w-full' : ''}`}>
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-line bg-paper shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${col.color === 'emerald' ? 'bg-emerald-500' : col.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-bold text-ink">{col.label}</span>
            <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
              col.color === 'emerald' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
              col.color === 'blue' ? 'text-blue-700 border-blue-200 bg-blue-50' :
              'text-amber-700 border-amber-200 bg-amber-50'
            }`}>
              {col.mode === 'graph' ? 'GRAPH' : col.mode === 'gemini' ? 'GEMINI' : 'BLEND'}
            </span>
          </div>
          {col.status === 'done' && (
            <span className="text-[9px] font-mono text-ink-4">
              {(col.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {col.status === 'loading' && (
            <div className="w-3 h-3 border border-line-strong border-t-brand rounded-full animate-spin" />
          )}
        </div>
        {col.status === 'done' && (col.trendCount > 0 || col.articleCount > 0) && (
          <div className="flex items-center gap-3 mt-1.5">
            {col.trendCount > 0 && (
              <span className="text-[9px] font-mono text-ink-3">
                <span className="text-ink font-bold">{col.trendCount}</span> trends
              </span>
            )}
            {col.articleCount > 0 && (
              <span className="text-[9px] font-mono text-ink-3">
                <span className="text-ink font-bold">{col.articleCount}</span> signals
              </span>
            )}
          </div>
        )}
      </div>

      {/* Column Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide bg-white">
        {col.status === 'idle' && (
          <div className="flex items-center justify-center h-full text-ink-4 text-xs font-mono">
            Waiting…
          </div>
        )}
        {col.status === 'loading' && <ColumnSkeleton />}
        {col.status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-red-500 text-sm font-bold italic">⚠ Error</span>
            <span className="text-[10px] text-ink-3 font-mono max-w-[200px]">{col.error}</span>
          </div>
        )}
        {col.status === 'done' && (
          <div className="prose prose-sm max-w-none
            prose-p:font-sans prose-p:text-ink-2 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-[14px]
            prose-li:text-ink-2 prose-li:leading-relaxed prose-li:mb-2 prose-li:text-[14px]
            prose-ul:my-4 prose-ul:pl-5
            prose-strong:text-ink prose-strong:font-bold
            prose-headings:text-ink prose-headings:font-serif prose-headings:italic
            prose-h1:font-mono prose-h1:text-[10px] prose-h1:font-bold prose-h1:text-ink-3 prose-h1:uppercase prose-h1:tracking-[0.2em] prose-h1:mt-8 prose-h1:mb-3 prose-h1:border-b prose-h1:border-line prose-h1:pb-1.5
            prose-h2:text-[18px] prose-h2:font-bold prose-h2:tracking-tight prose-h2:mt-6 prose-h2:mb-3 prose-h2:leading-snug
            prose-h3:text-[15px] prose-h3:font-bold prose-h3:text-ink-2 prose-h3:tracking-tight prose-h3:mt-4 prose-h3:mb-2 prose-h3:leading-snug
            prose-a:text-brand prose-a:underline prose-a:font-bold
            marker:text-line-strong"
          >
            <ReactMarkdown>{col.answer}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Column Footer */}
      {col.status === 'done' && (
        <div className="px-4 py-3 border-t border-line bg-paper shrink-0">
          <button
            onClick={onUse}
            className={`w-full text-center text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg transition-all duration-200 border shadow-sm ${
              col.color === 'emerald'
                ? 'text-emerald-700 border-emerald-300 bg-white hover:bg-emerald-50 hover:border-emerald-400'
                : col.color === 'blue'
                  ? 'text-blue-700 border-blue-300 bg-white hover:bg-blue-50 hover:border-blue-400'
                  : 'text-amber-700 border-amber-300 bg-white hover:bg-amber-50 hover:border-amber-400'
            }`}
          >
            Use this response
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  query,
  vertical,
  onUseResponse,
  onRunCompare,
  columns,
  lastQuery,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isAnyLoading = columns.some(c => c.status === 'loading');
  const isAllDone = columns.every(c => c.status === 'done' || c.status === 'error');
  const isAllIdle = columns.every(c => c.status === 'idle');

  // Sync input with active query
  useEffect(() => {
    if (isOpen && lastQuery) {
      setInputValue(lastQuery);
    }
  }, [isOpen, lastQuery]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isAnyLoading) return;
    onRunCompare(inputValue.trim());
  };

  if (!isOpen) return null;

  const headerLabel = useMemo(() => {
    const labels: Record<string, string> = {
      Retail: 'Future of Retail',
      Sports: 'Future of Sports',
      Beauty: 'Future of Beauty',
      SIC: 'SIC Graph',
      Waldo: 'Waldo Trends',
      Baseline: 'Public Beliefs',
    };
    return labels[vertical] || vertical;
  }, [vertical]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(250, 249, 245, 0.98)', backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-line shrink-0 bg-paper/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Compare icon with brand color */}
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <h2 className="font-serif italic text-lg text-ink">Compare Modes</h2>
            </div>
            <span className="text-[10px] font-mono font-bold text-ink-3 bg-cream px-2 py-0.5 rounded border border-line">
              {headerLabel}
            </span>
            {isAnyLoading && (
              <span className="text-[10px] font-mono font-bold text-brand animate-pulse">Comparing…</span>
            )}
            {isAllDone && columns[0].status !== 'idle' && (
              <span className="text-[10px] font-mono font-bold text-green-600">✓ Complete</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Inline query input */}
            <form onSubmit={handleSubmit} className="hidden md:flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)} 
                placeholder="Enter query to compare…"
                disabled={isAnyLoading}
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand w-80 font-mono disabled:opacity-50 shadow-sm"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isAnyLoading}
                className="px-4 py-2 bg-brand text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-brand-dark disabled:opacity-30 transition-all shadow-md shadow-brand/10"
              >
                {isAnyLoading ? 'Running…' : 'Compare'}
              </button>
            </form>
            <button
              onClick={onClose}
              className="p-2 text-ink-4 hover:text-ink transition-colors rounded-lg hover:bg-paper"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Query display bar */}
        {query && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Active Inquiry</span>
              <span className="text-xs font-mono font-bold text-ink-2 truncate italic">"{query}"</span>
            </div>
          </div>
        )}

        {/* Mobile query input */}
        <form onSubmit={handleSubmit} className="md:hidden px-5 pb-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter query to compare…"
              disabled={isAnyLoading}
              className="flex-1 bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand font-mono disabled:opacity-50 shadow-sm"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isAnyLoading}
              className="px-3 py-2 bg-brand text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-brand-dark disabled:opacity-30 transition-all shrink-0"
            >
              {isAnyLoading ? '…' : 'Go'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Columns Grid ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {isAllIdle ? (
          /* ── Empty State: Welcome screen ────────────────────── */
          <div className="flex flex-col items-center justify-center h-full px-6 bg-cream/40">
            <div className="max-w-xl w-full text-center">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-paper border border-line mb-6 shadow-sm">
                <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="font-serif italic text-2xl text-ink mb-3">Parallel Reasoning Architecture</h3>
              <p className="text-sm text-ink-3 mb-8 leading-relaxed max-w-md mx-auto">
                Compare responses from <span className="text-emerald-700 font-bold">Graph</span>, <span className="text-blue-700 font-bold">Gemini</span>, and <span className="text-amber-700 font-bold">Blended</span> modes to evaluate source grounding and synthesis density.
              </p>

              {/* Prominent query input */}
              <form onSubmit={handleSubmit} className="mb-10">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="e.g. What are the top trends in experiential retail?"
                    className="flex-1 bg-white border border-line rounded-xl px-4 py-4 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand font-mono transition-all shadow-md shadow-ink/5"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="px-6 py-4 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-dark disabled:opacity-30 transition-all shrink-0 shadow-lg shadow-brand/20"
                  >
                    Compare Modes
                  </button>
                </div>
              </form>

              {/* Mode cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Graph', desc: 'Knowledge graph retrieval with grounded evidence', color: 'emerald', tag: 'STRUCTURED' },
                  { label: 'Gemini', desc: 'LLM web search via Google Gemini grounding', color: 'blue', tag: 'GENERATIVE' },
                  { label: 'Blended', desc: 'Graph signals enriched with LLM synthesis', color: 'amber', tag: 'HYBRID' },
                ].map(mode => (
                  <div key={mode.label} className={`rounded-xl border p-4 text-left shadow-sm ${
                    mode.color === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' :
                    mode.color === 'blue' ? 'border-blue-200 bg-blue-50/50' :
                    'border-amber-200 bg-amber-50/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${
                        mode.color === 'emerald' ? 'bg-emerald-500' : mode.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-xs font-bold text-ink">{mode.label}</span>
                    </div>
                    <p className="text-[10px] text-ink-3 leading-relaxed mb-3">{mode.desc}</p>
                    <span className={`inline-block text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      mode.color === 'emerald' ? 'text-emerald-700 border-emerald-300 bg-white' :
                      mode.color === 'blue' ? 'text-blue-700 border-blue-300 bg-white' :
                      'text-amber-700 border-amber-300 bg-white'
                    }`}>{mode.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop: 3 side-by-side columns */}
            <div className="hidden md:grid md:grid-cols-3 h-full">
              {columns.map((col) => (
                <CompareColumnView
                  key={col.mode}
                  col={col}
                  onUse={() => onUseResponse(col.mode, col.answer)}
                />
              ))}
            </div>

            {/* Mobile: tabbed view */}
            <MobileTabView
              columns={columns}
              onUseResponse={onUseResponse}
            />
          </>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="border-t border-line shrink-0 bg-paper">
        <div className="flex items-center justify-between px-5 h-10">
          <span className="eyebrow">
            Parallel Reasoning Comparison
          </span>
          <span className="text-[9px] font-mono font-bold text-ink-4">
            ⌘⇧C toggle  •  Esc close
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ── Mobile Tab View ───────────────────────────────────────────────────

const MobileTabView: React.FC<{
  columns: CompareColumn[];
  onUseResponse: (mode: ReasoningMode, answer: string) => void;
}> = ({ columns, onUseResponse }) => {
  const [activeTab, setActiveTab] = useState<ReasoningMode>('graph');

  return (
    <div className="md:hidden flex flex-col h-full bg-cream">
      {/* Tab bar */}
      <div className="flex border-b border-line bg-paper shrink-0">
        {columns.map(col => (
          <button
            key={col.mode}
            onClick={() => setActiveTab(col.mode)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === col.mode
                ? `${col.color === 'emerald' ? 'text-emerald-700 border-emerald-500' : col.color === 'blue' ? 'text-blue-700 border-blue-500' : 'text-amber-700 border-amber-500'} bg-white`
                : 'text-ink-4 border-transparent hover:text-ink-2'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              col.color === 'emerald' ? 'bg-emerald-500' : col.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
            } ${activeTab === col.mode ? 'opacity-100' : 'opacity-30'}`} />
            {col.label}
            {col.status === 'loading' && (
              <div className="w-2.5 h-2.5 border border-line-strong border-t-brand rounded-full animate-spin" />
            )}
            {col.status === 'done' && <span className="text-[8px]">✓</span>}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="flex-1 overflow-hidden">
        {columns.filter(c => c.mode === activeTab).map(col => (
          <CompareColumnView
            key={col.mode}
            col={col}
            onUse={() => onUseResponse(col.mode, col.answer)}
            isOnly
          />
        ))}
      </div>
    </div>
  );
};

// ── Helper: Create empty columns ──────────────────────────────────────

export const createEmptyColumns = (): CompareColumn[] => [
  {
    mode: 'graph',
    label: 'Graph',
    color: 'emerald',
    colorBg: 'bg-emerald-50',
    answer: '',
    suggestedQuestions: [],
    trendCount: 0,
    articleCount: 0,
    status: 'idle',
    durationMs: 0,
  },
  {
    mode: 'gemini',
    label: 'Gemini',
    color: 'blue',
    colorBg: 'bg-blue-50',
    answer: '',
    suggestedQuestions: [],
    trendCount: 0,
    articleCount: 0,
    status: 'idle',
    durationMs: 0,
  },
  {
    mode: 'blended',
    label: 'Blended',
    color: 'amber',
    colorBg: 'bg-amber-50',
    answer: '',
    suggestedQuestions: [],
    trendCount: 0,
    articleCount: 0,
    status: 'idle',
    durationMs: 0,
  },
];
