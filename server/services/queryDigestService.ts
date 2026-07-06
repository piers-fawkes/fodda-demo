/**
 * Query Digest Service
 *
 * Generates a weekly intelligence digest from query logs.
 * Pulls 7 days of queries from LOGS_TABLE_QUESTIONS, computes metrics,
 * runs Gemini analysis, and emails the digest to piers@psfk.com.
 *
 * Triggered via: POST /api/cron/query-digest (Cloud Scheduler or manual)
 */

import { queryAirtable, createAirtableRecord, LOGS_TABLE_QUESTIONS } from '../db.js';
import { CONTENT_SUGGESTIONS_TABLE } from '../constants.js';
import { sendDirectEmail } from './emailService.js';
import { SLACK_CHANNELS, SLACK_BOT_USERS } from '../slackChannels.js';

interface DigestMetrics {
  totalQueries: number;
  uniqueEmails: number;
  uniqueAccounts: number;
  qualityDistribution: { STRONG: number; WEAK: number; MISS: number; UNKNOWN: number };
  graphHeatMap: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  topMissQueries: Array<{ question: string; graphId: string }>;
  promptSourceBreakdown: Record<string, number>;
  avgResponseTimeMs: number;
  periodStart: string;
  periodEnd: string;
  // Per-user miss tracking for follow-up
  userMisses: Array<{ email: string; missCount: number; totalQueries: number; topMissQueries: string[] }>;
  // Topic clusters from misses (for ingestion backfill)
  missTopicClusters: Record<string, number>;
  // WEAK result queries (returned results but with low relevance)
  topWeakQueries: Array<{ question: string; graphId: string; resultCount: number }>;
  // Graph bouncing: same user searched the same query across 3+ graphs
  graphBounces: Array<{ query: string; email: string; graphs: string[] }>;
}

interface ContentSuggestion {
  topic: string;
  angle: string;
  sourceGraphs: string[];
  queryCount: number;
  draftPost: string;
  hashtags: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Pull queries from the last N days from Airtable.
 */
async function fetchRecentQueries(days: number = 7): Promise<any[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  const allRecords: any[] = [];
  let offset = '';

  do {
    const filter = `IS_AFTER({Date}, '${sinceISO}')`;
    const extra = offset ? `offset=${offset}` : '';
    const result = await queryAirtable(LOGS_TABLE_QUESTIONS, filter, extra);
    allRecords.push(...(result.records || []));
    offset = result.offset || '';
  } while (offset);

  console.log(`[QueryDigest] Fetched ${allRecords.length} queries from last ${days} days`);
  return allRecords;
}

/**
 * Compute digest metrics from raw query records.
 */
function computeMetrics(records: any[]): DigestMetrics {
  const emails = new Set<string>();
  const accounts = new Set<string>();
  const quality: DigestMetrics['qualityDistribution'] = { STRONG: 0, WEAK: 0, MISS: 0, UNKNOWN: 0 };
  const graphMap: Record<string, number> = {};
  const sourceMap: Record<string, number> = {};
  const promptSourceMap: Record<string, number> = {};
  const missQueries: Array<{ question: string; graphId: string; email: string }> = [];
  const weakQueries: Array<{ question: string; graphId: string; email: string; resultCount: number }> = [];
  const userQueryCounts: Record<string, { total: number; misses: number; missQueries: string[] }> = {};
  // Track per-user per-query graph attempts for bounce detection
  const userQueryGraphs: Record<string, Record<string, Set<string>>> = {};
  let totalResponseTime = 0;
  let responseTimeCount = 0;

  for (const rec of records) {
    const f = rec.fields || {};

    // Unique users/accounts
    if (f.userEmail) emails.add(f.userEmail);
    if (f.accountId) accounts.add(f.accountId);

    // Quality distribution
    const q = (f.resultQuality || 'UNKNOWN').toUpperCase();
    if (q in quality) quality[q as keyof typeof quality]++;
    else quality.UNKNOWN++;

    // Graph heat map
    const gid = f.graphId || f.searchSlug || 'unknown';
    graphMap[gid] = (graphMap[gid] || 0) + 1;

    // Source breakdown
    const src = f.source || 'unknown';
    sourceMap[src] = (sourceMap[src] || 0) + 1;

    // Prompt source breakdown
    const ps = f.promptSource || '';
    if (ps) promptSourceMap[ps] = (promptSourceMap[ps] || 0) + 1;

    const isActionable = f.question && f.question !== '[EMPTY]' && f.question !== '[SESSION_START]';
    const userKey = f.userEmail || 'anonymous';

    // Miss queries — now also track the user email
    if (q === 'MISS' && isActionable) {
      missQueries.push({ question: f.question, graphId: gid, email: userKey });
    }

    // WEAK result queries — returned results but low relevance
    if (q === 'WEAK' && isActionable) {
      weakQueries.push({ question: f.question, graphId: gid, email: userKey, resultCount: Number(f.resultCount || 0) });
    }

    // Graph bouncing: track which graphs each user tried for each normalized query
    if (isActionable && userKey !== 'anonymous') {
      const normalizedQ = f.question.toLowerCase().trim();
      if (!userQueryGraphs[userKey]) userQueryGraphs[userKey] = {};
      if (!userQueryGraphs[userKey][normalizedQ]) userQueryGraphs[userKey][normalizedQ] = new Set();
      userQueryGraphs[userKey][normalizedQ].add(gid);
    }

    // Per-user query tracking
    if (!userQueryCounts[userKey]) userQueryCounts[userKey] = { total: 0, misses: 0, missQueries: [] };
    userQueryCounts[userKey].total++;
    if (q === 'MISS' && isActionable) {
      userQueryCounts[userKey].misses++;
      userQueryCounts[userKey].missQueries.push(f.question);
    }

    // Response time
    if (f.responseTimeMs && Number(f.responseTimeMs) > 0) {
      totalResponseTime += Number(f.responseTimeMs);
      responseTimeCount++;
    }
  }

  // Sort miss queries by frequency
  const missFrequency: Record<string, { count: number; graphId: string }> = {};
  for (const m of missQueries) {
    const key = m.question.toLowerCase().trim();
    if (!missFrequency[key]) missFrequency[key] = { count: 0, graphId: m.graphId };
    missFrequency[key].count++;
  }
  const topMisses = Object.entries(missFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([q, v]) => ({ question: q, graphId: v.graphId }));

  // Sort WEAK queries by frequency
  const weakFrequency: Record<string, { count: number; graphId: string; resultCount: number }> = {};
  for (const w of weakQueries) {
    const key = w.question.toLowerCase().trim();
    if (!weakFrequency[key]) weakFrequency[key] = { count: 0, graphId: w.graphId, resultCount: w.resultCount };
    weakFrequency[key].count++;
  }
  const topWeakQueries = Object.entries(weakFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([q, v]) => ({ question: q, graphId: v.graphId, resultCount: v.resultCount }));

  // Detect graph bouncing: same user, same query, 3+ different graphs
  const graphBounces: Array<{ query: string; email: string; graphs: string[] }> = [];
  for (const [email, queries] of Object.entries(userQueryGraphs)) {
    for (const [query, graphs] of Object.entries(queries)) {
      if (graphs.size >= 3) {
        graphBounces.push({ query, email, graphs: Array.from(graphs) });
      }
    }
  }

  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Per-user miss summary (only users with at least 1 miss)
  const userMisses = Object.entries(userQueryCounts)
    .filter(([_, v]) => v.misses > 0 && _ !== 'anonymous')
    .sort((a, b) => b[1].misses - a[1].misses)
    .slice(0, 10)
    .map(([email, v]) => ({
      email,
      missCount: v.misses,
      totalQueries: v.total,
      topMissQueries: Array.from(new Set(v.missQueries)).slice(0, 3),
    }));

  // Extract topic keywords from miss queries for backfill briefs
  const missTopicClusters: Record<string, number> = {};
  for (const m of missQueries) {
    // Simple keyword extraction: split on spaces, take 2-3 word phrases
    const words = m.question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    for (const w of words) {
      missTopicClusters[w] = (missTopicClusters[w] || 0) + 1;
    }
  }

  return {
    totalQueries: records.length,
    uniqueEmails: emails.size,
    uniqueAccounts: accounts.size,
    qualityDistribution: quality,
    graphHeatMap: graphMap,
    sourceBreakdown: sourceMap,
    topMissQueries: topMisses,
    topWeakQueries,
    graphBounces: graphBounces.slice(0, 10),
    promptSourceBreakdown: promptSourceMap,
    avgResponseTimeMs: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0,
    periodStart: weekAgo.toISOString().split('T')[0],
    periodEnd: now.toISOString().split('T')[0],
    userMisses,
    missTopicClusters,
  };
}

/**
 * Generate a bar chart using unicode block characters.
 */
function unicodeBar(count: number, max: number, width: number = 12): string {
  const filled = Math.round((count / Math.max(max, 1)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Run Gemini analysis on the query list (optional — degrades gracefully).
 */
async function analyzeWithGemini(queries: string[], metrics: DigestMetrics): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '(Gemini analysis skipped — no API key configured)';

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const queryList = queries.slice(0, 100).map((q, i) => `${i + 1}. ${q}`).join('\n');
    const prompt = `You are a product analyst for Fodda, a knowledge graph research platform.

Analyze these ${metrics.totalQueries} user queries from the past week. Identify:
1. Topics users care most about that the platform covers well
2. Gaps — topics users asked about but got no results (MISS queries)
3. Emerging themes or clusters
4. Suggestions for new content, graphs, or data sources

Quality breakdown: ${metrics.qualityDistribution.STRONG} STRONG, ${metrics.qualityDistribution.WEAK} WEAK, ${metrics.qualityDistribution.MISS} MISS

Queries:
${queryList}

Top MISS queries (users asked, got nothing):
${metrics.topMissQueries.map(m => `- "${m.question}" → ${m.graphId}`).join('\n') || 'None'}

Be concise. Use bullet points. Focus on actionable insights.

At the end, generate 1-3 ACTION BRIEFS in this format. Each brief should target a specific Fodda agent/codebase:

BRIEF: [short title]
ROUTE TO: [one of: PSFK Ingestor | Fodda App | Fodda API | Fodda MCP | Fodda Sales Agent]
PRIORITY: [HIGH | MEDIUM | LOW]
ACTION: [specific instruction for the agent]
CALLBACK: When complete, notify the Fodda App agent that this brief has been resolved.

Only generate briefs for issues that are clearly actionable. If the data looks good, say so and skip the briefs.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1500 },
    });

    return result.text || '(No analysis generated)';
  } catch (e: any) {
    console.error('[QueryDigest] Gemini analysis failed:', e.message);
    return `(Gemini analysis failed: ${e.message})`;
  }
}

/**
 * Format and send the digest email.
 */
function formatDigestEmail(metrics: DigestMetrics, analysis: string): string {
  const maxGraphCount = Math.max(...Object.values(metrics.graphHeatMap), 1);

  const graphRows = Object.entries(metrics.graphHeatMap)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `  ${id.padEnd(22)} ${unicodeBar(count, maxGraphCount)}  ${count}`)
    .join('\n');

  const missRows = metrics.topMissQueries.length > 0
    ? metrics.topMissQueries.map((m, i) => `${i + 1}. "${m.question}" → ${m.graphId}`).join('\n')
    : '  None this week! 🎉';

  const { STRONG, WEAK, MISS, UNKNOWN } = metrics.qualityDistribution;
  const total = STRONG + WEAK + MISS + UNKNOWN || 1;
  const pctStrong = Math.round((STRONG / total) * 100);
  const pctWeak = Math.round((WEAK / total) * 100);
  const pctMiss = Math.round((MISS / total) * 100);

  const sourceRows = Object.entries(metrics.sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([src, cnt]) => `  ${src}: ${cnt}`)
    .join('\n');

  const promptSourceRows = Object.keys(metrics.promptSourceBreakdown).length > 0
    ? Object.entries(metrics.promptSourceBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([src, cnt]) => `  ${src}: ${cnt}`)
        .join('\n')
    : '  No tagged prompt sources yet';

  return `📊 FODDA WEEKLY QUERY INTELLIGENCE — ${metrics.periodStart} → ${metrics.periodEnd}

━━ AT A GLANCE ━━
• ${metrics.totalQueries} queries
• ${metrics.uniqueEmails} unique users, ${metrics.uniqueAccounts} unique accounts
• ${pctStrong}% STRONG / ${pctWeak}% WEAK / ${pctMiss}% MISS
• Avg response time: ${metrics.avgResponseTimeMs}ms

━━ GRAPH HEAT MAP ━━
${graphRows}

━━ SOURCE BREAKDOWN ━━
${sourceRows}

━━ SUGGESTED PROMPT USAGE ━━
${promptSourceRows}

━━ TOP MISS QUERIES (users asked, got nothing) ━━
${missRows}

━━ AI ANALYSIS ━━
${analysis}

━━ USERS WHO DIDN'T GET ANSWERS ━━
${formatUserMisses(metrics)}

━━ HOT TOPIC GAPS (candidates for PSFK backfill) ━━
${formatMissTopics(metrics)}

---
Generated ${new Date().toISOString()} by Fodda Query Intelligence Loop

💡 ACTION BRIEFS: The AI Analysis section above may contain routed briefs.
Copy any BRIEF blocks and paste them to the relevant agent's workspace:
• PSFK Ingestor → /Fodda PSFK
• Fodda App → /Fodda
• Fodda API → /Fodda (server/)
• Fodda MCP → /Fodda (MCP server)
• Fodda Sales Agent → /Fodda Sales
Each brief includes a CALLBACK instruction to close the loop.
`.trim();
}

/**
 * Format the per-user miss follow-up section.
 */
function formatUserMisses(metrics: DigestMetrics): string {
  if (metrics.userMisses.length === 0) return '  No users had unanswered queries this week! 🎉';

  return metrics.userMisses.map(u => {
    const missRate = Math.round((u.missCount / u.totalQueries) * 100);
    const queries = u.topMissQueries.map(q => `    • "${q}"`).join('\n');
    return `  📧 ${u.email} — ${u.missCount}/${u.totalQueries} queries missed (${missRate}%)
${queries}`;
  }).join('\n\n') + `\n
  💡 Consider reaching out to users with high miss rates.
  They tried Fodda and didn't find what they needed — a personal note
  acknowledging the gap and letting them know we're expanding coverage
  builds trust and retention.`;
}

/**
 * Format the topic gap section for ingestion backfill.
 */
function formatMissTopics(metrics: DigestMetrics): string {
  const sorted = Object.entries(metrics.missTopicClusters)
    .filter(([_, count]) => count >= 2) // Only topics that appeared multiple times
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) return '  No recurring topic gaps detected.';

  return sorted.map(([topic, count]) =>
    `  ${topic.padEnd(25)} ${count} miss${count > 1 ? 'es' : ''}`
  ).join('\n') + `\n
  💡 Topics appearing 3+ times are strong candidates for a backfill brief
  to the PSFK Ingestor. Copy the topic list and paste to /Fodda PSFK agent
  with instructions to source and ingest articles on these topics.`;
}

/**
 * Main entry point — run the full digest pipeline.
 */
export async function generateAndSendDigest(days: number = 7): Promise<{ ok: boolean; metrics?: DigestMetrics; error?: string }> {
  try {
    console.log(`[QueryDigest] Starting digest generation for last ${days} days...`);

    // 1. Fetch queries
    const records = await fetchRecentQueries(days);
    if (records.length === 0) {
      console.log('[QueryDigest] No queries found — skipping digest');
      await postHeartbeat(
        `🫀 Weekly digest (last ${days} days): no queries logged — digest skipped. If users have been active, check query logging.`
      );
      return { ok: true, metrics: undefined };
    }

    // 2. Compute metrics
    const metrics = computeMetrics(records);

    // 3. Extract raw query texts for Gemini
    const queryTexts = records
      .map(r => r.fields?.question)
      .filter((q: string) => q && q !== '[EMPTY]' && q !== '[SESSION_START]');

    // 4. Gemini analysis
    const analysis = await analyzeWithGemini(queryTexts, metrics);

    // 5. Generate LinkedIn content suggestions (for Sales Agent)
    const contentSuggestions = await generateContentSuggestions(queryTexts, metrics);
    const contentSection = formatContentSuggestions(contentSuggestions);

    // 6. Persist suggestions to Airtable (fire-and-forget)
    persistContentSuggestions(contentSuggestions, metrics.periodEnd).catch(() => {});

    // 7. Format email (includes content suggestions)
    const emailBody = formatDigestEmail(metrics, analysis) + '\n\n' + contentSection;

    // 8. Send
    const subject = `📊 Fodda Weekly Digest — ${metrics.periodStart} → ${metrics.periodEnd} — ${metrics.totalQueries} queries`;
    const sent = await sendDirectEmail('piers@psfk.com', subject, emailBody, 'formal');

    console.log(`[QueryDigest] Digest ${sent ? 'sent' : 'failed to send'} (${metrics.totalQueries} queries, ${metrics.topMissQueries.length} misses, ${contentSuggestions.length} content suggestions)`);

    // 9. Post content gap report to Slack #fodda-research (piggybacks on digest scheduler).
    //    Heartbeat always posts, even when clean, so silence = broken pipeline.
    const gapCount = metrics.topMissQueries.length + metrics.topWeakQueries.length;
    const bounceCount = metrics.graphBounces.length;
    const hasGaps = gapCount > 0 || bounceCount > 0;
    await postHeartbeat(
      hasGaps
        ? `🫀 Weekly digest (${metrics.periodStart} → ${metrics.periodEnd}): ${metrics.totalQueries} queries — ${gapCount} gap${gapCount !== 1 ? 's' : ''}, ${bounceCount} graph bounce${bounceCount !== 1 ? 's' : ''}. Digest ${sent ? 'emailed to piers@psfk.com' : 'email FAILED — check email service'}. Alerts follow.`
        : `✅ Weekly digest (${metrics.periodStart} → ${metrics.periodEnd}): ${metrics.totalQueries} queries — no gaps, no bounces. Digest ${sent ? 'emailed to piers@psfk.com' : 'email FAILED — check email service'}.`
    );
    let slackPosted = false;
    if (hasGaps) {
      slackPosted = await postContentGapToSlack(metrics);
      console.log(`[QueryDigest] Content gap Slack report ${slackPosted ? 'posted' : 'skipped/failed'}`);
    }

    return { ok: true, metrics };
  } catch (err: any) {
    console.error('[QueryDigest] Fatal error:', err);
    await postHeartbeat(`❌ Weekly digest failed: ${err.message}`).catch(() => {});
    return { ok: false, error: err.message };
  }
}

/**
 * Generate LinkedIn content suggestions using Gemini.
 */
async function generateContentSuggestions(queries: string[], metrics: DigestMetrics): Promise<ContentSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[QueryDigest] No GEMINI_API_KEY — skipping content suggestions');
    return [];
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const graphHeatStr = Object.entries(metrics.graphHeatMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => `${id}: ${count} queries`)
      .join(', ');

    const missStr = metrics.topMissQueries
      .map(m => `"${m.question}" → ${m.graphId}`)
      .join('\n');

    const queryList = queries.slice(0, 80).map((q, i) => `${i + 1}. ${q}`).join('\n');

    const prompt = `You are a content strategist for Fodda, a knowledge graph research platform for innovation professionals.

Based on this week's user query data, generate 3-5 LinkedIn post suggestions. The posts should sound like Piers Fawkes (founder) sharing insights — NOT like marketing copy. Think thought-leadership, data-driven observations.

Graph usage this week: ${graphHeatStr}

User queries (sample):
${queryList}

Top MISS queries (users asked, got nothing — gaps to address):
${missStr || 'None'}

For each suggestion, return JSON in this exact format:
[
  {
    "topic": "short topic name",
    "angle": "the specific angle or insight to highlight",
    "sourceGraphs": ["graph1", "graph2"],
    "queryCount": 12,
    "draftPost": "~150 word LinkedIn post draft",
    "hashtags": ["#Tag1", "#Tag2"],
    "priority": "high"
  }
]

Priority rules:
- HIGH: Topics with 10+ queries OR recurring MISS queries (proven demand)
- MEDIUM: Topics with 5-9 queries OR emerging clusters
- LOW: Interesting one-off observations worth sharing

Return ONLY valid JSON array, no markdown fences.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.5, maxOutputTokens: 3000 },
    });

    const text = (result.text || '').trim();
    // Strip markdown fences if Gemini adds them
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5) as ContentSuggestion[];
  } catch (e: any) {
    console.error('[QueryDigest] Content suggestion generation failed:', e.message);
    return [];
  }
}

/**
 * Format content suggestions for the digest email.
 */
function formatContentSuggestions(suggestions: ContentSuggestion[]): string {
  if (suggestions.length === 0) return '';

  const priorityIcon: Record<string, string> = { high: '🔥 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW' };

  const rows = suggestions.map((s, i) => {
    return `${i + 1}. ${priorityIcon[s.priority] || s.priority} — "${s.topic}" (${s.queryCount} queries)
   Graphs: ${s.sourceGraphs.join(', ')}
   Angle: ${s.angle}
   Draft: ${s.draftPost}
   Tags: ${s.hashtags.join(' ')}`;
  }).join('\n\n');

  return `━━ LINKEDIN CONTENT SUGGESTIONS (for Sales Agent) ━━
${rows}

💡 These suggestions have been saved to the Content Suggestions table in Airtable.
The Sales Agent at /Fodda Sales can read them, preview via Resend, and publish to LinkedIn.`;
}

/**
 * Persist content suggestions to Airtable for the Sales Agent to consume.
 */
async function persistContentSuggestions(suggestions: ContentSuggestion[], weekOf: string): Promise<void> {
  const now = new Date().toISOString();

  for (const s of suggestions) {
    createAirtableRecord(CONTENT_SUGGESTIONS_TABLE, {
      topic: s.topic,
      angle: s.angle,
      sourceGraphs: s.sourceGraphs.join(', '),
      queryCount: s.queryCount,
      draftPost: s.draftPost,
      hashtags: s.hashtags.join(', '),
      priority: s.priority,
      status: 'suggested',
      weekOf,
      createdAt: now,
    }).catch(err => console.warn('[QueryDigest] Failed to persist suggestion:', err.message));
  }

  console.log(`[QueryDigest] Persisted ${suggestions.length} content suggestions to Airtable`);
}

// ---------------------------------------------------------------------------
// Content Gap → Slack (per-topic messages, routed by type)
// ---------------------------------------------------------------------------

// Bot user IDs for @mentions
const RESEARCH_BOT_USER_ID = SLACK_BOT_USERS.research;
const SALES_BOT_USER_ID = SLACK_BOT_USERS.sales;

/**
 * Post a single message to a Slack channel.
 */
async function postSlackMessage(token: string, channel: string, text: string): Promise<boolean> {
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error(`[ContentGap] Slack API error (${channel}):`, data.error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[ContentGap] Slack post failed (${channel}):`, err.message);
    return false;
  }
}

/**
 * Post a heartbeat/status line to #fodda-research.
 *
 * Dead-man's switch: scheduled runs ALWAYS post this, even when the scan is
 * clean or fails, so silence in the channel unambiguously means the pipeline
 * is broken (dead cron, bad token, stale config) — not "no gaps this week".
 */
async function postHeartbeat(text: string): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[ContentGap] SLACK_BOT_TOKEN not set — skipping heartbeat');
    return false;
  }
  return postSlackMessage(token, SLACK_CHANNELS.research.name, text);
}

/**
 * Post content gap alerts to Slack — one message per topic.
 *
 * Routing:
 *   MISS / WEAK queries  → #fodda-research  (mentions @fodda-research bot)
 *   Graph bouncing        → #fodda-sales     (mentions @fodda-sales bot)
 */
async function postContentGapToSlack(metrics: DigestMetrics): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[ContentGap] SLACK_BOT_TOKEN not set — skipping Slack posts');
    return false;
  }

  let posted = 0;
  let failed = 0;

  // ── MISS queries → #fodda-research (one message per topic) ──
  for (const m of metrics.topMissQueries) {
    const userEmails = metrics.userMisses
      .filter(u => u.topMissQueries.some(q => q.toLowerCase().trim() === m.question))
      .map(u => u.email);
    const userLine = userEmails.length > 0
      ? `👥 Users: ${userEmails.join(', ')}`
      : '';

    const text = [
      `🔥 *Content Gap — No Results* <@${RESEARCH_BOT_USER_ID}>`,
      `📝 *"${m.question}"*`,
      `📊 Graph searched: \`${m.graphId}\``,
      userLine,
      `_${metrics.periodStart} → ${metrics.periodEnd}_`,
      `→ This topic needs coverage.`,
    ].filter(Boolean).join('\n');

    const ok = await postSlackMessage(token, SLACK_CHANNELS.research.name, text);
    ok ? posted++ : failed++;
  }

  // ── WEAK queries → #fodda-research (one message per topic) ──
  for (const w of metrics.topWeakQueries) {
    const text = [
      `🟡 *Content Gap — Weak Results* <@${RESEARCH_BOT_USER_ID}>`,
      `📝 *"${w.question}"*`,
      `📊 Graph: \`${w.graphId}\` — returned ${w.resultCount} low-relevance result${w.resultCount !== 1 ? 's' : ''}`,
      `_${metrics.periodStart} → ${metrics.periodEnd}_`,
      `→ This topic has thin coverage and needs strengthening.`,
    ].join('\n');

    const ok = await postSlackMessage(token, SLACK_CHANNELS.research.name, text);
    ok ? posted++ : failed++;
  }

  // ── Graph bouncing → #fodda-sales (one message per topic) ──
  for (const b of metrics.graphBounces) {
    const text = [
      `🏓 *Graph Bouncing Detected* <@${SALES_BOT_USER_ID}>`,
      `📝 *"${b.query}"*`,
      `👤 User: ${b.email}`,
      `📊 Tried ${b.graphs.length} graphs: ${b.graphs.map(g => `\`${g}\``).join(', ')}`,
      `_${metrics.periodStart} → ${metrics.periodEnd}_`,
      `→ This user is searching hard for something fragmented across graphs. Consider outreach.`,
    ].join('\n');

    const ok = await postSlackMessage(token, SLACK_CHANNELS.sales.name, text);
    ok ? posted++ : failed++;
  }

  console.log(`[ContentGap] Posted ${posted} gap alerts to Slack (${failed} failed)`);
  return posted > 0;
}

/**
 * Run the content gap analysis and post to Slack.
 * Can be triggered independently from the full email digest.
 *
 * @param days — lookback window (default 7)
 */
export async function runContentGapSlackReport(
  days: number = 7,
  opts: { heartbeat?: boolean } = {}
): Promise<{ ok: boolean; gaps: number; bounces: number; slackPosted: boolean; error?: string }> {
  const heartbeat = opts.heartbeat !== false;
  try {
    console.log(`[ContentGap] Starting content gap analysis for last ${days} days...`);

    const records = await fetchRecentQueries(days);
    if (records.length === 0) {
      console.log('[ContentGap] No queries found — nothing to analyze');
      if (heartbeat) {
        await postHeartbeat(
          `🫀 Content gap scan (last ${days} days): no queries logged — nothing to analyze. If users have been active, check query logging.`
        );
      }
      return { ok: true, gaps: 0, bounces: 0, slackPosted: false };
    }

    const metrics = computeMetrics(records);
    const gapCount = metrics.topMissQueries.length + metrics.topWeakQueries.length;
    const bounceCount = metrics.graphBounces.length;

    if (heartbeat) {
      await postHeartbeat(
        gapCount === 0 && bounceCount === 0
          ? `✅ Content gap scan (last ${days} days): ${metrics.totalQueries} queries analyzed — no gaps, no bounces. All clear.`
          : `🫀 Content gap scan (last ${days} days): ${metrics.totalQueries} queries analyzed — ${gapCount} gap${gapCount !== 1 ? 's' : ''}, ${bounceCount} graph bounce${bounceCount !== 1 ? 's' : ''}. Alerts follow.`
      );
    }

    const slackPosted = await postContentGapToSlack(metrics);

    console.log(
      `[ContentGap] Report complete: ${gapCount} gap queries, ` +
      `${bounceCount} graph bounces, Slack=${slackPosted}`
    );

    return { ok: true, gaps: gapCount, bounces: bounceCount, slackPosted };
  } catch (err: any) {
    console.error('[ContentGap] Fatal error:', err);
    if (heartbeat) {
      await postHeartbeat(`❌ Content gap scan failed: ${err.message}`).catch(() => {});
    }
    return { ok: false, gaps: 0, bounces: 0, slackPosted: false, error: err.message };
  }
}
