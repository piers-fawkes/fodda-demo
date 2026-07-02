import React, { useState } from 'react';

interface ContextChipsProps {
    userContext: string;
    accountContext: string;
    onUpdateUserContext: (ctx: string, saveToDb: boolean) => void;
    onUpdateAccountContext: (ctx: string, saveToDb: boolean) => void;
}

export const ContextChips: React.FC<ContextChipsProps> = ({
    userContext,
    accountContext,
    onUpdateUserContext,
    onUpdateAccountContext
}) => {
    const [editing, setEditing] = useState<'user' | 'account' | null>(null);
    const [tempValue, setTempValue] = useState('');
    const [isAccountLocked, setIsAccountLocked] = useState<boolean>(false);
    const [isUserLocked, setIsUserLocked] = useState<boolean>(false);

    const startEditing = (type: 'user' | 'account', currentVal: string) => {
        setEditing(type);
        setTempValue(currentVal);
    };

    const saveContext = () => {
        if (editing === 'user') {
            onUpdateUserContext(tempValue, isUserLocked);
        } else if (editing === 'account') {
            onUpdateAccountContext(tempValue, isAccountLocked);
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveContext();
        if (e.key === 'Escape') setEditing(null);
    };

    const toggleAccountLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isAccountLocked;
        setIsAccountLocked(newState);
        if (newState) onUpdateAccountContext(accountContext, true);
    };

    const toggleUserLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isUserLocked;
        setIsUserLocked(newState);
        if (newState) onUpdateUserContext(userContext, true);
    };

    // Compact lock icon
    const LockIcon = ({ locked }: { locked: boolean }) => (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            {locked
                ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            }
        </svg>
    );

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Account Context Chip */}
            <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all border cursor-text text-[10px] font-mono
                    ${editing === 'account'
                        ? 'bg-brand-soft border-brand/30 ring-1 ring-brand/15'
                        : accountContext
                            ? 'bg-brand-soft border-brand/15 text-brand'
                            : 'bg-paper border-line text-ink-3 hover:text-ink-2 hover:bg-cream'
                    }`}
                onClick={() => startEditing('account', accountContext)}
                title={accountContext ? `Context: ${accountContext}` : 'Click to add account context'}
            >
                <button
                    onClick={toggleAccountLock}
                    className={`p-0.5 rounded hover:bg-brand-soft transition-colors ${isAccountLocked ? 'text-brand' : 'text-ink-4'}`}
                    title={isAccountLocked ? 'Stored in Profile' : 'Session Only'}
                >
                    <LockIcon locked={isAccountLocked} />
                </button>

                <span className="font-bold uppercase tracking-wider text-brand/70 shrink-0 select-none text-[9px]">Acct</span>

                {editing === 'account' ? (
                    <input
                        autoFocus
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveContext}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent outline-none w-full text-[11px] text-ink placeholder:text-ink-4 min-w-[80px]"
                        placeholder="Add context..."
                    />
                ) : (
                    <span className={`text-[11px] truncate max-w-[120px] ${!accountContext && 'text-ink-4 italic'}`}>
                        {accountContext || 'Add...'}
                    </span>
                )}
                {accountContext && editing !== 'account' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onUpdateAccountContext('', isAccountLocked); }}
                        className="text-ink-4 hover:text-ink text-xs leading-none ml-0.5"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* User Context Chip */}
            <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all border cursor-text text-[10px] font-mono
                    ${editing === 'user'
                        ? 'bg-blue-50 border-blue-300/30 ring-1 ring-blue-300/15'
                        : userContext
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-paper border-line text-ink-3 hover:text-ink-2 hover:bg-cream'
                    }`}
                onClick={() => startEditing('user', userContext)}
                title={userContext ? `Context: ${userContext}` : 'Click to add user context'}
            >
                <button
                    onClick={toggleUserLock}
                    className={`p-0.5 rounded hover:bg-blue-50 transition-colors ${isUserLocked ? 'text-blue-600' : 'text-ink-4'}`}
                    title={isUserLocked ? 'Stored in Profile' : 'Session Only'}
                >
                    <LockIcon locked={isUserLocked} />
                </button>

                <span className="font-bold uppercase tracking-wider text-blue-600/70 shrink-0 select-none text-[9px]">User</span>

                {editing === 'user' ? (
                    <input
                        autoFocus
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={saveContext}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent outline-none w-full text-[11px] text-ink placeholder:text-ink-4 min-w-[80px]"
                        placeholder="Add context..."
                    />
                ) : (
                    <span className={`text-[11px] truncate max-w-[120px] ${!userContext && 'text-ink-4 italic'}`}>
                        {userContext || 'Add...'}
                    </span>
                )}
                {userContext && editing !== 'user' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onUpdateUserContext('', isUserLocked); }}
                        className="text-ink-4 hover:text-ink text-xs leading-none ml-0.5"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};
