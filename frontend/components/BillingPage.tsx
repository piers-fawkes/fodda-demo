import React, { useState, useEffect } from 'react';
import { User, Account, Plan } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { useLavaWallet } from '../hooks/useLavaWallet';
import { UsageMeter } from './UsageMeter';
import { PageShell } from './PageShell';

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
  const { launchLavaWallet, loading: lavaLoading } = useLavaWallet();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [queryPricing, setQueryPricing] = useState<QueryPrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  const subscriptionStatus = account.subscriptionStatus || 'none';
  const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isCancelled = subscriptionStatus === 'cancelled';
  const rawPlanName = account.planName || account.planLevel || 'Base';
  const planName = rawPlanName.toLowerCase().includes('plan')
    ? rawPlanName
    : rawPlanName.toLowerCase().includes('free') || rawPlanName.toLowerCase() === 'base'
      ? 'Base - Free Plan'
      : `${rawPlanName} Plan`;
  const isPaidLegacy = subscriptionStatus === 'none' && !account.stripeCustomerId && planName !== 'Base - Free Plan' && planName !== 'Free';

  const apiCallsTotal = account.monthlyQueryLimit || 100;
  const apiCallsUsed = account.currentQueryCount || 0;
  const apiCallsRemaining = apiCallsTotal - apiCallsUsed;
  const isOverLimit = apiCallsRemaining < 0;
  const overageCount = isOverLimit ? Math.abs(apiCallsRemaining) : 0;
  // The lifetime figure is the questions-asked rollup — a different unit from the per-cycle
  // API-call counter above (one question runs several API calls). Never fall back to the
  // call count for it; that is how "134 / 100 used" sat next to "26 all-time".
  const questionsAsked = account.lifetimeQueries || 0;
  // Overage rate comes from the Airtable Plan record (house rule: never hardcode a price).
  // Base-Free carries 0 and some plans carry none — in those cases we name no figure.
  const overageRateLabel = typeof account.overageRate === 'number' && account.overageRate > 0
    ? `$${account.overageRate.toFixed(2)}/API call`
    : null;
  // Model (Piers, 2026-09-03): Base gets 100 free API calls every month, but the monthly
  // renewal for a free-tier account only happens with a card on file. Genuinely one-time
  // plans (e.g. Top-Up) are the `one_time` billingMode ones that are not the free tier.
  const isOneTime = account.billingMode === 'one_time' && !account.isFreeTier;
  const freeNeedsCardToRenew = !!account.isFreeTier && !account.hasPaymentMethod;

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

  const formatResetDate = () => {
    if (account.resetDate) {
      try {
        const d = new Date(account.resetDate);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return account.resetDate;
      }
    }
    if (freeNeedsCardToRenew) return 'Renews monthly with a card on file';
    return isOneTime ? 'One-time allowance' : 'Monthly reset';
  };

  return (
    <PageShell
      eyebrow="Billing & Usage"
      title={planName}
      subtitle={`${subscriptionStatus} · ${formatResetDate()} · ${apiCallsTotal.toLocaleString()} API calls${isOneTime ? ' (one-time)' : ' / month'}`}
      actions={
        <>
          <button
            onClick={() => launchLavaWallet(user.email, account.id)}
            disabled={lavaLoading}
            className="px-3.5 py-2 bg-gradient-to-r from-[#ff5a1f] to-[#ff7a00] text-white font-bold text-xs rounded-xl hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>🔥</span>
            <span>{lavaLoading ? 'Opening…' : 'Lava Wallet'}</span>
          </button>
          <button
            onClick={handleTopUp}
            disabled={topUpLoading}
            className="px-3.5 py-2 bg-white border border-line text-ink font-bold text-xs rounded-xl hover:bg-cream transition-colors shadow-sm disabled:opacity-50"
          >
            {topUpLoading ? 'Top Up…' : 'Top Up'}
          </button>
          <button
            onClick={() => onViewPlans?.()}
            className="px-3.5 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
          >
            Change plan
          </button>
        </>
      }
    >
      {/* ── Stat Tiles (3 Columns) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">{isOneTime ? 'API Calls Used' : 'API Calls Used This Cycle'}</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{apiCallsUsed.toLocaleString()} / {apiCallsTotal.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">{formatResetDate()}</p>
        </div>

        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Payment Method & Overage</p>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${account.hasPaymentMethod ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {account.hasPaymentMethod ? 'Overage Enabled' : 'Overage Paused'}
            </span>
          </div>
          <div>
            <p className="font-serif italic text-2xl text-ink leading-tight">{account.hasPaymentMethod ? 'Card on File' : 'No Card Saved'}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onSetupPayment ? onSetupPayment() : handleManageSubscription()}
                disabled={portalLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white font-bold text-[11px] rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {account.hasPaymentMethod ? 'Manage Payment Card' : 'Add Credit Card'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-ink-3 mt-auto leading-tight">
            {account.hasPaymentMethod
              ? `Card saved via Stripe. API calls past your monthly allowance continue${overageRateLabel ? ` at ${overageRateLabel}` : " at your plan's overage rate"}. Remove card via Manage Subscription to pause overage.`
              : `Add a credit card to enable metered overage billing${overageRateLabel ? ` (${overageRateLabel})` : ''} when your allowance is reached${account.isFreeTier ? ' — and to keep your free 100 API calls renewing each month' : ''}.`}
          </p>
        </div>

        <div className="p-5 bg-paper border border-line rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Questions Asked</p>
          <p className="font-serif italic text-3xl text-ink leading-tight">{questionsAsked.toLocaleString()}</p>
          <p className="text-[11px] font-medium text-ink-3 mt-auto">All time · each question uses several API calls</p>
        </div>
      </div>

      {/* ── Overage Alert Banner ── */}
      {isOverLimit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <span className="text-red-500 shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </span>
          <div>
            <p className="text-sm font-bold text-red-800">
              You're {overageCount.toLocaleString()} API {overageCount === 1 ? 'call' : 'calls'} over your monthly limit.
            </p>
            <p className="text-xs text-red-600 mt-1">
              {account.hasPaymentMethod
                ? `Overage charges apply${overageRateLabel ? ` at ${overageRateLabel}` : " at your plan's overage rate"}.`
                : `Add a payment method to continue querying. Overage charges apply${overageRateLabel ? ` at ${overageRateLabel}` : " at your plan's overage rate"}.`}
            </p>
          </div>
        </div>
      )}

      {/* ── Plan Details & Subscription Card ── */}
      <section className="p-5 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-3">Plan Details</p>
            <h3 className="font-serif italic text-xl text-ink font-bold">{planName}</h3>
          </div>
          {statusBadge()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">Billing Cycle</span>
            <span className="text-ink font-medium">{isOneTime ? 'One-time' : 'Monthly'}</span>
          </div>
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">{isOneTime ? 'Allowance' : 'Monthly Allowance'}</span>
            <span className="text-ink font-medium">{apiCallsTotal.toLocaleString()} API calls</span>
          </div>
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">Overage Rate</span>
            <span className="text-ink font-medium">{overageRateLabel ?? 'Per plan — see pricing'}</span>
          </div>
          <div>
            <span className="text-ink-4 block text-[10px] font-mono uppercase">Account ID</span>
            <span className="font-mono text-ink-3">{account.id}</span>
          </div>
        </div>

        {hasActiveSubscription && (
          <div className="pt-3 border-t border-line flex items-center justify-between">
            <span className="text-xs text-ink-3">Managed securely via Stripe</span>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="px-3.5 py-1.5 bg-ink text-white font-bold text-xs rounded-xl hover:bg-ink-2 transition-colors shadow-sm disabled:opacity-50"
            >
              {portalLoading ? 'Opening Portal…' : 'Manage Subscription →'}
            </button>
          </div>
        )}
      </section>

      {/* ── Usage Meter & sparkline ── */}
      <div className="pt-2">
        <UsageMeter user={user} account={account} hideStatTiles={true} />
      </div>
    </PageShell>
  );
};
