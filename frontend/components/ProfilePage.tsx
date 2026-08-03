import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { PageShell } from './PageShell';

interface ProfilePageProps {
  user: User;
  account: Account;
  onUpdate?: (user?: User, account?: Account) => void;
  onNavigate?: (view: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, account, onUpdate, onNavigate }) => {
  const [localContext, setLocalContext] = useState(user.userContext || '');
  const [isContextLocked, setIsContextLocked] = useState(true);

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
  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [sseCopied, setSseCopied] = useState(false);
  const [mcpConn, setMcpConn] = useState<any>(null);

  // Rotate API Key state
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

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
          dataService.getMcpConnection(user.email).then(conn => setMcpConn(conn)).catch(() => {});
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

  useEffect(() => {
    if (user?.email) {
      dataService.getMcpConnection(user.email).then(conn => setMcpConn(conn)).catch(() => {});
    }
  }, [user?.email]);

  const [accountUsers, setAccountUsers] = useState<any[]>([]);

  useEffect(() => {
    setLocalContext(user.userContext || '');
  }, [user.userContext]);

  useEffect(() => {
    if (account?.id) {
      dataService.getAccountUsers(account.id).then((res: any) => {
        if (res.ok && res.users) {
          setAccountUsers(res.users);
        }
      }).catch(() => {});
    }
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

  const currentQueries = account.currentQueryCount || 0;
  const maxQueries = account.monthlyQueryLimit || 0;
  const totalQueries = account.lifetimeQueries || account.totalQueries || currentQueries;

  const mcpToken = mcpConn?.token || (account as any)?.mcpToken;
  const mcpFullUrl = mcpConn?.mcpUrl || (mcpToken ? `https://mcp.fodda.ai/c/${mcpToken}` : 'https://mcp.fodda.ai/mcp');
  const sseFullUrl = mcpConn?.sseUrl || (mcpToken ? `https://mcp.fodda.ai/c/${mcpToken}` : 'https://mcp.fodda.ai/mcp');
  const mcpMaskedUrl = mcpToken ? `https://mcp.fodda.ai/c/${mcpToken.slice(0, 6)}…` : 'https://mcp.fodda.ai/mcp';

  const copyMcpUrl = () => {
    navigator.clipboard.writeText(mcpFullUrl);
    setMcpCopied(true);
    setToast({ msg: 'MCP Server URL copied to clipboard', type: 'success' });
    setTimeout(() => { setMcpCopied(false); setToast(null); }, 2500);
  };

  const displayName = user.name || user.userName || user.email?.split('@')[0] || 'Profile';
  const ownerUsers = accountUsers.filter((u: any) => u.role === 'Owner');
  const adminUsers = accountUsers.filter((u: any) => u.role === 'Admin');

  return (
    <PageShell
      eyebrow="Profile"
      title={displayName}
      subtitle={`${user.email || ''} · ${user.role || 'Member'} at ${account?.name || 'Fodda'}`}
      actions={
        <>
          <button
            onClick={() => onNavigate?.('profile-context')}
            className="px-3.5 py-2 bg-white border border-line text-ink font-bold text-xs rounded-xl hover:bg-cream transition-colors shadow-sm"
          >
            Edit persona
          </button>
          <button
            onClick={() => setIsUserModalOpen(true)}
            className="px-3.5 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
          >
            Edit profile
          </button>
        </>
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

      {/* ── 1. Your Research Persona ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your Research Persona</p>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${user.personaConfirmed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {user.personaConfirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
        </div>

        <div className="p-4 bg-cream/60 border border-line/60 rounded-xl">
          <p className="font-serif italic text-sm text-ink-2 leading-relaxed">
            "{user.userContext || 'No persona defined yet. Complete your research profile to tailor search results to your focus.'}"
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-line/60 text-xs">
          <span className="text-ink-3 font-medium">Adds your persona to the context of every query you run.</span>
          <button
            onClick={() => onNavigate?.('profile-context')}
            className="text-brand font-bold hover:underline text-xs"
          >
            Review Persona →
          </button>
        </div>
      </section>

      {/* ── 2. Your Usage ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your Usage</p>
          <button
            onClick={() => onNavigate?.('account-billing')}
            className="text-xs font-bold text-brand hover:underline"
          >
            View Account Billing →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">Queries This Month</span>
            <span className="text-ink font-bold text-base">{currentQueries.toLocaleString()} / {maxQueries ? maxQueries.toLocaleString() : '∞'}</span>
          </div>
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">All-Time Queries</span>
            <span className="text-ink font-bold text-base">{totalQueries.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-[11px] text-ink-3 italic pt-2 border-t border-line/40">
          Account plan, payment method, and team billing limits live in Billing.
        </p>
      </section>

      {/* ── 3. Your API Key & MCP URL ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Your API Key & MCP URL</p>
          {account.apiKey && (
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
              value={account.apiKey || 'No key set'}
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
                if (account.apiKey) {
                  navigator.clipboard.writeText(account.apiKey);
                  setToast({ msg: 'API Key copied to clipboard', type: 'success' });
                  setTimeout(() => setToast(null), 2500);
                }
              }}
              className="px-3 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark shadow-sm"
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
        </div>
      </section>

      {/* ── 4. Account Details ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Account Details</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-4">Organization Name</span>
            <span className="text-ink font-bold">{account?.name || 'Fodda'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-4">Your Role</span>
            <span className="text-ink font-bold">{user.role || 'Member'}</span>
          </div>
          {ownerUsers.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-ink-4">Account Owner</span>
              <span className="text-ink-2">{ownerUsers.map((u: any) => u.userName || u.email).join(', ')}</span>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
};
