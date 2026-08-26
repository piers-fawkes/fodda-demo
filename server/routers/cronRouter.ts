/**
 * Cron Router
 * 
 * Endpoints for scheduled tasks triggered by Cloud Scheduler.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * 
 * Endpoints:
 *   POST /api/cron/query-digest   — Weekly query intelligence digest
 *   POST /api/cron/prompt-sweep   — Nightly prompt validation sweep
 *   POST /api/cron/content-gaps   — Content gap report → Slack #fodda-research
 */

import { Router } from 'express';
import { generateAndSendDigest, runContentGapSlackReport } from '../services/queryDigestService.js';
import { runPromptSweep } from '../services/promptSweep.js';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || '';

/**
 * Simple auth check for cron endpoints.
 * Accepts either:
 * - Authorization: Bearer <CRON_SECRET>
 * - X-Cron-Secret: <CRON_SECRET>
 * (Query-string secret intentionally NOT supported — it would appear in access logs)
 */
function verifyCronAuth(req: any): boolean {
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error("[Cron Auth] CRON_SECRET is not configured. Rejecting request in production.");
      return false;
    }
    return true; // No secret configured = dev mode
  }

  const authHeader = req.headers['authorization'] || '';
  const cronHeader = req.headers['x-cron-secret'] || '';

  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    cronHeader === CRON_SECRET
  );
}

/**
 * POST /api/cron/query-digest
 * 
 * Generate and email the weekly query intelligence digest.
 * Optional body: { days: number } — defaults to 7.
 */
router.post('/query-digest', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const days = req.body?.days || 7;
  console.log(`[Cron] Query digest triggered (${days} days)`);

  try {
    const result = await generateAndSendDigest(days);
    res.json({
      ok: result.ok,
      totalQueries: result.metrics?.totalQueries || 0,
      missCount: result.metrics?.topMissQueries.length || 0,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[Cron] Query digest failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/prompt-sweep
 * 
 * Test all suggested prompts against the live API.
 * Alerts piers@psfk.com if any fail.
 */
router.post('/prompt-sweep', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  console.log('[Cron] Prompt sweep triggered');

  try {
    const result = await runPromptSweep();
    res.json({
      ok: true,
      tested: result.tested,
      passed: result.passed,
      failed: result.failed,
      failures: result.failures,
    });
  } catch (err: any) {
    console.error('[Cron] Prompt sweep failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/content-gaps
 * 
 * Analyze recent queries for content gaps (MISS + WEAK + graph bouncing)
 * and post a summary to #fodda-research on Slack.
 * Optional body: { days: number } — defaults to 7.
 */
router.post('/content-gaps', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const days = req.body?.days || 7;
  console.log(`[Cron] Content gap report triggered (${days} days)`);

  try {
    const result = await runContentGapSlackReport(days);
    res.json({
      ok: result.ok,
      gaps: result.gaps,
      bounces: result.bounces,
      slackPosted: result.slackPosted,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[Cron] Content gap report failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/backfill-taxonomy
 * 
 * One-time endpoint to backfill taxonomy_node on historical query records.
 * Only processes records where taxonomy_node is empty and source ≠ 'api-v1'.
 * Optional query param: ?limit=500 (default 500, max 2000).
 */
router.post('/backfill-taxonomy', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const limit = Math.min(Number(req.query?.limit || req.body?.limit) || 500, 2000);
  console.log(`[Cron] Backfill taxonomy triggered (limit: ${limit})`);

  try {
    const { queryAirtable, updateAirtableRecord } = await import('../db.js');
    const { LOGS_TABLE_QUESTIONS } = await import('../constants.js');

    // Fetch records missing taxonomy_node, excluding API source
    const formula = `AND({taxonomy_node} = '', {source} != 'api-v1')`;
    let processed = 0;
    let skipped = 0;
    let offset: string | undefined;

    do {
      const extraParams = offset ? `&offset=${offset}` : '';
      const batch = await queryAirtable(
        LOGS_TABLE_QUESTIONS,
        formula,
        `&pageSize=100&fields[]=graphId&fields[]=vertical${extraParams}`
      );

      if (!batch.records?.length) break;

      for (const record of batch.records) {
        if (processed >= limit) break;

        const graphId = record.fields?.graphId || '';
        const vertical = record.fields?.vertical || '';
        const taxonomyNode = graphId || vertical || 'unknown';

        if (!taxonomyNode || taxonomyNode === 'unknown') {
          skipped++;
          continue;
        }

        try {
          await updateAirtableRecord(LOGS_TABLE_QUESTIONS, record.id, {
            taxonomy_node: taxonomyNode.substring(0, 100),
          });
          processed++;

          // Respect Airtable rate limits (5 req/sec)
          if (processed % 4 === 0) {
            await new Promise(r => setTimeout(r, 250));
          }
        } catch {
          skipped++;
        }
      }

      offset = batch.offset;
    } while (offset && processed < limit);

    console.log(`[Cron] Backfill taxonomy complete: ${processed} processed, ${skipped} skipped`);
    res.json({ ok: true, processed, skipped });
  } catch (err: any) {
    console.error('[Cron] Backfill taxonomy failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/persona-synthesis
 * 
 * Nightly persona synthesis — analyzes user query patterns and generates
 * persona observations. Designed to be triggered by Cloud Scheduler at 2 AM.
 * Optional body: { days: number } — defaults to 7.
 */
router.post('/persona-synthesis', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const days = req.body?.days || 7;
  console.log(`[Cron] Persona synthesis triggered (${days} days)`);

  try {
    const { runPersonaSynthesis } = await import('../services/personaSynthesisService.js');
    const result = await runPersonaSynthesis(days);
    res.json(result);
  } catch (err: any) {
    console.error('[Cron] Persona synthesis failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/query-health-check
 * 
 * Daily check: if chat traffic was served in last 24h, ensure count of Questions rows in 24h is > 0.
 */
router.post('/query-health-check', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  console.log('[Cron] Query health check triggered');
  try {
    const { runDailyZeroQuestionsCheck } = await import('../services/queryReconciliationService.js');
    const result = await runDailyZeroQuestionsCheck();
    res.json(result);
  } catch (err: any) {
    console.error('[Cron] Query health check failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/cron/reconcile-questions
 * 
 * Weekly reconciliation: find users with lastLogin in window and 0 Questions rows.
 * Surfaces summary in Slack and writes noQuestionsRecorded: true to Users record.
 */
router.post('/reconcile-questions', async (req, res) => {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const days = req.body?.days || 7;
  console.log(`[Cron] Users vs Questions reconciliation triggered (${days} days)`);
  try {
    const { runUsersQuestionsReconciliation } = await import('../services/queryReconciliationService.js');
    const result = await runUsersQuestionsReconciliation(days);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron] Reconcile questions failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
