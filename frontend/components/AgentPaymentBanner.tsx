import React, { useState } from 'react';

interface AgentPaymentBannerProps {
    hasPaymentMethod: boolean;
    onSetupStripe: () => void;
}

export const AgentPaymentBanner: React.FC<AgentPaymentBannerProps> = ({ hasPaymentMethod, onSetupStripe }) => {
    const [dismissed, setDismissed] = useState(() => {
        try { return sessionStorage.getItem('fodda_payment_banner_dismissed') === 'true'; } catch { return false; }
    });

    if (dismissed) return null;

    // Card already on file — show success state
    if (hasPaymentMethod) {
        return (
            <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 shadow-sm">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">✓</span>
                <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-800">Payment method active</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Your agent won't be interrupted when it exceeds your included API calls.</p>
                </div>
            </div>
        );
    }

    const handleDismiss = () => {
        setDismissed(true);
        try { sessionStorage.setItem('fodda_payment_banner_dismissed', 'true'); } catch {}
    };

    return (
        <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm relative">
            {/* Dismiss */}
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-all"
                title="Dismiss"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="flex items-start gap-3 mb-4">
                <span className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-base shrink-0">⚡</span>
                <div>
                    <p className="text-sm font-bold text-amber-900">Have you set up payment options for your agent?</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">When your agent exceeds your included API calls, it needs a payment method to keep running. Choose how to pay:</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 pl-11">
                {/* Stripe — Credit Card */}
                <button
                    onClick={onSetupStripe}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-brand/20"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" strokeWidth="2"/><path d="M1 10h22" strokeWidth="2"/></svg>
                    Add Credit Card
                </button>

                {/* Lava — PAYG Wallet */}
                <a
                    href="https://lava.so"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-[#ff5a1f] text-[#ff5a1f] hover:bg-[#ff5a1f]/5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Lava PAYG Wallet
                </a>

                {/* SPT — Learn More */}
                <a
                    href="https://www.fodda.ai/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 text-ink-3 hover:text-ink hover:bg-cream text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-transparent hover:border-line"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    SPT Auth Info
                </a>
            </div>
        </div>
    );
};
