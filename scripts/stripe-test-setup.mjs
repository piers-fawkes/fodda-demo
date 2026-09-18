#!/usr/bin/env node
/**
 * stripe-test-setup.mjs — create Stripe TEST-mode products/prices that mirror the
 * live Fodda plans, then print a ready-to-paste STRIPE_TEST_PRICE_MAP for local
 * payment testing. See PAYMENT_TESTING.md.
 *
 * SAFETY: refuses to run unless STRIPE_SECRET_KEY is a TEST key (sk_test_...).
 * Idempotent: re-runs reuse existing prices via lookup_key.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-test-setup.mjs
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) {
  console.error('❌ Refusing to run: STRIPE_SECRET_KEY must be a TEST key (sk_test_...).');
  console.error(`   Got: ${key ? key.slice(0, 8) + '…' : '(unset)'}`);
  console.error('   Grab a test key from the Stripe Dashboard with the "Test mode" toggle ON.');
  process.exit(1);
}

const stripe = new Stripe(key);

// planCode -> { live-mirroring definition }. Amounts in cents; recurring => subscription.
const PLANS = [
  { planCode: 5, lookup_key: 'fodda_test_studio',   name: 'Studio (TEST)',              unit_amount: 250000, recurring: true  },
  { planCode: 6, lookup_key: 'fodda_test_business', name: 'Business (TEST)',            unit_amount: 460000, recurring: true  },
  { planCode: 7, lookup_key: 'fodda_test_topup',    name: 'Top-Up — 200 API Calls (TEST)', unit_amount: 10000,  recurring: false },
];

async function ensurePrice({ lookup_key, name, unit_amount, recurring }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`   ↺ reused ${lookup_key} -> ${existing.data[0].id}`);
    return existing.data[0];
  }
  const product = await stripe.products.create({ name, metadata: { fodda_test: 'true' } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount,
    ...(recurring ? { recurring: { interval: 'month' } } : {}),
    lookup_key,
    transfer_lookup_key: true,
    metadata: { fodda_test: 'true' },
  });
  console.log(`   ✅ created ${lookup_key} -> ${price.id} (${recurring ? 'subscription' : 'one_time'}, $${(unit_amount / 100).toFixed(2)})`);
  return price;
}

(async () => {
  console.log('🔧 Creating/reusing Stripe TEST-mode prices for Fodda plans…\n');
  const map = {};
  for (const p of PLANS) {
    const price = await ensurePrice(p);
    map[String(p.planCode)] = price.id;
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('Paste this into your local .env (never commit it):\n');
  console.log(`STRIPE_TEST_PRICE_MAP=${JSON.stringify(map)}`);
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('Reminder: overage (add-card → metered subscription) needs a separate');
  console.log('Stripe TEST Meter + STRIPE_OVERAGE_PRICE_ID; see PAYMENT_TESTING.md.');
})().catch((e) => {
  console.error('❌ Setup failed:', e?.message || e);
  process.exit(1);
});
