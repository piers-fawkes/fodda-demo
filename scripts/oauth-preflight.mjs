#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { sendOAuthGuardAlert } from './slack-alert.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to get current git commit hash
function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    return process.env.COMMIT_SHA || process.env.GIT_COMMIT || 'unknown';
  }
}

// Recursively find files in a directory matching extensions
function getFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      files.push(...getFiles(fullPath, extensions));
    } else if (entry.isFile()) {
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function runPreflight() {
  console.log('🔍 Running OAuth-flow Preflight Test Suite...\n');
  const failures = [];

  // =========================================================================
  // Layer 1: Source Guards
  // =========================================================================
  const frontendDir = path.join(projectRoot, 'frontend');
  const frontendFiles = getFiles(frontendDir);

  const FORBIDDEN_TOKENS = [
    'emailLink',
    'sendEmailLink',
    'prepareEmailAddressVerification',
    'prepareFirstFactor',
  ];

  for (const filePath of frontendFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Check for legacy/link-based Clerk methods
    for (const token of FORBIDDEN_TOKENS) {
      if (content.includes(token)) {
        failures.push(`Forbidden token '${token}' found in ${relativePath} (link-based Clerk calls must not be reintroduced)`);
      }
    }

    // 2. Check for inline redirect host checks (outside shared/redirectAllowlist.ts)
    // Matches patterns like .endsWith('fodda.ai'), .endsWith("fodda.ai"), .endsWith('clerk.com'), etc.
    const inlineHostCheckRegex = /\.endsWith\(\s*['"]\.?(?:fodda\.ai|clerk\.com|accounts\.fodda\.ai|clerk\.fodda\.ai)['"]\s*\)/g;
    if (inlineHostCheckRegex.test(content)) {
      failures.push(`Inline redirect host check detected in ${relativePath}; all host validation must use shared/redirectAllowlist.ts`);
    }
  }

  // Also check server directory for inline host checks outside shared/redirectAllowlist.ts
  const serverDir = path.join(projectRoot, 'server');
  if (fs.existsSync(serverDir)) {
    const serverFiles = getFiles(serverDir);
    for (const filePath of serverFiles) {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const inlineHostCheckRegex = /\.endsWith\(\s*['"]\.?(?:fodda\.ai|clerk\.com|accounts\.fodda\.ai|clerk\.fodda\.ai)['"]\s*\)/g;
      if (inlineHostCheckRegex.test(content)) {
        failures.push(`Inline redirect host check detected in ${relativePath}; all host validation must use shared/redirectAllowlist.ts`);
      }
    }
  }

  // =========================================================================
  // Layer 2: Allowlist Behavior Tests
  // =========================================================================
  let allowlistModule;
  try {
    const allowlistPath = path.join(projectRoot, 'shared', 'redirectAllowlist.ts');
    allowlistModule = await import(allowlistPath);
  } catch (err) {
    try {
      // Fallback relative path
      allowlistModule = await import('../shared/redirectAllowlist.ts');
    } catch (importErr) {
      failures.push(`Failed to import shared/redirectAllowlist.ts: ${importErr.message}`);
    }
  }

  if (allowlistModule) {
    const { isValidRedirectUrl, isInternalAppUrl, normalizeOAuthRedirectUrl } = allowlistModule;

    // Test cases for isValidRedirectUrl
    const shouldReject = [
      'https://evilfodda.ai',
      'https://evilfodda.ai/login',
      'https://notclerk.com',
      '//evil.com',
      '//evil.com/path',
      '/\\evil.com',
      '\\\\evil.com',
      'javascript:alert(1)',
      'data:text/html,evil',
      'https://sub.evilfodda.ai',
    ];

    const shouldAccept = [
      '/dashboard',
      '/sandbox',
      '/oauth-consent',
      'https://app.fodda.ai/x',
      'https://app.fodda.ai/oauth-consent',
      'https://clerk.fodda.ai/oauth/x',
      'https://accounts.fodda.ai/oauth-consent',
      'https://fodda.ai/pricing',
      'https://clerk.com/sso-callback',
    ];

    for (const url of shouldReject) {
      if (isValidRedirectUrl(url) !== false) {
        failures.push(`isValidRedirectUrl failed: '${url}' should be REJECTED (returned true)`);
      }
    }

    for (const url of shouldAccept) {
      if (isValidRedirectUrl(url) !== true) {
        failures.push(`isValidRedirectUrl failed: '${url}' should be ACCEPTED (returned false)`);
      }
    }

    // Test cases for isInternalAppUrl
    const nonAppHosts = [
      'https://evilfodda.ai',
      'https://notclerk.com',
      'https://clerk.fodda.ai/oauth/x',
      'https://accounts.fodda.ai/oauth-consent',
      'https://fodda.ai/pricing',
      'https://clerk.com/sso-callback',
    ];

    const appDestinations = [
      '/dashboard',
      '/sandbox',
      '/oauth-consent',
      'https://app.fodda.ai/x',
      'http://localhost:8080/dashboard',
      'http://127.0.0.1:3000/sandbox',
    ];

    for (const url of nonAppHosts) {
      if (isInternalAppUrl(url) !== false) {
        failures.push(`isInternalAppUrl failed: '${url}' should be FALSE for non-app host (returned true)`);
      }
    }

    for (const url of appDestinations) {
      if (isInternalAppUrl(url) !== true) {
        failures.push(`isInternalAppUrl failed: '${url}' should be TRUE for app destination (returned false)`);
      }
    }

    // Test cases for normalizeOAuthRedirectUrl
    if (typeof normalizeOAuthRedirectUrl !== 'function') {
      failures.push('normalizeOAuthRedirectUrl is not exported or not a function');
    } else {
      const normalizeCases = [
        {
          input: 'https://accounts.fodda.ai/oauth-consent?client_id=foo123&redirect_uri=https%3A%2F%2Fclaude.ai',
          expected: '/oauth-consent?client_id=foo123&redirect_uri=https%3A%2F%2Fclaude.ai',
        },
        {
          input: 'https://accounts.fodda.ai/oauth-consent',
          expected: '/oauth-consent',
        },
        {
          input: '/oauth-consent?client_id=foo123',
          expected: '/oauth-consent?client_id=foo123',
        },
        {
          input: 'https://app.fodda.ai/oauth-consent?client_id=foo123',
          expected: 'https://app.fodda.ai/oauth-consent?client_id=foo123',
        },
        {
          input: 'https://evilfodda.ai/oauth-consent',
          expected: null,
        },
        {
          input: null,
          expected: null,
        },
        {
          input: undefined,
          expected: null,
        },
      ];

      for (const { input, expected } of normalizeCases) {
        const result = normalizeOAuthRedirectUrl(input);
        if (result !== expected) {
          failures.push(`normalizeOAuthRedirectUrl failed for '${input}': expected '${expected}', got '${result}'`);
        }
      }
    }
  }

  // =========================================================================
  // Layer 2.5: OAuth Resume Storage & Expiry Tests
  // =========================================================================
  let storageModule;
  try {
    const storagePath = path.join(projectRoot, 'shared', 'oauthResumeStorage.ts');
    storageModule = await import(storagePath);
  } catch (err) {
    failures.push(`Failed to import shared/oauthResumeStorage.ts: ${err.message}`);
  }

  if (storageModule) {
    const { writePendingOAuthRedirect, readPendingOAuthRedirect, clearPendingOAuthRedirect, OAUTH_REDIRECT_EXPIRY_MS } = storageModule;

    // Set up mock window, sessionStorage, and localStorage for Node environment testing
    const sessionMap = new Map();
    const localMap = new Map();

    const mockStorage = (map) => ({
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
    });

    const prevWindow = global.window;
    const prevSession = global.sessionStorage;
    const prevLocal = global.localStorage;

    global.window = {};
    global.sessionStorage = mockStorage(sessionMap);
    global.localStorage = mockStorage(localMap);

    try {
      // 1. Write test
      writePendingOAuthRedirect('https://accounts.fodda.ai/oauth-consent?client_id=test123');
      const readVal = readPendingOAuthRedirect();
      if (readVal !== '/oauth-consent?client_id=test123') {
        failures.push(`oauthResumeStorage: readPendingOAuthRedirect returned '${readVal}', expected '/oauth-consent?client_id=test123'`);
      }

      // 2. Expiry test (>15 minutes)
      const expiredTs = (Date.now() - (OAUTH_REDIRECT_EXPIRY_MS + 5000)).toString();
      sessionMap.set('fodda.pendingOAuthRedirectAt', expiredTs);
      localMap.set('fodda.pendingOAuthRedirectAt', expiredTs);

      const expiredVal = readPendingOAuthRedirect();
      if (expiredVal !== null) {
        failures.push(`oauthResumeStorage: readPendingOAuthRedirect should return null for timestamp older than 15 min, got '${expiredVal}'`);
      }
      if (sessionMap.has('fodda.pendingOAuthRedirect') || localMap.has('fodda.pendingOAuthRedirect')) {
        failures.push(`oauthResumeStorage: expired entry was not automatically cleared from storage`);
      }

      // 3. Clear test
      writePendingOAuthRedirect('/oauth-consent?client_id=fresh');
      clearPendingOAuthRedirect();
      if (sessionMap.size > 0 || localMap.size > 0) {
        failures.push(`oauthResumeStorage: clearPendingOAuthRedirect left keys in storage`);
      }
    } finally {
      global.window = prevWindow;
      global.sessionStorage = prevSession;
      global.localStorage = prevLocal;
    }
  }

  // =========================================================================
  // Layer 3: Route Wiring & Effect Guards
  // =========================================================================
  const oauthConsentPagePath = path.join(projectRoot, 'frontend', 'components', 'OAuthConsentPage.tsx');
  if (!fs.existsSync(oauthConsentPagePath)) {
    failures.push(`OAuthConsentPage component missing at ${path.relative(projectRoot, oauthConsentPagePath)}`);
  }

  const ssoCallbackPath = path.join(projectRoot, 'frontend', 'components', 'SsoCallbackPage.tsx');
  if (!fs.existsSync(ssoCallbackPath)) {
    failures.push(`frontend/components/SsoCallbackPage.tsx not found`);
  } else {
    const ssoContent = fs.readFileSync(ssoCallbackPath, 'utf8');
    if (!ssoContent.includes('signInForceRedirectUrl')) {
      failures.push(`SsoCallbackPage.tsx missing signInForceRedirectUrl on AuthenticateWithRedirectCallback`);
    }
  }

  const serverIndexPath = path.join(projectRoot, 'server', 'index.ts');
  if (!fs.existsSync(serverIndexPath)) {
    failures.push(`server/index.ts not found`);
  } else {
    const serverContent = fs.readFileSync(serverIndexPath, 'utf8');
    if (!serverContent.includes('formAction') || !serverContent.includes('https://clerk.fodda.ai')) {
      failures.push(`server/index.ts missing formAction directive containing https://clerk.fodda.ai`);
    }
    if (!serverContent.includes('referrerPolicy')) {
      failures.push(`server/index.ts missing referrerPolicy configuration in helmet`);
    }
  }

  const appTsxPath = path.join(projectRoot, 'frontend', 'App.tsx');
  if (!fs.existsSync(appTsxPath)) {
    failures.push(`frontend/App.tsx not found`);
  } else {
    const appContent = fs.readFileSync(appTsxPath, 'utf8');
    if (!appContent.includes('OAuthConsentPage')) {
      failures.push(`frontend/App.tsx does not import OAuthConsentPage`);
    }
    if (!appContent.includes('/oauth-consent')) {
      failures.push(`frontend/App.tsx does not contain /oauth-consent route wiring`);
    }
    const rendersConsent = /<OAuthConsentPage\s*\/>/.test(appContent);
    if (!rendersConsent) {
      failures.push(`frontend/App.tsx does not render <OAuthConsentPage /> on /oauth-consent route`);
    }

    // Verify billing and auto-checkout effects guard against /oauth-consent
    const billingGuardMatch = appContent.includes("pathname === '/oauth-consent' || pathname === '/sso-callback'");
    if (!billingGuardMatch) {
      failures.push(`frontend/App.tsx billing or auto-checkout effect missing /oauth-consent pathname guard`);
    }
  }

  // =========================================================================
  // Reporting & Exit
  // =========================================================================
  const commit = getCommitHash();

  if (failures.length > 0) {
    console.error(`❌ Preflight failed with ${failures.length} issue(s):`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }

    const firstFailingCheck = failures[0];
    await sendOAuthGuardAlert({
      guardType: 'preflight',
      commit,
      firstFailingCheck,
      allFailures: failures,
    });

    process.exit(1);
  }

  console.log('✅ Source Guards: zero forbidden Clerk magic-link tokens & no inline host checks');
  console.log('✅ Allowlist Behavior: isValidRedirectUrl, isInternalAppUrl & normalizeOAuthRedirectUrl passed all test cases');
  console.log('✅ OAuth Resume Storage: 15-minute TTL expiry, persistence, and cleanup verified');
  console.log('✅ Route Wiring & Effect Guards: /oauth-consent route, OAuthConsentPage, SsoCallbackPage props, Helmet CSP, and App effect guards verified');
  console.log('\n🎉 Preflight suite passed cleanly! Deploy gate is OPEN.\n');
  process.exit(0);
}

runPreflight().catch(async (err) => {
  console.error('Unhandled exception in preflight runner:', err);
  const commit = getCommitHash();
  await sendOAuthGuardAlert({
    guardType: 'preflight',
    commit,
    firstFailingCheck: `Unhandled runner crash: ${err.message}`,
  });
  process.exit(1);
});
