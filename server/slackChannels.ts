/**
 * Slack channel registry — single source of truth for channel routing.
 *
 * Two channels are in play:
 *   #fodda-research — content gap alerts (MISS/WEAK), events listener, heartbeats
 *   #fodda-sales    — graph-bounce alerts (sales outreach signals)
 *
 * Posting (chat.postMessage) uses channel NAMES, which survive channel
 * recreation. The events listener must match incoming events by ID (Slack
 * events carry IDs, not names), so IDs are env-overridable — a recreated
 * channel is a config change, not a code change. The 2026-07 listener outage
 * was caused by a stale hardcoded ID after #fodda-research was recreated.
 */

export const SLACK_CHANNELS = {
  research: {
    name: 'fodda-research',
    id: process.env.SLACK_RESEARCH_CHANNEL_ID || 'C06QWNN67DB',
  },
  sales: {
    name: 'fodda-sales',
    // No listener is bound to sales; posting resolves by name. Set
    // SLACK_SALES_CHANNEL_ID if an ID match is ever needed.
    id: process.env.SLACK_SALES_CHANNEL_ID || '',
  },
} as const;

// Bot user IDs used for @mentions in alert messages
export const SLACK_BOT_USERS = {
  research: 'U0AU9TBTNBY', // Fodda Research bot
  sales: 'U0AU49JG7AS',    // Fodda Sales bot
} as const;
