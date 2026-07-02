import React, { useEffect, useState } from 'react';
import { dataService } from '../../shared/dataService';
import { Plan } from '../../shared/types';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanCode?: number;
    currentPlanName?: string;
    userEmail?: string;
    accountVertical?: string; // 'all' or a specific graph slug for referral users
    subscriptionStatus?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, currentPlanCode, currentPlanName, userEmail, accountVertical = 'all', subscriptionStatus }) => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(false);
    const [redirectingPlanId, setRedirectingPlanId] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

    const handleConvertToBase = async () => {
        setActionLoading(true);
        try {
            const res = await dataService.convertToBase(userEmail || '');
            if (res.ok) {
                if (res.alreadyConfirmed) {
                    alert('Your Base - Free account has been successfully activated with 100 API calls/month! Since your email is already verified, you are ready to query immediately.');
                } else {
                    alert('Your Base - Free account has been activated! Please check your inbox for the email confirmation link to unlock your 100 API calls/month.');
                }
                onClose();
                window.location.reload();
            } else {
                alert(res.error || 'Failed to activate Base - Free plan');
            }
        } catch (e: any) {
            alert(e.message || 'Something went wrong');
        } finally {
            setActionLoading(false);
        }
    };

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            const res = await dataService.createBillingPortal(userEmail || '');
            if (res.ok && res.portal_url) {
                window.open(res.portal_url, '_blank');
            } else {
                alert(res.error || 'Failed to open billing portal');
            }
        } catch (e: any) {
            alert(e.message || 'Something went wrong');
        } finally {
            setPortalLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            dataService.getPlans()
                .then(res => {
                    if (res.ok) {
                        // Mark current plan and recommended upsell
                        const enriched = res.plans.map((p: Plan) => {
                            const isCurrent = currentPlanCode ? p.planCode === currentPlanCode : p.name === currentPlanName;
                            // Find if any current plan's upsells points to this plan
                            const currentPlan = res.plans.find((cp: Plan) =>
                                currentPlanCode ? cp.planCode === currentPlanCode : cp.name === currentPlanName
                            );
                            const isRecommended = currentPlan?.upsellsPlanCode === p.planCode;
                            return { ...p, isCurrent, isRecommended };
                        });

                        // Sort: Put Base - Free (planCode 2) at the bottom
                        const sorted = [...enriched].sort((a, b) => {
                            if (a.planCode === 2) return 1;
                            if (b.planCode === 2) return -1;
                            return (a.planCode || 0) - (b.planCode || 0);
                        });
                        setPlans(sorted);
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, currentPlanCode, currentPlanName]);

    if (!isOpen) return null;

    const formatQueryLimit = (limit?: number) => {
        if (!limit) return '—';
        return limit.toLocaleString();
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-line flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">

                {/* Header */}
                <div className="p-8 border-b border-line flex justify-between items-start bg-cream">
                    <div>
                        <h2 className="font-serif italic text-2xl text-ink mb-2">Plans & Pricing</h2>
                        <p className="text-ink-3 text-sm">
                            You are currently on the <span className="text-ink font-bold">{currentPlanName || 'Free'}</span> plan.
                            {accountVertical !== 'all' && <span> Your access is scoped to the <span className="text-brand font-bold">{accountVertical}</span> graph.</span>}
                            {currentPlanCode === 2 && ' Upgrade to unlock more API calls and features.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-4 hover:text-ink transition-colors p-2 rounded-lg hover:bg-paper">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Pricing Table */}
                <div className="p-8 overflow-y-auto flex-1 bg-white">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
                        </div>
                    ) : (
                        <>
                            {/* Top-Up Card — shown for free plan users OR graph-scoped referral users */}
                            {(currentPlanCode === 2 || accountVertical !== 'all') && (() => {
                                const topUpPlan = plans.find(p => p.planCode === 7);
                                const topUpLink = topUpPlan?.stripeLink || 'https://buy.stripe.com/aFaeVc3PrcZL6Mo1JF6g80a';
                                return (
                                    <div className="mb-8 p-6 rounded-2xl border border-brand/20 bg-brand-soft shadow-sm shadow-brand/5">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                            <div>
                                                <h3 className="font-serif italic text-lg text-brand flex items-center gap-2">
                                                    ⚡ Need more API calls?
                                                </h3>
                                                <p className="text-sm text-ink-2 mt-1">
                                                    Buy <span className="text-ink font-bold">100 extra API calls</span> without changing your monthly subscription. API calls are added to your account instantly.
                                                </p>
                                            </div>
                                            <a
                                                href={`${topUpLink}?prefilled_email=${encodeURIComponent(userEmail || '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 px-6 py-3 bg-brand text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-brand-dark transition-all duration-200 whitespace-nowrap shadow-lg shadow-brand/20"
                                            >
                                                Buy 100 API Calls →
                                            </a>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Table Header */}
                            <div className="hidden md:grid md:grid-cols-4 gap-4 px-4 py-3 text-[10px] uppercase tracking-widest text-ink-3 font-bold border-b border-line mb-4">
                                <div className="eyebrow">Tier</div>
                                <div className="eyebrow">Scope</div>
                                <div className="eyebrow text-center">Graph Access</div>
                                <div className="eyebrow text-right pr-12">Price</div>
                            </div>

                            {/* Plan Rows — filter out top-up plan (planCode 7) since it has its own card */}
                            <div className="space-y-4">
                                {plans.filter(p => p.planCode !== 7).map(plan => {
                                    const isCurrent = plan.isCurrent;
                                    const isRecommended = plan.isRecommended;
                                    const isLavaPayg = plan.planCode === 8 || plan.name.toLowerCase().includes('lava') || plan.name.toLowerCase().includes('pay as you go') || plan.name.toLowerCase().includes('payg');
                                    const borderClass = isCurrent
                                        ? 'border-brand/40 bg-brand-soft/30 shadow-sm shadow-brand/5'
                                        : isLavaPayg
                                            ? 'border-[#ff5a1f]/30 bg-[#ff5a1f]/5 hover:border-[#ff5a1f]/50'
                                            : isRecommended
                                                ? 'border-brand/20 bg-paper/50'
                                                : 'border-line hover:border-line-strong bg-white';

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`relative rounded-2xl border ${borderClass} transition-all duration-200`}
                                        >
                                            {/* Badges */}
                                            {isCurrent && (
                                                <span className="absolute -top-2.5 right-6 bg-brand text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-brand shadow-sm">
                                                    Current Plan
                                                </span>
                                            )}
                                            {isRecommended && !isCurrent && (
                                                <span className="absolute -top-2.5 right-6 bg-white text-brand text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-brand shadow-sm">
                                                    Recommended
                                                </span>
                                            )}

                                            {/* Content — responsive: stack on mobile, table on desktop */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 items-center">
                                                {/* Package Name */}
                                                <div>
                                                    <span className="md:hidden eyebrow block mb-1">Tier</span>
                                                    <a href="https://www.fodda.ai/pricing" target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors">
                                                        <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                                                    </a>
                                                    {isLavaPayg && (
                                                        <span className="text-[9px] font-bold text-[#ff5a1f] uppercase tracking-wider block mt-1">
                                                            External Service via Lava.so
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                <div>
                                                    <span className="md:hidden eyebrow block mb-1">Scope</span>
                                                    <p className="text-xs text-ink-3 leading-relaxed line-clamp-3">{plan.description || '—'}</p>
                                                    {isLavaPayg && (
                                                        <p className="text-[10px] text-[#ff5a1f] mt-1.5 font-semibold leading-relaxed">
                                                            Manage wallet: <a href={`https://www.lava.so/dashboard/wallet?prefilled_email=${encodeURIComponent(userEmail || '')}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#e04f1a] font-bold">Lava Dashboard</a>
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Graphs Included */}
                                                <div className="text-center">
                                                    <span className="md:hidden eyebrow block mb-1">Graph Access</span>
                                                    <span className="text-sm font-bold text-ink-2">{plan.graphsIncluded || '—'}</span>
                                                    {accountVertical !== 'all' && plan.graphsIncluded?.toLowerCase().includes('all') && (
                                                        <span className="text-[8px] font-black text-brand uppercase tracking-wider block mt-1">Unlock Everything</span>
                                                    )}
                                                </div>

                                                {/* Monthly Price & Action */}
                                                <div className="flex items-center justify-end gap-8">
                                                    <div className="text-right w-20">
                                                        <span className="md:hidden eyebrow block mb-1">Price</span>
                                                        <span className="text-xl font-bold text-ink whitespace-nowrap">
                                                            {(() => {
                                                                if (!plan.price.includes('$')) return plan.price;
                                                                const num = parseFloat(plan.price.replace('$', ''));
                                                                if (isNaN(num)) return plan.price;
                                                                return `$${Math.ceil(num)}`;
                                                            })()}
                                                        </span>
                                                        {plan.price !== '$0' && <span className="text-[10px] text-ink-4 block mt-0.5 whitespace-nowrap">/month</span>}
                                                    </div>

                                                    <div className="w-32 flex flex-col items-center">
                                                        {/* Action Button */}
                                                    {!isCurrent && plan.billingMode === 'subscription' ? (
                                                        <button
                                                            onClick={async () => {
                                                                setRedirectingPlanId(plan.id);
                                                                try {
                                                                    const res = await dataService.createSubscriptionCheckout(plan.planCode!, userEmail || '');
                                                                    if (res.ok && res.checkout_url) {
                                                                        window.open(res.checkout_url, '_blank');
                                                                    } else {
                                                                        alert(res.error || 'Failed to create checkout session');
                                                                    }
                                                                } catch (e: any) {
                                                                    alert(e.message || 'Checkout error');
                                                                } finally {
                                                                    setTimeout(() => setRedirectingPlanId(null), 2000);
                                                                }
                                                            }}
                                                            disabled={redirectingPlanId === plan.id}
                                                            className={`w-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-200 text-center whitespace-nowrap flex items-center justify-center gap-2 ${isRecommended
                                                                ? 'bg-brand text-white hover:bg-brand-dark shadow-md shadow-brand/10'
                                                                : 'bg-ink text-white hover:bg-ink-2 shadow-md shadow-ink/10'
                                                                } ${redirectingPlanId === plan.id ? 'opacity-75 cursor-wait' : ''}`}
                                                        >
                                                            {redirectingPlanId === plan.id ? (
                                                                <>
                                                                    <div className="animate-spin h-3 w-3 border border-white/30 border-t-white rounded-full" />
                                                                    WAIT…
                                                                </>
                                                            ) : (
                                                                isRecommended ? 'SUBSCRIBE' : 'SUBSCRIBE'
                                                            )}
                                                        </button>
                                                    ) : !isCurrent && (plan.stripeLink || isLavaPayg) ? (
                                                        <a
                                                            href={isLavaPayg ? `https://www.lava.so/?prefilled_email=${encodeURIComponent(userEmail || '')}` : `${plan.stripeLink}?prefilled_email=${encodeURIComponent(userEmail || '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={() => setRedirectingPlanId(plan.id)}
                                                            className={`w-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-200 text-center whitespace-nowrap flex items-center justify-center gap-2 ${
                                                                isLavaPayg
                                                                    ? 'bg-[#ff5a1f] text-white hover:bg-[#e54e18] shadow-md shadow-[#ff5a1f]/15'
                                                                    : isRecommended
                                                                        ? 'bg-brand text-white hover:bg-brand-dark shadow-md shadow-brand/10'
                                                                        : 'bg-ink text-white hover:bg-ink-2 shadow-md shadow-ink/10'
                                                                } ${redirectingPlanId === plan.id ? 'opacity-75 cursor-wait' : ''}`}
                                                        >
                                                            {redirectingPlanId === plan.id ? (
                                                                <>
                                                                    <div className="animate-spin h-3 w-3 border border-white/30 border-t-white rounded-full" />
                                                                    WAIT…
                                                                </>
                                                            ) : (
                                                                isLavaPayg ? 'SET UP PAYG' : isRecommended ? 'UPGRADE' : 'SELECT'
                                                            )}
                                                        </a>
                                                    ) : !isCurrent ? (
                                                        plan.planCode === 2 && currentPlanCode === 13 ? (
                                                            <button
                                                                onClick={handleConvertToBase}
                                                                disabled={actionLoading}
                                                                className="w-full px-5 py-2.5 bg-brand text-white hover:bg-brand-dark border border-brand text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-200 text-center whitespace-nowrap flex items-center justify-center gap-2"
                                                            >
                                                                {actionLoading && <div className="animate-spin h-3 w-3 border border-white/30 border-t-white rounded-full" />}
                                                                {actionLoading ? 'WAIT…' : 'ACTIVATE BASE'}
                                                            </button>
                                                        ) : (
                                                            <a
                                                                href={plan.planCode === 2 ? undefined : "mailto:sales@fodda.ai?subject=Enterprise%20Plan%20Inquiry"}
                                                                className={`w-full px-5 py-2.5 ${plan.planCode === 2 ? 'bg-paper text-ink-4' : 'bg-cream text-ink-3 hover:text-ink hover:border-brand'} border border-line text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-200 text-center whitespace-nowrap`}
                                                            >
                                                                {plan.planCode === 2 ? 'Included' : 'Contact Sales'}
                                                            </a>
                                                        )
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1.5 w-full">
                                                            <div className="w-full px-5 py-2.5 bg-paper border border-line text-brand text-[10px] font-black uppercase tracking-widest rounded-xl text-center whitespace-nowrap">
                                                                ACTIVE
                                                            </div>
                                                            {hasActiveSubscription && (
                                                                <button
                                                                    onClick={handleManageSubscription}
                                                                    disabled={portalLoading}
                                                                    className="text-[9px] font-bold text-ink-4 hover:text-red-600 transition-colors uppercase tracking-wider whitespace-nowrap"
                                                                >
                                                                    {portalLoading ? 'Wait...' : 'Cancel Subscription'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="mt-10 p-6 bg-paper rounded-2xl border border-line text-center">
                                <p className="text-xs text-ink-3 leading-relaxed">
                                    Need a custom enterprise solution? <a href="mailto:sales@fodda.ai" className="text-brand font-bold hover:underline">Speak with a Research Consultant</a>.
                                    <br />
                                    <span className="text-ink-4 mt-2 block font-medium">All plans include standard support. API call limits represent baseline monthly volume. Overages are billed at pro-rata rates.</span>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
