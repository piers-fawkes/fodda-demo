#!/usr/bin/env node

import assert from 'assert';
import { derivePlatformFromUrl, deriveIntentFromApiUse } from '../shared/platformDetection.ts';

console.log('🧪 Running Platform Detection & Grok Attribution Unit Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err.message);
    failed++;
  }
}

// 1. Grok brand context URL
test('Grok brand context resource detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?client_id=MuPhVBpeyvvMn6re&resource=https%3A%2F%2Fmcp.fodda.ai%2Fgrok-brand-context&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fcallback';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Grok Bot');
  assert.strictEqual(res.intent, 'grok');
  assert.strictEqual(res.source, 'grok_brand_context');
});

// 2. Grok earnings intelligence URL
test('Grok earnings intelligence resource detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?client_id=DOHTQ0pmgSKoD705&resource=https%3A%2F%2Fmcp.fodda.ai%2Fearnings-intelligence&redirect_uri=https%3A%2F%2Fgrok.com%2Foauth';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Grok Bot (Earnings)');
  assert.strictEqual(res.intent, 'grok');
  assert.strictEqual(res.source, 'grok_earnings');
});

// 3. Grok callback bridge (:8787) without explicit resource
test('Grok local bridge (:8787) redirect_uri detection', () => {
  const url = '/oauth-consent?client_id=someclient&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fcallback';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Grok Bot');
  assert.strictEqual(res.intent, 'grok');
  assert.strictEqual(res.source, 'grok_brand_context');
});

// 4. Grok domain (x.ai or grok.com)
test('Grok domain (x.ai) redirect_uri detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?redirect_uri=https%3A%2F%2Fx.ai%2Fcallback';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Grok Bot');
  assert.strictEqual(res.intent, 'grok');
});

// 5. Nested redirect_url (e.g. login with redirect_url pointing to Grok consent)
test('Nested redirect_url parameter with Grok consent target', () => {
  const url = '/login?redirect_url=' + encodeURIComponent('/oauth-consent?resource=https%3A%2F%2Fmcp.fodda.ai%2Fgrok-brand-context&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fcallback');
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Grok Bot');
  assert.strictEqual(res.intent, 'grok');
  assert.strictEqual(res.source, 'grok_brand_context');
});

// 6. Claude connector detection
test('Claude connector redirect_uri detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?client_id=xyz&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fcallback';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Mainly Claude');
  assert.strictEqual(res.intent, 'claude');
  assert.strictEqual(res.source, 'claude_connector');
});

// 7. ChatGPT app detection
test('ChatGPT redirect_uri detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Mainly ChatGPT');
  assert.strictEqual(res.intent, 'chatgpt');
  assert.strictEqual(res.source, 'chatgpt_app');
});

// 8. Generic MCP detection
test('Generic MCP server detection', () => {
  const url = 'https://app.fodda.ai/oauth-consent?resource=https%3A%2F%2Fmcp.fodda.ai%2Fmcp';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Mainly MCP Use');
  assert.strictEqual(res.intent, 'mcp');
  assert.strictEqual(res.source, 'mcp_server');
});

// 9. Onboarding platform param
test('Onboarding platform parameter detection (perplexity)', () => {
  const url = '/register?platform=perplexity';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Mainly Perplexity');
  assert.strictEqual(res.intent, 'account');
  assert.strictEqual(res.source, 'perplexity');
});

// 10. Default fallback
test('Standard webapp fallback without parameters', () => {
  const url = '/';
  const res = derivePlatformFromUrl(url);
  assert.strictEqual(res.apiUse, 'Mainly Claude');
  assert.strictEqual(res.intent, 'account');
  assert.strictEqual(res.source, 'webapp');
});

// 11. deriveIntentFromApiUse helper
test('deriveIntentFromApiUse mappings', () => {
  assert.strictEqual(deriveIntentFromApiUse('Grok Bot'), 'grok');
  assert.strictEqual(deriveIntentFromApiUse('Grok Bot (Earnings)'), 'grok');
  assert.strictEqual(deriveIntentFromApiUse('Mainly Claude'), 'claude');
  assert.strictEqual(deriveIntentFromApiUse('Mainly ChatGPT'), 'chatgpt');
  assert.strictEqual(deriveIntentFromApiUse('Mainly MCP Use'), 'mcp');
  assert.strictEqual(deriveIntentFromApiUse('Self-Demo'), 'demo');
  assert.strictEqual(deriveIntentFromApiUse('Graph Seller'), 'sell');
  assert.strictEqual(deriveIntentFromApiUse('Mainly API Access'), 'api');
  assert.strictEqual(deriveIntentFromApiUse('Custom'), 'account');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All platform detection tests passed cleanly!');
}
