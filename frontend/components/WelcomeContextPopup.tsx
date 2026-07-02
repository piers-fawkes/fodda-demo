import React, { useState } from 'react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface WelcomeContextPopupProps {
    user: User;
    account: Account;
    onSave: (userCtx: string, accountCtx: string) => void;
    onDismiss: () => void;
}

const STORAGE_KEY = 'fodda_context_popup_dismissed';

export const shouldShowWelcomePopup = (user: User | null): boolean => {
    if (!user) return false;
    if (user.apiUse === 'Mainly Claude') return false;
    if (user.apiUse === 'Mainly ChatGPT') return false;
    if (user.apiUse === 'Mainly Notion') return false;
    if (localStorage.getItem(STORAGE_KEY)) return false;
    // Don't show for existing users who already have context set
    if (user.userContext && user.userContext.trim().length > 0) return false;
    return true;
};

export const WelcomeContextPopup: React.FC<WelcomeContextPopupProps> = ({
    user,
    account,
    onSave,
    onDismiss,
}) => {
    const [userContextRaw, setUserContextRaw] = useState('');
    const [companyContextRaw, setCompanyContextRaw] = useState('');
    const [isProfessionalServices, setIsProfessionalServices] = useState(!!account.isProfessionalServices);
    const [isSaving, setIsSaving] = useState(false);

    const isOwnerOrAdmin = user.role === 'Owner' || user.role === 'Admin';

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        onDismiss();
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save user context if provided
            if (userContextRaw.trim()) {
                await dataService.updateUserContext(user.email, userContextRaw.trim());
            }
            // Save account context if provided (Owner/Admin only)
            if (companyContextRaw.trim() && isOwnerOrAdmin && account.id) {
                await dataService.updateAccountContext(account.id, companyContextRaw.trim());
            }
            // Save professional services flag if changed (Owner/Admin only)
            if (isOwnerOrAdmin && account.id && isProfessionalServices !== !!account.isProfessionalServices) {
                await dataService.updateAccount(account.id, { isProfessionalServices }, user.role);
            }

            localStorage.setItem(STORAGE_KEY, 'true');
            onSave(userContextRaw.trim(), companyContextRaw.trim());
        } catch (e) {
            console.error('[WelcomePopup] Save failed:', e);
            // Still dismiss on error — don't trap the user
            localStorage.setItem(STORAGE_KEY, 'true');
            onDismiss();
        } finally {
            setIsSaving(false);
        }
    };

    const hasContent = userContextRaw.trim() || companyContextRaw.trim();

    return (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="max-w-lg w-full bg-zinc-900 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl border border-zinc-800 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-fodda-accent/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl"></div>

                {/* Header */}
                <div className="text-center mb-8 relative z-10">
                    <div className="w-12 h-12 bg-fodda-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-fodda-accent/20">
                         <svg className="w-6 h-6 text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <h2 className="font-serif italic text-3xl text-white tracking-tight mb-2">
                        Welcome to your Fodda Desk
                    </h2>
                    <div className="w-12 h-1 bg-fodda-accent mx-auto rounded-full mb-4"></div>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                        This is your central hub for managing team access, knowledge graphs, and research settings. First, let's tailor your experience.
                    </p>
                </div>

                {/* Fields */}
                <div className="space-y-6 relative z-10">
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block ml-1">
                            Your Research Persona <span className="text-zinc-600 normal-case tracking-normal">(optional)</span>
                        </label>
                        <textarea
                            value={userContextRaw}
                            onChange={(e) => setUserContextRaw(e.target.value)}
                            placeholder="e.g. Strategist researching emerging consumer shifts in beauty tech..."
                            className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl focus:outline-none focus:border-fodda-accent/50 focus:ring-1 focus:ring-fodda-accent/20 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all h-28 resize-none"
                        />
                    </div>

                    {isOwnerOrAdmin && (
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block ml-1">
                                Organization Focus <span className="text-zinc-600 normal-case tracking-normal">(optional)</span>
                            </label>
                            <textarea
                                value={companyContextRaw}
                                onChange={(e) => setCompanyContextRaw(e.target.value)}
                                placeholder="e.g. Media agency focused on Gen Z trends and cultural intelligence..."
                                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl focus:outline-none focus:border-fodda-accent/50 focus:ring-1 focus:ring-fodda-accent/20 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all h-28 resize-none"
                            />
                        </div>
                    )}

                    {isOwnerOrAdmin && (
                        <label className="flex items-start gap-3 p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-2xl cursor-pointer hover:border-zinc-600/50 transition-all group">
                            <input
                                type="checkbox"
                                checked={isProfessionalServices}
                                onChange={(e) => setIsProfessionalServices(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-fodda-accent focus:ring-fodda-accent/30 cursor-pointer accent-purple-500"
                            />
                            <div>
                                <p className="text-[11px] font-bold text-zinc-200 leading-tight">Professional Services Firm</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">We research on behalf of external clients</p>
                            </div>
                        </label>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-10 relative z-10">
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="order-2 sm:order-1 px-8 py-4 bg-transparent text-zinc-500 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:text-zinc-300 transition-all"
                    >
                        Skip for now
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !hasContent}
                        className="order-1 sm:order-2 flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-white/5"
                    >
                        {isSaving ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-900" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </span>
                        ) : 'Apply Context'}
                    </button>
                </div>

                {/* Footnote */}
                <p className="text-[9px] text-zinc-600 text-center mt-6 uppercase tracking-widest font-bold">
                    Context can be modified at any time in settings
                </p>
            </div>
        </div>
    );
};
