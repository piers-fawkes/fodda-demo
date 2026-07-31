import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpertiseMapItem {
  topic: string;
  tier: 'core' | 'growth' | 'exploratory';
  confidence?: number;
  description?: string;
}

interface SignatureInsight {
  title: string;
  description: string;
  whyItMatters?: string;
}

interface BlindSpot {
  title: string;
  description: string;
  disclosureQuote?: string;
}

interface ExpertFlag {
  section: string;
  flag: string;
  timestamp: string;
  status: 'pending' | 'resolved';
}

interface VoiceProfile {
  vocabulary?: { say: string; not: string }[];
  hedgePhrases?: string[];
  openingPatterns?: string[];
  antiPatterns?: string[];
  register?: string;
  sentenceRhythm?: string;
}

interface ExpertData {
  analystId: string;
  analystName: string;
  portraitUrl: string;
  expertCard: string;
  expertiseMap: ExpertiseMapItem[];
  signatureInsights: SignatureInsight[];
  blindSpots: BlindSpot[];
  exampleQueries: string[];
  voiceProfile: VoiceProfile | null;
  crossGraphConnections: any[];
  expertFlags: ExpertFlag[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { pill: string; label: string }> = {
  core:        { pill: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Core' },
  growth:      { pill: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'Growth' },
  exploratory: { pill: 'bg-slate-100 text-slate-600 border-slate-200',    label: 'Exploratory' },
};

function useDebouncedSave(fn: () => void, delay = 900) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, delay);
  }, [fn, delay]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CardShell: React.FC<{
  emoji: string;
  title: string;
  badge?: string;
  badgeStyle?: string;
  children: React.ReactNode;
  saving?: boolean;
}> = ({ emoji, title, badge, badgeStyle, children, saving }) => (
  <section className="bg-paper border border-line rounded-2xl shadow-sm flex flex-col overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-cream/60 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{emoji}</span>
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {saving && (
          <span className="text-[10px] text-ink-4 font-mono animate-pulse">Saving…</span>
        )}
        {badge && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle || 'bg-line-soft text-ink-3 border-line'}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
    <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
      {children}
    </div>
  </section>
);

// ── Expert Card (read-only + flag per section) ─────────────────────────────

const ExpertCardPanel: React.FC<{
  content: string;
  existingFlags: ExpertFlag[];
  onFlag: (section: string, text: string) => Promise<void>;
}> = ({ content, existingFlags, onFlag }) => {
  const [flagSection, setFlagSection] = useState<string | null>(null);
  const [flagText, setFlagText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const sections = content.split(/\n(?=§)/).filter(Boolean);
  const hasSections = sections.length > 1;

  const handleSubmit = async () => {
    if (!flagSection || !flagText.trim()) return;
    setSubmitting(true);
    try {
      await onFlag(flagSection, flagText.trim());
      setSubmitted(flagSection);
      setFlagSection(null);
      setFlagText('');
      setTimeout(() => setSubmitted(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingFlagSections = new Set(existingFlags.map(f => f.section));

  return (
    <div className="space-y-4">
      {existingFlags.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 space-y-1">
          <p className="font-bold">🚩 Pending changes ({existingFlags.length})</p>
          {existingFlags.map((f, i) => (
            <p key={i} className="text-amber-600 leading-snug">
              <span className="font-semibold">{f.section}:</span> {f.flag}
            </p>
          ))}
        </div>
      )}

      {hasSections ? sections.map((section, idx) => {
        const firstLine = section.split('\n')[0].trim();
        const sectionTitle = firstLine;
        const hasPendingFlag = pendingFlagSections.has(sectionTitle);
        const isOpen = flagSection === sectionTitle;
        const wasSubmitted = submitted === sectionTitle;

        return (
          <div key={idx} className="group">
            <div className="flex items-start justify-between gap-3">
              <pre className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap font-sans flex-1 min-w-0">
                {section}
              </pre>
              <button
                onClick={() => {
                  setFlagSection(isOpen ? null : sectionTitle);
                  setFlagText('');
                }}
                title={hasPendingFlag ? 'Flag pending admin review' : 'Flag this section'}
                className={`shrink-0 mt-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1 ${
                  hasPendingFlag || wasSubmitted
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : isOpen
                    ? 'bg-red-50 text-red-500 border-red-200'
                    : 'opacity-0 group-hover:opacity-100 bg-cream text-ink-3 border-line hover:text-ink hover:border-line-strong'
                }`}
              >
                🚩 {hasPendingFlag ? 'Flagged' : wasSubmitted ? 'Sent!' : 'Flag'}
              </button>
            </div>
            {isOpen && (
              <div className="mt-2 space-y-2 animate-fade-in">
                <textarea
                  className="w-full text-xs rounded-xl border border-line bg-white p-3 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                  rows={3}
                  placeholder={`What's wrong with "${sectionTitle}"? Be specific.`}
                  value={flagText}
                  onChange={e => setFlagText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !flagText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-40 hover:bg-brand/90 transition-colors"
                  >
                    {submitting ? 'Sending…' : 'Send Flag'}
                  </button>
                  <button
                    onClick={() => { setFlagSection(null); setFlagText(''); }}
                    className="px-3 py-1.5 rounded-lg border border-line text-ink-3 text-xs hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }) : (
        <pre className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap font-sans">
          {content || <span className="text-ink-4 italic">No Expert Card generated yet.</span>}
        </pre>
      )}
    </div>
  );
};

// ── Expertise Map ──────────────────────────────────────────────────────────

const ExpertiseMapPanel: React.FC<{
  items: ExpertiseMapItem[];
  onChange: (items: ExpertiseMapItem[]) => void;
}> = ({ items, onChange }) => {
  const tiers: Array<'core' | 'growth' | 'exploratory'> = ['core', 'growth', 'exploratory'];

  const add = () => onChange([...items, { topic: '', tier: 'growth', description: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof ExpertiseMapItem, value: string) =>
    onChange(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-ink-4 italic text-center py-4">No topics yet — add your first area of expertise.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="p-3 bg-cream border border-line rounded-xl space-y-2 group">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-transparent focus:border-ink-3 focus:outline-none text-ink placeholder:text-ink-4 transition-colors"
              placeholder="Topic name"
              value={item.topic}
              onChange={e => update(idx, 'topic', e.target.value)}
            />
            <div className="flex gap-1 shrink-0">
              {tiers.map(tier => (
                <button
                  key={tier}
                  onClick={() => update(idx, 'tier', tier)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                    item.tier === tier ? TIER_STYLES[tier].pill : 'bg-white text-ink-4 border-line hover:border-line-strong'
                  }`}
                >
                  {TIER_STYLES[tier].label}
                </button>
              ))}
            </div>
            <button
              onClick={() => remove(idx)}
              className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-md text-ink-4 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Remove topic"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            className="w-full text-xs text-ink-2 bg-transparent border-0 border-b border-transparent focus:border-ink-3 focus:outline-none placeholder:text-ink-4 transition-colors"
            placeholder="Brief description (optional)"
            value={item.description || ''}
            onChange={e => update(idx, 'description', e.target.value)}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2 rounded-xl border border-dashed border-line text-xs text-ink-3 hover:text-ink hover:border-line-strong hover:bg-cream/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Topic
      </button>
    </div>
  );
};

// ── Signature Insights ────────────────────────────────────────────────────

const SignatureInsightsPanel: React.FC<{
  items: SignatureInsight[];
  onChange: (items: SignatureInsight[]) => void;
}> = ({ items, onChange }) => {
  const add = () => onChange([...items, { title: '', description: '', whyItMatters: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof SignatureInsight, value: string) =>
    onChange(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-ink-4 italic text-center py-4">No insights yet — add your key frameworks or ideas.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="p-4 bg-cream border border-line rounded-xl space-y-2 group relative">
          <button
            onClick={() => remove(idx)}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-4 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Remove insight"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <input
            className="w-full text-sm font-semibold text-ink bg-transparent border-0 border-b border-transparent focus:border-ink-3 focus:outline-none placeholder:text-ink-4 transition-colors pr-8"
            placeholder="Framework or insight title"
            value={item.title}
            onChange={e => update(idx, 'title', e.target.value)}
          />
          <textarea
            className="w-full text-xs text-ink-2 bg-transparent border-0 focus:outline-none resize-none placeholder:text-ink-4"
            rows={2}
            placeholder="What it is…"
            value={item.description}
            onChange={e => update(idx, 'description', e.target.value)}
          />
          <textarea
            className="w-full text-xs text-ink-3 bg-white/60 rounded-lg px-2 py-1.5 border border-line/50 focus:outline-none resize-none placeholder:text-ink-4"
            rows={2}
            placeholder="Why it matters to clients…"
            value={item.whyItMatters || ''}
            onChange={e => update(idx, 'whyItMatters', e.target.value)}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2 rounded-xl border border-dashed border-line text-xs text-ink-3 hover:text-ink hover:border-line-strong hover:bg-cream/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Insight
      </button>
    </div>
  );
};

// ── Blind Spots ────────────────────────────────────────────────────────────

const BlindSpotsPanel: React.FC<{
  items: BlindSpot[];
  onChange: (items: BlindSpot[]) => void;
}> = ({ items, onChange }) => {
  const add = () => onChange([...items, { title: '', description: '', disclosureQuote: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof BlindSpot, value: string) =>
    onChange(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-ink-4 leading-snug">
        Honest blind spots help your twin refuse gracefully instead of hallucinating. More is better.
      </p>
      {items.length === 0 && (
        <p className="text-xs text-ink-4 italic text-center py-4">No blind spots defined yet.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="p-3 bg-cream border border-line rounded-xl space-y-2 group relative">
          <button
            onClick={() => remove(idx)}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-4 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <input
            className="w-full text-sm font-semibold text-ink bg-transparent border-0 border-b border-transparent focus:border-ink-3 focus:outline-none placeholder:text-ink-4 pr-8 transition-colors"
            placeholder="Area (e.g. Financial modelling)"
            value={item.title}
            onChange={e => update(idx, 'title', e.target.value)}
          />
          <input
            className="w-full text-xs text-ink-2 bg-transparent border-0 focus:outline-none placeholder:text-ink-4"
            placeholder="Brief description"
            value={item.description}
            onChange={e => update(idx, 'description', e.target.value)}
          />
          <input
            className="w-full text-xs text-ink-3 bg-white/60 rounded-lg px-2 py-1.5 border border-line/50 focus:outline-none placeholder:text-ink-4"
            placeholder="Disclosure phrase (e.g. 'That's not my wheelhouse.')"
            value={item.disclosureQuote || ''}
            onChange={e => update(idx, 'disclosureQuote', e.target.value)}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2 rounded-xl border border-dashed border-line text-xs text-ink-3 hover:text-ink hover:border-line-strong hover:bg-cream/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Blind Spot
      </button>
    </div>
  );
};

// ── Example Queries ────────────────────────────────────────────────────────

const ExampleQueriesPanel: React.FC<{
  items: string[];
  onChange: (items: string[]) => void;
}> = ({ items, onChange }) => {
  const add = () => onChange([...items, '']);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, value: string) =>
    onChange(items.map((item, i) => i === idx ? value : item));

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-ink-4 leading-snug">
        Shown to users on your public expert page. Shapes first impression of what your twin can do.
      </p>
      {items.length === 0 && (
        <p className="text-xs text-ink-4 italic text-center py-4">No example queries defined yet.</p>
      )}
      {items.map((query, idx) => (
        <div key={idx} className="flex items-center gap-2 group">
          <span className="text-ink-4 text-[10px] font-mono w-5 text-right shrink-0">{idx + 1}.</span>
          <input
            className="flex-1 text-xs text-ink bg-cream border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
            placeholder="e.g. How does SCOUT differentiate root causes from symptoms?"
            value={query}
            onChange={e => update(idx, e.target.value)}
          />
          <button
            onClick={() => remove(idx)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-4 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2 rounded-xl border border-dashed border-line text-xs text-ink-3 hover:text-ink hover:border-line-strong hover:bg-cream/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Query
      </button>
    </div>
  );
};

// ── Voice Profile (read-only) ──────────────────────────────────────────────

const VoiceProfilePanel: React.FC<{
  data: VoiceProfile | null;
  existingFlags: ExpertFlag[];
  onFlag: (section: string, text: string) => Promise<void>;
}> = ({ data, existingFlags, onFlag }) => {
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagText, setFlagText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!flagText.trim()) return;
    setSubmitting(true);
    try {
      await onFlag('Voice Profile', flagText.trim());
      setFlagOpen(false);
      setFlagText('');
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) {
    return (
      <p className="text-xs text-ink-4 italic text-center py-4">
        Voice profile not yet generated — it's extracted from your chat history and expert interview.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      {data.register && (
        <div>
          <p className="eyebrow text-[9px] mb-1">Register</p>
          <p className="text-ink-2">{data.register}</p>
        </div>
      )}
      {data.vocabulary && data.vocabulary.length > 0 && (
        <div>
          <p className="eyebrow text-[9px] mb-2">Vocabulary</p>
          <div className="space-y-1">
            {data.vocabulary.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-ink-2">
                <span className="font-semibold text-ink">{v.say}</span>
                <span className="text-ink-4">→ not</span>
                <span className="line-through text-ink-4">{v.not}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.hedgePhrases && data.hedgePhrases.length > 0 && (
        <div>
          <p className="eyebrow text-[9px] mb-1">Hedge Phrases</p>
          <ul className="space-y-0.5 text-ink-2">
            {data.hedgePhrases.map((p, i) => <li key={i} className="italic">"{p}"</li>)}
          </ul>
        </div>
      )}
      {data.antiPatterns && data.antiPatterns.length > 0 && (
        <div>
          <p className="eyebrow text-[9px] mb-1">Anti-patterns</p>
          <ul className="space-y-0.5 text-ink-3">
            {data.antiPatterns.map((p, i) => <li key={i}>✗ {p}</li>)}
          </ul>
        </div>
      )}

      {/* Flag button */}
      <div className="pt-2 border-t border-line">
        {!flagOpen ? (
          <button
            onClick={() => setFlagOpen(true)}
            className="flex items-center gap-1.5 text-[10px] text-ink-4 hover:text-ink transition-colors"
          >
            🚩 Something look wrong? Flag it
          </button>
        ) : (
          <div className="space-y-2 animate-fade-in">
            <textarea
              className="w-full text-xs rounded-xl border border-line bg-white p-3 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              rows={3}
              placeholder="Describe what's incorrect in the Voice Profile…"
              value={flagText}
              onChange={e => setFlagText(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !flagText.trim()}
                className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-40 hover:bg-brand/90 transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Flag'}
              </button>
              <button
                onClick={() => { setFlagOpen(false); setFlagText(''); }}
                className="px-3 py-1.5 rounded-lg border border-line text-ink-3 text-xs hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Non-Expert CTA ────────────────────────────────────────────────────────

const NonExpertCTA: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="max-w-md text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto text-3xl shadow-sm border border-violet-200">
        🧠
      </div>
      <div>
        <h2 className="text-xl font-serif italic text-ink font-normal mb-2">Your Digital Twin awaits</h2>
        <p className="text-sm text-ink-3 leading-relaxed">
          Fodda Experts get a personalised Digital Twin — an AI that speaks in your voice, with your authority,
          to clients 24/7. You're not registered as an expert yet.
        </p>
      </div>
      <div className="space-y-3">
        <a
          href="https://www.fodda.ai/join-experts"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all shadow-sm"
        >
          Apply to become a Fodda Expert
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
        <p className="text-[11px] text-ink-4">
          Already an expert? Contact <a href="mailto:hello@fodda.ai" className="text-brand hover:underline">hello@fodda.ai</a> to link your account.
        </p>
      </div>
    </div>
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────

interface ExpertTwinPageProps {
  user: User | null;
}

export const ExpertTwinPage: React.FC<ExpertTwinPageProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [isExpert, setIsExpert] = useState(false);
  const [data, setData] = useState<ExpertData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-field saving state
  const [saving, setSaving] = useState<Partial<Record<string, boolean>>>({});

  // Supplier Console State
  const [earningsData, setEarningsData] = useState<any>(null);
  const [graphStatus, setGraphStatus] = useState<'Active' | 'Paused'>('Active');
  const [takedownLoading, setTakedownLoading] = useState(false);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [referralTopics, setReferralTopics] = useState<any[]>([]);

  const handleToggleTakedown = async () => {
    if (!data?.analystId) return;
    const nextStatus = graphStatus === 'Active' ? 'Paused' : 'Active';
    setTakedownLoading(true);
    try {
      const res = await fetch('/api/creator/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphId: data.analystId, status: nextStatus })
      });
      const json = await res.json();
      if (json.ok) {
        setGraphStatus(nextStatus);
      }
    } catch (e) {
      console.error('[ExpertTwinPage] Failed to toggle takedown:', e);
    } finally {
      setTakedownLoading(false);
    }
  };

  const handleTestDriveTwin = async () => {
    if (!draftQuery.trim()) return;
    setDraftLoading(true);
    setDraftResponse('');
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: draftQuery,
          vertical: data?.analystId || 'retail',
          mode: 'sandbox'
        })
      });
      const json = await res.json();
      setDraftResponse(json.answer || 'Draft twin preview generated cleanly.');
    } catch (e: any) {
      setDraftResponse(`Preview execution error: ${e.message}`);
    } finally {
      setDraftLoading(false);
    }
  };

  // ── Fetch expert data ──
  useEffect(() => {
    if (!user?.isExpert) {
      setIsExpert(false);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/expert/me');
        const json = await res.json();
        if (json.ok && json.isExpert) {
          setIsExpert(true);
          setData(json as ExpertData);

          // Fetch earnings and analytics
          const gId = json.analystId || 'retail';
          fetch(`/api/creator/earnings?graphId=${gId}`).then(r => r.json()).then(earnRes => {
            if (earnRes.ok) setEarningsData(earnRes.earnings);
          }).catch(() => {});

          fetch(`/api/creator/analytics?graphId=${gId}`).then(r => r.json()).then(analyticsRes => {
            if (analyticsRes.ok && analyticsRes.stats?.topQueries) {
              setReferralTopics(analyticsRes.stats.topQueries.slice(0, 5));
            }
          }).catch(() => {});
        } else {
          setIsExpert(false);
        }
      } catch (e: any) {
        setError(e.message);
        setIsExpert(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.isExpert]);

  // ── Save helpers ──

  const save = useCallback(async (endpoint: string, body: object, fieldKey: string) => {
    setSaving(prev => ({ ...prev, [fieldKey]: true }));
    try {
      await fetch(`/api/expert/me/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error(`[ExpertTwinPage] save ${endpoint} failed:`, e);
    } finally {
      setSaving(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, []);

  const saveExpertiseMap = useCallback(
    (items: ExpertiseMapItem[]) => save('expertise-map', { items }, 'expertiseMap'),
    [save]
  );
  const saveSignatureInsights = useCallback(
    (items: SignatureInsight[]) => save('signature-insights', { items }, 'signatureInsights'),
    [save]
  );
  const saveBlindSpots = useCallback(
    (items: BlindSpot[]) => save('blind-spots', { items }, 'blindSpots'),
    [save]
  );
  const saveExampleQueries = useCallback(
    (items: string[]) => save('example-queries', { items }, 'exampleQueries'),
    [save]
  );

  const submitFlag = useCallback(async (section: string, flagText: string) => {
    await fetch('/api/expert/me/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, flag: flagText }),
    });
    // Optimistically add flag to local state
    setData(prev => prev ? {
      ...prev,
      expertFlags: [
        ...prev.expertFlags,
        { section, flag: flagText, timestamp: new Date().toISOString(), status: 'pending' }
      ]
    } : prev);
  }, []);

  // ── Debounced field updaters ──
  const handleExpertiseMapChange = useCallback((items: ExpertiseMapItem[]) => {
    setData(prev => prev ? { ...prev, expertiseMap: items } : prev);
    // Debounce save
    clearTimeout((handleExpertiseMapChange as any)._timer);
    (handleExpertiseMapChange as any)._timer = setTimeout(() => saveExpertiseMap(items), 900);
  }, [saveExpertiseMap]);

  const handleSignatureInsightsChange = useCallback((items: SignatureInsight[]) => {
    setData(prev => prev ? { ...prev, signatureInsights: items } : prev);
    clearTimeout((handleSignatureInsightsChange as any)._timer);
    (handleSignatureInsightsChange as any)._timer = setTimeout(() => saveSignatureInsights(items), 900);
  }, [saveSignatureInsights]);

  const handleBlindSpotsChange = useCallback((items: BlindSpot[]) => {
    setData(prev => prev ? { ...prev, blindSpots: items } : prev);
    clearTimeout((handleBlindSpotsChange as any)._timer);
    (handleBlindSpotsChange as any)._timer = setTimeout(() => saveBlindSpots(items), 900);
  }, [saveBlindSpots]);

  const handleExampleQueriesChange = useCallback((items: string[]) => {
    setData(prev => prev ? { ...prev, exampleQueries: items } : prev);
    clearTimeout((handleExampleQueriesChange as any)._timer);
    (handleExampleQueriesChange as any)._timer = setTimeout(() => saveExampleQueries(items), 900);
  }, [saveExampleQueries]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-brand animate-spin" />
          <p className="text-sm text-ink-4 font-serif italic">Loading your twin…</p>
        </div>
      </div>
    );
  }

  if (!isExpert) return <NonExpertCTA />;

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const voiceFlags = data.expertFlags.filter(f => f.section === 'Voice Profile');

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <p className="eyebrow mb-1">Expert Twin</p>
        <div className="flex items-center gap-4">
          {data.portraitUrl && (
            <img
              src={data.portraitUrl}
              alt={data.analystName}
              className="w-12 h-12 rounded-full object-cover border-2 border-line shadow-sm shrink-0"
            />
          )}
          <div>
            <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">
              {data.analystName || 'My Twin'}
            </h1>
            <p className="text-sm text-ink-3 mt-0.5">
              Review and refine the data that powers your Digital Twin.
            </p>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div className="px-8 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* 🧠 Expert Card — flag only */}
          <CardShell
            emoji="🧠"
            title="Expert Card"
            badge="Flag to suggest change"
            badgeStyle="bg-amber-50 text-amber-600 border-amber-200"
          >
            <ExpertCardPanel
              content={data.expertCard}
          existingFlags={data.expertFlags.filter(f => f.section !== 'Voice Profile')}
              onFlag={submitFlag}
            />
          </CardShell>

          {/* 💰 1. Revenue Share & Earnings Card */}
          <CardShell
            emoji="💰"
            title="Revenue Share & Earnings"
            badge="50/50 Revenue Split"
            badgeStyle="bg-green-50 text-green-700 border-green-200"
          >
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-cream/60 border border-line rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Total Queries</span>
                  <span className="text-base font-bold text-ink font-mono">{earningsData?.totalQueries ?? '—'}</span>
                  <span className="text-[9px] text-ink-4 block mt-0.5">Full Footprint</span>
                </div>
                <div className="p-3 bg-green-50/60 border border-green-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 block">Paid Queries</span>
                  <span className="text-base font-bold text-green-900 font-mono">{earningsData?.paidQueries ?? '—'}</span>
                  <span className="text-[9px] text-green-700 block mt-0.5">Earning Subset</span>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Free / Trial</span>
                  <span className="text-base font-bold text-amber-900 font-mono">{earningsData?.trialQueries ?? '—'}</span>
                  <span className="text-[9px] text-amber-700 block mt-0.5">Non-Earning</span>
                </div>
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">Payout (50%)</span>
                  <span className="text-base font-bold text-purple-900 font-mono">${earningsData?.expertEarningsUSD?.toFixed(2) ?? '0.00'}</span>
                  <span className="text-[9px] text-purple-700 block mt-0.5">50/50 Split</span>
                </div>
              </div>

              {earningsData?.syncNotice && (
                <div className="p-3 bg-cream border border-line/60 rounded-xl text-ink-3 italic text-[11px] flex items-center justify-between">
                  <span>ℹ️ {earningsData.syncNotice}</span>
                  <span className="font-mono text-[10px] text-ink-4 uppercase">Token Purchase Log</span>
                </div>
              )}

              <p className="text-[10px] text-ink-4 leading-relaxed font-sans border-t border-line/40 pt-2">
                *V1 Attribution: Earnings represent a 50% split on unit revenue derived from all paying-customer queries routed to your primary expert twin graph.
              </p>
            </div>
          </CardShell>

          {/* 🛑 2. Graph Control & Real Takedown Card */}
          <CardShell
            emoji="🛑"
            title="Twin Status & Takedown"
            badge={graphStatus === 'Active' ? 'Active Live' : 'Paused / Takedown'}
            badgeStyle={graphStatus === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-paper border border-line rounded-xl">
                <div>
                  <h4 className="font-bold text-ink text-sm">Twin Status: <span className={graphStatus === 'Active' ? 'text-green-700' : 'text-red-700'}>{graphStatus}</span></h4>
                  <p className="text-ink-3 text-[11px] mt-0.5">
                    {graphStatus === 'Active' ? 'Receiving query routing across App and MCP channels.' : 'Routing currently paused across all channels.'}
                  </p>
                </div>
                <button
                  onClick={handleToggleTakedown}
                  disabled={takedownLoading}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm ${
                    graphStatus === 'Active'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {takedownLoading ? 'Updating…' : graphStatus === 'Active' ? 'Pause Expert / Takedown' : 'Resume Twin Routing'}
                </button>
              </div>
              <p className="text-[10px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                *Takedown / Pause stops receiving new queries across all app and MCP channels within ~5 minutes as catalog cache refreshes.
              </p>
            </div>
          </CardShell>

          {/* 🧪 3. Test-Drive Your Twin (Draft Preview Sandbox) */}
          <CardShell
            emoji="🧪"
            title="Test-Drive Your Twin"
            badge="Draft Preview Sandbox"
            badgeStyle="bg-blue-50 text-blue-700 border-blue-200"
          >
            <div className="space-y-3 text-xs">
              <p className="text-ink-3">
                Test-query your twin in draft state to verify voice, reasoning, and accuracy before publishing live.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.target.value)}
                  placeholder="Ask your twin a test question..."
                  className="flex-1 bg-cream/40 border border-line rounded-xl px-3.5 py-2 text-ink text-xs focus:outline-none focus:border-brand/40"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTestDriveTwin(); }}
                />
                <button
                  onClick={handleTestDriveTwin}
                  disabled={draftLoading || !draftQuery.trim()}
                  className="px-4 py-2 bg-brand text-white font-bold uppercase text-[11px] tracking-wider rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {draftLoading ? 'Testing...' : 'Send Test Query'}
                </button>
              </div>
              {draftResponse && (
                <div className="p-4 bg-white border border-line rounded-xl space-y-1 font-serif text-ink-2 italic text-xs leading-relaxed">
                  <span className="text-[9px] font-mono font-bold text-brand uppercase tracking-wider block not-italic mb-1">Twin Preview Response:</span>
                  "{draftResponse}"
                </div>
              )}
            </div>
          </CardShell>

          {/* 📥 4. Referral & Consult Inbox */}
          <CardShell
            emoji="📥"
            title="Referral & Consult Inbox"
            badge="Inbound Topics"
            badgeStyle="bg-purple-50 text-purple-700 border-purple-200"
          >
            <div className="space-y-3 text-xs">
              <p className="text-ink-3">
                Inbound consult topics and delegated cross-referral requests for your expert twin.
              </p>
              {referralTopics.length === 0 ? (
                <div className="p-4 bg-cream/40 border border-line rounded-xl text-center text-ink-3 italic">
                  No inbound consult requests in the last 30 days.
                </div>
              ) : (
                <div className="space-y-2">
                  {referralTopics.map((topic, i) => (
                    <div key={i} className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                      <span className="font-serif italic text-ink text-xs">"{topic.query}"</span>
                      <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {topic.count} query
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardShell>

          {/* 📜 5. Plain-Text Promises (Creator Terms) */}
          <CardShell
            emoji="📜"
            title="Plain-Text Promises"
            badge="Creator Terms"
            badgeStyle="bg-slate-50 text-slate-700 border-slate-200"
          >
            <div className="p-4 bg-white border border-line rounded-xl space-y-2 text-xs text-ink-2 leading-relaxed font-sans">
              <div className="flex items-center space-x-2 text-brand font-bold">
                <span>✓ Non-Exclusive Content License</span>
              </div>
              <p className="text-ink-3 pl-5">You retain full ownership of your intelligence. You grant Fodda a non-exclusive license to route queries to your twin.</p>

              <div className="flex items-center space-x-2 text-brand font-bold pt-1">
                <span>✓ Text Only, No Avatar</span>
              </div>
              <p className="text-ink-3 pl-5">Your twin provides text-based intelligence and reasoning only. No synthetic avatars or video clones are ever created.</p>

              <div className="flex items-center space-x-2 text-brand font-bold pt-1">
                <span>✓ Pause & Takedown Anytime</span>
              </div>
              <p className="text-ink-3 pl-5">You can pause query routing or remove your expert twin instantly via 1-click takedown controls with ~5 minute multi-channel propagation.</p>

              <div className="flex items-center space-x-2 text-brand font-bold pt-1">
                <span>✓ 50/50 Revenue Split on Paid Usage</span>
              </div>
              <p className="text-ink-3 pl-5">You receive a 50% split on unit revenue derived from all paying-customer queries routed to your expert twin.</p>
            </div>
          </CardShell>

          {/* 📊 Expertise Map — editable */}
          <CardShell
            emoji="📊"
            title="Expertise Map"
            badge="Editable"
            badgeStyle="bg-green-50 text-green-600 border-green-200"
            saving={saving.expertiseMap}
          >
            <ExpertiseMapPanel
              items={data.expertiseMap}
              onChange={handleExpertiseMapChange}
            />
          </CardShell>

          {/* 💡 Signature Insights — editable */}
          <CardShell
            emoji="💡"
            title="Signature Insights"
            badge="Editable"
            badgeStyle="bg-green-50 text-green-600 border-green-200"
            saving={saving.signatureInsights}
          >
            <SignatureInsightsPanel
              items={data.signatureInsights}
              onChange={handleSignatureInsightsChange}
            />
          </CardShell>

          {/* 🔍 Blind Spots — editable */}
          <CardShell
            emoji="🔍"
            title="Blind Spots"
            badge="Editable"
            badgeStyle="bg-green-50 text-green-600 border-green-200"
            saving={saving.blindSpots}
          >
            <BlindSpotsPanel
              items={data.blindSpots}
              onChange={handleBlindSpotsChange}
            />
          </CardShell>

          {/* 💬 Example Queries — editable */}
          <CardShell
            emoji="💬"
            title="Example Queries"
            badge="Editable"
            badgeStyle="bg-green-50 text-green-600 border-green-200"
            saving={saving.exampleQueries}
          >
            <ExampleQueriesPanel
              items={data.exampleQueries}
              onChange={handleExampleQueriesChange}
            />
          </CardShell>

          {/* 🗣️ Voice Profile — read-only + flaggable */}
          <CardShell
            emoji="🗣️"
            title="Voice Profile"
            badge="Read-only"
            badgeStyle="bg-slate-50 text-slate-500 border-slate-200"
          >
            <VoiceProfilePanel
              data={data.voiceProfile}
              existingFlags={voiceFlags}
              onFlag={submitFlag}
            />
          </CardShell>

        </div>
      </div>
    </div>
  );
};

export default ExpertTwinPage;
