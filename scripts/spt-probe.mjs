#!/usr/bin/env node
/**
 * spt-probe.mjs — exercise the agentic (SPT) payment rail against the Fodda API.
 * This is the "Grok-bot path": discover -> validate -> (optionally) settle.
 *
 * Modes:
 *   node scripts/spt-probe.mjs discover
 *       Hit a private endpoint with NO auth and print the HTTP 402 payment
 *       challenge (headers + body). Proves discovery works. No charge.
 *
 *   node scripts/spt-probe.mjs validate <spt_token>
 *       POST /v1/spt/validate with the token. Confirms the token is live/active.
 *       Free ($0) per the API's own OpenAPI. No charge.
 *
 *   node scripts/spt-probe.mjs settle <spt_token> --yes-charge-50-cents
 *       Make ONE real paid call presenting the SPT. This is the full settlement
 *       test: expect HTTP 200 + graph data, and a ~$0.50 charge against the token.
 *       Requires the explicit --yes-charge-50-cents flag. THIS SPENDS MONEY.
 *
 * Env:
 *   FODDA_API_URL   (default https://api.fodda.ai)
 *   PROBE_PATH      (default /v1/graphs — any private endpoint works)
 */
const API = (process.env.FODDA_API_URL || 'https://api.fodda.ai').replace(/\/$/, '');
const PATH = process.env.PROBE_PATH || '/v1/graphs';
const [, , mode = 'discover', token] = process.argv;

function hdrs(res) {
  const keep = ['www-authenticate', 'content-type', 'x-request-id'];
  const out = {};
  for (const k of keep) { const v = res.headers.get(k); if (v) out[k] = v; }
  return out;
}

async function discover() {
  const res = await fetch(`${API}${PATH}`, { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  console.log(`DISCOVER  GET ${API}${PATH}`);
  console.log(`HTTP ${res.status}`);
  console.log('headers:', JSON.stringify(hdrs(res), null, 2));
  console.log('body:', JSON.stringify(body, null, 2));
  if (res.status === 402) console.log('\n✅ Discovery works: an unpaid agent is told exactly how to pay (SPT).');
  else console.log(`\n⚠️  Expected 402, got ${res.status}.`);
}

async function validate() {
  if (!token) { console.error('Usage: spt-probe.mjs validate <spt_token>'); process.exit(1); }
  const res = await fetch(`${API}/v1/spt/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  console.log(`VALIDATE  POST ${API}/v1/spt/validate`);
  console.log(`HTTP ${res.status}`);
  console.log('body:', JSON.stringify(body, null, 2));
  console.log(res.ok ? '\n✅ Token accepted by Stripe/Fodda.' : '\n⚠️  Token not valid/active (see body).');
}

async function settle() {
  if (!token) { console.error('Usage: spt-probe.mjs settle <spt_token> --yes-charge-50-cents'); process.exit(1); }
  if (!process.argv.includes('--yes-charge-50-cents')) {
    console.error('⛔ Refusing: `settle` charges ~$0.50 against the SPT.');
    console.error('   Re-run with the explicit flag to proceed:');
    console.error(`   node scripts/spt-probe.mjs settle ${token} --yes-charge-50-cents`);
    process.exit(1);
  }
  console.log('💸 SETTLING a real 50¢ call against the SPT…');
  const res = await fetch(`${API}${PATH}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  console.log(`SETTLE  GET ${API}${PATH}`);
  console.log(`HTTP ${res.status}`);
  console.log('headers:', JSON.stringify(hdrs(res), null, 2));
  console.log('body:', JSON.stringify(body, null, 2).slice(0, 1200));
  if (res.ok) console.log('\n✅ Settlement succeeded: the agent paid per-call and got data. Reconcile the charge in Stripe.');
  else console.log(`\n⚠️  Settlement did not return 200 (HTTP ${res.status}). No access granted.`);
}

const run = { discover, validate, settle }[mode];
if (!run) { console.error(`Unknown mode "${mode}". Use: discover | validate | settle`); process.exit(1); }
run().catch((e) => { console.error('❌ probe failed:', e?.message || e); process.exit(1); });
