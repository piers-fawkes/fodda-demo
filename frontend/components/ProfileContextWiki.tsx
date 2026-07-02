import React, { useState, useEffect, useCallback } from 'react';
import { User, Account } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────

interface ProfileContextWikiProps {
  user: User | null;
  account: Account | null;
  onSaveContext: (context: string, showToast?: boolean) => void;
}

interface InterestNode {
  node: string;
  weight: number;
}

interface EngagementDomain {
  node: string;
  avgDepth: number;
  queryCount: number;
}

interface ExpertiseDomain {
  node: string;
  contributionCount: number;
  latestDate?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : fallback) as T;
  } catch {
    return fallback;
  }
}

// ─── Chevron Icon ────────────────────────────────────────────────

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={`w-4 h-4 text-ink-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ─── Section Wrapper ─────────────────────────────────────────────

const WikiSection: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-paper border border-line rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-cream/40 transition-colors duration-200"
      >
        <div className="w-9 h-9 rounded-xl bg-brand/8 border border-brand/12 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="eyebrow">{title}</h3>
          <p className="text-xs text-ink-4 mt-0.5 truncate">{subtitle}</p>
        </div>
        <ChevronIcon open={isOpen} />
      </button>
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isOpen ? '1200px' : '0',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-5 pb-5 space-y-3">
          <div className="border-t border-line/50 pt-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Section Icons ───────────────────────────────────────────────

const PersonaIcon = () => (
  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const InterestsIcon = () => (
  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const DepthIcon = () => (
  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ExpertiseIcon = () => (
  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const NotesIcon = () => (
  <svg className="w-4.5 h-4.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// ═════════════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════

export const ProfileContextWiki: React.FC<ProfileContextWikiProps> = ({
  user,
  account,
  onSaveContext,
}) => {
  // ─── Share toggle ───
  const [shareEnabled, setShareEnabled] = useState(user?.shareContextInSessions !== false);
  const [shareToggling, setShareToggling] = useState(false);

  // ─── Section 1: Research Persona ───
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [personaDraft, setPersonaDraft] = useState('');
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaToast, setPersonaToast] = useState<string | null>(null);

  // ─── Section 5: Free Notes ───
  const [notesValue, setNotesValue] = useState(user?.userContext || '');
  const [notesSaving, setNotesSaving] = useState(false);

  // Sync notes from props
  useEffect(() => {
    setNotesValue(user?.userContext || '');
  }, [user?.userContext]);

  // Sync share toggle from props
  useEffect(() => {
    setShareEnabled(user?.shareContextInSessions !== false);
  }, [user?.shareContextInSessions]);

  const handleToggleShare = async (enabled: boolean) => {
    if (!user?.email) return;
    setShareEnabled(enabled);
    setShareToggling(true);
    try {
      await fetch('/api/user/toggle-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, enabled }),
      });
    } catch (e) {
      console.error('[ProfileContextWiki] Toggle share failed:', e);
      setShareEnabled(!enabled); // revert on failure
    } finally {
      setShareToggling(false);
    }
  };

  // ─── Persona helpers ───
  const hasProposedPersona = !user?.personaConfirmed && !!user?.currentPersonaText;
  const hasConfirmedPersona = !!user?.personaConfirmed && !!user?.confirmedPersonaText;

  const startEditPersona = useCallback(() => {
    const initial = hasConfirmedPersona
      ? user?.confirmedPersonaText || ''
      : hasProposedPersona
        ? user?.currentPersonaText || ''
        : '';
    setPersonaDraft(initial);
    setIsEditingPersona(true);
  }, [user, hasConfirmedPersona, hasProposedPersona]);

  const handleSavePersona = async (text: string) => {
    if (!user?.email) return;
    setPersonaSaving(true);
    try {
      const res = await fetch('/api/user/confirm-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, confirmedText: text }),
      });
      if (res.ok) {
        setPersonaToast('Persona saved successfully');
        setIsEditingPersona(false);
        setTimeout(() => setPersonaToast(null), 3000);
      } else {
        setPersonaToast('Failed to save persona');
        setTimeout(() => setPersonaToast(null), 3000);
      }
    } catch (e) {
      console.error('[ProfileContextWiki] Failed to save persona:', e);
      setPersonaToast('Error saving persona');
      setTimeout(() => setPersonaToast(null), 3000);
    } finally {
      setPersonaSaving(false);
    }
  };

  // ─── Section 2: Interests ───
  const interests: InterestNode[] = safeParseJSON<InterestNode[]>(
    user?.interestsCurrent,
    []
  ).sort((a, b) => b.weight - a.weight);

  // ─── Section 3: Engagement Domains ───
  const engagementDomains: EngagementDomain[] = safeParseJSON<EngagementDomain[]>(
    user?.topEngagementDomains,
    []
  );

  // ─── Section 4: Expertise ───
  const expertiseDomains: ExpertiseDomain[] = safeParseJSON<ExpertiseDomain[]>(
    user?.confirmedExpertiseDomains,
    []
  );

  // ─── Notes save ───
  const handleSaveNotes = () => {
    setNotesSaving(true);
    onSaveContext(notesValue, true);
    // Simulate a brief save state
    setTimeout(() => setNotesSaving(false), 600);
  };

  return (
    <div className="space-y-4">
      {/* ─── Share Toggle ─── */}
      <div className="flex items-center justify-between bg-paper border border-line rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/8 border border-green-500/12 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Share during AI sessions</p>
            <p className="text-[10px] text-ink-4 mt-0.5">
              {shareEnabled ? 'Your persona & context are injected to improve results' : 'Context is paused — AI responses will be generic'}
            </p>
          </div>
        </div>
        <button
          onClick={() => handleToggleShare(!shareEnabled)}
          disabled={shareToggling}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
            shareEnabled ? 'bg-green-500' : 'bg-ink-2/20'
          } ${shareToggling ? 'opacity-50' : ''}`}
          role="switch"
          aria-checked={shareEnabled}
          aria-label="Share context during AI sessions"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              shareEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* ─── Floating Toast ─── */}
      {personaToast && (
        <div className="fixed top-4 right-4 z-[300] px-4 py-3 rounded-xl border shadow-lg animate-fade-in-up flex items-center gap-3 max-w-sm bg-green-50 border-green-200 text-green-800">
          <span className="text-xs font-medium">{personaToast}</span>
          <button onClick={() => setPersonaToast(null)} className="text-ink-4 hover:text-ink shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 1: Your Research Persona                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <WikiSection
        title="Your Research Persona"
        subtitle={hasConfirmedPersona ? 'Last confirmed persona' : 'AI-generated from your activity'}
        icon={<PersonaIcon />}
        defaultOpen={true}
      >
        {/* Proposed persona banner (unconfirmed) */}
        {hasProposedPersona && !isEditingPersona && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 mb-4 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-200 mb-1">AI has proposed an updated persona based on your activity</p>
                <p className="text-sm text-amber-100/80 leading-relaxed whitespace-pre-wrap">
                  {user?.currentPersonaText}
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setPersonaDraft(user?.currentPersonaText || '');
                  setIsEditingPersona(true);
                }}
                className="px-4 py-2 bg-amber-500/20 text-amber-200 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-all border border-amber-500/30"
              >
                Review &amp; Confirm
              </button>
            </div>
          </div>
        )}

        {/* Confirmed persona display */}
        {hasConfirmedPersona && !isEditingPersona && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">
              {user?.confirmedPersonaText}
            </p>
            {user?.personaLastUpdated && (
              <p className="text-[10px] text-ink-4 italic">
                Last updated: {user.personaLastUpdated}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasProposedPersona && !hasConfirmedPersona && !isEditingPersona && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-sm text-ink-3 max-w-xs">
              Use Fodda to build your research persona over time
            </p>
            <p className="text-[10px] text-ink-4 mt-1">
              Your persona is synthesized from your queries, corrections, and graph usage
            </p>
          </div>
        )}

        {/* Inline edit textarea */}
        {isEditingPersona && (
          <div
            className="space-y-3 transition-all duration-300"
            style={{ opacity: isEditingPersona ? 1 : 0 }}
          >
            <textarea
              value={personaDraft}
              onChange={(e) => setPersonaDraft(e.target.value)}
              className="w-full h-36 bg-cream border border-line rounded-xl px-4 py-3 text-sm text-ink-2 focus:outline-none focus:border-brand transition-all resize-none hover:border-line-strong"
              placeholder="Describe your research persona, expertise, and how you approach analysis..."
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditingPersona(false)}
                className="px-4 py-2 text-ink-3 text-sm font-medium hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePersona(personaDraft)}
                disabled={personaSaving || !personaDraft.trim()}
                className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {personaSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Edit button (when not editing) */}
        {!isEditingPersona && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={startEditPersona}
              className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-brand transition-colors font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Edit
            </button>
          </div>
        )}
      </WikiSection>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 2: Your Interests                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <WikiSection
        title="Your Interests"
        subtitle="Based on your recent queries · Auto-updated nightly"
        icon={<InterestsIcon />}
      >
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map((interest, idx) => {
              const opacity = Math.max(0.4, Math.min(1.0, interest.weight));
              return (
                <span
                  key={`${interest.node}-${idx}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20 transition-all duration-200 hover:scale-105"
                  style={{ opacity }}
                  title={`Weight: ${interest.weight.toFixed(2)}`}
                >
                  {interest.node}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <p className="text-sm text-ink-3">No interests detected yet — keep using Fodda!</p>
            <p className="text-[10px] text-ink-4 mt-1">
              Interests are inferred from your query patterns and updated nightly
            </p>
          </div>
        )}
      </WikiSection>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 3: Areas You Go Deep On                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <WikiSection
        title="Areas You Go Deep On"
        subtitle="Inferred from your query depth"
        icon={<DepthIcon />}
      >
        {engagementDomains.length > 0 ? (
          <div className="space-y-4">
            {engagementDomains.map((domain, idx) => {
              const widthPercent = Math.min(100, (domain.avgDepth / 5.0) * 100);
              return (
                <div key={`${domain.node}-${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-2 font-medium">{domain.node}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-4">
                        {domain.avgDepth.toFixed(1)} / 5.0
                      </span>
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-brand/8 text-[9px] font-bold text-brand tabular-nums">
                        {domain.queryCount}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-ink-2/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm text-ink-3">No deep engagement areas detected yet</p>
            <p className="text-[10px] text-ink-4 mt-1">
              Go deeper on topics to see your engagement profile emerge
            </p>
          </div>
        )}
      </WikiSection>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 4: Your Demonstrated Expertise                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <WikiSection
        title="Your Demonstrated Expertise"
        subtitle="Backed by your corrections and contributions"
        icon={<ExpertiseIcon />}
      >
        {expertiseDomains.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {expertiseDomains.map((domain, idx) => (
              <div
                key={`${domain.node}-${idx}`}
                className="p-3 bg-cream border border-line rounded-xl hover:border-brand/20 hover:shadow-sm transition-all duration-200"
              >
                <p className="text-sm font-bold text-ink truncate">{domain.node}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-ink-3 font-medium">
                    {domain.contributionCount} contribution{domain.contributionCount !== 1 ? 's' : ''}
                  </span>
                  {domain.latestDate && (
                    <>
                      <span className="text-ink-4">·</span>
                      <span className="text-[10px] text-ink-4 italic">{domain.latestDate}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-cream border border-line flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="text-sm text-ink-3">Contribute corrections or extensions to build this section</p>
            <p className="text-[10px] text-ink-4 mt-1">
              Expertise is earned by improving Fodda's knowledge graphs
            </p>
          </div>
        )}
      </WikiSection>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Section 5: Free Notes                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <WikiSection
        title="Free Notes"
        subtitle="Your own notes — always editable, always injected"
        icon={<NotesIcon />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            className="w-full h-40 bg-cream border border-line rounded-xl px-4 py-3 text-sm text-ink-2 focus:outline-none focus:border-brand transition-all resize-none hover:border-line-strong"
            placeholder="Add your own notes to shape how Fodda responds. These are always injected into every query context…"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-ink-4">
              {notesValue.length > 0
                ? `${notesValue.length} characters · injected into every query`
                : 'Empty — add context to personalise responses'}
            </p>
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {notesSaving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      </WikiSection>
    </div>
  );
};

export default ProfileContextWiki;
