import React, { useState, useEffect } from 'react';
import { User, Account } from '../../shared/types.js';

// ── Types for parsed JSON fields ──
interface InterestNode {
  node: string;
  weight: number;
}

interface EngagementDomain {
  node: string;
  avgDepth: number;
  queryCount: number;
}

interface KnowledgeDomain {
  graph: string;
  queryShare: number;
}

// ── Props ──
export interface AccountContextWikiProps {
  user: User | null;
  account: Account | null;
  onSaveContext: (context: string, showToast?: boolean) => void;
}

// ── Helpers ──
function safeParseJSON<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Chevron Icon ──
const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={`w-4 h-4 text-ink-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ── Lock Icon (for non-admin users on editable sections) ──
const LockIcon: React.FC = () => (
  <div className="relative group/lock">
    <svg className="w-3.5 h-3.5 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-ink text-white text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/lock:opacity-100 transition-opacity z-10 shadow-lg">
      Only account owners can edit
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-ink" />
    </div>
  </div>
);

// ══════════════════════════════════════════════
// AccountContextWiki Component
// ══════════════════════════════════════════════
export const AccountContextWiki: React.FC<AccountContextWikiProps> = ({ user, account, onSaveContext }) => {
  // ── Collapsible section state ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    focus: true,
    interests: true,
    engagement: true,
    domains: true,
    notes: true,
  });

  // ── Section 1: Organization Focus ──
  const [personaText, setPersonaText] = useState('');
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaToast, setPersonaToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Section 5: Free Notes ──
  const [notesText, setNotesText] = useState('');

  // ── Role checks ──
  const isOwnerOrAdmin = user?.role === 'Owner' || user?.role === 'Admin';

  // ── Share toggle ──
  const [shareEnabled, setShareEnabled] = useState(account?.shareAccountContextInSessions !== false);
  const [shareToggling, setShareToggling] = useState(false);

  useEffect(() => {
    setShareEnabled(account?.shareAccountContextInSessions !== false);
  }, [account?.shareAccountContextInSessions]);

  const handleToggleShare = async (enabled: boolean) => {
    if (!account?.id || !isOwnerOrAdmin) return;
    setShareEnabled(enabled);
    setShareToggling(true);
    try {
      await fetch('/api/account/toggle-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, enabled }),
      });
    } catch (e) {
      console.error('[AccountContextWiki] Toggle share failed:', e);
      setShareEnabled(!enabled); // revert on failure
    } finally {
      setShareToggling(false);
    }
  };

  // ── Sync from account data ──
  useEffect(() => {
    if (account?.accountPersonaConfirmed && account.confirmedAccountPersonaText) {
      setPersonaText(account.confirmedAccountPersonaText);
    } else if (account?.currentAccountPersonaText) {
      setPersonaText(account.currentAccountPersonaText);
    } else {
      setPersonaText('');
    }
  }, [account?.confirmedAccountPersonaText, account?.currentAccountPersonaText, account?.accountPersonaConfirmed]);

  useEffect(() => {
    setNotesText(account?.accountContext || '');
  }, [account?.accountContext]);

  // ── Parsed data for sections 2-4 ──
  const teamInterests = safeParseJSON<InterestNode[]>(account?.teamInterestsCurrent, []);
  const engagementDomains = safeParseJSON<EngagementDomain[]>(account?.teamEngagementDomains, []);
  const knowledgeDomains = safeParseJSON<KnowledgeDomain[]>(account?.activeKnowledgeDomains, []);

  // ── Toggle section ──
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Section 1: Save confirmed persona ──
  const handleConfirmPersona = async () => {
    if (!account?.id || !personaText.trim()) return;
    setPersonaSaving(true);
    try {
      const res = await fetch('/api/account/confirm-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, confirmedText: personaText }),
      });
      if (res.ok) {
        setPersonaToast({ msg: 'Organization focus confirmed', type: 'success' });
      } else {
        const data = await res.json().catch(() => ({}));
        setPersonaToast({ msg: data.error || 'Failed to save', type: 'error' });
      }
    } catch (e: any) {
      console.error('[AccountContextWiki] confirm-persona failed', e);
      setPersonaToast({ msg: 'Network error', type: 'error' });
    } finally {
      setPersonaSaving(false);
      setTimeout(() => setPersonaToast(null), 3000);
    }
  };

  // ── Max weight / depth for normalization ──
  const maxWeight = teamInterests.length > 0 ? Math.max(...teamInterests.map(i => i.weight)) : 1;
  const maxDepth = engagementDomains.length > 0 ? Math.max(...engagementDomains.map(d => d.avgDepth)) : 1;
  const maxShare = knowledgeDomains.length > 0 ? Math.max(...knowledgeDomains.map(d => d.queryShare)) : 1;

  // ── Whether the proposed persona needs review ──
  const needsReview = !account?.accountPersonaConfirmed && !!account?.currentAccountPersonaText;

  return (
    <>
      {/* Toast */}
      {personaToast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-xl border shadow-lg animate-fade-in-up flex items-center gap-3 max-w-sm ${personaToast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span className="text-xs font-medium">{personaToast.msg}</span>
          <button onClick={() => setPersonaToast(null)} className="text-ink-4 hover:text-ink shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="space-y-5">

        {/* ── Share Toggle ── */}
        <div className="flex items-center justify-between bg-paper border border-line rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/8 border border-green-500/12 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Share during AI sessions</p>
              <p className="text-[10px] text-ink-4 mt-0.5">
                {shareEnabled ? 'Account context is injected to improve team results' : 'Account context is paused — AI responses will be generic'}
              </p>
            </div>
            {!isOwnerOrAdmin && <LockIcon />}
          </div>
          <button
            onClick={() => handleToggleShare(!shareEnabled)}
            disabled={shareToggling || !isOwnerOrAdmin}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
              shareEnabled ? 'bg-green-500' : 'bg-ink-2/20'
            } ${shareToggling || !isOwnerOrAdmin ? 'opacity-50' : ''}`}
            role="switch"
            aria-checked={shareEnabled}
            aria-label="Share account context during AI sessions"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                shareEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* ═══════════════════════════════════════════
            Section 1 — Organization Focus
        ═══════════════════════════════════════════ */}
        <section className="bg-paper border border-line rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('focus')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="eyebrow">Organization Focus</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">AI-synthesized summary of your team's research direction</p>
              </div>
              {!isOwnerOrAdmin && <LockIcon />}
            </div>
            <ChevronIcon open={!!openSections.focus} />
          </button>

          {openSections.focus && (
            <div className="px-5 pb-5 space-y-3">
              {/* Amber banner for unconfirmed proposed persona */}
              {needsReview && isOwnerOrAdmin && (
                <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Proposed focus — needs your review</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Fodda generated this summary from your team's activity. Edit if needed, then confirm.</p>
                  </div>
                </div>
              )}

              {isOwnerOrAdmin ? (
                <>
                  <textarea
                    value={personaText}
                    onChange={(e) => setPersonaText(e.target.value)}
                    className="w-full h-32 bg-cream border border-line rounded-xl px-4 py-3 text-sm text-ink-2 focus:outline-none focus:border-brand transition-all resize-none hover:border-line-strong"
                    placeholder="Describe your organization's research focus and how the team uses Fodda..."
                  />
                  <div className="flex items-center gap-3">
                    {needsReview ? (
                      <button
                        onClick={handleConfirmPersona}
                        disabled={personaSaving}
                        className="px-4 py-2 bg-amber-500 text-white font-bold text-xs rounded-[10px] hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {personaSaving ? 'Saving...' : '✓ Review & Confirm'}
                      </button>
                    ) : (
                      <button
                        onClick={handleConfirmPersona}
                        disabled={personaSaving}
                        className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-[10px] hover:bg-brand-dark transition-colors disabled:opacity-50"
                      >
                        {personaSaving ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    {account?.accountPersonaConfirmed && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Confirmed
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 bg-cream border border-line rounded-xl">
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">
                    {personaText || <span className="italic text-ink-4">No organization focus defined yet.</span>}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            Section 2 — Team Interests
        ═══════════════════════════════════════════ */}
        <section className="bg-paper border border-line rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('interests')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="eyebrow">Team Interests</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">What your team collectively researches</p>
              </div>
            </div>
            <ChevronIcon open={!!openSections.interests} />
          </button>

          {openSections.interests && (
            <div className="px-5 pb-5">
              {teamInterests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teamInterests.map((item, i) => {
                    const opacity = Math.max(0.35, item.weight / maxWeight);
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105"
                        style={{
                          backgroundColor: `rgba(var(--color-brand-rgb, 99, 102, 241), ${opacity * 0.12})`,
                          borderColor: `rgba(var(--color-brand-rgb, 99, 102, 241), ${opacity * 0.25})`,
                          color: `rgba(var(--color-brand-rgb, 99, 102, 241), ${Math.max(0.6, opacity)})`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {item.node}
                        <span className="text-[10px] opacity-50 ml-0.5">{Math.round(item.weight * 100)}%</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-ink-4 italic">No team interest data yet — this builds from team queries over time.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            Section 3 — Team Engagement Depth
        ═══════════════════════════════════════════ */}
        <section className="bg-paper border border-line rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('engagement')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="eyebrow">Team Engagement Depth</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">Where your team goes deepest</p>
              </div>
            </div>
            <ChevronIcon open={!!openSections.engagement} />
          </button>

          {openSections.engagement && (
            <div className="px-5 pb-5">
              {engagementDomains.length > 0 ? (
                <div className="space-y-3">
                  {engagementDomains.map((domain, i) => {
                    const pct = maxDepth > 0 ? (domain.avgDepth / maxDepth) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-ink-2 truncate">{domain.node}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-[10px] text-ink-4">{domain.queryCount} queries</span>
                            <span className="text-[10px] font-bold text-ink-3">{domain.avgDepth.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-line-soft rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-ink-4 italic">No engagement depth data yet — this builds from team queries over time.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            Section 4 — Active Knowledge Domains
        ═══════════════════════════════════════════ */}
        <section className="bg-paper border border-line rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('domains')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="eyebrow">Active Knowledge Domains</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">Query distribution across knowledge graphs</p>
              </div>
            </div>
            <ChevronIcon open={!!openSections.domains} />
          </button>

          {openSections.domains && (
            <div className="px-5 pb-5">
              {knowledgeDomains.length > 0 ? (
                <div className="space-y-3">
                  {/* Color palette for chart bars */}
                  {knowledgeDomains.map((domain, i) => {
                    const pctOfMax = maxShare > 0 ? (domain.queryShare / maxShare) * 100 : 0;
                    const displayPct = Math.round(domain.queryShare * 100);
                    const barColors = [
                      'from-emerald-400 to-emerald-600',
                      'from-blue-400 to-blue-600',
                      'from-purple-400 to-purple-600',
                      'from-amber-400 to-amber-600',
                      'from-pink-400 to-pink-600',
                      'from-cyan-400 to-cyan-600',
                      'from-orange-400 to-orange-600',
                      'from-indigo-400 to-indigo-600',
                    ];
                    const color = barColors[i % barColors.length];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-ink-2 truncate">{domain.graph}</span>
                          <span className="text-[10px] font-bold text-ink-3 shrink-0 ml-3">{displayPct}%</span>
                        </div>
                        <div className="h-2 bg-line-soft rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                            style={{ width: `${pctOfMax}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-ink-4 italic">No knowledge domain data yet — this builds from team queries over time.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            Section 5 — Free Notes
        ═══════════════════════════════════════════ */}
        <section className="bg-paper border border-line rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('notes')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="eyebrow">Free Notes</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">Team-wide notes — always editable, always injected</p>
              </div>
              {!isOwnerOrAdmin && <LockIcon />}
            </div>
            <ChevronIcon open={!!openSections.notes} />
          </button>

          {openSections.notes && (
            <div className="px-5 pb-5 space-y-3">
              {isOwnerOrAdmin ? (
                <>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="w-full h-40 bg-cream border border-line rounded-xl px-4 py-3 text-sm text-ink-2 focus:outline-none focus:border-brand transition-all resize-none hover:border-line-strong"
                    placeholder="Describe your organization's research focus, industry, and how you use Fodda..."
                  />
                  <button
                    onClick={() => onSaveContext(notesText, true)}
                    className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-[10px] hover:bg-brand-dark transition-colors"
                  >
                    Save Context Wiki
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 bg-cream border border-line rounded-xl">
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">
                    {notesText || <span className="italic text-ink-4">No team notes defined yet.</span>}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </>
  );
};

export default AccountContextWiki;
