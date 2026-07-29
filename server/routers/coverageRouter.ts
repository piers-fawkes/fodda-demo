import { Router } from 'express';
import { queryAirtable, createAirtableRecord, escapeAirtableString } from '../db.js';
import { COVERAGE_REQUESTS_TABLE } from '../constants.js';
import { authenticateSession } from '../helpers.js';
import { SLACK_CHANNELS } from '../slackChannels.js';

const router = Router();

// --- Rate Limiting (5 requests per 10 minutes per IP/User) ---
type RateEntry = { count: number; resetAt: number };
const requestRateLimits = new Map<string, RateEntry>();

function isRateLimited(key: string, limit: number = 5, windowMs: number = 10 * 60_000): boolean {
  const now = Date.now();
  const entry = requestRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    requestRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Trim stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requestRateLimits) {
    if (now > v.resetAt) requestRateLimits.delete(k);
  }
}, 15 * 60_000).unref();

/**
 * POST /api/coverage/request
 * Logs a coverage request (or search-miss signal) to Airtable and posts a Slack alert to #fodda-research.
 */
router.post('/request', async (req, res) => {
  try {
    const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const user = await authenticateSession(req);
    const rateKey = user?.email ? `user:${user.email}` : `ip:${clientIp}`;

    if (isRateLimited(rateKey, 5, 10 * 60_000)) {
      return res.status(429).json({ ok: false, error: 'Too many coverage requests. Please try again later.' });
    }

    const { topic, searchedTerm, source, accountId: bodyAccountId } = req.body || {};
    const effectiveTopic = String(topic || searchedTerm || '').trim();

    if (!effectiveTopic) {
      return res.status(400).json({ ok: false, error: 'Topic or searchedTerm is required.' });
    }

    const requesterEmail = user?.email || (req.body?.email ? String(req.body.email).toLowerCase().trim() : 'anonymous@fodda.ai');
    const accountId = user?.accountId || bodyAccountId || '';
    const requestSource = source === 'search_miss' ? 'search_miss' : 'button';
    const timestamp = new Date().toISOString();

    // 1. Log to Airtable
    try {
      await createAirtableRecord(COVERAGE_REQUESTS_TABLE, {
        'Topic': effectiveTopic,
        'Requester Email': requesterEmail,
        'Account ID': accountId,
        'Source': requestSource,
        'Searched Term': searchedTerm || effectiveTopic,
        'Timestamp': timestamp
      });
    } catch (err: any) {
      console.warn('[CoverageRouter] Failed to write Airtable record (continuing to Slack alert):', err?.message || err);
    }

    // 2. Post Slack Alert to #fodda-research
    try {
      const slackToken = process.env.SLACK_BOT_TOKEN;
      if (slackToken) {
        const sourceLabel = requestSource === 'search_miss' ? '🔍 Search Miss Signal' : '📩 Coverage Request Button';
        const slackMessage = {
          channel: SLACK_CHANNELS.research.name,
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
        if (!slackResult.ok) {
          console.warn('[CoverageRouter] Slack notification returned warning:', slackResult.error || response.statusText);
        }
      }
    } catch (err: any) {
      console.warn('[CoverageRouter] Slack alert dispatch error:', err?.message || err);
    }

    res.json({
      ok: true,
      message: 'Coverage request logged successfully.',
      topic: effectiveTopic,
      source: requestSource
    });
  } catch (err: any) {
    console.error('[CoverageRouter] Failed to handle coverage request:', err);
    res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
  }
});

export default router;
