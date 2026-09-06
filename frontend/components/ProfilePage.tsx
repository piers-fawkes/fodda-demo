import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { PageShell } from './PageShell';

interface ProfilePageProps {
  user: User;
  account: Account;
  onUpdate?: (user?: User, account?: Account) => void;
  onNavigate?: (view: string) => void;
  onOpenReceipt?: (receiptId: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  account,
  onUpdate,
  onNavigate,
  onOpenReceipt
}) => {
  // Edit Profile Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    firstName: user.name?.split(' ')[0] || '',
    lastName: user.name?.split(' ').slice(1).join(' ') || '',
    jobTitle: user.jobTitle || '',
    company: user.company || '',
    email: user.email || ''
  });
  const [savingUser, setSavingUser] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Usage & Execution data
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (account?.id) {
      setLoadingUsage(true);
      dataService.getAccountUsage(account.id)
        .then(res => {
          if (isMounted && res?.ok && res?.usage) {
            setUsageData(res.usage);
          }
        })
        .catch(err => console.error('[ProfilePage] Failed to load usage data:', err))
        .finally(() => { if (isMounted) setLoadingUsage(false); });
    }
    return () => { isMounted = false; };
  }, [account?.id]);

  const handleUserUpdate = async () => {
    setSavingUser(true);
    try {
      const res = await dataService.updateUserProfile(user.email, {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        jobTitle: userForm.jobTitle,
        company: userForm.company,
        email: userForm.email
      });
      if (res.ok) {
        const updatedName = `${userForm.firstName} ${userForm.lastName}`.trim();
        const updatedUser: User = {
          ...user,
          name: updatedName,
          userName: updatedName,
          jobTitle: userForm.jobTitle,
          company: userForm.company,
          email: userForm.email
        };
        onUpdate?.(updatedUser);
        setToast({ msg: 'Profile updated successfully', type: 'success' });
        setIsUserModalOpen(false);
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ msg: 'Failed to update: ' + res.error, type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setToast({ msg: 'Error updating profile', type: 'error' });
    } finally {
      setSavingUser(false);
    }
  };

  const monthlyQueries = usageData?.monthlyQueries ?? (account.currentQueryCount || 0);
  const monthlyQueryLimit = usageData?.monthlyQueryLimit ?? (account.monthlyQueryLimit || 100);
  const remainingQueries = usageData?.remainingQueries ?? Math.max(0, monthlyQueryLimit - monthlyQueries);
  const totalQueries = (account as any)?.lifetimeQueries
    ?? usageData?.lifetimeQueries
    ?? (account as any)?.totalQueries
    ?? usageData?.totalQueries
    ?? monthlyQueries;

  const usagePercent = monthlyQueryLimit > 0 ? Math.min(100, Math.round((monthlyQueries / monthlyQueryLimit) * 100)) : 0;
  const recentQueries: any[] = usageData?.recentQueries || [];
  const hasMultiStep = recentQueries.some((q: any) => (q.stepCount || 1) > 1);

  const displayName = user.name || user.userName || user.email?.split('@')[0] || 'Profile';

  return (
    <PageShell
      eyebrow="Profile"
      title={displayName}
      subtitle={`${user.email || ''} · ${user.jobTitle ? `${user.jobTitle} · ` : ''}${account?.name || 'Fodda'}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('home')}
            className="px-3.5 py-2 bg-white border border-line text-ink font-bold text-xs rounded-xl hover:bg-cream transition-colors shadow-sm"
          >
            Workspace Home
          </button>
          <button
            onClick={() => setIsUserModalOpen(true)}
            className="px-3.5 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
          >
            Edit profile
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

      {/* Edit Profile Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}>
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg p-6 m-4 animate-fade-in-up border border-line" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-ink">Edit Profile</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-ink-4 hover:text-ink">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">First Name</label>
                  <input type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Last Name</label>
                  <input type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Job Title</label>
                  <input type="text" value={userForm.jobTitle} onChange={e => setUserForm({ ...userForm, jobTitle: e.target.value })} className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Company</label>
                  <input type="text" value={userForm.company} onChange={e => setUserForm({ ...userForm, company: e.target.value })} className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-xs font-bold text-ink-3 hover:text-ink">Cancel</button>
              <button onClick={handleUserUpdate} disabled={savingUser} className="px-5 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50">
                {savingUser ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Headline Stat Cards (3 Columns, Single Row — No Duplication) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Queries Used */}
        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Queries Used</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{monthlyQueries.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">This month ({usagePercent}% of monthly limit)</p>
          {monthlyQueryLimit > 0 && (
            <div className="mt-2 h-1.5 bg-cream rounded-full overflow-hidden border border-line/40">
              <div
                className={`h-full rounded-full transition-all duration-700 ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-brand'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Queries Remaining */}
        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Queries Remaining</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">
            {monthlyQueryLimit ? remainingQueries.toLocaleString() : '∞'}
          </p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">Available until renewal</p>
        </div>

        {/* All-Time Queries */}
        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">All-Time Queries</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{totalQueries.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">Lifetime account volume</p>
        </div>
      </div>

      {/* ── 2. Recent Query Executions Table ── */}
      <section className="p-6 bg-paper border border-line rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Execution History</p>
            <h3 className="font-serif italic text-xl text-ink font-bold">Recent Queries</h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-ink-3 bg-cream border border-line px-3 py-1 rounded-full">
            Click row for Answer Receipt
          </span>
        </div>

        {loadingUsage ? (
          <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-xl border border-line/60">
            Loading recent queries…
          </div>
        ) : recentQueries.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-xl border border-line/60">
            No queries logged yet for this account. Run a query in Ask Fodda or connect an MCP client!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">
                  <th className="pb-3 pr-4">Query</th>
                  <th className="pb-3 px-4">Domain / Graph</th>
                  <th className="pb-3 px-4">Date</th>
                  <th className="pb-3 px-4">Source</th>
                  {hasMultiStep && <th className="pb-3 pl-4 text-right">Steps</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 text-xs">
                {recentQueries.map((q: any) => {
                  const dateStr = q.timestamp
                    ? new Date(q.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—';
                  const isMulti = (q.stepCount || 1) > 1;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => onOpenReceipt?.(q.id)}
                      className="hover:bg-cream/60 transition-colors cursor-pointer group"
                      title="Click to view Answer Receipt"
                    >
                      <td className="py-3.5 pr-4 font-medium text-ink max-w-sm truncate group-hover:text-brand transition-colors" title={q.question}>
                        {q.question}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-ink-3 text-[11px]">
                        {q.graphId}
                      </td>
                      <td className="py-3.5 px-4 text-ink-3 text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${q.source === 'mcp' ? 'bg-purple-100 text-purple-800 border border-purple-200' : q.source === 'trial' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                          {q.source || 'api'}
                        </span>
                      </td>
                      {hasMultiStep && (
                        <td className="py-3.5 pl-4 text-right">
                          {isMulti ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {q.stepCount} steps
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-3">1 step</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
};
