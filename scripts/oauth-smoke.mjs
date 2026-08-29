#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { sendOAuthGuardAlert } from './slack-alert.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    return process.env.COMMIT_SHA || process.env.GIT_COMMIT || 'unknown';
  }
}

async function runSmoke() {
  console.log('💨 Running OAuth-flow Post-Deploy Smoke Suite...\n');
  const failures = [];

  // =========================================================================
  // Smoke Check 1: GET https://app.fodda.ai/ (Health & 200 check)
  // =========================================================================
  try {
    const homeRes = await fetch('https://app.fodda.ai/', {
      signal: AbortSignal.timeout(10000),
    });
    if (homeRes.status !== 200) {
      failures.push(`GET https://app.fodda.ai/ returned status ${homeRes.status} (expected 200)`);
    } else {
      console.log('✅ Live App Root: https://app.fodda.ai/ returned HTTP 200');
    }
  } catch (err) {
    failures.push(`GET https://app.fodda.ai/ failed: ${err.message}`);
  }

  // =========================================================================
  // Smoke Check 2: GET https://app.fodda.ai/oauth-consent & bundle verification
  // =========================================================================
  try {
    const consentRes = await fetch('https://app.fodda.ai/oauth-consent', {
      signal: AbortSignal.timeout(10000),
    });
    if (consentRes.status !== 200) {
      failures.push(`GET https://app.fodda.ai/oauth-consent returned status ${consentRes.status} (expected 200)`);
    } else {
      const htmlText = await consentRes.text();
      // Extract script tags
      const scriptSrcMatches = [...htmlText.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
      
      let bundleContainsOAuthConsent = false;
      let checkedScripts = 0;

      for (const src of scriptSrcMatches) {
        const scriptUrl = src.startsWith('http') ? src : `https://app.fodda.ai${src.startsWith('/') ? '' : '/'}${src}`;
        // Skip external analytics/CDNs if we want, or fetch internal assets
        if (scriptUrl.includes('/assets/') || scriptUrl.includes('app.fodda.ai')) {
          checkedScripts++;
          try {
            const scriptRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(10000) });
            if (scriptRes.ok) {
              const scriptText = await scriptRes.text();
              if (scriptText.includes('OAuthConsent') || scriptText.includes('oauth-consent')) {
                bundleContainsOAuthConsent = true;
                break;
              }
            }
          } catch (e) {
            // Ignore single script fetch error if others exist
          }
        }
      }

      if (!bundleContainsOAuthConsent) {
        // Fallback check: check if the HTML itself has an OAuthConsent reference or marker
        if (htmlText.includes('OAuthConsent') || htmlText.includes('oauth-consent')) {
          bundleContainsOAuthConsent = true;
        }
      }

      if (!bundleContainsOAuthConsent) {
        failures.push(`Served bundle at https://app.fodda.ai/oauth-consent lacks OAuthConsent marker (${checkedScripts} script(s) inspected)`);
      } else {
        console.log('✅ Live OAuth Consent Route: https://app.fodda.ai/oauth-consent returned HTTP 200 with OAuthConsent bundle marker');
      }
    }
  } catch (err) {
    failures.push(`GET https://app.fodda.ai/oauth-consent failed: ${err.message}`);
  }

  // =========================================================================
  // Smoke Check 3: GET https://clerk.fodda.ai/v1/environment (Email code-only)
  // =========================================================================
  try {
    const clerkRes = await fetch('https://clerk.fodda.ai/v1/environment?_clerk_js_version=5.100.0', {
      signal: AbortSignal.timeout(10000),
    });

    if (clerkRes.status !== 200) {
      failures.push(`GET https://clerk.fodda.ai/v1/environment returned status ${clerkRes.status} (expected 200)`);
    } else {
      const data = await clerkRes.json();
      const emailAttr = data?.user_settings?.attributes?.email_address;
      
      if (!emailAttr) {
        failures.push('Clerk environment response missing user_settings.attributes.email_address');
      } else {
        const verifications = emailAttr.verifications || [];
        const firstFactors = emailAttr.first_factors || [];

        const isVerificationsCodeOnly = verifications.length === 1 && verifications[0] === 'email_code';
        const isFirstFactorsCodeOnly = firstFactors.length === 1 && firstFactors[0] === 'email_code';

        if (!isVerificationsCodeOnly) {
          failures.push(`Clerk email verifications config is [${verifications.join(', ')}] (expected exactly ['email_code'])`);
        }
        if (!isFirstFactorsCodeOnly) {
          failures.push(`Clerk email first_factors config is [${firstFactors.join(', ')}] (expected exactly ['email_code'])`);
        }

        if (isVerificationsCodeOnly && isFirstFactorsCodeOnly) {
          console.log("✅ Live Clerk Config: verifications and first_factors are strictly ['email_code']");
        }
      }
    }
  } catch (err) {
    failures.push(`GET https://clerk.fodda.ai/v1/environment failed: ${err.message}`);
  }

  // =========================================================================
  // Reporting & Exit
  // =========================================================================
  const commit = getCommitHash();

  if (failures.length > 0) {
    console.error(`\n❌ Post-deploy smoke check failed with ${failures.length} issue(s):`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }

    const firstFailingCheck = failures[0];
    await sendOAuthGuardAlert({
      guardType: 'smoke',
      commit,
      firstFailingCheck,
      allFailures: failures,
    });

    process.exit(1);
  }

  console.log('\n🎉 Post-deploy smoke checks passed cleanly! All live OAuth-flow dependencies intact.\n');
  process.exit(0);
}

runSmoke().catch(async (err) => {
  console.error('Unhandled exception in smoke runner:', err);
  const commit = getCommitHash();
  await sendOAuthGuardAlert({
    guardType: 'smoke',
    commit,
    firstFailingCheck: `Unhandled smoke crash: ${err.message}`,
  });
  process.exit(1);
});
