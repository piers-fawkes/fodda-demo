import React, { useEffect, useState } from 'react';
import { User, Account, Plan } from '../../shared/types';
import { dataService } from '../../shared/dataService';


interface UserStats {
    totalQueries: number;
    monthlyQueries: number;
    maxplanQueries: number;
}

interface DashboardProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    account: Account;
    accessMode?: 'psfk' | 'waldo';
    onViewModeChange: (mode: 'psfk' | 'waldo') => void;
    userId: string;
    onUserIdChange: (id: string) => void;
    demoApiKey: string;
    onDemoApiKeyChange: (key: string) => void;
    onUpdate?: (user?: User, account?: Account) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    isOpen, onClose, user, account, accessMode = 'psfk', onViewModeChange,
    userId, onUserIdChange: _onUserIdChange, demoApiKey: _demoApiKey, onDemoApiKeyChange: _onDemoApiKeyChange, onUpdate
}: DashboardProps) => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && user?.email) {
            // Build stats from user/account props — no separate API call needed
            setStats({
                totalQueries: (user as any).monthlyQueries || 0,
                monthlyQueries: (user as any).monthlyQueries || 0,
                maxplanQueries: account.monthlyQueryLimit || 10,
            });
            setLoading(false);
        }
    }, [isOpen, user, account]);

    const [_plans, setPlans] = useState<Plan[]>([]);
    const [_loadingPlans, setLoadingPlans] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPlans();
        }
    }, [isOpen]);

    const loadPlans = async () => {
        setLoadingPlans(true);
        try {
            const res = await dataService.getPlans();
            if (res.ok) {
                setPlans(res.plans);
            }
        } catch (e) {
            console.error("Failed to load plans", e);
        } finally {
            setLoadingPlans(false);
        }
    }

    const [localContext, setLocalContext] = useState(user.userContext || '');
    const [isContextLocked, setIsContextLocked] = useState(true);

    useEffect(() => {
        setLocalContext(user.userContext || '');
    }, [user.userContext]);

    const toggleContextLock = async () => {
        if (!isContextLocked) {
            try {
                const res = await fetch('/api/user/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, context: localContext })
                });
                if (res.ok) {
                    // Update main app state
                    onUpdate?.({ ...user, userContext: localContext });
                } else {
                    console.error("Failed to save context");
                }
            } catch (e) {
                console.error("Error saving context", e);
            }
        }
        setIsContextLocked(!isContextLocked);
    };

    const [userForm, setUserForm] = useState({
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
        jobTitle: user.jobTitle || '',
        company: user.company || '',
        email: user.email || ''
    });
    const [savingUser, setSavingUser] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [accountUsers, setAccountUsers] = useState<User[]>([]);
    const isAdmin = user.role === 'Admin' || user.role === 'Owner';

    const loadAccountUsers = async () => {
        try {
            const res = await dataService.getAccountUsers(account.id);
            if (res.ok && res.users) setAccountUsers(res.users);
        } catch (e) { console.error("Failed to load users", e); }
    };

    const handleEditUser = (targetUser: User) => {
        setEditingUser(targetUser);
        setNewEmail(targetUser.email || '');
        setIsEditEmailModalOpen(true);
    };

    const handleEmailUpdate = async () => {
        if (!editingUser || !newEmail) return;
        try {
            const res = await dataService.updateUserProfile(editingUser.email, { email: newEmail });
            if (res.ok) {
                alert("Email updated successfully!");
                setIsEditEmailModalOpen(false);
                loadAccountUsers(); // Reload list
            } else {
                alert("Failed to update email: " + res.error);
            }
        } catch (e: any) {
            console.error("Email update error", e);
            alert("Error updating email");
        }
    };

    const handleDeleteUser = async (targetUserId: string, targetEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${targetEmail} from your account? This action cannot be undone.`)) return;

        try {
            const res = await dataService.deleteUser(targetUserId, user.email || ''); // Pass current user email for auth check
            if (res.ok) {
                // Remove locally or reload
                setAccountUsers(prev => prev.filter(u => u.id !== targetUserId));
            } else {
                alert("Failed to delete user: " + res.error);
            }
        } catch (e: any) {
            console.error("Delete error", e);
            alert("Error deleting user");
        }
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
                alert("Profile updated successfully! Logout and log in again to see all changes.");
                setIsUserModalOpen(false);
            } else {
                alert("Failed to update profile: " + res.error);
            }
        } catch (e: any) {
            console.error(e);
            alert("Error updating profile");
        } finally {
            setSavingUser(false);
        }
    };



    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-md" onClick={onClose}>
            {/* User Profile Edit Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 backdrop-blur-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 animate-fade-in-up border border-line">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif italic text-lg text-ink">Edit Profile</h3>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-ink-3 hover:text-ink">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={userForm.firstName}
                                        onChange={e => setUserForm({ ...userForm, firstName: e.target.value })}
                                        className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={userForm.lastName}
                                        onChange={e => setUserForm({ ...userForm, lastName: e.target.value })}
                                        className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Job Title</label>
                                    <input
                                        type="text"
                                        value={userForm.jobTitle}
                                        onChange={e => setUserForm({ ...userForm, jobTitle: e.target.value })}
                                        className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Company</label>
                                    <input
                                        type="text"
                                        value={userForm.company}
                                        onChange={e => setUserForm({ ...userForm, company: e.target.value })}
                                        className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={userForm.email}
                                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end space-x-3">
                            <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-ink-3 font-medium text-sm hover:text-ink">Cancel</button>
                            <button
                                onClick={handleUserUpdate}
                                disabled={savingUser}
                                className="px-6 py-2 bg-brand text-white font-bold text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50"
                            >
                                {savingUser ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Edit User Email Modal */}
            {isEditEmailModalOpen && editingUser && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 backdrop-blur-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 animate-fade-in-up border border-line">
                        <h3 className="font-serif italic text-lg text-ink mb-4">Edit User Email</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wide mb-1">New Email for {editingUser.firstName || editingUser.name}</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-cream border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end space-x-3">
                            <button onClick={() => setIsEditEmailModalOpen(false)} className="px-4 py-2 text-ink-3 font-medium text-sm hover:text-ink">Cancel</button>
                            <button
                                onClick={handleEmailUpdate}
                                className="px-6 py-2 bg-brand text-white font-bold text-sm rounded-lg hover:bg-brand-dark"
                            >
                                Save Email
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl m-4 animate-fade-in-up border border-line flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                {/* Header — consistent with Graph Admin */}
                <div className="h-14 bg-cream border-b border-line flex items-center justify-between px-8 rounded-t-2xl shrink-0">
                    <h1 className="font-serif italic text-lg text-ink">User Profile</h1>
                    <button onClick={onClose} className="text-xs font-bold text-ink-3 hover:text-ink uppercase tracking-widest">Exit</button>
                </div>

                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-1">
                                <h2 className="font-serif italic text-2xl text-ink tracking-tight">{user.userName || user.name || 'User Profile'}</h2>
                                <button
                                    onClick={() => setIsUserModalOpen(true)}
                                    className="p-1.5 text-ink-3 hover:text-brand hover:bg-brand-soft rounded-lg transition-all"
                                    title="Edit Profile"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                </button>
                            </div>
                            <p className="text-xs font-medium text-ink-3 uppercase tracking-widest leading-relaxed">
                                {user.role}{user.company && <> • <span className="text-ink-2">{user.company}</span></>}
                                {user.signupDate && <><br /><span className="text-[10px] lowercase text-ink-4 italic">member since {user.signupDate}</span></>}
                            </p>
                            <div className="mt-2 text-xs text-ink-3 font-mono">{user.email || 'No email'}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh] pr-2">
                        {/* Left Column: Stats & ID */}
                        <div className="space-y-6">
                            {/* Account Info (read-only) */}
                            <section className="p-4 rounded-xl border border-line bg-cream">
                                <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.2em] mb-3">Account</h3>
                                <div className="text-sm font-bold text-ink">{account.name || user.accountName || 'No Account'}</div>
                                <div className="text-[10px] text-ink-3 mt-1">Plan: <span className="text-ink-2 font-medium">{account.planLevel || 'Free'}</span></div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.2em] mb-4">Account Usage</h3>
                                <div className="bg-paper rounded-xl p-4 border border-line">
                                    {loading ? (
                                        <div className="animate-pulse flex space-y-3 flex-col">
                                            <div className="h-2 bg-line rounded w-1/3"></div>
                                            <div className="h-2 bg-line rounded w-full"></div>
                                        </div>
                                    ) : error ? (
                                        <div className="text-xs text-red-500">{error}</div>
                                    ) : stats ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-bold text-ink tracking-tighter">{stats.monthlyQueries}</span>
                                                <span className="text-[10px] font-medium text-ink-3 mb-1">OF {stats.maxplanQueries} QUERIES</span>
                                            </div>
                                            <div className="h-1 bg-line-soft rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${stats.monthlyQueries / stats.maxplanQueries > 0.9 ? 'bg-brand' : 'bg-brand'}`}
                                                    style={{ width: `${Math.min(100, (stats.monthlyQueries / stats.maxplanQueries) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-ink-4 italic">No usage data found</div>
                                    )}
                                </div>
                            </section>

                            <section className="p-4 rounded-xl border border-line bg-paper">
                                <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.2em] mb-4">API & Identity</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest mb-1.5 ml-1">User ID</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={user.email || 'Not set'}
                                                readOnly
                                                className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink-3 focus:outline-none transition-all font-mono opacity-80"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 ml-1">
                                            <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest">Account API Key</label>
                                            <button
                                                onClick={() => {
                                                    const key = account.apiKey || '';
                                                    if (key) {
                                                        navigator.clipboard.writeText(key);
                                                        alert("API Key copied to clipboard");
                                                    }
                                                }}
                                                className="text-[10px] text-brand hover:underline font-bold"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={account.apiKey || 'Not Available'}
                                                readOnly
                                                className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink-3 focus:outline-none transition-all font-mono"
                                            />
                                        </div>
                                    </div>

                                </div>
                            </section>

                        </div>

                        {/* Right Column: Claude Connector, Context & Controls */}
                        <div className="space-y-6">
                            {/* Claude Connector */}
                            <section className="p-4 rounded-xl border border-brand/20 bg-brand-soft">
                                <h3 className="text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-1">Claude Connector</h3>
                                <p className="text-[10px] text-ink-3 mb-4">Connect Fodda to Claude — works with Pro, Max, Team, and Enterprise</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                                        <input
                                            type="text"
                                            value="Fodda"
                                            readOnly
                                            className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-xs text-ink-2 focus:outline-none font-medium"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 ml-1">
                                            <label className="block text-[10px] font-bold text-ink-4 uppercase tracking-widest">Connector URL</label>
                                            <button
                                                onClick={() => {
                                                    const url = `https://mcp.fodda.ai/mcp?api_key=${account.apiKey || ''}&user_id=${encodeURIComponent(user.email || '')}`;
                                                    navigator.clipboard.writeText(url);
                                                    alert("MCP URL copied to clipboard");
                                                }}
                                                className="text-[10px] text-brand hover:underline font-bold"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={`https://mcp.fodda.ai/mcp?api_key=${account.apiKey || ''}&user_id=${encodeURIComponent(user.email || '')}`}
                                            readOnly
                                            className="w-full bg-cream border border-line rounded-lg px-3 py-2 text-[10px] text-ink-3 focus:outline-none font-mono"
                                        />
                                    </div>
                                    <p className="text-[10px] text-ink-4 italic ml-1">No special settings required</p>
                                    <a
                                        href="https://claude.ai/settings/connectors?modal=add-custom-connector"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand hover:text-brand-dark uppercase tracking-widest transition-colors ml-1"
                                    >
                                        Set Up Now
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                    <p className="text-[10px] text-ink-4 italic ml-1 mt-1">Enterprise? Ask your workspace admin to add this in Organization Settings → Connectors.</p>
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.2em]">Research Persona</h3>
                                    <button
                                        onClick={toggleContextLock}
                                        className={`p-1.5 rounded-md transition-colors ${isContextLocked ? 'text-ink-3 hover:bg-cream' : 'text-green-600 bg-green-50'}`}
                                    >
                                        {isContextLocked ? (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2z" /></svg>
                                        )}
                                    </button>
                                </div>
                                <textarea
                                    value={localContext}
                                    onChange={(e) => setLocalContext(e.target.value)}
                                    readOnly={isContextLocked}
                                    className={`w-full h-32 bg-cream border border-line rounded-xl px-4 py-3 text-sm text-ink-2 focus:outline-none focus:border-brand transition-all resize-none ${isContextLocked ? 'opacity-60 cursor-not-allowed' : 'opacity-100 hover:border-line-strong'}`}
                                    placeholder="Describe your role and research goals..."
                                />
                            </section>

                            <div className="pt-4 space-y-4">
                                <button
                                    onClick={() => {
                                        // Clear all Fodda auth/session data from localStorage
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
                                    }}
                                    className="w-full py-2.5 bg-cream hover:bg-line-soft text-xs font-bold text-ink-3 rounded-xl border border-line transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
