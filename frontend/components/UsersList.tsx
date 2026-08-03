import React, { useState } from 'react';
import { User } from '../../shared/types';

interface UsersListProps {
    users: User[];
    loading: boolean;
    error: string | null;
    onDelete?: (userId: string, email: string) => void;
    onEdit?: (user: User) => void;
    onRoleChange?: (userId: string, newRole: string) => void;
    currentUserId?: string;
    currentUserRole?: string;
    signupCode?: string;
    accountApiKey?: string;
    accountMcpUrl?: string;
    accountMonthlyQueryLimit?: number;
    accountCurrentQueryCount?: number;
}

export const UsersList: React.FC<UsersListProps> = ({
    users, loading, error, onDelete, onEdit, onRoleChange, currentUserId, currentUserRole, signupCode,
    accountApiKey, accountMcpUrl, accountMonthlyQueryLimit, accountCurrentQueryCount
}) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
    const [updatingRole, setUpdatingRole] = useState<string | null>(null);

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleEmailCredentials = (targetUser: User) => {
        setEmailSentTo(targetUser.email || null);
        // Mock — show confirmation then reset after 3s
        setTimeout(() => setEmailSentTo(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-2 border-line border-t-brand rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-700 text-xs font-bold p-4 bg-red-50 border border-red-100 rounded-xl">{error}</div>;
    }

    // masked key helper
    const maskedApiKey = accountApiKey
        ? accountApiKey.slice(0, 10) + '••••••••'
        : null;
    const maskedMcpUrl = accountMcpUrl
        ? (accountMcpUrl.includes('/c/') ? accountMcpUrl.replace(/\/c\/([a-zA-Z0-9-]+)/, '/c/$1…') : accountMcpUrl)
        : null;

    return (
        <div className="space-y-8">
            {signupCode && (
                <div className="bg-cream/40 border border-line rounded-2xl p-6 flex items-center justify-between shadow-sm">
                    <div>
                        <h4 className="eyebrow mb-3">Invite Team Member</h4>
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-mono font-bold text-ink bg-white px-4 py-2 rounded-xl border border-line tracking-widest shadow-sm select-all">
                                {signupCode}
                            </p>
                            <span className="text-[10px] text-ink-4 font-bold uppercase tracking-widest">Share code to onboard team</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Identitiy & Endpoint Reference ─── */}
            {(maskedApiKey || maskedMcpUrl) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {maskedApiKey && (
                        <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="eyebrow">API Identifier</h4>
                                <button
                                    onClick={() => handleCopy(accountApiKey!, 'api-key')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm border ${
                                        copiedField === 'api-key'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-white text-ink-3 border-line hover:border-line-strong hover:text-ink'
                                    }`}
                                >
                                    {copiedField === 'api-key' ? '✓ Copied' : 'Copy Key'}
                                </button>
                            </div>
                            <code className="block text-xs font-mono text-ink-3 bg-cream/40 px-3 py-2 rounded-lg border border-line truncate shadow-inner">
                                {maskedApiKey}
                            </code>
                        </div>
                    )}
                    {maskedMcpUrl && (
                        <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="eyebrow">MCP Service Endpoint</h4>
                                <button
                                    onClick={() => handleCopy(accountMcpUrl!, 'mcp-url')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm border ${
                                        copiedField === 'mcp-url'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-white text-ink-3 border-line hover:border-line-strong hover:text-ink'
                                    }`}
                                >
                                    {copiedField === 'mcp-url' ? '✓ Copied' : 'Copy URL'}
                                </button>
                            </div>
                            <code className="block text-xs font-mono text-ink-3 bg-cream/40 px-3 py-2 rounded-lg border border-line truncate shadow-inner">
                                {maskedMcpUrl}
                            </code>
                        </div>
                    )}
                </div>
            )}

            {!users || users.length === 0 ? (
                <div className="text-ink-4 text-[10px] font-bold uppercase tracking-widest p-8 text-center border border-line rounded-2xl border-dashed bg-cream/20">No team members found.</div>
            ) : (
                <div className="overflow-hidden border border-line rounded-2xl shadow-sm bg-white">
                    <table className="min-w-full text-left">
                        <thead className="bg-cream">
                            <tr>
                                <th className="px-6 py-4 eyebrow">Team Member</th>
                                <th className="px-6 py-4 eyebrow">Role</th>
                                <th className="px-6 py-4 eyebrow text-right">Last Active</th>
                                <th className="px-6 py-4 eyebrow text-right">Queries</th>
                                <th className="px-6 py-4 eyebrow text-right">Auth Status</th>
                                <th className="px-6 py-4 eyebrow text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {users.map((user) => (
                                <tr key={user.id || user.email} className="hover:bg-cream/20 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-ink">
                                                {(user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : (user.userName || user.name || 'Anonymous User')}
                                            </span>
                                            <span className="text-[10px] text-ink-4 font-mono mt-0.5">{user.email}</span>
                                            {user.jobTitle && <span className="text-[9px] text-ink-3 mt-1 font-medium">{user.jobTitle}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {onRoleChange && (currentUserRole === 'Owner' || currentUserRole === 'Admin') && user.id !== currentUserId ? (
                                            <select
                                                value={(user.role === 'Employee' || !user.role) ? 'Member' : user.role}
                                                onChange={async (e) => {
                                                    setUpdatingRole(user.id);
                                                    await onRoleChange(user.id, e.target.value);
                                                    setUpdatingRole(null);
                                                }}
                                                disabled={updatingRole === user.id}
                                                className={`bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all focus:outline-none focus:border-brand shadow-sm ${
                                                    updatingRole === user.id
                                                        ? 'opacity-50 cursor-wait border-line text-ink-4'
                                                        : user.role === 'Owner' || user.role === 'Admin'
                                                            ? 'border-brand/40 text-brand'
                                                            : 'border-line text-ink-3'
                                                }`}
                                            >
                                                <option value="Owner">Owner</option>
                                                <option value="Admin">Admin</option>
                                                <option value="Member">Member</option>
                                            </select>
                                        ) : (
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${user.role === 'Owner' || user.role === 'Admin' ? 'bg-brand-soft text-brand border-brand/20' : 'bg-paper text-ink-3 border-line'}`}>
                                                {user.role === 'Employee' ? 'Member' : user.role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className="text-[10px] text-ink-3 font-mono font-bold uppercase">
                                            {user.lastLogin
                                                ? (() => {
                                                    const d = new Date(user.lastLogin);
                                                    const now = new Date();
                                                    const diffMs = now.getTime() - d.getTime();
                                                    const diffMins = Math.floor(diffMs / 60000);
                                                    const diffHours = Math.floor(diffMs / 3600000);
                                                    const diffDays = Math.floor(diffMs / 86400000);
                                                    if (diffMins < 5) return 'Active Now';
                                                    if (diffMins < 60) return `${diffMins}M ago`;
                                                    if (diffHours < 24) return `${diffHours}H ago`;
                                                    if (diffDays < 7) return `${diffDays}D ago`;
                                                    return d.toLocaleDateString();
                                                })()
                                                : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex flex-col items-end w-36 ml-auto">
                                            {(() => {
                                                const current = user.monthlyQueries || 0;
                                                const max = accountMonthlyQueryLimit || user.maxplanQueries || 100;
                                                const isOver = current >= max;
                                                const percent = Math.min(100, max > 0 ? (current / max) * 100 : 0);

                                                return (
                                                    <div className="w-full">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className={`text-[10px] font-mono font-bold ${isOver ? 'text-red-600' : 'text-ink'}`}>
                                                                {current} <span className="text-ink-4 font-medium">/ {max}</span>
                                                            </span>
                                                            {isOver && (
                                                                <a
                                                                    href={`mailto:piers.fawkes@psfk.com?subject=Scale Plan Request&body=Requesting scale upgrade for associate ${user.email}.`}
                                                                    className="text-[9px] font-black text-brand hover:text-brand-dark uppercase tracking-widest"
                                                                >
                                                                    Scale →
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="w-full h-1.5 bg-cream rounded-full border border-line/50 overflow-hidden shadow-inner">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ease-out ${isOver ? 'bg-red-500' : (percent > 85 ? 'bg-amber-500' : 'bg-brand')}`}
                                                                style={{ width: `${percent}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="inline-flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${user.emailConfirmed ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${user.emailConfirmed ? 'text-green-700' : 'text-amber-700'}`}>
                                                {user.emailConfirmed ? 'Verified' : 'Pending'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            {/* Email Credentials Button */}
                                            <button
                                                onClick={() => handleEmailCredentials(user)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border shadow-sm ${
                                                    emailSentTo === user.email
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-white text-ink-3 border-line hover:text-ink hover:border-line-strong opacity-0 group-hover:opacity-100'
                                                }`}
                                            >
                                                {emailSentTo === user.email ? 'Sent ✓' : 'Dispatch Access'}
                                            </button>
                                            {/* Edit Button */}
                                            {onEdit && (
                                                <button
                                                    onClick={() => onEdit(user)}
                                                    className="p-2 text-ink-4 hover:text-brand hover:bg-brand-soft rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-brand/20"
                                                    title="Modify Profile"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                </button>
                                            )}
                                            {/* Delete Button */}
                                            {onDelete && user.id !== currentUserId && (
                                                <button
                                                    onClick={() => onDelete(user.id, user.email || '')}
                                                    className="p-2 text-ink-4 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-red-200"
                                                    title="Remove User"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
