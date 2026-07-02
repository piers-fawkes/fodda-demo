/**
 * Account Type Service
 * 
 * Logic for differentiating between new paying clients and demo/intro recipients.
 */

export type AccountType = 'client' | 'trial' | 'demo';

/**
 * Determine the account type based on plan, subscription status, or revenue.
 */
export function detectAccountType(accountFields: any): AccountType {
  const planCode = Number(accountFields.planCode || 0);
  const subscriptionStatus = accountFields.subscriptionStatus || '';
  const lastAmountPaid = Number(accountFields.lastAmountPaid || 0);
  const sourceTrialKey = accountFields.sourceTrialKey || '';
  const vertical = (accountFields.vertical || '').toLowerCase();

  // 1. Trial Detection
  // - planCode is 13 (Trial Plan)
  // - Came via a trial key (sk_trial_...)
  if (planCode === 13 || (sourceTrialKey && sourceTrialKey.startsWith('sk_trial_'))) {
    return 'trial';
  }

  // 2. Client Detection
  // - planCode > 2 (anything above Base/Free, except Trial planCode 13)
  // - Active or trialing subscription
  // - Any previous payment recorded
  // - vertical is "all" (common for Studio Beta/Partner accounts)
  if (
    (planCode > 2 && planCode !== 13) || 
    subscriptionStatus === 'active' || 
    subscriptionStatus === 'trialing' || 
    lastAmountPaid > 0 ||
    vertical === 'all'
  ) {
    return 'client';
  }

  // 3. Default: Demo/Intro
  return 'demo';
}
