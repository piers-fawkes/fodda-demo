import React from 'react';
import { User } from '../../shared/types';

interface UsersListProps {
    users: User[];
    loading: boolean;
    error: string | null;
    onDelete?: (userId: string, email: string) => void;
    onEdit?: (user: User) => void;
    currentUserId?: string;
    signupCode?: string;
}

export const UsersList: React.FC<UsersListProps> = ({ users, loading, error, onDelete, onEdit, currentUserId, signupCode }) => {
    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <svg className="animate-spin h-6 w-6 text-fodda-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-400 text-xs p-4 bg-red-500/10 rounded-lg">{error}</div>;
    }

    // Even if no users, show the invite code if available
    const hasUsers = users && users.length > 0;

    return (
        <div className="space-y-6">
            {signupCode && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Team Invite Code</h4>
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-mono font-bold text-white bg-black px-3 py-2 rounded-lg border border-zinc-800 tracking-wider select-all">
                                {signupCode}
                            </p>
                            <span className="text-[10px] text-zinc-600 italic">Share to invite members</span>
                        </div>
                    </div>
                </div>
            )}

            {!hasUsers ? (
                <div className="text-zinc-500 text-xs italic p-4 text-center border border-zinc-800 rounded-xl border-dashed">No users found in this account.</div>
            ) : (
                <div className="overflow-hidden border border-zinc-800 rounded-xl">
                    <table className="min-w-full text-left">
                        <thead className="bg-zinc-900/50">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">User</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Role</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Usage</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Status</th>
                                {onDelete && <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {users.map((user) => (
                                <tr key={user.id || user.email} className="hover:bg-zinc-800/20 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white">
                                                {(user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : (user.userName || user.name || 'Unknown')}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-mono">{user.email}</span>
                                            {user.jobTitle && <span className="text-[9px] text-zinc-600 mt-0.5">{user.jobTitle}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${user.role === 'Owner' || user.role === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {/* Progress Bar for Usage */}
                                        <div className="flex flex-col items-end w-32 ml-auto">
                                            {(() => {
                                                const current = user.monthlyQueries || 0;
                                                const max = user.maxplanQueries || 100;
                                                const isOver = current >= max;
                                                const percent = Math.min(100, max > 0 ? (current / max) * 100 : 0);

                                                return (
                                                    <>
                                                        <div className="flex justify-between w-full mb-1 items-end gap-2">
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Usage</span>
                                                                {isOver && (
                                                                    <a
                                                                        href={`mailto:piers.fawkes@psfk.com?subject=Upgrade Plan Request&body=I would like to upgrade the plan for account associated with ${user.email}.`}
                                                                        className="text-[9px] font-bold text-fodda-accent hover:text-white transition-colors uppercase tracking-wide flex items-center mt-0.5"
                                                                    >
                                                                        Upgrade Plan &rarr;
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] font-mono font-bold ${isOver ? 'text-red-500' : 'text-zinc-300'}`}>
                                                                {current} <span className={`${isOver ? 'text-red-500/50' : 'text-zinc-600'} text-[9px]`}>/ {max}</span>
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : (percent > 85 ? 'bg-yellow-500' : 'bg-fodda-accent')}`}
                                                                style={{ width: `${percent}%` }}
                                                            ></div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {user.emailConfirmed ? (
                                            <span className="text-[10px] text-green-500 font-bold uppercase tracking-wide">Active</span>
                                        ) : (
                                            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wide">Pending</span>
                                        )}
                                    </td>
                                    {onEdit && (
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => onEdit(user)}
                                                className="p-1.5 text-zinc-600 hover:text-fodda-accent hover:bg-zinc-900 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 mr-2"
                                                title="Edit User"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                            </button>
                                        </td>
                                    )}
                                    {onDelete && (
                                        <td className="px-4 py-3 text-right">
                                            {user.id !== currentUserId && (
                                                <button
                                                    onClick={() => onDelete(user.id, user.email || '')}
                                                    className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Remove User"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
