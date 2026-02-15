import React, { useEffect, useState } from 'react';
import { User, Account, Plan } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { UsersList } from './UsersList';

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
        const loadStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await dataService.getUserStats(user.email);
                if (res.ok) {
                    setStats(res.stats);
                } else {
                    setError(res.error || "Failed to load stats");
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen && user?.email) {
            loadStats();
        }
    }, [isOpen, user]);

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

    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [adminForm, setAdminForm] = useState({
        name: account.name,
        context: account.accountContext,
        authPolicy: account.authPolicy || 'RELAXED'
    });
    const [userForm, setUserForm] = useState({
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || '',
        jobTitle: user.jobTitle || '',
        company: user.company || '',
        email: user.email || ''
    });
    const [regeneratingKey, setRegeneratingKey] = useState(false);
    const [savingUser, setSavingUser] = useState(false);
    const isAdmin = user.role === 'Admin' || user.role === 'Owner';

    // Team / Users List State
    const [activeTab, setActiveTab] = useState<'profile' | 'team'>('profile');
    const [accountUsers, setAccountUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    const loadAccountUsers = async () => {
        setLoadingUsers(true);
        setUsersError(null);
        try {
            const res = await dataService.getAccountUsers(account.id);
            if (res.ok && res.users) {
                setAccountUsers(res.users);
            } else {
                setUsersError(res.error || "Failed to load users");
            }
        } catch (e: any) {
            setUsersError(e.message);
        } finally {
            setLoadingUsers(false);
        }
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

    const handleAccountUpdate = async () => {
        try {
            const res = await dataService.updateAccount(account.id, adminForm, user.role);
            if (res.ok) {
                alert("Account updated successfully!");
                onUpdate?.(undefined, { ...account, ...adminForm });
                setIsAdminModalOpen(false);
            } else {
                alert("Failed to update account: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error updating account");
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

    const handleRegenerateKey = async () => {
        if (!confirm("⚠️ WARNING: Regenerating the API Key will immediately invalidate the old key. integrations using the old key will break.")) return;
        setRegeneratingKey(true);
        try {
            const res = await fetch('/api/account/regenerate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: account.id, role: user.role })
            });
            const data = await res.json();
            if (data.ok) {
                alert(`New API Key Generated: \n\n${data.apiKey} \n\nPlease copy this now.`);
            } else {
                alert("Failed to regenerate key: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error regenerating key");
        } finally {
            setRegeneratingKey(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
            {/* User Profile Edit Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 animate-fade-in-up border border-zinc-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Edit Profile</h3>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={userForm.firstName}
                                        onChange={e => setUserForm({ ...userForm, firstName: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={userForm.lastName}
                                        onChange={e => setUserForm({ ...userForm, lastName: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Job Title</label>
                                    <input
                                        type="text"
                                        value={userForm.jobTitle}
                                        onChange={e => setUserForm({ ...userForm, jobTitle: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Company</label>
                                    <input
                                        type="text"
                                        value={userForm.company}
                                        onChange={e => setUserForm({ ...userForm, company: e.target.value })}
                                        className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={userForm.email}
                                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end space-x-3">
                            <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-zinc-500 font-medium text-sm hover:text-white">Cancel</button>
                            <button
                                onClick={handleUserUpdate}
                                disabled={savingUser}
                                className="px-6 py-2 bg-fodda-accent text-white font-bold text-sm rounded-lg hover:bg-fodda-accent/90 shadow-lg shadow-fodda-accent/20 disabled:opacity-50"
                            >
                                {savingUser ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Admin Modal */}
            {isAdminModalOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg p-8 m-4 animate-fade-in-up border border-zinc-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Account Admin Settings</h3>
                            <button onClick={() => setIsAdminModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Account Display Name</label>
                                <input
                                    type="text"
                                    value={adminForm.name}
                                    onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-fodda-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Company Context (Knowledge Graph Baseline)</label>
                                <textarea
                                    value={adminForm.context}
                                    onChange={e => setAdminForm({ ...adminForm, context: e.target.value })}
                                    className="w-full h-32 px-4 py-3 bg-black border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-fodda-accent resize-none"
                                    placeholder="e.g. Our company focuses on sustainable retail innovation..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Authentication Policy</label>
                                <div className="flex items-center space-x-4 p-3 bg-black border border-zinc-800 rounded-xl">
                                    <button
                                        onClick={() => setAdminForm({ ...adminForm, authPolicy: adminForm.authPolicy === 'STRICT' ? 'RELAXED' : 'STRICT' })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fodda-accent focus:ring-offset-2 ${adminForm.authPolicy === 'RELAXED' ? 'bg-green-500' : 'bg-zinc-700'}`}
                                    >
                                        <span className={`${adminForm.authPolicy === 'RELAXED' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                    </button>
                                    <div>
                                        <span className={`text-sm font-bold ${adminForm.authPolicy === 'RELAXED' ? 'text-green-500' : 'text-zinc-400'}`}>
                                            {adminForm.authPolicy === 'RELAXED' ? 'Relaxed (Persistent)' : 'Strict (Session Only)'}
                                        </span>
                                        <p className="text-[10px] text-zinc-600 mt-0.5">
                                            {adminForm.authPolicy === 'RELAXED'
                                                ? "Users stay logged in for 24 hours."
                                                : "Users are logged out when the tab closes."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Account API Key</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={account.apiKey || 'No key generated'}
                                        className="flex-1 px-4 py-3 bg-black border border-zinc-800 rounded-xl text-xs font-mono text-zinc-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(account.apiKey || '');
                                            alert("API Key copied to clipboard!");
                                        }}
                                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                                    >
                                        Copy Key
                                    </button>
                                </div>
                            </div>

                            {user.role === 'Owner' && (
                                <div className="pt-4 border-t border-zinc-800">
                                    <h4 className="text-[10px] font-bold text-red-500/80 uppercase tracking-widest mb-3 ml-1">Danger Zone</h4>
                                    <button
                                        onClick={handleRegenerateKey}
                                        disabled={regeneratingKey}
                                        className="w-full py-3 bg-red-500/5 border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-bold rounded-xl transition-all"
                                    >
                                        {regeneratingKey ? "Regenerating..." : "Regenerate Account API Key"}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="mt-8 flex justify-end space-x-3">
                            <button onClick={() => setIsAdminModalOpen(false)} className="px-4 py-2 text-zinc-500 font-medium text-sm hover:text-white">Cancel</button>
                            <button
                                onClick={handleAccountUpdate}
                                className="px-6 py-2 bg-fodda-accent text-white font-bold text-sm rounded-lg hover:bg-fodda-accent/90 shadow-lg shadow-fodda-accent/20"
                            >
                                Update Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Email Modal */}
            {isEditEmailModalOpen && editingUser && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 animate-fade-in-up border border-zinc-700">
                        <h3 className="text-lg font-bold text-white mb-4">Edit User Email</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">New Email for {editingUser.firstName || editingUser.name}</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-fodda-accent"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end space-x-3">
                            <button onClick={() => setIsEditEmailModalOpen(false)} className="px-4 py-2 text-zinc-500 font-medium text-sm hover:text-white">Cancel</button>
                            <button
                                onClick={handleEmailUpdate}
                                className="px-6 py-2 bg-fodda-accent text-white font-bold text-sm rounded-lg hover:bg-fodda-accent/90 shadow-lg shadow-fodda-accent/20"
                            >
                                Save Email
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-2xl p-8 m-4 animate-fade-in-up border border-zinc-800" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{user.userName || user.name || 'User Profile'}</h2>
                            <button
                                onClick={() => setIsUserModalOpen(true)}
                                className="p-1.5 text-zinc-500 hover:text-fodda-accent hover:bg-zinc-900 rounded-lg transition-all"
                                title="Edit Profile"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            </button>
                        </div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest leading-relaxed">
                            {user.role} • {account.name || user.accountName || 'No Account Connected'}
                            {user.company && <><br /><span className="text-zinc-400">{user.company}</span></>}
                            {user.signupDate && <><br /><span className="text-[10px] lowercase text-zinc-600 italic">member since {user.signupDate}</span></>}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {isAdmin && (
                    <div className="flex space-x-6 border-b border-zinc-800 mb-6">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`pb-2 text-sm font-bold tracking-wide transition-colors ${activeTab === 'profile' ? 'text-white border-b-2 border-fodda-accent' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Profile & Account
                        </button>
                        <button
                            onClick={() => { setActiveTab('team'); loadAccountUsers(); }}
                            className={`pb-2 text-sm font-bold tracking-wide transition-colors ${activeTab === 'team' ? 'text-white border-b-2 border-fodda-accent' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Team
                        </button>
                    </div>
                )}

                {activeTab === 'team' && isAdmin ? (
                    <div className="overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                        <UsersList
                            users={accountUsers}
                            loading={loadingUsers}
                            error={usersError}
                            onDelete={isAdmin ? handleDeleteUser : undefined}
                            onEdit={isAdmin ? handleEditUser : undefined}
                            currentUserId={user.id}
                            signupCode={isAdmin ? account.signupCode : undefined}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                        {/* Left Column: Stats & ID */}
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Account Usage</h3>
                                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                                    {loading ? (
                                        <div className="animate-pulse flex space-y-3 flex-col">
                                            <div className="h-2 bg-zinc-800 rounded w-1/3"></div>
                                            <div className="h-2 bg-zinc-800 rounded w-full"></div>
                                        </div>
                                    ) : error ? (
                                        <div className="text-xs text-red-400">{error}</div>
                                    ) : stats ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-bold text-white tracking-tighter">{stats.monthlyQueries}</span>
                                                <span className="text-[10px] font-medium text-zinc-500 mb-1">OF {stats.maxplanQueries} QUERIES</span>
                                            </div>
                                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${stats.monthlyQueries / stats.maxplanQueries > 0.9 ? 'bg-[#663399]' : 'bg-fodda-accent'}`}
                                                    style={{ width: `${Math.min(100, (stats.monthlyQueries / stats.maxplanQueries) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-zinc-600 italic">No usage data found</div>
                                    )}
                                </div>
                            </section>

                            <section className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-950">
                                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">API & Identity</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 ml-1">User ID</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={userId}
                                                readOnly
                                                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 focus:outline-none transition-all font-mono opacity-80"
                                                placeholder="User UUID..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 ml-1">
                                            <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Account API Key</label>
                                            <button
                                                onClick={() => {
                                                    const key = account.apiKey || '';
                                                    if (key) {
                                                        navigator.clipboard.writeText(key);
                                                        alert("API Key copied to clipboard");
                                                    }
                                                }}
                                                className="text-[10px] text-[#663399] hover:underline font-bold"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={account.apiKey || 'Not Available'}
                                                readOnly
                                                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none transition-all font-mono"
                                            />
                                        </div>
                                    </div>

                                </div>
                            </section>
                        </div>

                        {/* Right Column: Context & Admin Controls */}
                        <div className="space-y-6">
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Research Persona</h3>
                                    <button
                                        onClick={toggleContextLock}
                                        className={`p-1.5 rounded-md transition-colors ${isContextLocked ? 'text-zinc-500 hover:bg-zinc-900' : 'text-green-500 bg-green-500/10'}`}
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
                                    className={`w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-fodda-accent transition-all resize-none ${isContextLocked ? 'opacity-60 cursor-not-allowed' : 'opacity-100 hover:border-zinc-700'}`}
                                    placeholder="Describe your role and research goals..."
                                />
                            </section>

                            <div className="pt-4 space-y-4">
                                {isAdmin && (
                                    <div className="pt-4 border-t border-zinc-800">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3 block">Simulate View Mode</label>
                                        <div className="flex bg-black p-1 rounded-lg border border-zinc-800">
                                            <button
                                                onClick={() => onViewModeChange('psfk')}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${accessMode === 'psfk' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Default
                                            </button>
                                            <button
                                                onClick={() => onViewModeChange('waldo')}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${accessMode === 'waldo' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Waldo
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setIsAdminModalOpen(true)}
                                            className="w-full mt-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white rounded-xl border border-zinc-800 transition-colors"
                                        >
                                            Account Admin Settings
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        sessionStorage.clear();
                                        window.location.reload();
                                    }}
                                    className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 text-xs font-bold text-zinc-500 rounded-xl border border-zinc-800 transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
