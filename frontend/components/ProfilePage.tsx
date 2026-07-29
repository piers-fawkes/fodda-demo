import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface ProfilePageProps {
  user: User;
  account: Account;
  onUpdate?: (user?: User, account?: Account) => void;
  onNavigate?: (view: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, account, onUpdate, onNavigate }) => {
  // Research Persona
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

  // Account team members (for Owner/Admin display)
  const [accountUsers, setAccountUsers] = useState<any[]>([]);

  // Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await dataService.deleteAccount(user.email, 'DELETE');
      if (result.ok) {
        // Clear all local session data and force reload to login screen
        localStorage.removeItem('fodda_unlocked');
        localStorage.removeItem('fodda_user');
        localStorage.removeItem('fodda_account');
        localStorage.removeItem('fodda_session_token');
        localStorage.removeItem('fodda_session_expiry');
        localStorage.removeItem('fodda.userId');
        localStorage.removeItem('fodda.apiKey');
        localStorage.removeItem('fodda.userContext');
        localStorage.removeItem('fodda.accountContext');
        sessionStorage.clear();
        window.location.reload();
      } else {
        setDeleteError(result.error || 'Failed to delete account. Please try again.');
      }
    } catch (e: any) {
      setDeleteError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    setLocalContext(user.userContext || '');
  }, [user.userContext]);

  // Fetch account users for Owner/Admin display
  useEffect(() => {
    if (account?.id) {
      dataService.getAccountUsers(account.id).then((res: any) => {
        if (res.ok && res.users) {
          setAccountUsers(res.users);
        }
      }).catch(() => {});
    }
  }, [account?.id]);

  const toggleContextLock = async () => {
    if (!isContextLocked) {
      try {
        const res = await fetch('/api/user/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, context: localContext })
        });
        if (res.ok) {
          onUpdate?.({ ...user, userContext: localContext });
        }
      } catch (e) {
        console.error('Failed to save context', e);
      }
    }
    setIsContextLocked(!isContextLocked);
  };

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
        // Update React state immediately so the UI reflects the change
        const updatedName = `${userForm.firstName} ${userForm.lastName}`.trim();
        const updatedUser: User = {
          ...user,
          name: updatedName,
          userName: updatedName, // Keep both in sync
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

  // Usage data pulled directly from account (same source as AccountPortal overview)
  const currentQueries = account.currentQueryCount || 0;
  const maxQueries = account.monthlyQueryLimit || 0;
  const usagePercent = maxQueries > 0 ? Math.min(100, (currentQueries / maxQueries) * 100) : 0;

  // MCP URL
  const mcpFullUrl = mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token');
  const sseFullUrl = 'https://mcp.fodda.ai/sse';
  // Show base with ellipsis for the masked version
  const mcpMaskedUrl = mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token.slice(0, 6)}…` : 'https://mcp.fodda.ai/c/••••••••…';

  const copyMcpUrl = () => {
    navigator.clipboard.writeText(mcpFullUrl);
    setMcpCopied(true);
    setToast({ msg: 'MCP Server URL copied to clipboard', type: 'success' });
    setTimeout(() => { setMcpCopied(false); setToast(null); }, 2500);
  };

  const copySseUrl = () => {
    navigator.clipboard.writeText(sseFullUrl);
    setSseCopied(true);
    setToast({ msg: 'SSE MCP URL copied to clipboard', type: 'success' });
    setTimeout(() => { setSseCopied(false); setToast(null); }, 2500);
  };

  // Initials for avatar — prefer full name over handle
  const displayName = user.name || user.userName || 'Profile';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  // Account Owner/Admin names
  const ownerUsers = accountUsers.filter((u: any) => u.role === 'Owner');
  const adminUsers = accountUsers.filter((u: any) => u.role === 'Admin');

  const planNameForApiCheck = String((account as any).planName || account.planLevel || 'Free').toLowerCase();
  const isApiDisabled = planNameForApiCheck.includes('free') || planNameForApiCheck.includes('trial') || planNameForApiCheck.includes('base');

  return (
    <div className="flex-1 overflow-y-auto">
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
              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Email Address</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand" />
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3">
              <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-ink-3 font-medium text-sm hover:text-ink">Cancel</button>
              <button onClick={handleUserUpdate} disabled={savingUser} className="px-6 py-2 bg-brand text-white font-bold text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {savingUser ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page Header (Dossier editorial) ─── */}
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Profile</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Overview</h1>
        <p className="text-sm text-ink-3 mt-1">Your identity, plan details, and connection settings</p>
      </div>

      <div className="px-8 pb-8 max-w-4xl space-y-6">

        {/* ─── User Profile Hero Card ─── */}
        <section className="relative p-6 bg-paper border border-line rounded-xl overflow-hidden">
          <div className="relative flex items-start gap-5">
            {/* Avatar */}
            <div className="shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center shadow-lg shadow-brand/15">
              <span className="text-xl font-bold text-white tracking-tight">{initials}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-ink tracking-tight truncate">{displayName}</h2>
                <button onClick={() => setIsUserModalOpen(true)} className="p-1.5 text-ink-4 hover:text-brand hover:bg-brand-soft rounded-lg transition-all shrink-0" title="Edit Profile">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-soft text-brand border border-brand/15">
                  {user.role || 'User'}
                </span>
                {user.company && (
                  <span className="text-xs text-ink-3 font-medium">{user.company}</span>
                )}
                {user.signupDate && (
                  <>
                    <span className="text-ink-4">·</span>
                    <span className="text-[10px] text-ink-3 italic">member since {user.signupDate}</span>
                  </>
                )}
              </div>
              <div className="mt-2.5 text-xs text-ink-3 font-mono flex items-center gap-1.5">
                <svg className="w-3 h-3 text-ink-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {user.email || 'No email'}
              </div>
            </div>
          </div>
        </section>

        {/* ─── MCP Server URL ─── */}
        <section className="relative p-6 bg-paper border border-line rounded-xl overflow-hidden group">
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink-2 uppercase tracking-widest">MCP URL</h3>
                  <p className="text-[10px] text-ink-3 mt-0.5">
                    Connect Fodda to{' '}
                    <button onClick={() => onNavigate?.('connections-claude')} className="text-brand hover:text-brand-dark hover:underline transition-colors">Claude</button>,{' '}
                    <button onClick={() => onNavigate?.('connections-copilot')} className="text-brand hover:text-brand-dark hover:underline transition-colors">Co-Pilot</button>{' '}
                    and{' '}
                    <button onClick={() => onNavigate?.('connections-mcp')} className="text-brand hover:text-brand-dark hover:underline transition-colors">more</button>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={mcpMaskedUrl}
                  readOnly
                  className="w-full bg-cream border border-line rounded-xl px-4 py-3 text-xs text-ink-3 focus:outline-none font-mono pr-4 cursor-default"
                  style={{ letterSpacing: '0.02em' }}
                />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-cream to-transparent rounded-r-xl pointer-events-none"></div>
              </div>
              <button
                onClick={copyMcpUrl}
                className={`shrink-0 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                  mcpCopied
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-brand-soft text-brand border border-brand/20 hover:bg-brand-softer hover:border-brand/40'
                }`}
              >
                {mcpCopied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    Copy URL
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-ink-3 flex-wrap gap-1">
              <span>SSE Endpoint (Cursor/Desktop): <code className="font-mono bg-cream px-1.5 py-0.5 rounded border border-line">https://mcp.fodda.ai/sse</code> (Header: <code className="font-mono bg-cream px-1.5 py-0.5 rounded border border-line">Authorization: Bearer sk_live_...</code>)</span>
              <button onClick={copySseUrl} className="text-brand hover:underline font-bold ml-2">
                {sseCopied ? '✓ Copied' : 'Copy SSE'}
              </button>
            </div>
          </div>
        </section>

        {/* ─── Account Health ─── */}
        <section className="p-6 bg-paper border border-line rounded-xl">
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-4">Account Health</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-ink-3 text-sm mb-1">Current Plan</p>
              <p className="text-2xl font-bold text-ink">{(account as any).planName || account.planLevel || 'Free'}</p>
              {(account as any).planCode && <p className="text-[10px] text-ink-4 mt-0.5">Plan Code: {(account as any).planCode}</p>}
            </div>
            <div>
              <p className="text-ink-3 text-sm mb-1">Monthly Usage</p>
              <p className="text-2xl font-bold text-ink">
                {maxQueries ? `${currentQueries} / ${maxQueries}` : 'N/A'}
              </p>
              {maxQueries > 0 && (
                <div className="mt-2 h-1.5 bg-line-soft rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Account Info ─── */}
        <section className="p-6 bg-paper border border-line rounded-xl">
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-4">Account</h3>
          <div className="space-y-3">
            <div className="text-sm font-bold text-ink">{account.name || user.accountName || 'No Account'}</div>
            {/* Owner / Admin names */}
            {ownerUsers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-3 font-medium">Owner:</span>
                <span className="text-ink-2">{ownerUsers.map((u: any) => u.userName || u.email).join(', ')}</span>
              </div>
            )}
            {adminUsers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-3 font-medium">Admin{adminUsers.length > 1 ? 's' : ''}:</span>
                <span className="text-ink-2">{adminUsers.map((u: any) => u.userName || u.email).join(', ')}</span>
              </div>
            )}
          </div>
        </section>

        {/* ─── API & Identity ─── */}
        <section className="p-6 bg-paper border border-line rounded-xl">
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-4">API & Identity</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest mb-1.5 ml-1">User ID</label>
              <input type="text" value={user.email || 'Not set'} readOnly className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink-3 focus:outline-none font-mono opacity-80" />
            </div>
            {isApiDisabled ? (
              <div className="mt-4 p-4 bg-cream border border-line border-dashed rounded-xl">
                <p className="text-[10px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Account API Key</p>
                <p className="text-xs font-medium text-ink-3">API access is not available for your Plan.</p>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest">Account API Key</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowApiKey(!showApiKey)} className="text-[10px] text-ink-3 hover:text-ink font-bold">{showApiKey ? 'Hide' : 'Reveal'}</button>
                    <button onClick={() => { const key = account.apiKey || ''; if (key) { navigator.clipboard.writeText(key); setToast({ msg: 'API Key copied', type: 'success' }); setTimeout(() => setToast(null), 2000); } }} className="text-[10px] text-brand hover:underline font-bold">Copy</button>
                    <button onClick={() => setIsRotateModalOpen(true)} className="text-[10px] text-amber-600 hover:text-amber-700 font-bold hover:underline">Rotate Key</button>
                  </div>
                </div>
                <input type={showApiKey ? 'text' : 'password'} value={account.apiKey || 'Not Available'} readOnly className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink-2 focus:outline-none font-mono" />
              </div>
            )}
          </div>
        </section>

        {/* ─── Danger Zone (Owner only) ─── */}
        {user.role === 'Owner' && (
          <section className="p-6 bg-red-50 border border-red-200 rounded-xl">
            <h3 className="text-xs font-bold text-red-600/70 uppercase tracking-widest mb-3">Danger Zone</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-2 font-medium">Delete Account</p>
                <p className="text-xs text-ink-3 mt-0.5">Permanently delete your account, all team members, and revoke all API keys.</p>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0 px-4 py-2 text-xs font-bold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 hover:border-red-400 transition-all"
              >Delete Account</button>
            </div>
          </section>
        )}

      </div>

      {/* ─── Delete Account Confirmation Modal ─── */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirm(''); setDeleteError(null); }}>
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 m-4 animate-fade-in-up border border-red-200" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Delete Account</h3>
                <p className="text-xs text-ink-3">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-ink-2 leading-relaxed">This will permanently:</p>
                <ul className="mt-2 space-y-1.5 text-xs text-ink-3">
                  <li className="flex items-center gap-2"><span className="text-red-500">×</span> Anonymize all user data for this account</li>
                  <li className="flex items-center gap-2"><span className="text-red-500">×</span> Revoke all API keys immediately</li>
                  <li className="flex items-center gap-2"><span className="text-red-500">×</span> Remove access for all team members</li>
                  <li className="flex items-center gap-2"><span className="text-red-500">×</span> Delete all account settings and context</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-2">
                  Type <span className="text-red-500 font-mono">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-4 py-2.5 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-red-500 font-mono placeholder:text-ink-4"
                  autoFocus
                />
              </div>

              {deleteError && (
                <p className="text-xs text-red-500 font-medium">{deleteError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirm(''); setDeleteError(null); }}
                className="px-4 py-2 text-ink-3 font-medium text-sm hover:text-ink transition-colors"
              >Cancel</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || isDeleting}
                className="px-5 py-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rotate API Key Confirmation Modal ─── */}
      {isRotateModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setIsRotateModalOpen(false); setRotateError(null); }}>
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 m-4 animate-fade-in-up border border-amber-200" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Rotate API Key</h3>
                <p className="text-xs text-ink-3">Revoke existing key and issue a new one</p>
              </div>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed mb-4">
              Rotating your API key will revoke your current key immediately. Active token connections (<code className="font-mono font-bold">/c/:token</code>) will update on next resolution. Are you sure?
            </div>
            {rotateError && (
              <p className="text-xs text-red-500 font-medium mb-3">{rotateError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setIsRotateModalOpen(false); setRotateError(null); }} className="px-4 py-2 text-ink-3 font-medium text-sm hover:text-ink">Cancel</button>
              <button onClick={handleRotateApiKey} disabled={isRotating} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-lg text-white font-bold disabled:opacity-50 transition-all">
                {isRotating ? 'Rotating...' : 'Rotate Key Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
