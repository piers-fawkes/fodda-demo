import React, { useState } from 'react';

interface UsageWarningBannerProps {
    used: number;
    limit: number;
    onAddCard: () => void;
    hasPaymentMethod: boolean;
    /** Per-API-call overage rate from the Airtable Plan record; omit/0 to name no figure. */
    overageRate?: number;
}

export const UsageWarningBanner: React.FC<UsageWarningBannerProps> = ({ used, limit, onAddCard, hasPaymentMethod, overageRate }) => {
    const [dismissed, setDismissed] = useState(false);
    const rateLabel = typeof overageRate === 'number' && overageRate > 0 ? `$${overageRate.toFixed(2)}/API call` : null;

    if (dismissed) return null;

    const ratio = limit > 0 ? used / limit : 0;
    const isOverLimit = used > limit;

    if (ratio < 0.8 && !(hasPaymentMethod && isOverLimit)) return null;

    if (!hasPaymentMethod && ratio >= 0.8) {
        return (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-amber-600 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </span>
                    <p className="text-sm text-amber-800">
                        You've used <span className="font-bold">{used.toLocaleString()}</span> of <span className="font-bold">{limit.toLocaleString()}</span> API calls. Add a payment method to keep querying{rateLabel ? ` at ${rateLabel}` : ''} beyond your limit — and to keep your free 100 API calls renewing each month.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onAddCard}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                    >
                        Add Card
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-amber-400 hover:text-amber-600 transition-colors p-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        );
    }

    if (hasPaymentMethod && isOverLimit) {
        return (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-blue-500 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    <p className="text-sm text-blue-800">
                        Overage billing active. <span className="font-bold">{(used - limit).toLocaleString()}</span> API calls over limit this cycle.
                    </p>
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-blue-300 hover:text-blue-500 transition-colors p-1 shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        );
    }

    return null;
};
