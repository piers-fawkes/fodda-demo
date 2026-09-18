#!/usr/bin/env node
/**
 * spt-mint — a tiny LOCAL tool to mint a Stripe Shared Payment Token (spt_...)
 * scoped to Fodda's seller profile, so you can run the live settlement test.
 *
 * It serves a Stripe Payment Element page (collects a card → PaymentMethod) and a
 * /create-spt endpoint that mints the SPT server-side (secret key never touches the
 * browser). Minting does NOT charge — a charge only happens later when Fodda's API
 * uses the token (that's `scripts/spt-probe.mjs settle`, which is separately gated).
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_live_xxx VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx \
 *     node scripts/spt-mint/server.mjs
 *   # then open http://localhost:4242, enter a card, copy the spt_ it prints.
 *
 * Env:
 *   STRIPE_SECRET_KEY            required (sk_live_ for a live SPT, sk_test_ for test)
 *   VITE_STRIPE_PUBLISHABLE_KEY  required, MUST match the secret key's mode
 *   FODDA_SELLER_PROFILE         default = live @fodda profile
 *   SPT_MAX_AMOUNT               spend cap in cents (default 200 = $2)
 *   SPT_MINT_PORT                default 4242
 *
 * NOTE: uses Stripe's agentic-commerce preview API + the Stripe.js "dahlia" build,
 * per docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens (agent side).
 * If Stripe revises the preview, adjust the version/JS shape here.
 */
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const PORT = Number(process.env.SPT_MINT_PORT || 4242);
const SECRET = process.env.STRIPE_SECRET_KEY || '';
const PUBLISHABLE = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
const PROFILE = process.env.FODDA_SELLER_PROFILE || 'profile_61UkOZHFXofghS82UA6UkOZH2JSQENHoH2ygQe0sSBJw';
const MAX_AMOUNT = Number(process.env.SPT_MAX_AMOUNT || 200);
const PREVIEW = '2026-04-22.preview';

if (!SECRET || !PUBLISHABLE) {
  console.error('❌ Set STRIPE_SECRET_KEY and VITE_STRIPE_PUBLISHABLE_KEY (same mode) first.');
  process.exit(1);
}
const secretMode = SECRET.startsWith('sk_live_') ? 'live' : SECRET.startsWith('sk_test_') ? 'test' : 'unknown';
const pubMode = PUBLISHABLE.startsWith('pk_live_') ? 'live' : PUBLISHABLE.startsWith('pk_test_') ? 'test' : 'unknown';
if (secretMode !== pubMode) {
  console.error(`❌ Key mode mismatch: secret=${secretMode}, publishable=${pubMode}. They must match.`);
  process.exit(1);
}
if (/x{3,}/i.test(SECRET) || /x{3,}/i.test(PUBLISHABLE) || SECRET.length < 20 || PUBLISHABLE.length < 20) {
  console.error('❌ Those look like PLACEHOLDER keys (e.g. sk_live_xxx). Replace them with your REAL');
  console.error('   keys from https://dashboard.stripe.com/apikeys (Test mode OFF for a live SPT).');
  process.exit(1);
}
console.warn(`[spt-mint] ${secretMode.toUpperCase()} mode · seller ${PROFILE} · cap $${(MAX_AMOUNT / 100).toFixed(2)}`);
if (secretMode === 'live') console.warn('[spt-mint] LIVE: the SPT will bind a real card (no charge until settled).');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  const html = readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    .replaceAll('__PUBLISHABLE__', PUBLISHABLE)
    .replaceAll('__PROFILE__', PROFILE)
    .replaceAll('__AMOUNT__', String(MAX_AMOUNT));
  res.type('html').send(html);
});

app.post('/create-spt', async (req, res) => {
  try {
    const pm = req.body?.paymentMethodId;
    if (!pm) return res.status(400).json({ error: 'missing paymentMethodId' });
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1h
    const body = new URLSearchParams();
    body.set('payment_method', pm);
    body.set('seller_details[network_business_profile]', PROFILE);
    body.set('usage_limits[currency]', 'usd');
    body.set('usage_limits[max_amount]', String(MAX_AMOUNT));
    body.set('usage_limits[expires_at]', String(expires));
    body.set('return_url', 'https://app.fodda.ai?checkout=return');

    const r = await fetch('https://api.stripe.com/v1/shared_payment/issued_tokens', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(SECRET + ':').toString('base64'),
        'Stripe-Version': PREVIEW,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[spt-mint] Stripe error:', data?.error?.message || r.status);
      return res.status(r.status).json({ error: data?.error?.message || 'stripe error', raw: data });
    }
    console.log(`[spt-mint] ✅ minted ${data.id} (status ${data.status})`);
    return res.json({ spt: data.id, status: data.status });
  } catch (e) {
    console.error('[spt-mint] failed:', e?.message || e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.listen(PORT, () => console.log(`[spt-mint] open http://localhost:${PORT}`));
