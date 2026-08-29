import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Attempt to load .env if process.env variables are not already populated
function loadEnvFallback() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      // Ignore env read errors
    }
  }
}

loadEnvFallback();

const DEFAULT_SALES_CHANNEL_ID = 'C0AV0HLSF24'; // #fodda-sales

/**
 * Dispatches an alert to #fodda-sales upon preflight or post-deploy smoke guard failure.
 * Never throws. If SLACK_BOT_TOKEN is not present, prints a loud banner to stdout/stderr.
 *
 * @param {Object} opts
 * @param {'preflight' | 'smoke'} opts.guardType
 * @param {string} opts.commit
 * @param {string} opts.firstFailingCheck
 * @param {string[]} [opts.allFailures]
 */
export async function sendOAuthGuardAlert({ guardType, commit, firstFailingCheck, allFailures = [] }) {
  const shortCommit = (commit || 'unknown').substring(0, 7);
  const text = `🛑 OAuth-flow guard FAILED (${guardType}) on deploy of ${shortCommit}: ${firstFailingCheck}`;

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_SALES_CHANNEL_ID || DEFAULT_SALES_CHANNEL_ID;

  if (!token) {
    console.error('\n' + '='.repeat(80));
    console.error(`🛑 OAUTH-FLOW GUARD FAILED (${guardType.toUpperCase()}) ON DEPLOY OF ${shortCommit}`);
    console.error(`Failure: ${firstFailingCheck}`);
    if (allFailures.length > 1) {
      console.error('All Failures:');
      for (const f of allFailures) {
        console.error(`  - ${f}`);
      }
    }
    console.error('NOTE: SLACK_BOT_TOKEN is not configured in this environment — alert not posted to Slack.');
    console.error('='.repeat(80) + '\n');
    return { ok: false, sent: false, reason: 'no_token' };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text,
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const data = await response.json();
    if (!data.ok) {
      console.error(`[OAuthGuardAlert] Slack API error: ${data.error}`);
      return { ok: false, sent: false, error: data.error };
    }

    console.log(`[OAuthGuardAlert] Alert successfully posted to Slack #${channel}: "${text}"`);
    return { ok: true, sent: true };
  } catch (err) {
    console.error(`[OAuthGuardAlert] Failed to dispatch Slack alert:`, err.message);
    return { ok: false, sent: false, error: err.message };
  }
}
