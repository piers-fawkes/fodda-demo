import { Router } from 'express';
import { createAirtableRecord } from '../db.js';
import { COVERAGE_REQUESTS_TABLE, LOGS_TABLE_QUESTIONS, NOTIFICATION_REQUESTS_TABLE } from '../constants.js';
import { authenticateSession } from '../helpers.js';
import { SLACK_CHANNELS } from '../slackChannels.js';

const router = Router();

// --- Rate Limiting (Separate budgets for button vs search_miss) ---
type RateEntry = { count: number; resetAt: number };
const requestRateLimits = new Map<string, RateEntry>();

function isRateLimited(key: string, limit: number, windowMs: number = 10 * 60_000): boolean {
  const now = Date.now();
  const entry = requestRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    requestRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Cleanup stale rate entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requestRateLimits) {
    if (now > v.resetAt) requestRateLimits.delete(k);
  }
}, 15 * 60_000).unref();

/**
 * POST /api/coverage/request
 * Logs a coverage request (or search-miss signal) to Airtable and posts a Slack alert to #fodda-research.
 * Returns honest per-leg status (Airtable / Slack).
 */
router.post('/request', async (req, res) => {
  try {
    const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const user = await authenticateSession(req);

    const { topic, searchedTerm, source, accountId: bodyAccountId, email: bodyEmail } = req.body || {};
    const effectiveTopic = String(topic || searchedTerm || '').trim();

    if (!effectiveTopic) {
      return res.status(400).json({ ok: false, error: 'Topic or searchedTerm is required.' });
    }

    const requestSource = source === 'search_miss' ? 'search_miss' : 'button';

    // Separate rate limit budgets: search_miss (15/10m) vs button (5/10m)
    const rateLimitMax = requestSource === 'search_miss' ? 15 : 5;
    const userOrIp = user?.email ? `user:${user.email}` : `ip:${clientIp}`;
    const rateKey = `${requestSource}:${userOrIp}`;

    if (isRateLimited(rateKey, rateLimitMax, 10 * 60_000)) {
      return res.status(429).json({ ok: false, error: `Too many ${requestSource} requests. Please try again later.` });
    }

    // Unverified Email Attribution discipline:
    // Authenticated users get their verified user.email.
    // Unauthenticated requests specifying an email are tagged unverified:email to prevent spoofing.
    const requesterEmail = user?.email
      ? user.email
      : (bodyEmail ? `unverified:${String(bodyEmail).toLowerCase().trim()}` : 'anonymous@fodda.ai');

    const accountId = user?.accountId || bodyAccountId || '';
    const timestamp = new Date().toISOString();

    let airtableSuccess = false;
    let airtableError: string | null = null;
    let slackSuccess = false;
    let slackError: string | null = null;

    // 1. Log to Airtable
    try {
      // Build field payload matching target table schema
      const targetTable = COVERAGE_REQUESTS_TABLE;
      let fieldsPayload: Record<string, any> = {};

      if (targetTable === NOTIFICATION_REQUESTS_TABLE) {
        fieldsPayload = {
          expertId: 'coverage-request',
          expertName: effectiveTopic,
          userEmail: requesterEmail,
          requestType: requestSource,
          status: 'Queued',
          createdAt: timestamp
        };
      } else if (targetTable === LOGS_TABLE_QUESTIONS) {
        fieldsPayload = {
          'question': `[Coverage Request] ${effectiveTopic}`,
          'userEmail': requesterEmail,
          'source': requestSource,
          'vertical': effectiveTopic,
          'accessKey': accountId,
          'Date': timestamp
        };
      } else {
        fieldsPayload = {
          'Topic': effectiveTopic,
          'Requester Email': requesterEmail,
          'Account ID': accountId,
          'Source': requestSource,
          'Searched Term': searchedTerm || effectiveTopic,
          'Timestamp': timestamp
        };
      }

      await createAirtableRecord(targetTable, fieldsPayload);
      airtableSuccess = true;
    } catch (err: any) {
      airtableError = err?.message || String(err);
      console.error('[CoverageRouter] Airtable write failed:', airtableError);
    }

    // 2. Post Slack Alert to #fodda-research
    try {
      const slackToken = process.env.SLACK_BOT_TOKEN;
      if (slackToken) {
        const sourceLabel = requestSource === 'search_miss' ? '🔍 Search Miss Signal' : '📩 Coverage Request Button';
        const channelTarget = process.env.SLACK_RESEARCH_CHANNEL_ID || SLACK_CHANNELS.research.id || 'C0AU0403M3M';

        const slackMessage = {
          channel: channelTarget,
          text: `*${sourceLabel}*\n> *Topic / Term:* "${effectiveTopic}"\n> *User:* ${requesterEmail}${accountId ? ` (Account: \`${accountId}\`)` : ''}\n> *Time:* ${timestamp}`
        };

        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${slackToken}`
          },
          body: JSON.stringify(slackMessage)
        });

        const slackResult = await response.json().catch(() => ({}));
        if (response.ok && slackResult.ok) {
          slackSuccess = true;
        } else {
          slackError = slackResult.error || `HTTP ${response.status} ${response.statusText}`;
          console.error('[CoverageRouter] Slack alert dispatch failed:', slackError);
        }
      } else {
        slackError = 'SLACK_BOT_TOKEN missing in environment';
        console.warn('[CoverageRouter]', slackError);
      }
    } catch (err: any) {
      slackError = err?.message || String(err);
      console.error('[CoverageRouter] Slack alert dispatch error:', slackError);
    }

    // Overall endpoint status is true if AT LEAST ONE leg succeeds, with full per-leg breakdown
    const overallSuccess = airtableSuccess || slackSuccess;
    const statusCode = overallSuccess ? 200 : 500;

    return res.status(statusCode).json({
      ok: overallSuccess,
      airtable: { status: airtableSuccess ? 'ok' : 'failed', error: airtableError },
      slack: { status: slackSuccess ? 'ok' : 'failed', error: slackError },
      topic: effectiveTopic,
      source: requestSource
    });
  } catch (err: any) {
    console.error('[CoverageRouter] Fatal error handling coverage request:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
  }
});

export default router;
