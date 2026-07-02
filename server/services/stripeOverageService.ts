/**
 * Stripe Overage Billing Service
 * 
 * Handles:
 * - SetupIntent creation for card collection
 * - $0 subscription creation with metered price
 * - Overage usage reporting to Stripe Meters
 * - Setup URL generation for API/MCP 403 responses
 */

import { queryAirtable, updateAirtableRecord, escapeAirtableString } from '../db.js';
import { ACCOUNTS_TABLE } from '../constants.js';

// Lazy-load Stripe to keep cold starts fast
let stripeInstance: any = null;
async function getStripe() {
  if (stripeInstance) return stripeInstance;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');
  const Stripe = (await import('stripe')).default;
  stripeInstance = new Stripe(stripeKey);
  return stripeInstance;
}

// Stripe Meter event name — must match the Meter created in Stripe Dashboard
const OVERAGE_METER_EVENT_NAME = process.env.STRIPE_OVERAGE_METER_EVENT || 'fodda_overage_tokens';

// Metered price ID — the $0.50/unit price attached to subscriptions
const OVERAGE_PRICE_ID = process.env.STRIPE_OVERAGE_PRICE_ID || '';

// Base price ID — $0/month for free plan subscriptions
const BASE_PRICE_ID = process.env.STRIPE_BASE_PRICE_ID || '';

/**
 * Create or retrieve a Stripe Customer for an account.
 */
export async function ensureStripeCustomer(accountId: string, email: string): Promise<string> {
  const stripe = await getStripe();

  // Check if account already has a Stripe Customer
  const accQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
  const accRec = accQuery.records?.[0];
  if (!accRec) throw new Error(`Account ${accountId} not found`);

  const existingCustomerId = accRec.fields.stripeCustomerId;
  if (existingCustomerId) return existingCustomerId;

  // Create new Customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      fodda_account_id: accountId,
      source: 'overage_setup',
    },
  });

  // Store in Airtable
  await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
    stripeCustomerId: customer.id,
  });

  console.log(`[Overage] Created Stripe Customer ${customer.id} for account ${accountId}`);
  return customer.id;
}

/**
 * Create a SetupIntent for collecting a card without charging.
 * Returns the client_secret for the frontend Stripe Elements form.
 */
export async function createSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
  const stripe = await getStripe();

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // Allow charging later without user present
  });

  console.log(`[Overage] Created SetupIntent ${setupIntent.id} for customer ${customerId}`);
  return { clientSecret: setupIntent.client_secret! };
}

/**
 * Create a $0 subscription with a metered overage price component.
 * Called after the user successfully adds a card via SetupIntent.
 */
export async function createOverageSubscription(accountId: string, customerId: string): Promise<string> {
  const stripe = await getStripe();

  if (!OVERAGE_PRICE_ID) {
    console.warn('[Overage] STRIPE_OVERAGE_PRICE_ID not configured. Skipping subscription creation.');
    // Still mark payment method as active even without metered billing
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
      hasPaymentMethod: true,
      overageEnabled: true,
    });
    return 'skipped_no_price_id';
  }

  const items: any[] = [
    { price: OVERAGE_PRICE_ID }, // Metered price — usage reported via Stripe Meter
  ];

  // Add base $0 price if configured
  if (BASE_PRICE_ID) {
    items.unshift({ price: BASE_PRICE_ID });
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice'],
  });

  // Update Airtable
  await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    hasPaymentMethod: true,
    overageEnabled: true,
  });

  console.log(`[Overage] Created subscription ${subscription.id} for account ${accountId}`);
  return subscription.id;
}

/**
 * Report overage usage to Stripe Meter.
 * Called from incrementUsage when a query exceeds the plan limit.
 * 
 * @param customerId - Stripe Customer ID
 * @param tokenCount - Number of tokens consumed by this query
 * @param graphMultiplier - Graph-based cost multiplier (e.g. SIC = 2.0)
 */
export async function reportOverageToStripe(
  customerId: string,
  tokenCount: number,
  graphMultiplier: number
): Promise<void> {
  const stripe = await getStripe();

  // Billable units = tokens × graph multiplier (at $0.50 per unit)
  const billableUnits = Math.ceil(tokenCount * graphMultiplier);

  try {
    await stripe.billing.meterEvents.create({
      event_name: OVERAGE_METER_EVENT_NAME,
      payload: {
        value: String(billableUnits),
        stripe_customer_id: customerId,
      },
      timestamp: Math.floor(Date.now() / 1000),
    });
    console.log(`[Overage] Reported ${billableUnits} units for customer ${customerId}`);
  } catch (err: any) {
    // Non-blocking — don't fail the query if meter reporting fails
    console.error(`[Overage] Meter reporting failed for ${customerId}:`, err.message);
  }
}

/**
 * Generate a one-click setup URL for API/MCP 403 responses.
 * Creates a Stripe Checkout Session in 'setup' mode.
 */
export async function generateSetupUrl(
  accountId: string,
  email?: string
): Promise<string> {
  const stripe = await getStripe();

  try {
    const customerId = email ? await ensureStripeCustomer(accountId, email) : undefined;

    const sessionParams: any = {
      mode: 'setup',
      success_url: `${process.env.APP_URL || 'https://app.fodda.ai'}?setup=success`,
      cancel_url: `${process.env.APP_URL || 'https://app.fodda.ai'}?setup=cancelled`,
      metadata: {
        fodda_account_id: accountId,
        source: 'overage_setup_url',
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[Overage] Generated setup URL for account ${accountId}: ${session.url}`);
    return session.url!;
  } catch (err: any) {
    console.error(`[Overage] Failed to generate setup URL:`, err.message);
    // Fallback to app billing page
    return `${process.env.APP_URL || 'https://app.fodda.ai'}?view=billing`;
  }
}
