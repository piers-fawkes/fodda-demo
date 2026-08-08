import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { queryAirtable, queryAirtableCE, updateAirtableRecord, updateAirtableCERecord, escapeAirtableString } from '../db.js';
import { LOGS_TABLE_QUESTIONS, CE_BASE_ID, CE_ANALYSTS_TABLE, GRAPH_LIST_TABLE, TOKEN_PURCHASES_TABLE } from '../constants.js';
import { getGraph } from '../services/graph-registry.js';
import { authenticateSession } from '../helpers.js';

const router = Router();

// Helper to mask emails for privacy (e.g. piers.fawkes@psfk.com -> p***.f***@psfk.com)
function maskEmail(email: string): string {
  if (!email) return 'anonymous';
  const parts = email.split('@');
  if (parts.length !== 2) return 'anonymous';
  const [local, domain] = parts;
  
  const subParts = local.split(/([._-])/);
  const maskedLocal = subParts.map(part => {
    if (part === '.' || part === '_' || part === '-') return part;
    if (part.length <= 1) return part + '***';
    return part[0] + '***';
  }).join('');
  
  return `${maskedLocal}@${domain}`;
}

/**
 * GET /api/creator/analytics
 * Provides usage statistics for a specific graph, gated strictly to the graph's owner/creator.
 * Query param: ?graphId=slug
 */
router.get("/analytics", async (req: any, res) => {
  try {
    const graphId = req.query.graphId as string;
    if (!graphId) {
      return res.status(400).json({ ok: false, error: "graphId query parameter is required" });
    }

    // 1. Authentication Check (Clerk session required)
    const clerkAuth = req.auth;
    const clerkUserId = clerkAuth?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: "Unauthorized - Clerk session required" });
    }

    // 2. Resolve User's Email
    let email = clerkAuth?.sessionClaims?.email;
    if (!email) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        email = clerkUser.emailAddresses[0]?.emailAddress;
      } catch (clerkErr) {
        console.error("[CreatorRouter] Failed to fetch user from Clerk Client:", clerkErr);
      }
    }

    if (!email) {
      return res.status(401).json({ ok: false, error: "Unauthorized - Could not resolve email from Clerk session" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Authorization Check (User must own the graph)
    const graph = await getGraph(graphId);
    if (!graph) {
      return res.status(404).json({ ok: false, error: `Graph with ID "${graphId}" not found in registry.` });
    }

    const ownerEmail = (graph.ownerId || '').toLowerCase().trim();
    const creatorEmail = (graph.creator || '').toLowerCase().trim();

    if (ownerEmail !== normalizedEmail && creatorEmail !== normalizedEmail) {
      return res.status(403).json({ ok: false, error: "Forbidden - You do not own this graph" });
    }

    // 4. Query Airtable Questions Log Table for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const formula = `AND({graphId} = '${escapeAirtableString(graphId)}', IS_AFTER({Date}, '${startDate.toISOString()}'))`;

    let records: any[] = [];
    let offset = '';
    do {
      const extra = offset ? `offset=${offset}` : '';
      const result = await queryAirtable(LOGS_TABLE_QUESTIONS, formula, extra);
      if (result.records) {
        records.push(...result.records);
      }
      offset = result.offset || '';
    } while (offset);

    // 5. Aggregate Analytics Data
    const totalQueries = records.length;

    // Unique Users Count
    const uniqueEmailsSet = new Set<string>();
    const userCountsMap = new Map<string, number>();
    const queryCountsMap = new Map<string, number>();

    // Pre-populate daily trend map for all 30 days
    const dailyTrendMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyTrendMap.set(dateStr, 0);
    }

    let missCount = 0;

    for (const rec of records) {
      const fields = rec.fields || {};
      const userMail = (fields.userEmail || '').trim().toLowerCase();
      const questionText = (fields.question || '').trim();
      const dateVal = fields.Date || '';
      const quality = fields.resultQuality || 'MISS';

      if (userMail) {
        uniqueEmailsSet.add(userMail);
        userCountsMap.set(userMail, (userCountsMap.get(userMail) || 0) + 1);
      }

      if (questionText) {
        queryCountsMap.set(questionText, (queryCountsMap.get(questionText) || 0) + 1);
      }

      if (dateVal) {
        const dateStr = dateVal.split('T')[0];
        if (dailyTrendMap.has(dateStr)) {
          dailyTrendMap.set(dateStr, (dailyTrendMap.get(dateStr) || 0) + 1);
        }
      }

      if (quality === 'MISS') {
        missCount++;
      }
    }

    const uniqueUsers = uniqueEmailsSet.size;

    // Format Daily Trend (chronological order)
    const dailyTrend = Array.from(dailyTrendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format Top Queries (sorted by count desc, top 10)
    const topQueries = Array.from(queryCountsMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Format Top Users (masked emails, sorted by count desc)
    const topUsers = Array.from(userCountsMap.entries())
      .map(([userMail, count]) => ({ email: maskEmail(userMail), count }))
      .sort((a, b) => b.count - a.count);

    // Format Recent Queries (sorted by date desc, top 10)
    const recentQueries = records
      .map(rec => ({
        date: rec.fields.Date || '',
        query: rec.fields.question || '',
        quality: rec.fields.resultQuality || 'MISS'
      }))
      .filter(q => q.date && q.query)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    res.json({
      ok: true,
      stats: {
        totalQueries,
        uniqueUsers,
        dailyTrend,
        topQueries,
        topUsers,
        recentQueries
      }
    });

  } catch (err: any) {
    console.error("[CreatorRouter] Failed to query analytics:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/creator/earnings
 * Serves creator earnings status.
 * Attempts to fetch per-query usage-attributed earnings from API layer (/v1/creator/earnings);
 * falls back to coming_soon state with in-app footprint if API is not yet live.
 */
router.get("/earnings", async (req: any, res) => {
  try {
    const graphId = req.query.graphId as string;
    if (!graphId) return res.status(400).json({ ok: false, error: "graphId parameter is required" });

    // Get activity footprint from question logs (in-app activity footprint)
    const activityRes = await queryAirtable(LOGS_TABLE_QUESTIONS, `{graphId} = '${escapeAirtableString(graphId)}'`);
    const activityRecords = activityRes.records || [];
    const totalQueries = activityRecords.length;
    const trialQueries = activityRecords.filter((r: any) => r.fields.source === 'trial').length;

    // Try calling canonical API earnings endpoint if available
    const apiUrl = process.env.FODDA_API_URL || 'https://api.fodda.co';
    try {
      const apiRes = await fetch(`${apiUrl}/v1/creator/earnings?graphId=${encodeURIComponent(graphId)}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData && apiData.grossRevenueUSD !== undefined) {
          return res.json({
            ok: true,
            earnings: {
              graphId,
              inAppActivityFootprint: totalQueries,
              totalQueries: apiData.totalQueries || totalQueries,
              paidQueries: apiData.paidQueries || 0,
              trialQueries: apiData.freeTrialQueries || trialQueries,
              revenueSharePercent: 50,
              expertEarningsUSD: apiData.expertEarningsUSD || 0,
              status: 'synced',
              syncNotice: null
            }
          });
        }
      }
    } catch (_e) {
      // API endpoint not live yet — use coming_soon fallback
    }

    return res.json({
      ok: true,
      earnings: {
        graphId,
        inAppActivityFootprint: totalQueries,
        paidQueries: null,
        trialQueries,
        revenueSharePercent: 50,
        expertEarningsUSD: null,
        status: 'coming_soon',
        syncNotice: 'Earnings — coming soon. We are wiring per-query usage attribution to the canonical API metering layer.'
      }
    });
  } catch (err: any) {
    console.error("[CreatorRouter] Failed to fetch earnings:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/creator/takedown
 * Updates expert graph status ({Status}: 'Active' | 'Paused') in CE_ANALYSTS_TABLE and GRAPH_LIST_TABLE.
 */
router.post("/takedown", async (req: any, res) => {
  try {
    const { graphId, status } = req.body || {};
    if (!graphId || !status || !['Active', 'Paused'].includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid graphId or status ('Active' | 'Paused' required)" });
    }

    // 1. Find Analyst record in CE base matching Analyst ID, expertSlug, or graphId
    const safeGraphId = escapeAirtableString(graphId);
    const formula = `OR({Analyst ID} = '${safeGraphId}', {expertSlug} = '${safeGraphId}', {graphId} = '${safeGraphId}')`;
    const analystRes = await queryAirtableCE(CE_ANALYSTS_TABLE, formula);
    const analystRec = analystRes.records?.[0];
    if (analystRec) {
      await updateAirtableCERecord(CE_ANALYSTS_TABLE, analystRec.id, { "Status": status });
    }

    // 2. Also update GRAPH_LIST_TABLE in main base
    const graphRes = await queryAirtable(GRAPH_LIST_TABLE, `{id} = '${escapeAirtableString(graphId)}'`);
    const graphRec = graphRes.records?.[0];
    if (graphRec) {
      await updateAirtableRecord(GRAPH_LIST_TABLE, graphRec.id, { "Status": status });
    }

    return res.json({
      ok: true,
      graphId,
      status,
      latencyNotice: 'Takedown / Pause stops receiving new queries across all app and MCP channels within ~5 minutes.'
    });
  } catch (err: any) {
    console.error("[CreatorRouter] Failed to update takedown status:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
