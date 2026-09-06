import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { PageShell } from './PageShell';

interface HomeDashboardProps {
  user: User;
  account: Account;
  onNavigate: (view: string, extra?: any) => void;
  onTryPrompt?: (promptText: string, graphId?: string) => void;
  onOpenReceipt?: (receiptId: string) => void;
  onUpdate?: (user?: User, account?: Account) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  account,
  onNavigate,
  onTryPrompt,
  onOpenReceipt,
  onUpdate
}) => {
  const [mcpConn, setMcpConn] = useState<any>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [accountUsers, setAccountUsers] = useState<any[]>([]);

  // Rotate API Key state
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  // Expert activity state (for registered experts)
  const [expertActivity, setExpertActivity] = useState<{ queryCount7d: number; recentQuestions: any[] } | null>(null);
  const [loadingExpert, setLoadingExpert] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (user?.email) {
      dataService.getMcpConnection(account?.id, user.email)
        .then(conn => { if (isMounted && conn) setMcpConn(conn); })
        .catch(() => {});
    }

    if (account?.id) {
      dataService.getAccountUsers(account.id)
        .then((res: any) => {
          if (isMounted && res?.ok && res?.users) {
            setAccountUsers(res.users);
          }
        })
        .catch(() => {});
    }

    // If user is an expert, fetch 7-day queries and recent questions
    if (user?.isExpert) {
      setLoadingExpert(true);
      dataService.getExpertActivity()
        .then(act => {
          if (isMounted && act?.ok) {
            setExpertActivity(act);
          }
        })
        .catch(err => console.warn('[HomeDashboard] Expert activity warning:', err))
        .finally(() => { if (isMounted) setLoadingExpert(false); });
    }

    return () => { isMounted = false; };
  }, [user?.email, user?.isExpert, account?.id]);

  const handleRotateApiKey = async () => {
    setIsRotating(true);
    setRotateError(null);
    try {
      const res = await dataService.rotateApiKey(user.email);
      if (res.ok && res.apiKey) {
        if (onUpdate) {
          onUpdate(user, { ...account, apiKey: res.apiKey });
        }
        if (res.mcpConn) {
          setMcpConn(res.mcpConn);
        } else if (user?.email) {
          dataService.getMcpConnection(account?.id, user.email).then(conn => setMcpConn(conn)).catch(() => {});
        }
        navigator.clipboard.writeText(res.apiKey);
        setToast({ msg: 'API Key rotated successfully! New key copied to clipboard.', type: 'success' });
        setIsRotateModalOpen(false);
        setTimeout(() => setToast(null), 3500);
      } else {
        setRotateError(res.error || 'Failed to rotate API Key.');
      }
    } catch (err: any) {
      setRotateError(err.message || 'An error occurred while rotating API Key.');
    } finally {
      setIsRotating(false);
    }
  };

  const monthlyQueries = account?.currentQueryCount || 0;
  const monthlyQueryLimit = account?.monthlyQueryLimit || 100;
  const remainingQueries = Math.max(0, monthlyQueryLimit - monthlyQueries);

  const mcpToken = mcpConn?.token || (account as any)?.mcpToken;
  const mcpFullUrl = mcpConn?.mcpUrl || (mcpToken ? `https://mcp.fodda.ai/c/${mcpToken}` : 'https://mcp.fodda.ai/mcp');
  const mcpMaskedUrl = mcpToken ? `https://mcp.fodda.ai/c/${mcpToken.slice(0, 6)}…` : 'https://mcp.fodda.ai/mcp';

  const copyMcpUrl = () => {
    navigator.clipboard.writeText(mcpFullUrl);
    setMcpCopied(true);
    setToast({ msg: 'MCP Server URL copied to clipboard', type: 'success' });
    setTimeout(() => { setMcpCopied(false); setToast(null); }, 2500);
  };

  const firstName = user?.name ? user.name.split(' ')[0] : (user?.email?.split('@')[0] || 'Partner');
  const planLevel = account?.planLevel || 'Free';
  const planName = account?.planName || (planLevel === 'Free' ? 'Base - Free' : `${planLevel} Plan`);
  const ownerUsers = accountUsers.filter((u: any) => u.role === 'Owner');

  // Vertical and scope restriction logic
  const verticalScope = account?.vertical;
  const hasVerticalRestriction = verticalScope && verticalScope.toLowerCase() !== 'all';
  const scopeLabel = hasVerticalRestriction
    ? `Restricted to: ${verticalScope.charAt(0).toUpperCase() + verticalScope.slice(1)} vertical graphs only`
    : 'Full Catalog Access (All 90+ industry & expert graphs)';

  return (
    <PageShell
      eyebrow="Home"
      title={`Welcome back, ${firstName}`}
      subtitle={`${account?.name || 'Your Org'} · ${planName} · ${remainingQueries.toLocaleString()} queries remaining`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('sandbox')}
            className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>Ask Fodda</span>
            <span>💬</span>
          </button>
          <button
            onClick={() => onNavigate('connections')}
            className="px-3.5 py-2 bg-white border border-line text-ink font-bold text-xs rounded-xl hover:bg-cream transition-colors shadow-2xs"
          >
            Connect AI
          </button>
        </div>
      }
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-xl border shadow-lg animate-fade-in-up flex items-center gap-3 max-w-sm ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span className="text-xs font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-ink-4 hover:text-ink shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Rotate API Key Modal */}
      {isRotateModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setIsRotateModalOpen(false)}>
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 m-4 animate-fade-in-up border border-line" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-ink">Rotate API Key</h3>
              <button onClick={() => setIsRotateModalOpen(false)} className="text-ink-4 hover:text-ink">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs text-ink-3 leading-relaxed mb-4">
              Are you sure you want to rotate your API Key? Any existing MCP or API connections using the old key will break until updated.
            </p>
            {rotateError && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 mb-4">{rotateError}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsRotateModalOpen(false)} className="px-4 py-2 text-xs font-bold text-ink-3 hover:text-ink">Cancel</button>
              <button onClick={handleRotateApiKey} disabled={isRotating} className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
                {isRotating ? 'Rotating…' : 'Confirm Rotate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Plan Level & Account Details (Higher Up) ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your Plan Level &amp; Access</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-soft text-brand border border-brand/20">
              {planName}
            </span>
          </div>
          <button
            onClick={() => onNavigate('account-billing')}
            className="text-xs font-bold text-brand hover:underline"
          >
            Manage Billing →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1 border-b border-line/30">
              <span className="text-ink-4">Organization</span>
              <span className="font-bold text-ink">{account?.name || 'Fodda'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-line/30">
              <span className="text-ink-4">Your Role</span>
              <span className="font-bold text-ink">{user.role || 'Member'}</span>
            </div>
            {ownerUsers.length > 0 && (
              <div className="flex items-center justify-between py-1 border-b border-line/30">
                <span className="text-ink-4">Account Owner</span>
                <span className="text-ink-2">{ownerUsers.map((u: any) => u.userName || u.email).join(', ')}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-1 border-b border-line/30">
              <span className="text-ink-4">Allowance</span>
              <span className="font-bold text-ink">{monthlyQueryLimit.toLocaleString()} calls / month</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-line/30">
              <span className="text-ink-4">Remaining This Cycle</span>
              <span className="font-bold text-brand">{remainingQueries.toLocaleString()} calls</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-line/30">
              <span className="text-ink-4">Renewal Status</span>
              <span className="text-ink-2">
                {account?.hasPaymentMethod ? 'Renews automatically with card on file' : 'Card required to renew'}
              </span>
            </div>
          </div>
        </div>

        {/* Scope / Access Restriction Callout */}
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${hasVerticalRestriction ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-cream/70 border-line/70 text-ink-2'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{hasVerticalRestriction ? '🔒' : '🌐'}</span>
            <div>
              <span className="font-bold block">{hasVerticalRestriction ? 'Access Restriction' : 'Access Coverage'}</span>
              <span className="text-[11px] opacity-90">{scopeLabel}</span>
            </div>
          </div>
          {hasVerticalRestriction && (
            <button
              onClick={() => onNavigate('account-billing')}
              className="px-3 py-1 bg-amber-600 text-white font-bold text-[11px] rounded-lg hover:bg-amber-700 transition-colors shrink-0"
            >
              Upgrade Access
            </button>
          )}
        </div>
      </section>

      {/* ── 2. Your API Key & MCP URL ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your API Key &amp; Personal MCP URL</p>
          {account?.apiKey && (
            <button
              onClick={() => setIsRotateModalOpen(true)}
              className="text-[10px] font-mono text-red-600 hover:underline font-bold"
            >
              Rotate Key
            </button>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold text-ink-4 uppercase mb-1">Account API Key</label>
          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={account?.apiKey || 'No key set'}
              readOnly
              className="flex-1 bg-cream border border-line rounded-xl px-3 py-2 text-xs font-mono text-ink-2 focus:outline-none"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3 py-2 bg-white border border-line text-xs font-bold text-ink-3 rounded-xl hover:text-ink"
            >
              {showApiKey ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={() => {
                if (account?.apiKey) {
                  navigator.clipboard.writeText(account.apiKey);
                  setToast({ msg: 'API Key copied to clipboard', type: 'success' });
                  setTimeout(() => setToast(null), 2500);
                }
              }}
              className="px-3.5 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark shadow-sm"
            >
              Copy Key
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-line/60">
          <label className="block text-[10px] font-mono font-bold text-ink-4 uppercase mb-1">Personal MCP Endpoint</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={mcpMaskedUrl}
              readOnly
              className="flex-1 bg-cream border border-line rounded-xl px-3 py-2 text-xs font-mono text-ink-3 focus:outline-none"
            />
            <button
              onClick={copyMcpUrl}
              className="px-3.5 py-2 bg-brand-soft text-brand font-bold text-xs rounded-xl hover:bg-brand-softer border border-brand/20 shadow-sm"
            >
              {mcpCopied ? '✓ Copied' : 'Copy MCP URL'}
            </button>
          </div>
          <p className="text-[11px] text-ink-3 mt-1.5 flex items-center justify-between">
            <span>Paste directly into Claude, Cursor, ChatGPT, or Gemini.</span>
            <button onClick={() => onNavigate('connections')} className="text-brand font-bold hover:underline">
              Setup Guides →
            </button>
          </p>
        </div>
      </section>

      {/* ── 3. Expert Twin Activity (Conditional on user.isExpert) ── */}
      {user?.isExpert && (
        <section className="p-5 bg-paper border border-line rounded-2xl space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🎓</span>
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Expert Twin Activity</p>
                <h3 className="font-serif italic text-lg text-ink font-bold">Your Human Agent Inquiries</h3>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Last 7 Days
            </span>
          </div>

          <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-700">7-Day Query Volume</p>
              <p className="font-serif italic text-3xl text-purple-950 font-bold leading-tight">
                {loadingExpert ? '…' : (expertActivity?.queryCount7d ?? 0)}
              </p>
              <p className="text-[11px] text-purple-800/80 mt-0.5">
                Questions asked of your expert twin across Claude, MCP, and Fodda
              </p>
            </div>
            <button
              onClick={() => onNavigate('expert-twin')}
              className="px-3.5 py-2 bg-purple-700 text-white font-bold text-xs rounded-xl hover:bg-purple-800 transition-colors shadow-sm shrink-0"
            >
              Manage Twin →
            </button>
          </div>

          {/* List of Recent Questions */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-ink uppercase tracking-wide">Recent Questions</p>
            {loadingExpert ? (
              <div className="p-4 text-center text-xs text-ink-3 italic bg-cream/40 rounded-xl border border-line/60">
                Loading expert questions…
              </div>
            ) : (!expertActivity?.recentQuestions || expertActivity.recentQuestions.length === 0) ? (
              <div className="p-4 text-center text-xs text-ink-3 italic bg-cream/40 rounded-xl border border-line/60">
                No questions asked of your twin in the last 7 days.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {expertActivity.recentQuestions.map((q: any, idx: number) => {
                  const dateStr = q.timestamp
                    ? new Date(q.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <div key={q.id || idx} className="p-3 bg-cream/60 border border-line/60 rounded-xl flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-serif italic text-ink font-medium leading-snug">"{q.question}"</p>
                        <p className="text-[10px] font-mono text-ink-4 mt-1">
                          {dateStr} {q.source ? `· via ${q.source}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 4. Your Research Persona (At Bottom) ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your Research Persona</p>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${user?.personaConfirmed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {user?.personaConfirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
        </div>

        <div className="p-4 bg-cream/60 border border-line/60 rounded-xl">
          <p className="font-serif italic text-sm text-ink-2 leading-relaxed">
            "{user?.userContext || 'No persona defined yet. Complete your research profile to tailor search results to your focus.'}"
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-line/60 text-xs">
          <span className="text-ink-3 font-medium">Adds your persona to the context of every query you run.</span>
          <button
            onClick={() => onNavigate('profile-context')}
            className="text-brand font-bold hover:underline text-xs"
          >
            Review &amp; Edit Persona →
          </button>
        </div>
      </section>
    </PageShell>
  );
};
