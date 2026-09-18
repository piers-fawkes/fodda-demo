/**
 * Stripe Test-Mode price override — DEV / LOCAL ONLY.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Base-upgrade / top-up flow resolves prices from the live Airtable Plans
 * table (source of truth) and the webhook credits an account by matching the
 * completed session's price id back to Airtable ({stripePriceId} lookup). To test
 * the FULL flow (checkout -> webhook -> account credited) against Stripe TEST mode
 * we need test-mode price ids — which do NOT exist in the live Airtable — WITHOUT
 * writing fake prices into the live Plans table (that would also pollute the public
 * /api/account/plans response).
 *
 * This module lets a local run substitute test-mode price ids in-memory only.
 *
 * PRODUCTION IS UNAFFECTED. Every function is a hard no-op unless BOTH hold:
 *   1. process.env.NODE_ENV !== 'production'   (the prod deploy sets NODE_ENV=production)
 *   2. process.env.STRIPE_TEST_PRICE_MAP is set (never set in prod)
 *
 * STRIPE_TEST_PRICE_MAP is JSON: { "<planCode>": "<test price id>" }, e.g.
 *   STRIPE_TEST_PRICE_MAP='{"5":"price_TESTstudio","6":"price_TESTbiz","7":"price_TESTtopup"}'
 * Generate it with:  node scripts/stripe-test-setup.mjs   (requires an sk_test_ key)
 */

let cached: { map: Record<string, string>; reverse: Record<string, number> } | null = null;
let parsed = false;

function load(): { map: Record<string, string>; reverse: Record<string, number> } | null {
  if (parsed) return cached;
  parsed = true;

  // Gate 1: never active in production.
  if (process.env.NODE_ENV === 'production') { cached = null; return cached; }

  // Gate 2: only active when a map is explicitly provided.
  const raw = process.env.STRIPE_TEST_PRICE_MAP;
  if (!raw) { cached = null; return cached; }

  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    const map: Record<string, string> = {};
    const reverse: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!k || !v) continue;
      map[String(k)] = String(v);
      reverse[String(v)] = Number(k);
    }
    cached = { map, reverse };
    console.warn(
      `[StripeTestMode] ACTIVE (non-prod). Overriding checkout prices for planCodes: ${Object.keys(map).join(', ') || '(none)'}`
    );
  } catch (e: any) {
    console.error('[StripeTestMode] STRIPE_TEST_PRICE_MAP is not valid JSON — ignoring override.', e?.message);
    cached = null;
  }
  return cached;
}

/** True when test-mode price overrides are active (non-prod + map set). */
export function isStripeTestMode(): boolean {
  return !!load();
}

/**
 * Given a planCode and the live price id from Airtable, return the TEST price id
 * to actually use for a checkout session, if one is configured. Otherwise returns
 * the live id unchanged (so prod behaviour is identical).
 */
export function overridePriceForCheckout(planCode: number | string | undefined | null, livePriceId: string): string {
  const c = load();
  if (!c || planCode == null) return livePriceId;
  const testId = c.map[String(planCode)];
  if (testId) {
    console.warn(`[StripeTestMode] planCode ${planCode}: using TEST price ${testId} (live was ${livePriceId})`);
    return testId;
  }
  return livePriceId;
}

/**
 * Given a price id seen on a completed checkout session, return the planCode it
 * maps to IF it is a configured test price id. Otherwise null — the caller then
 * falls back to the normal Airtable {stripePriceId} lookup (unchanged prod path).
 */
export function planCodeForTestPrice(priceId: string | null | undefined): number | null {
  const c = load();
  if (!c || !priceId) return null;
  const pc = c.reverse[String(priceId)];
  return Number.isFinite(pc) ? pc : null;
}
