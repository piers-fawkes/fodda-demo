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

      // Verify security headers
      const referrerPolicy = consentRes.headers.get('referrer-policy');
      if (referrerPolicy !== 'strict-origin-when-cross-origin') {
        failures.push(`https://app.fodda.ai/oauth-consent referrer-policy is '${referrerPolicy}' (expected 'strict-origin-when-cross-origin')`);
      }

      const csp = consentRes.headers.get('content-security-policy') || '';
      if (!csp.includes('form-action') || !csp.includes('https://clerk.fodda.ai')) {
        failures.push(`https://app.fodda.ai/oauth-consent CSP form-action does not contain https://clerk.fodda.ai`);
      }

      if (!bundleContainsOAuthConsent) {
        failures.push(`Served bundle at https://app.fodda.ai/oauth-consent lacks OAuthConsent marker (${checkedScripts} script(s) inspected)`);
      } else {
        console.log('✅ Live OAuth Consent Route: https://app.fodda.ai/oauth-consent returned HTTP 200, strict-origin referrer, form-action CSP, and OAuthConsent bundle marker');
      }
    }
  } catch (err) {
    failures.push(`GET https://app.fodda.ai/oauth-consent failed: ${err.message}`);
  }

  // =========================================================================
  // Smoke Check 3: GET https://clerk.fodda.ai/v1/environment (Email code-only & display paths)
  // =========================================================================
  try {
    const clerkRes = await fetch('https://clerk.fodda.ai/v1/environment?_clerk_js_version=6.30.1', {
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

      // Check display paths in Clerk environment
      const displayConfig = data?.display_config;
      if (!displayConfig) {
        failures.push('Clerk environment response missing display_config');
      } else {
        if (displayConfig.oauth_consent_url !== 'https://app.fodda.ai/oauth-consent') {
          failures.push(`Clerk display_config.oauth_consent_url is '${displayConfig.oauth_consent_url}' (expected 'https://app.fodda.ai/oauth-consent')`);
        } else {
          console.log("✅ Live Clerk Config: display_config.oauth_consent_url is 'https://app.fodda.ai/oauth-consent'");
        }

        if (displayConfig.sign_in_url !== 'https://app.fodda.ai') {
          failures.push(`Clerk display_config.sign_in_url is '${displayConfig.sign_in_url}' (expected 'https://app.fodda.ai')`);
        } else {
          console.log("✅ Live Clerk Config: display_config.sign_in_url is 'https://app.fodda.ai'");
        }
      }
    }
  } catch (err) {
    failures.push(`GET https://clerk.fodda.ai/v1/environment failed: ${err.message}`);
  }

  // =========================================================================
  // Smoke Check 4: Signed-out Authorize Chain Probe
  // Probes /oauth/authorize -> /oauth/authorize/continue -> app.fodda.ai?redirect_url=https://app.fodda.ai/oauth-consent
  // =========================================================================
  try {
    let probeUrl = 'https://clerk.fodda.ai/oauth/authorize?response_type=code&client_id=9RijQGa1nndtlWlV&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&scope=profile+email&state=12345678&code_challenge=E9Melhoa2OwvFrGMTJguCH50lK6Zw51L08pfauWB9U8&code_challenge_method=S256';
    let landedUrl = null;

    for (let hop = 0; hop < 5; hop++) {
      const hopRes = await fetch(probeUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });

      const loc = hopRes.headers.get('location');
      if (!loc) break;

      const nextUrl = new URL(loc, probeUrl).toString();
      probeUrl = nextUrl;

      if (probeUrl.includes('app.fodda.ai')) {
        landedUrl = probeUrl;
        break;
      }
    }

    if (!landedUrl) {
      failures.push('Signed-out authorize chain did not redirect to app.fodda.ai within 5 hops');
    } else {
      const parsedLanded = new URL(landedUrl);
      const rawRedirectParam = parsedLanded.searchParams.get('redirect_url');
      if (!rawRedirectParam) {
        failures.push(`Signed-out authorize redirect to app.fodda.ai missing 'redirect_url' query parameter: ${landedUrl}`);
      } else {
        const parsedRedirect = new URL(rawRedirectParam);
        if (parsedRedirect.hostname !== 'app.fodda.ai') {
          failures.push(`Signed-out authorize redirect_url host is '${parsedRedirect.hostname}' (expected 'app.fodda.ai')`);
        }
        if (!parsedRedirect.pathname.includes('/oauth-consent')) {
          failures.push(`Signed-out authorize redirect_url path is '${parsedRedirect.pathname}' (expected '/oauth-consent')`);
        }

        if (parsedRedirect.hostname === 'app.fodda.ai' && parsedRedirect.pathname.includes('/oauth-consent')) {
          console.log("✅ Live Authorize Chain: signed-out handoff targets app.fodda.ai with redirect_url to https://app.fodda.ai/oauth-consent");
        }
      }
    }
  } catch (err) {
    failures.push(`Signed-out authorize chain probe failed: ${err.message}`);
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
