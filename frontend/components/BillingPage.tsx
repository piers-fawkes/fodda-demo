import React, { useState, useEffect } from 'react';
import { User, Account, Plan } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { UsageMeter } from './UsageMeter';

interface BillingPageProps {
  user: User;
  account: Account;
  onNavigate?: (view: string) => void;
  onViewPlans?: () => void;
  onSetupPayment?: () => void;
}

interface QueryPrice {
  queryType: string;
  apiCalls: number;
  label?: string;
}

export const BillingPage: React.FC<BillingPageProps> = ({ user, account, onNavigate, onViewPlans, onSetupPayment }) => {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [queryPricing, setQueryPricing] = useState<QueryPrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  const subscriptionStatus = account.subscriptionStatus || 'none';
  // Treat Stripe 'trialing' as active for display — but don't show trial-specific UI
  const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isCancelled = subscriptionStatus === 'cancelled';
  const planName = account.planName || account.planLevel || 'Base - Free';
  const isPaidLegacy = subscriptionStatus === 'none' && !account.stripeCustomerId && planName !== 'Base - Free' && planName !== 'Free';

  // ─── Billing data (parity with MCP get_my_account) ───
  const apiCallsTotal = account.monthlyQueryLimit || 0;
  const apiCallsUsed = account.currentQueryCount || 0;
  const apiCallsRemaining = apiCallsTotal - apiCallsUsed;
  const isOverLimit = apiCallsRemaining < 0;
  const overageCount = isOverLimit ? Math.abs(apiCallsRemaining) : 0;
  const usagePercent = apiCallsTotal > 0 ? Math.min(100, (apiCallsUsed / apiCallsTotal) * 100) : 0;

  useEffect(() => {
    setLoadingPlans(true);
    dataService.getPlans()
      .then(res => {
        if (res.ok) {
          const sorted = res.plans
            .filter((p: Plan) => p.billingMode === 'subscription')
            .sort((a: Plan, b: Plan) => (a.planCode || 0) - (b.planCode || 0));
          setPlans(sorted);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));

    // Fetch per-query pricing from the API's single source of truth
    setPricingLoading(true);
    dataService.fetchQueryPricing()
      .then(res => {
        if (res.ok && res.pricing) {
          setQueryPricing(res.pricing);
        }
      })
      .catch(() => {})
      .finally(() => setPricingLoading(false));
  }, []);

  const currentPlanCode = account.planCode;
  const currentPlanName = account.planName || account.planLevel || 'Base - Free';

  const currentPlanIndex = plans.findIndex(p => 
    currentPlanCode ? p.planCode === currentPlanCode : p.name.toLowerCase() === currentPlanName.toLowerCase()
  );

  let displayNextPlan: Plan | null = null;
  if (currentPlanIndex !== -1 && currentPlanIndex < plans.length - 1) {
    displayNextPlan = plans[currentPlanIndex + 1];
  } else if (plans.length > 0) {
    const isFree = currentPlanName.toLowerCase().includes('free');
    if (isFree) {
      displayNextPlan = plans.find(p => p.planCode === 3) || null;
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await dataService.createBillingPortal(user.email);
      if (res.ok && res.portal_url) {
        window.open(res.portal_url, '_blank');
      } else {
        setPortalError(res.error || 'Failed to open billing portal');
      }
    } catch (e: any) {
      setPortalError(e.message || 'Something went wrong');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleTopUp = async () => {
    setTopUpLoading(true);
    try {
      const res = await dataService.createAgentCheckout(user.email);
      if (res.ok && res.checkout_url) {
        window.open(res.checkout_url, '_blank');
      } else {
        alert(res.error || 'Failed to create top-up checkout');
      }
    } catch (e: any) {
      alert(e.message || 'Something went wrong');
    } finally {
      setTopUpLoading(false);
    }
  };

  // Status badge styling — no trial badge; trialing maps to Active
  const statusBadge = () => {
    const badges: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
      trialing: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
      cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
      past_due: { label: 'Past Due', className: 'bg-red-50 text-red-700 border-red-200' },
      none: { label: isPaidLegacy ? 'Legacy' : 'No Subscription', className: isPaidLegacy ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-ink-4/10 text-ink-3 border-line' },
    };
    const b = badges[subscriptionStatus] || badges.none;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${b.className}`}>
        {b.label}
      </span>
    );
  };

  // Format reset date for display
  const formatResetDate = () => {
    if (account.resetDate) {
      try {
        const d = new Date(account.resetDate);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return account.resetDate;
      }
    }
    return 'Resets monthly';
  };

  // Friendly label for query types
  const formatQueryType = (qt: string) => {
    const labels: Record<string, string> = {
      research_chat: 'Research Chat',
      topic_research: 'Topic Research',
      brainstorm: 'Brainstorm',
      brand_intelligence: 'Brand Intelligence',
      deep_research_light: 'Deep Research (Light)',
      deep_research_heavy: 'Deep Research (Heavy)',
      expert_agent: 'Expert Agent',
    };
    if (labels[qt]) return labels[qt];
    // Handle standalone_* and other patterns
    if (qt.startsWith('standalone_')) return qt.replace('standalone_', 'Standalone: ').replace(/_/g, ' ');
    if (qt === 'visual' || qt === 'admin') return qt.charAt(0).toUpperCase() + qt.slice(1);
    return qt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Account</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Billing</h1>
        <p className="text-sm text-ink-3 mt-1">Manage your subscription, view usage, and access invoices.</p>
      </div>

      <div className="px-8 pb-8 max-w-3xl space-y-6">

        {/* ═══ Current Plan Card ═══ */}
        <section className="p-6 bg-paper border border-line rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-2">Current Plan</h3>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-ink">{account.planName || account.planLevel || 'Base - Free'}</span>
                {statusBadge()}
              </div>
            </div>
          </div>

          {hasActiveSubscription && (
            <div className="mt-4 pt-4 border-t border-line space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-3">Billing cycle</span>
                <span className="text-ink font-medium">Monthly</span>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-700">
                Your subscription has ended. You're on the free Base plan. Resubscribe anytime to restore your previous access level.
              </p>
            </div>
          )}

          {subscriptionStatus === 'none' && (
            <div className="mt-4 p-4 bg-cream border border-line rounded-xl">
              <p className="text-sm text-ink-3">
                {isPaidLegacy
                  ? 'Your plan was set up before automated billing. To manage your subscription going forward, upgrade via the Plans & Pricing modal — your plan will transition to a self-managed subscription.'
                  : 'You\'re on the free plan. Upgrade to get more API calls, access to all graphs, and team features.'}
              </p>
            </div>
          )}
        </section>

        {/* ═══ Plain-Language Usage Meter ═══ */}
        <section className="p-6 bg-paper border border-line rounded-2xl space-y-6">
          <div>
            <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-4">Usage & Consumption</h3>
            <UsageMeter user={user} account={account} />
          </div>

          {/* Overage state banner */}
          {isOverLimit && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <span className="text-red-500 shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </span>
              <div>
                <p className="text-sm font-bold text-red-800">
                  You're {overageCount.toLocaleString()} API {overageCount === 1 ? 'call' : 'calls'} over your monthly limit.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {account.hasPaymentMethod
                    ? 'Overage charges apply at $0.50/API call.'
                    : 'Add a payment method to continue querying. Overage charges apply at $0.50/API call.'}
                </p>
              </div>
            </div>
          )}

          {/* Quick actions for payment / top-up */}
          <div className="mt-4 flex flex-wrap gap-3">
            {!account.hasPaymentMethod && (
              <button
                onClick={() => onSetupPayment?.()}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md shadow-brand/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" strokeWidth="2"/><path d="M1 10h22" strokeWidth="2"/></svg>
                Add Payment Method
              </button>
            )}
            <button
              onClick={handleTopUp}
              disabled={topUpLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-brand text-brand hover:bg-brand-soft text-xs font-bold uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              {topUpLoading ? (
                <>
                  <div className="animate-spin h-3.5 w-3.5 border border-brand/30 border-t-brand rounded-full" />
                  Processing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Buy More API Calls
                </>
              )}
            </button>
          </div>
        </section>

        {/* ═══ What Each Query Costs ═══ */}
        <section className="p-6 bg-paper border border-line rounded-2xl">
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-4">What Each Query Costs</h3>
          {pricingLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand"></div>
            </div>
          ) : queryPricing.length > 0 ? (
            <div className="space-y-0">
              {queryPricing.map((qp, i) => (
                <div
                  key={qp.queryType}
                  className={`flex items-center justify-between py-3 px-1 ${
                    i < queryPricing.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <span className="text-sm text-ink font-medium">{qp.label || formatQueryType(qp.queryType)}</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    qp.apiCalls === 0 ? 'text-green-600' : 'text-ink'
                  }`}>
                    {qp.apiCalls === 0 ? 'Free' : `${qp.apiCalls} API ${qp.apiCalls === 1 ? 'call' : 'calls'}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-4 italic">Pricing information unavailable. Check back shortly.</p>
          )}
          <p className="text-[10px] text-ink-4 mt-4 leading-relaxed">
            Prices are set server-side and may be updated. This table reflects the current API pricing.
          </p>
        </section>

        {/* ═══ Payment Plans Card ═══ */}
        <section className="p-6 bg-paper border border-line rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-ink-3 uppercase tracking-widest mb-2">Payment Plans</h3>
              <p className="text-sm text-ink-2">Manage your subscription tiers and billing frequency.</p>
            </div>
          </div>
          <div className="mt-2 space-y-3">
             <div className="flex items-center justify-between p-4 bg-brand-soft border border-brand/20 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-brand">{planName}</span>
                  <span className="text-xs text-brand/70">Current Plan</span>
                </div>
                <span className="text-sm font-bold text-brand">Active</span>
             </div>

             {loadingPlans ? (
               <div className="flex items-center justify-center p-6 bg-white border border-line rounded-xl">
                 <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand"></div>
               </div>
             ) : displayNextPlan ? (
               <button 
                 onClick={() => onViewPlans?.()}
                 className="w-full flex items-center justify-between p-4 bg-white border border-line hover:border-brand rounded-xl hover:bg-cream/30 transition-all duration-200 text-left group"
               >
                 <div className="flex flex-col">
                   <span className="text-sm font-bold text-ink group-hover:text-brand transition-colors">
                     {displayNextPlan.name}
                   </span>
                   <span className="text-xs text-ink-3">Upgrade available</span>
                 </div>
                 <span className="text-sm font-bold text-ink-2">
                   {(() => {
                     const price = displayNextPlan.price;
                     if (displayNextPlan.planCode === 8 || !price || price === '$0' || (!displayNextPlan.stripeLink && displayNextPlan.billingMode !== 'subscription')) {
                       return 'Contact Sales →';
                     }
                     if (typeof price === 'number') {
                       return `$${Math.ceil(price)} / mo →`;
                     }
                     if (!price.includes('$')) return `${price} →`;
                     const num = parseFloat(price.replace('$', ''));
                     if (isNaN(num)) return `${price} →`;
                     return `$${Math.ceil(num)} / mo →`;
                   })()}
                 </span>
               </button>
             ) : null}
          </div>
        </section>

        {/* ═══ Actions ═══ */}
        <section className="space-y-3">
          {hasActiveSubscription && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="w-full py-3 px-6 bg-ink text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-ink-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {portalLoading ? (
                <>
                  <div className="animate-spin h-3.5 w-3.5 border border-white/30 border-t-white rounded-full" />
                  Opening Portal…
                </>
              ) : (
                <>
                  Manage Subscription
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </>
              )}
            </button>
          )}

          {(subscriptionStatus === 'none' || isCancelled) && (
            <button
              onClick={() => onViewPlans?.()}
              className="w-full py-3 px-6 bg-brand text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-brand-dark transition-all duration-200 shadow-lg shadow-brand/20"
            >
              {isCancelled ? 'Re-subscribe' : 'Upgrade Plan'}
            </button>
          )}

          {portalError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {portalError}
            </div>
          )}
        </section>

        {/* ═══ Info footer ═══ */}
        {hasActiveSubscription && (
          <div className="p-4 bg-cream border border-line rounded-xl">
            <p className="text-xs text-ink-3 leading-relaxed">
              Use <strong>Manage Subscription</strong> to update your payment method, view invoices, cancel, or change your plan. All billing is handled securely through Stripe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
