/**
 * Persona Synthesis Service
 *
 * Nightly cron job that analyzes user query patterns and contributions,
 * generates persona observations via Gemini, and writes them to Airtable.
 *
 * Pipeline:
 *   1. Fetch active users
 *   2. For each user: fetch queries + contributions
 *   3. Call Gemini to synthesize persona
 *   4. Write observations to USER_OBSERVATIONS_TABLE
 *   5. Update user record with persona fields
 *   6. Aggregate account-level persona data
 *
 * Triggered via: POST /api/cron/persona-synthesis (Cloud Scheduler or manual)
 */

import { queryAirtable, createAirtableRecord, updateAirtableRecord } from '../db.js';
import { LOGS_TABLE_QUESTIONS, USERS_TABLE, ACCOUNTS_TABLE, CONTEXT_CONTRIBUTIONS_TABLE, USER_OBSERVATIONS_TABLE } from '../constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  currentPersonaText: string;
  confirmedPersonaText: string;
  userContext: string;
  accountId: string;
}

interface UserQuery {
  question: string;
  graphId: string;
  vertical: string;
  taxonomy_node: string;
  Date: string;
  source: string;
}

interface UserContribution {
  origin_type: string;
  taxonomy_node: string;
  content_summary: string;
  created_at: string;
}

interface PersonaSynthesis {
  persona_text: string;
  interests: Array<{ node: string; weight: number }>;
  engagement_depth: Array<{ node: string; avgDepth: number; queryCount: number }>;
  expertise_domains: Array<{ node: string; contributionCount: number }>;
  drift_detected: boolean;
  drift_summary: string;
}

interface SynthesisResult {
  ok: boolean;
  usersProcessed: number;
  accountsProcessed: number;
  observationsWritten: number;
  error?: string;
}

interface AccountSynthesisResult {
  ok: boolean;
  accountsProcessed: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_USERS_PER_RUN = 100;
const MIN_QUERIES_THRESHOLD = 3;
const GEMINI_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all users from USERS_TABLE.
 * Returns user records with persona-relevant fields.
 */
async function fetchActiveUsers(): Promise<UserRecord[]> {
  const allRecords: any[] = [];
  let offset = '';

  do {
    const extra = offset ? `offset=${offset}` : '';
    const result = await queryAirtable(USERS_TABLE, '', extra);
    allRecords.push(...(result.records || []));
    offset = result.offset || '';
  } while (offset);

  console.log(`[PersonaSynthesis] Fetched ${allRecords.length} users from USERS_TABLE`);

  return allRecords.map((rec: any) => {
    const f = rec.fields || {};
    const accountArray = f.Account;
    const accountId = Array.isArray(accountArray) && accountArray.length > 0 ? accountArray[0] : '';
    return {
      id: rec.id,
      email: f.email || '',
      firstName: f['User Full Name']?.split(' ')[0] || f.firstName || '',
      lastName: f['User Full Name']?.split(' ').slice(1).join(' ') || f.lastName || '',
      jobTitle: f.jobTitle || f.buyer_type || '',
      company: f.company || f.buyer_industry || '',
      currentPersonaText: f.current_persona_text || '',
      confirmedPersonaText: f.confirmed_persona_text || '',
      userContext: f.userContext || '',
      accountId,
    };
  });
}

/**
 * Fetch queries for a specific user within the lookback window.
 * Handles Airtable pagination via offset.
 */
async function fetchUserQueries(userEmail: string, days: number): Promise<UserQuery[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString();

  const allRecords: any[] = [];
  let offset = '';

  do {
    const filter = `AND(IS_AFTER({Date}, '${sinceDate}'), {userEmail} = '${userEmail}', {source} != 'api-v1')`;
    const extra = offset ? `offset=${offset}` : '';
    const result = await queryAirtable(LOGS_TABLE_QUESTIONS, filter, extra);
    allRecords.push(...(result.records || []));
    offset = result.offset || '';
  } while (offset);

  return allRecords.map((rec: any) => {
    const f = rec.fields || {};
    return {
      question: f.question || '',
      graphId: f.graphId || f.searchSlug || '',
      vertical: f.vertical || '',
      taxonomy_node: f.taxonomy_node || '',
      Date: f.Date || '',
      source: f.source || '',
    };
  });
}

/**
 * Fetch contributions for a specific user within the lookback window.
 * Handles Airtable pagination via offset.
 */
async function fetchUserContributions(userEmail: string, days: number): Promise<UserContribution[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString();

  const allRecords: any[] = [];
  let offset = '';

  do {
    const filter = `AND(IS_AFTER({created_at}, '${sinceDate}'), {user_id} = '${userEmail}')`;
    const extra = offset ? `offset=${offset}` : '';
    const result = await queryAirtable(CONTEXT_CONTRIBUTIONS_TABLE, filter, extra);
    allRecords.push(...(result.records || []));
    offset = result.offset || '';
  } while (offset);

  return allRecords.map((rec: any) => {
    const f = rec.fields || {};
    return {
      origin_type: f.origin_type || '',
      taxonomy_node: f.taxonomy_node || '',
      content_summary: f.content_summary || '',
      created_at: f.created_at || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Gemini Synthesis
// ---------------------------------------------------------------------------

/**
 * Call Gemini 2.0 Flash to synthesize a persona from user activity.
 * Uses dynamic import of @google/genai (same pattern as helpers.ts rewriteContext).
 */
async function synthesizePersona(
  user: UserRecord,
  queries: UserQuery[],
  contributions: UserContribution[],
  days: number
): Promise<PersonaSynthesis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[PersonaSynthesis] No GEMINI_API_KEY — skipping Gemini synthesis');
    return null;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Format top 50 queries with taxonomy_node
    const queryList = queries
      .slice(0, 50)
      .map((q, i) => `${i + 1}. "${q.question}" [${q.taxonomy_node || 'uncategorized'}] (${q.graphId})`)
      .join('\n');

    // Format contributions
    const contribList = contributions
      .map((c, i) => `${i + 1}. [${c.origin_type}] ${c.taxonomy_node || 'general'}: ${c.content_summary || '(no summary)'}`)
      .join('\n');

    const prompt = `You are analyzing a research platform user's activity to build their persona profile.

USER: ${user.firstName} ${user.lastName}, ${user.jobTitle} at ${user.company}
EXISTING PERSONA: ${user.currentPersonaText || 'None yet'}

RECENT QUERIES (${queries.length} queries over last ${days} days):
${queryList || 'No queries'}

CONTRIBUTIONS (${contributions.length}):
${contribList || 'No contributions'}

Respond with ONLY valid JSON:
{
  "persona_text": "2-3 sentence summary of research focus and style",
  "interests": [{"node": "Retail", "weight": 0.8}],
  "engagement_depth": [{"node": "Sports", "avgDepth": 4.2, "queryCount": 45}],
  "expertise_domains": [{"node": "Retail", "contributionCount": 3}],
  "drift_detected": false,
  "drift_summary": ""
}

Rules:
- interests: recency-weight queries. Last 3 days = 1.0, 4-7 days = 0.7, 8-14 = 0.4, older = 0.2
- engagement_depth is INFERRED from query patterns only. Never say "expertise" for inferred data.
- expertise_domains ONLY from contributions with origin_type corrected/extended.
- Keep persona_text concise and factual.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1500 },
    });

    const text = (result.text || '').trim();
    // Strip markdown fences if Gemini adds them
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');

    try {
      const parsed = JSON.parse(cleaned) as PersonaSynthesis;
      return parsed;
    } catch (parseErr: any) {
      console.error(`[PersonaSynthesis] JSON parse failed for user ${user.email}:`, parseErr.message);
      console.error(`[PersonaSynthesis] Raw response: ${text.slice(0, 500)}`);
      return null;
    }
  } catch (e: any) {
    console.error(`[PersonaSynthesis] Gemini synthesis failed for user ${user.email}:`, e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Observation Writing
// ---------------------------------------------------------------------------

/**
 * Write persona observations to USER_OBSERVATIONS_TABLE.
 * Creates one record per observation type (interest, engagement_depth, produced_expertise).
 * Returns the number of observations written.
 */
async function writeObservations(userId: string, synthesis: PersonaSynthesis): Promise<number> {
  let written = 0;
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Interest observations
  for (const interest of synthesis.interests) {
    try {
      await createAirtableRecord(USER_OBSERVATIONS_TABLE, {
        user_id: userId,
        date: now,
        observation_type: 'interest',
        taxonomy_node: interest.node,
        summary_text: `Interest weight: ${interest.weight}`,
        confidence_tier: interest.weight >= 0.7 ? 'high' : interest.weight >= 0.4 ? 'medium' : 'low',
        evidence_count: 1,
        source_refs: '',
        superseded: false,
      });
      written++;
    } catch (err: any) {
      console.error(`[PersonaSynthesis] Failed to write interest observation for ${userId}:`, err.message);
    }
  }

  // Engagement depth observations
  for (const eng of synthesis.engagement_depth) {
    try {
      await createAirtableRecord(USER_OBSERVATIONS_TABLE, {
        user_id: userId,
        date: now,
        observation_type: 'engagement_depth',
        taxonomy_node: eng.node,
        summary_text: `Avg depth: ${eng.avgDepth}, ${eng.queryCount} queries`,
        confidence_tier: eng.queryCount >= 10 ? 'high' : eng.queryCount >= 5 ? 'medium' : 'low',
        evidence_count: eng.queryCount,
        source_refs: '',
        superseded: false,
      });
      written++;
    } catch (err: any) {
      console.error(`[PersonaSynthesis] Failed to write engagement_depth observation for ${userId}:`, err.message);
    }
  }

  // Expertise domain observations (from contributions only)
  for (const exp of synthesis.expertise_domains) {
    try {
      await createAirtableRecord(USER_OBSERVATIONS_TABLE, {
        user_id: userId,
        date: now,
        observation_type: 'produced_expertise',
        taxonomy_node: exp.node,
        summary_text: `${exp.contributionCount} contributions (corrected/extended)`,
        confidence_tier: exp.contributionCount >= 5 ? 'high' : exp.contributionCount >= 2 ? 'medium' : 'low',
        evidence_count: exp.contributionCount,
        source_refs: '',
        superseded: false,
      });
      written++;
    } catch (err: any) {
      console.error(`[PersonaSynthesis] Failed to write produced_expertise observation for ${userId}:`, err.message);
    }
  }

  return written;
}

// ---------------------------------------------------------------------------
// User Record Update
// ---------------------------------------------------------------------------

/**
 * Update the user record with synthesized persona fields.
 * NEVER touches confirmed_persona_text — that is user-owned.
 */
async function updateUserFields(userId: string, synthesis: PersonaSynthesis): Promise<void> {
  try {
    await updateAirtableRecord(USERS_TABLE, userId, {
      current_persona_text: synthesis.persona_text,
      persona_last_updated: new Date().toISOString(),
      interests_current: JSON.stringify(synthesis.interests),
      top_engagement_domains: JSON.stringify(synthesis.engagement_depth),
      confirmed_expertise_domains: JSON.stringify(synthesis.expertise_domains),
    });
  } catch (err: any) {
    console.error(`[PersonaSynthesis] Failed to update user fields for ${userId}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point — User Synthesis
// ---------------------------------------------------------------------------

/**
 * Main entry point. Called by cron endpoint.
 *
 * Runs the full persona synthesis pipeline:
 *   1. Fetch all users
 *   2. For each user (up to MAX_USERS_PER_RUN), fetch queries and contributions
 *   3. Skip users with fewer than MIN_QUERIES_THRESHOLD queries
 *   4. Call Gemini to synthesize persona
 *   5. Write observations to USER_OBSERVATIONS_TABLE
 *   6. Update user record
 *   7. Run account-level aggregation
 */
export async function runPersonaSynthesis(
  days: number = 30
): Promise<SynthesisResult> {
  try {
    console.log(`[PersonaSynthesis] Starting persona synthesis for last ${days} days...`);

    // 1. Fetch all users
    const users = await fetchActiveUsers();
    if (users.length === 0) {
      console.log('[PersonaSynthesis] No users found — skipping');
      return { ok: true, usersProcessed: 0, accountsProcessed: 0, observationsWritten: 0 };
    }

    let usersProcessed = 0;
    let totalObservationsWritten = 0;

    // 2. Process each user (capped at MAX_USERS_PER_RUN)
    for (const user of users.slice(0, MAX_USERS_PER_RUN)) {
      if (!user.email) continue;

      // Fetch user's queries
      const queries = await fetchUserQueries(user.email, days);

      // Skip users with too few queries
      if (queries.length < MIN_QUERIES_THRESHOLD) {
        continue;
      }

      // Fetch user's contributions
      const contributions = await fetchUserContributions(user.email, days);

      console.log(
        `[PersonaSynthesis] Processing user ${user.email} (${queries.length} queries, ${contributions.length} contributions)`
      );

      // Call Gemini to synthesize persona
      const synthesis = await synthesizePersona(user, queries, contributions, days);

      if (!synthesis) {
        console.warn(`[PersonaSynthesis] No synthesis result for ${user.email} — skipping`);
        continue;
      }

      // Write observations
      const observationsWritten = await writeObservations(user.id, synthesis);
      totalObservationsWritten += observationsWritten;

      // Update user fields
      await updateUserFields(user.id, synthesis);

      usersProcessed++;

      // Delay between Gemini calls to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, GEMINI_DELAY_MS));
    }

    // 3. Run account-level aggregation
    const accountResult = await runAccountSynthesis();

    console.log(
      `[PersonaSynthesis] Complete: ${usersProcessed} users processed, ` +
      `${totalObservationsWritten} observations written, ` +
      `${accountResult.accountsProcessed} accounts aggregated`
    );

    return {
      ok: true,
      usersProcessed,
      accountsProcessed: accountResult.accountsProcessed,
      observationsWritten: totalObservationsWritten,
    };
  } catch (err: any) {
    console.error('[PersonaSynthesis] Fatal error:', err);
    return {
      ok: false,
      usersProcessed: 0,
      accountsProcessed: 0,
      observationsWritten: 0,
      error: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Account-Level Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregates user-level persona data to account level.
 *
 * For each account:
 *   1. Fetch all users in the account
 *   2. Merge their interests_current, top_engagement_domains
 *   3. Compute active_knowledge_domains from query distribution
 *   4. Update ACCOUNTS_TABLE with aggregated fields
 *
 * No Gemini call — pure JSON aggregation.
 */
export async function runAccountSynthesis(): Promise<AccountSynthesisResult> {
  try {
    console.log('[PersonaSynthesis] Starting account-level aggregation...');

    // Fetch all users to group by account
    const allRecords: any[] = [];
    let offset = '';

    do {
      const extra = offset ? `offset=${offset}` : '';
      const result = await queryAirtable(USERS_TABLE, '', extra);
      allRecords.push(...(result.records || []));
      offset = result.offset || '';
    } while (offset);

    // Group users by account
    const accountUsers: Record<string, any[]> = {};
    for (const rec of allRecords) {
      const f = rec.fields || {};
      const accountArray = f.Account;
      const accountId = Array.isArray(accountArray) && accountArray.length > 0 ? accountArray[0] : '';
      if (!accountId) continue;

      if (!accountUsers[accountId]) accountUsers[accountId] = [];
      accountUsers[accountId].push(f);
    }

    let accountsProcessed = 0;

    for (const [accountId, users] of Object.entries(accountUsers)) {
      try {
        // Merge interests_current across all users in the account
        const teamInterests: Record<string, { totalWeight: number; count: number }> = {};
        const teamEngagement: Record<string, { totalDepth: number; totalQueries: number; count: number }> = {};
        const knowledgeDomains: Record<string, number> = {};

        for (const userFields of users) {
          // Parse interests_current
          try {
            const interests = JSON.parse(userFields.interests_current || '[]');
            if (Array.isArray(interests)) {
              for (const interest of interests) {
                if (!interest.node) continue;
                if (!teamInterests[interest.node]) teamInterests[interest.node] = { totalWeight: 0, count: 0 };
                teamInterests[interest.node].totalWeight += (interest.weight || 0);
                teamInterests[interest.node].count++;
              }
            }
          } catch { /* skip unparseable */ }

          // Parse top_engagement_domains
          try {
            const engagements = JSON.parse(userFields.top_engagement_domains || '[]');
            if (Array.isArray(engagements)) {
              for (const eng of engagements) {
                if (!eng.node) continue;
                if (!teamEngagement[eng.node]) teamEngagement[eng.node] = { totalDepth: 0, totalQueries: 0, count: 0 };
                teamEngagement[eng.node].totalDepth += (eng.avgDepth || 0);
                teamEngagement[eng.node].totalQueries += (eng.queryCount || 0);
                teamEngagement[eng.node].count++;
              }
            }
          } catch { /* skip unparseable */ }

          // Parse confirmed_expertise_domains for knowledge domains
          try {
            const expertise = JSON.parse(userFields.confirmed_expertise_domains || '[]');
            if (Array.isArray(expertise)) {
              for (const exp of expertise) {
                if (!exp.node) continue;
                knowledgeDomains[exp.node] = (knowledgeDomains[exp.node] || 0) + (exp.contributionCount || 1);
              }
            }
          } catch { /* skip unparseable */ }
        }

        // Build aggregated arrays
        const teamInterestsArray = Object.entries(teamInterests)
          .map(([node, data]) => ({
            node,
            avgWeight: Math.round((data.totalWeight / data.count) * 100) / 100,
            userCount: data.count,
          }))
          .sort((a, b) => b.avgWeight - a.avgWeight)
          .slice(0, 20);

        const teamEngagementArray = Object.entries(teamEngagement)
          .map(([node, data]) => ({
            node,
            avgDepth: Math.round((data.totalDepth / data.count) * 100) / 100,
            totalQueries: data.totalQueries,
            userCount: data.count,
          }))
          .sort((a, b) => b.totalQueries - a.totalQueries)
          .slice(0, 20);

        const knowledgeDomainsArray = Object.entries(knowledgeDomains)
          .map(([node, contributionCount]) => ({ node, contributionCount }))
          .sort((a, b) => b.contributionCount - a.contributionCount)
          .slice(0, 20);

        // Build account persona text (simple aggregation, no Gemini)
        const topInterests = teamInterestsArray.slice(0, 3).map(i => i.node).join(', ');
        const topEngagement = teamEngagementArray.slice(0, 3).map(e => e.node).join(', ');
        const accountPersonaText = topInterests || topEngagement
          ? `Team of ${users.length} users. Top interests: ${topInterests || 'N/A'}. Most engaged domains: ${topEngagement || 'N/A'}.`
          : '';

        // Update account record
        await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
          team_interests_current: JSON.stringify(teamInterestsArray),
          team_engagement_domains: JSON.stringify(teamEngagementArray),
          active_knowledge_domains: JSON.stringify(knowledgeDomainsArray),
          current_account_persona_text: accountPersonaText,
        });

        accountsProcessed++;
      } catch (err: any) {
        console.error(`[PersonaSynthesis] Failed to aggregate account ${accountId}:`, err.message);
      }
    }

    console.log(`[PersonaSynthesis] Account aggregation complete: ${accountsProcessed} accounts processed`);
    return { ok: true, accountsProcessed };
  } catch (err: any) {
    console.error('[PersonaSynthesis] Account aggregation fatal error:', err);
    return { ok: false, accountsProcessed: 0, error: err.message };
  }
}
