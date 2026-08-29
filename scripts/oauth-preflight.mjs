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
    const { isValidRedirectUrl, isInternalAppUrl } = allowlistModule;

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
  }

  // =========================================================================
  // Layer 3: Route Wiring Checks
  // =========================================================================
  const oauthConsentPagePath = path.join(projectRoot, 'frontend', 'components', 'OAuthConsentPage.tsx');
  if (!fs.existsSync(oauthConsentPagePath)) {
    failures.push(`OAuthConsentPage component missing at ${path.relative(projectRoot, oauthConsentPagePath)}`);
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
  console.log('✅ Allowlist Behavior: isValidRedirectUrl & isInternalAppUrl passed all test cases');
  console.log('✅ Route Wiring: /oauth-consent route and OAuthConsentPage verified in App.tsx');
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
