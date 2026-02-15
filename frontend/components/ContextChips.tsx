import React, { useState } from 'react';


// SVG Icons
const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);

const UnlockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
    </svg>
);

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

    // Default to UNLOCKED (Session Only)
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

    // Helper to toggle lock and save immediately if locking
    const toggleAccountLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isAccountLocked;
        setIsAccountLocked(newState);
        // If we just LOCKED it, we should verify/save the current value to DB
        if (newState) {
            onUpdateAccountContext(accountContext, true);
        }
    };

    const toggleUserLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isUserLocked;
        setIsUserLocked(newState);
        if (newState) {
            onUpdateUserContext(userContext, true);
        }
    };

    return (
        <div className="w-full mb-1 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Account Context Chip */}
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border cursor-text
                    ${editing === 'account' ? 'bg-zinc-900 border-purple-500/50 ring-1 ring-purple-500/20' :
                            accountContext ? 'bg-zinc-900/80 border-purple-500/30 text-purple-300' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
                    `}
                    onClick={() => startEditing('account', accountContext)}
                    title={accountContext ? `Context: ${accountContext}` : "Click to add account context"}
                >
                    <button
                        onClick={toggleAccountLock}
                        className={`p-1 rounded-full hover:bg-white/10 transition-colors ${isAccountLocked ? 'text-purple-400' : 'text-zinc-500'}`}
                        title={isAccountLocked ? "Locked: Stored in Profile" : "Unlocked: Session-Only Context"}
                    >
                        {isAccountLocked ? <LockIcon /> : <UnlockIcon />}
                    </button>

                    <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 shrink-0 select-none">Account</span>

                    {editing === 'account' ? (
                        <input
                            autoFocus
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={saveContext}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent outline-none w-full text-xs font-medium text-white placeholder:text-zinc-600"
                            placeholder="Add context..."
                        />
                    ) : (
                        <span className={`text-xs truncate max-w-[150px] ${!accountContext && 'text-zinc-600 italic'}`}>
                            {accountContext || "Add context..."}
                        </span>
                    )}
                    {accountContext && editing !== 'account' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdateAccountContext('', isAccountLocked); }}
                            className="text-zinc-500 hover:text-white px-1"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* User Context Chip */}
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border cursor-text
                    ${editing === 'user' ? 'bg-zinc-900 border-blue-500/50 ring-1 ring-blue-500/20' :
                            userContext ? 'bg-zinc-900/80 border-blue-500/30 text-blue-300' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
                    `}
                    onClick={() => startEditing('user', userContext)}
                    title={userContext ? `Context: ${userContext}` : "Click to add user context"}
                >
                    <button
                        onClick={toggleUserLock}
                        className={`p-1 rounded-full hover:bg-white/10 transition-colors ${isUserLocked ? 'text-blue-400' : 'text-zinc-500'}`}
                        title={isUserLocked ? "Locked: Stored in Profile" : "Unlocked: Session-Only Context"}
                    >
                        {isUserLocked ? <LockIcon /> : <UnlockIcon />}
                    </button>

                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 shrink-0 select-none">User</span>

                    {editing === 'user' ? (
                        <input
                            autoFocus
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={saveContext}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent outline-none w-full text-xs font-medium text-white placeholder:text-zinc-600"
                            placeholder="Add context..."
                        />
                    ) : (
                        <span className={`text-xs truncate max-w-[150px] ${!userContext && 'text-zinc-600 italic'}`}>
                            {userContext || "Add context..."}
                        </span>
                    )}
                    {userContext && editing !== 'user' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdateUserContext('', isUserLocked); }}
                            className="text-zinc-500 hover:text-white px-1"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
