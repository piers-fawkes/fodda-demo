/**
 * Query Reconciliation & Failure Alerting Service
 *
 * 1. Tracks query log failures with 15-minute Slack alert throttling.
 * 2. Exposes failure count for GET /health.
 * 3. Daily cron: Checks if chat traffic > 0 in 24h but Questions written == 0.
 * 4. Weekly cron: Reconciles active logged-in users against Questions table,
 *    marking noQuestionsRecorded: true on users with 0 recorded queries.
 */

import { queryAirtable, queryAirtableAll, updateAirtableRecord, LOGS_TABLE_QUESTIONS, USERS_TABLE } from '../db.js';

let queryLogFailureCount = 0;
let lastSlackAlertTime = 0;
const SLACK_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

let chatTraffic24hCount = 0;
let lastChatTrafficReset = Date.now();

export function getQueryLogFailureCount(): number {
  return queryLogFailureCount;
}

export function resetQueryLogFailureCount(): void {
  queryLogFailureCount = 0;
}

export function recordChatTraffic(): void {
  const now = Date.now();
  if (now - lastChatTrafficReset > 24 * 60 * 60 * 1000) {
    chatTraffic24hCount = 0;
    lastChatTrafficReset = now;
  }
  chatTraffic24hCount++;
}

export function getChatTrafficCount(): number {
  return chatTraffic24hCount;
}

export function setChatTrafficCount(count: number): void {
  chatTraffic24hCount = count;
}

/**
 * Post an ops alert to Slack.
 */
export async function notifySlackAlert(message: string): Promise<void> {
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      console.warn('[QueryReconciliation] SLACK_BOT_TOKEN not set — skipping Slack alert');
      return;
    }

    const channel = process.env.SLACK_RESEARCH_CHANNEL_ID || 'C0AU0403M3M';

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text: message,
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json() as any;
    if (!data.ok) {
      console.error('[QueryReconciliation] Slack API error:', data.error);
    } else {
      console.log('[QueryReconciliation] Slack alert posted successfully');
    }
  } catch (err: any) {
    console.error('[QueryReconciliation] Failed to post Slack alert:', err?.message);
  }
}

/**
 * Triggered on question logging failure. Increments counter and throttles Slack alerts to 1 per 15 min.
 */
export function notifyQueryLogFailure(errorMessage: string): void {
  queryLogFailureCount++;
  const now = Date.now();
  if (now - lastSlackAlertTime > SLACK_THROTTLE_MS) {
    lastSlackAlertTime = now;
    const msg = `🚨 *QUESTIONS LOGGING FAILURE*: Airtable Questions table write failed: \`${errorMessage}\`. Total failures: ${queryLogFailureCount}`;
    console.error('[QueryLog] Throttled Slack alert triggered:', msg);
    notifySlackAlert(msg).catch(() => {});
  }
}

/**
 * Daily cron check:
 * If the app served chat traffic in the last 24h, the count of Questions rows written in the last 24h must be > 0.
 */
export async function runDailyZeroQuestionsCheck(): Promise<{ ok: boolean; chatTraffic: number; questionsLogged24h: number; alertSent: boolean }> {
  console.log('[QueryReconciliation] Running daily zero-questions check...');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let questionsLogged24h = 0;
  try {
    const filter = `IS_AFTER({Date}, '${cutoff}')`;
    const records = await queryAirtable(LOGS_TABLE_QUESTIONS, filter, 100);
    questionsLogged24h = records.length;
  } catch (err: any) {
    console.error('[QueryReconciliation] Failed to query Questions table:', err?.message);
  }

  const traffic = getChatTrafficCount();
  let alertSent = false;

  if (traffic > 0 && questionsLogged24h === 0) {
    const msg = `🚨 *ZERO QUESTIONS LOGGED (24h)*: The app served ${traffic} chat requests in the last 24h, but 0 rows were recorded in the Airtable Questions table (\`${LOGS_TABLE_QUESTIONS}\`). Logging is broken!`;
    console.error('[QueryReconciliation]', msg);
    await notifySlackAlert(msg);
    alertSent = true;
  } else {
    console.log(`[QueryReconciliation] Daily check clean: ${traffic} requests served, ${questionsLogged24h} questions logged in 24h.`);
  }

  return {
    ok: !alertSent,
    chatTraffic: traffic,
    questionsLogged24h,
    alertSent,
  };
}

/**
 * Weekly cron check:
 * Query Users table for users whose lastLogin is within the window (7 days).
 * Count their rows in Questions. If lastLogin is set but Questions count == 0,
 * surface in a weekly summary line to ops and set noQuestionsRecorded: true on that user record.
 */
export async function runUsersQuestionsReconciliation(windowDays: number = 7): Promise<{
  checkedUsers: number;
  unrecordedUsers: Array<{ email: string; lastLogin: string }>;
  alertSent: boolean;
}> {
  console.log(`[QueryReconciliation] Running weekly users-vs-questions reconciliation (${windowDays}d window)...`);
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const unrecordedUsers: Array<{ email: string; lastLogin: string }> = [];

  try {
    // Query users with lastLogin
    const allUsers = await queryAirtableAll(USERS_TABLE);
    const recentUsers = allUsers.filter(u => {
      const lastLogin = u.fields?.lastLogin || u.fields?.LastLogin || u.fields?.['Last Login'];
      if (!lastLogin) return false;
      try {
        return new Date(lastLogin).toISOString() >= cutoff;
      } catch {
        return false;
      }
    });

    console.log(`[QueryReconciliation] Found ${recentUsers.length} users with logins in last ${windowDays} days.`);

    for (const userRecord of recentUsers) {
      const email = userRecord.fields?.email || userRecord.fields?.Email || '';
      const lastLogin = userRecord.fields?.lastLogin || userRecord.fields?.LastLogin || '';
      if (!email) continue;

      // Query Questions table for this user's email
      const emailFilter = `{userEmail} = '${email.replace(/'/g, "\\'")}'`;
      const questions = await queryAirtable(LOGS_TABLE_QUESTIONS, emailFilter, 5);

      if (questions.length === 0) {
        unrecordedUsers.push({ email, lastLogin });

        // Update user record with noQuestionsRecorded: true
        try {
          await updateAirtableRecord(USERS_TABLE, userRecord.id, {
            "noQuestionsRecorded": true
          });
          console.log(`[QueryReconciliation] Flagged user ${email} as noQuestionsRecorded: true`);
        } catch (updateErr: any) {
          console.error(`[QueryReconciliation] Failed to update user ${email}:`, updateErr?.message);
        }
      }
    }

    let alertSent = false;
    if (unrecordedUsers.length > 0) {
      const userList = unrecordedUsers.map(u => `• ${u.email} (last login: ${u.lastLogin})`).join('\n');
      const msg = `⚠️ *Weekly Questions Reconciliation*: Found ${unrecordedUsers.length} active users with logins in the last ${windowDays} days but 0 recorded questions in Airtable. Flagged \`noQuestionsRecorded: true\` on their records.\n${userList}`;
      console.warn('[QueryReconciliation]', msg);
      await notifySlackAlert(msg);
      alertSent = true;
    } else {
      console.log('[QueryReconciliation] All active users have recorded questions.');
    }

    return {
      checkedUsers: recentUsers.length,
      unrecordedUsers,
      alertSent,
    };
  } catch (err: any) {
    console.error('[QueryReconciliation] Reconciliation failed:', err?.message);
    return {
      checkedUsers: 0,
      unrecordedUsers: [],
      alertSent: false,
    };
  }
}
