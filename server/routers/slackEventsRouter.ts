/**
 * Slack Events Router
 *
 * Receives Slack Events API webhooks and handles:
 *   - URL verification (Slack handshake)
 *   - Natural language content gap requests in #fodda-research
 *
 * When a message in #fodda-research mentions content gaps, the bot
 * acknowledges and triggers the content gap analysis pipeline.
 *
 * Endpoint: POST /api/slack/events
 */

import { Router } from 'express';
import crypto from 'crypto';
import { runContentGapSlackReport } from '../services/queryDigestService.js';
import { SLACK_CHANNELS } from '../slackChannels.js';

const router = Router();

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

// Channel where we listen for content gap requests (#fodda-research).
// Incoming events are matched by ID; see slackChannels.ts for the registry
// and env overrides.
const RESEARCH_CHANNEL_ID = SLACK_CHANNELS.research.id;

// Keywords / phrases that indicate a content gap request
const GAP_TRIGGERS = [
  'content gap',
  'gap analysis',
  'gap report',
  'what are users searching',
  'what are people searching',
  'what topics are missing',
  'missing topics',
  'unmet queries',
  'run content gaps',
  'check content gaps',
  'content coverage',
  'what are we missing',
  'where are the gaps',
  'find gaps',
  'run gaps',
];

/**
 * Verify Slack request signature.
 * Falls through if SLACK_SIGNING_SECRET is not configured (dev mode).
 */
function verifySlackSignature(req: any): boolean {
  if (!SIGNING_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error("[Slack Auth] SLACK_SIGNING_SECRET is not configured. Rejecting request in production.");
      return false;
    }
    return true; // No secret = dev mode
  }

  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

/**
 * Check if a message is asking for content gap analysis.
 */
function isContentGapRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return GAP_TRIGGERS.some(trigger => lower.includes(trigger));
}

/**
 * Post a reply to a Slack channel (optionally in a thread).
 */
async function postReply(channel: string, text: string, threadTs?: string): Promise<void> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('[SlackEvents] SLACK_BOT_TOKEN not set — cannot post reply');
    return;
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        thread_ts: threadTs,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error(`[SlackEvents] chat.postMessage failed (${channel}):`, data.error);
    }
  } catch (err: any) {
    console.error(`[SlackEvents] chat.postMessage error (${channel}):`, err.message);
  }
}

// Track processed event IDs to avoid duplicate handling (Slack retries)
const processedEvents = new Set<string>();

/**
 * POST /api/slack/events
 *
 * Handles Slack Events API payloads:
 *   - type: url_verification → returns challenge
 *   - type: event_callback  → processes the event
 */
router.post('/', async (req, res) => {
  const body = req.body;

  // 1. Verify signature first (before any early returns)
  //    url_verification handshakes must also be signed in production.
  if (!verifySlackSignature(req)) {
    console.warn('[SlackEvents] Invalid signature — rejecting');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. URL verification handshake (Slack sends this when you configure the URL)
  if (body.type === 'url_verification') {
    console.log('[SlackEvents] Received URL verification handshake');
    return res.json({ challenge: body.challenge });
  }

  // 3. Acknowledge immediately (Slack expects a 200 within 3 seconds)
  res.status(200).json({ ok: true });

  // 4. Process the event asynchronously
  if (body.type !== 'event_callback') return;

  const event = body.event;
  if (!event) return;

  // Deduplicate (Slack retries if it doesn't get a fast 200)
  const eventId = body.event_id || `${event.ts}-${event.channel}`;
  if (processedEvents.has(eventId)) return;
  processedEvents.add(eventId);
  // Clean up old event IDs (keep last 200)
  if (processedEvents.size > 200) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }

  // Only handle messages (not bot messages, not edits)
  if (event.type !== 'message' && event.type !== 'app_mention') return;
  if (event.subtype) return; // Ignore edits, joins, etc.
  if (event.bot_id) return;  // Ignore other bot messages

  const text = event.text || '';
  const channel = event.channel || '';

  // Check for content gap request
  if (!isContentGapRequest(text)) return;

  // Only process messages in #fodda-research. A trigger phrase from another
  // channel is logged so a stale/misconfigured channel ID is visible in logs
  // instead of silently dropping every event.
  if (channel !== RESEARCH_CHANNEL_ID) {
    console.warn(
      `[SlackEvents] Gap trigger received from channel ${channel} but listener is bound to ${RESEARCH_CHANNEL_ID} — ignoring. ` +
      `If this is #fodda-research, set SLACK_RESEARCH_CHANNEL_ID=${channel}.`
    );
    return;
  }

  console.log(`[SlackEvents] Content gap request detected from ${event.user}: "${text}"`);

  // Parse optional lookback period from the message (e.g. "last 14 days", "30 days")
  const daysMatch = text.match(/(\d+)\s*days?/i);
  const days = daysMatch ? Math.min(parseInt(daysMatch[1]), 90) : 7;

  // Acknowledge in-thread
  await postReply(
    channel,
    `🔍 On it — running content gap analysis for the last ${days} days. Results incoming…`,
    event.ts
  );

  // Trigger the analysis. Heartbeat off — this interactive path already
  // reports its outcome in-thread; heartbeats are for the scheduled runs.
  try {
    const result = await runContentGapSlackReport(days, { heartbeat: false });

    if (result.gaps === 0 && result.bounces === 0) {
      await postReply(
        channel,
        `✅ Analysis complete — no content gaps detected in the last ${days} days. All queries returned strong results.`,
        event.ts
      );
    } else {
      await postReply(
        channel,
        `✅ Analysis complete — found ${result.gaps} gap${result.gaps !== 1 ? 's' : ''} and ${result.bounces} graph bounce${result.bounces !== 1 ? 's' : ''}. Individual alerts have been posted.`,
        event.ts
      );
    }
  } catch (err: any) {
    console.error('[SlackEvents] Content gap analysis failed:', err.message);
    await postReply(
      channel,
      `❌ Content gap analysis failed: ${err.message}`,
      event.ts
    );
  }
});

export default router;
