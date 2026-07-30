/**
 * Payment Slack Service
 *
 * Sends payment-journey alerts and failure notifications to Slack (#fodda-sales, C0AV0HLSF24).
 * Non-blocking, fire-and-forget, never throws, 10s timeout.
 * Deduplicates identical events within a 10-minute window.
 */

const DEFAULT_SALES_CHANNEL_ID = 'C0AV0HLSF24';
const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory cache for deduplication: eventKey -> timestamp (ms)
const dedupeCache = new Map<string, number>();

/**
 * Redact email address for non-critical alerts (e.g. piers.fawkes@psfk.com -> pi***@psfk.com).
 */
export function redactEmail(email?: string): string {
  if (!email || typeof email !== 'string') return 'unknown';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return 'unknown';
  const name = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex);
  const visiblePrefix = name.substring(0, 2);
  return `${visiblePrefix}***${domain}`;
}

/**
 * Clean up stale cache entries to prevent memory growth.
 */
function pruneDedupeCache(): void {
  const now = Date.now();
  if (dedupeCache.size > 500) {
    for (const [key, timestamp] of dedupeCache.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) {
        dedupeCache.delete(key);
      }
    }
  }
}

/**
 * Format a human-readable, compact 1-2 line message for Slack based on the failure stage.
 */
function formatSlackMessage(stage: string, detail: Record<string, any>): string {
  switch (stage) {
    case 'airtable_update_failed': {
      const email = detail.customerEmail || 'unknown';
      const acct = detail.accountId || 'unknown';
      const amt = detail.amount || 'unknown';
      const err = detail.error || 'Unknown database error';
      return `🚨 *AIRTABLE UPDATE FAILED AFTER PAYMENT*: Buyer ${email} paid ${amt} for account \`${acct}\` — database record failed to update! Error: ${err}`;
    }
    case 'unmatched_payment_auto_resolved': {
      const email = detail.customerEmail || 'unknown';
      const amt = detail.amount || 'unknown';
      const price = detail.stripePriceId || 'unknown';
      const acct = detail.accountId || 'unknown';
      const sess = detail.sessionId || 'unknown';
      return `💸 *UNMATCHED STRIPE PAYMENT (AUTO-RESOLVED)*: ${email} paid ${amt} (Price ID: ${price}) — auto domain-matched to account \`${acct}\`. Session: ${sess}`;
    }
    case 'unmatched_payment_no_user': {
      const email = detail.customerEmail || 'unknown';
      const amt = detail.amount || 'unknown';
      const price = detail.stripePriceId || 'unknown';
      const sess = detail.sessionId || 'unknown';
      return `💸 *UNMATCHED STRIPE PAYMENT*: ${email} paid ${amt} (Price ID: ${price}) — no Fodda user account matched. Session: ${sess}`;
    }
    case 'unmatched_payment_no_account': {
      const email = detail.customerEmail || 'unknown';
      const amt = detail.amount || 'unknown';
      const price = detail.stripePriceId || 'unknown';
      const sess = detail.sessionId || 'unknown';
      return `💸 *UNMATCHED STRIPE PAYMENT*: ${email} paid ${amt} (Price ID: ${price}) — user exists but has no linked Fodda account. Session: ${sess}`;
    }
    case 'webhook_signature_failed': {
      const err = detail.error || 'Invalid Stripe signature';
      return `⚠️ *STRIPE WEBHOOK SIGNATURE REJECTION*: Webhook payload failed signature verification. Error: ${err}`;
    }
    case 'plan_not_found': {
      const email = redactEmail(detail.customerEmail);
      const price = detail.stripePriceId || 'unknown';
      const sess = detail.sessionId || 'unknown';
      return `⚠️ *STRIPE WEBHOOK PLAN MISSING*: Completed checkout for ${email} referenced unknown Price ID ${price}. Session: ${sess}`;
    }
    case 'subscribe_no_price_id': {
      const email = redactEmail(detail.email);
      const plan = detail.planCode ?? 'unknown';
      return `⚠️ *CHECKOUT SUBSCRIBE FAILURE*: User ${email} attempted to subscribe to plan ${plan}, but no Stripe price ID is configured.`;
    }
    case 'subscribe_plan_not_found': {
      const email = redactEmail(detail.email);
      const plan = detail.planCode ?? 'unknown';
      return `⚠️ *CHECKOUT SUBSCRIBE FAILURE*: User ${email} attempted to subscribe to invalid plan code ${plan}.`;
    }
    case 'subscribe_5xx': {
      const email = redactEmail(detail.email);
      const plan = detail.planCode ?? 'unknown';
      const err = detail.error || 'Internal server error';
      return `⚠️ *CHECKOUT SUBSCRIBE FAILURE (5XX)*: Checkout error for user ${email} (plan ${plan}): ${err}`;
    }
    case 'auto_checkout_failed': {
      const email = redactEmail(detail.email);
      const plan = detail.planCode ?? 'unknown';
      const err = detail.error || 'Failed to create checkout session';
      return `⚠️ *AUTO CHECKOUT FAILURE*: Auto-checkout failed for ${email} (plan ${plan}): ${err}`;
    }
    default: {
      const email = redactEmail(detail.email || detail.customerEmail);
      const err = detail.error || detail.reason || JSON.stringify(detail);
      return `⚠️ *PAYMENT JOURNEY FAILURE* (\`${stage}\`): User ${email} — ${err}`;
    }
  }
}

/**
 * Send payment failure alert to Slack (#fodda-sales).
 *
 * Fire-and-forget function. Never throws, never delays payment execution paths.
 */
export function notifyPaymentSlack(stage: string, detail: Record<string, any> = {}): void {
  // Execute async task out-of-band so it never blocks the caller
  Promise.resolve().then(async () => {
    try {
      const token = process.env.SLACK_BOT_TOKEN;
      if (!token) {
        console.warn('[PaymentSlack] SLACK_BOT_TOKEN not set — skipping alert');
        return;
      }

      const channel = process.env.SLACK_SALES_CHANNEL_ID || DEFAULT_SALES_CHANNEL_ID;
      const errorMsg = String(detail.error || detail.reason || detail.sessionId || detail.planCode || '');
      const dedupeKey = `${stage}:${errorMsg}:${detail.customerEmail || detail.email || ''}`;

      const now = Date.now();
      const lastSent = dedupeCache.get(dedupeKey);
      if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
        console.log(`[PaymentSlack] Suppressed duplicate alert for stage '${stage}' (last sent ${Math.round((now - lastSent) / 1000)}s ago)`);
        return;
      }

      dedupeCache.set(dedupeKey, now);
      pruneDedupeCache();

      const text = formatSlackMessage(stage, detail);

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          text,
          unfurl_links: false,
          unfurl_media: false,
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const data = await response.json() as any;
      if (!data.ok) {
        console.error(`[PaymentSlack] Slack API error (${channel}):`, data.error);
      } else {
        console.log(`[PaymentSlack] Alert posted to Slack channel ${channel} for stage '${stage}'`);
      }
    } catch (err: any) {
      console.error(`[PaymentSlack] Failed to post alert for stage '${stage}':`, err.message);
    }
  }).catch(() => {});
}
