import { Router } from 'express';
import {
  queryAirtable,
  queryAirtableAll,
  queryAirtableCE,
  updateAirtableCERecord,
  escapeAirtableString,
  DatabaseUnavailableError,
  LOGS_TABLE_QUESTIONS
} from '../db.js';
import { USERS_TABLE, CE_ANALYSTS_TABLE } from '../constants.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helper: resolve the authenticated user's email from the Clerk session,
// then verify they are a registered expert by checking the cached isExpert
// flag on their App Users record.
//
// Returns { email, analystId } or null (unauthenticated / not an expert).
// ---------------------------------------------------------------------------
async function resolveExpert(req: any): Promise<{ email: string; analystId: string } | null> {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) return null;

  const userQuery = await queryAirtable(
    USERS_TABLE,
    `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`
  );
  const userRecord = userQuery.records?.[0];
  if (!userRecord) return null;

  const email = String(userRecord.fields?.email || '').toLowerCase().trim();
  const isExpert = !!userRecord.fields?.isExpert;
  const analystId = String(userRecord.fields?.analystId || '').trim();

  if (!isExpert || !analystId || !email) return null;

  return { email, analystId };
}

// ---------------------------------------------------------------------------
// Helper: fetch the Airtable internal record ID from the Analyst ID slug.
// ---------------------------------------------------------------------------
async function getAnalystRecordId(analystId: string): Promise<string | null> {
  const res = await queryAirtableCE(
    CE_ANALYSTS_TABLE,
    `{Analyst ID} = '${escapeAirtableString(analystId)}'`,
    'fields%5B%5D=Analyst+ID&maxRecords=1'
  );
  return res.records?.[0]?.id || null;
}

// ---------------------------------------------------------------------------
// GET /api/expert/me
// Returns the expert's full Analyst record from the CE base.
// ---------------------------------------------------------------------------
router.get('/me', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) {
      return res.status(403).json({ ok: false, error: 'Not a registered expert', isExpert: false });
    }

    const analystRes = await queryAirtableCE(
      CE_ANALYSTS_TABLE,
      `{Analyst ID} = '${escapeAirtableString(expert.analystId)}'`
    );
    const record = analystRes.records?.[0];
    if (!record) {
      return res.status(404).json({ ok: false, error: 'Analyst record not found in CE base' });
    }

    const parseJSON = (val: any, fallback: any = null) => {
      if (!val) return fallback;
      try { return JSON.parse(val); } catch { return fallback; }
    };

    const allFlags: any[] = parseJSON(record.fields['expertFlags'], []);

    return res.json({
      ok: true,
      isExpert: true,
      analystId: expert.analystId,
      expertCard: record.fields['Expert Card'] || '',
      expertiseMap: parseJSON(record.fields['expertiseMap'], []),
      signatureInsights: parseJSON(record.fields['signatureInsights'], []),
      blindSpots: parseJSON(record.fields['blindSpots'], []),
      exampleQueries: parseJSON(record.fields['exampleQueries'], []),
      voiceProfile: parseJSON(record.fields['voiceProfile'], null),
      crossGraphConnections: parseJSON(record.fields['crossGraphConnections'], []),
      // Only surface pending flags — hide resolved ones
      expertFlags: allFlags.filter((f: any) => f.status !== 'resolved'),
      analystName: record.fields['Analyst Name'] || record.fields['Name'] || '',
      portraitUrl: record.fields['Portrait URL'] || record.fields['portrait_url'] || '',
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] GET /me failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/expert/me/expertise-map   Body: { items: ExpertiseMapItem[] }
// ---------------------------------------------------------------------------
router.put('/me/expertise-map', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items must be an array' });
    const recordId = await getAnalystRecordId(expert.analystId);
    if (!recordId) return res.status(404).json({ ok: false, error: 'Analyst record not found' });
    await updateAirtableCERecord(CE_ANALYSTS_TABLE, recordId, { expertiseMap: JSON.stringify(items) });
    console.log(`[ExpertRouter] expertiseMap updated for ${expert.analystId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] PUT /me/expertise-map failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/expert/me/signature-insights   Body: { items: SignatureInsight[] }
// ---------------------------------------------------------------------------
router.put('/me/signature-insights', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items must be an array' });
    const recordId = await getAnalystRecordId(expert.analystId);
    if (!recordId) return res.status(404).json({ ok: false, error: 'Analyst record not found' });
    await updateAirtableCERecord(CE_ANALYSTS_TABLE, recordId, { signatureInsights: JSON.stringify(items) });
    console.log(`[ExpertRouter] signatureInsights updated for ${expert.analystId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] PUT /me/signature-insights failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/expert/me/blind-spots   Body: { items: BlindSpot[] }
// ---------------------------------------------------------------------------
router.put('/me/blind-spots', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items must be an array' });
    const recordId = await getAnalystRecordId(expert.analystId);
    if (!recordId) return res.status(404).json({ ok: false, error: 'Analyst record not found' });
    await updateAirtableCERecord(CE_ANALYSTS_TABLE, recordId, { blindSpots: JSON.stringify(items) });
    console.log(`[ExpertRouter] blindSpots updated for ${expert.analystId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] PUT /me/blind-spots failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/expert/me/example-queries   Body: { items: string[] }
// ---------------------------------------------------------------------------
router.put('/me/example-queries', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'items must be an array' });
    const recordId = await getAnalystRecordId(expert.analystId);
    if (!recordId) return res.status(404).json({ ok: false, error: 'Analyst record not found' });
    await updateAirtableCERecord(CE_ANALYSTS_TABLE, recordId, { exampleQueries: JSON.stringify(items) });
    console.log(`[ExpertRouter] exampleQueries updated for ${expert.analystId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] PUT /me/example-queries failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/expert/me/flag   Body: { section: string, flag: string }
// Appends a new flag (status: "pending") to the expertFlags JSON array.
// Uses typecast: true (via updateAirtableCERecord) so Airtable auto-creates
// the field if it does not yet exist.
// ---------------------------------------------------------------------------
router.post('/me/flag', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });

    const { section, flag } = req.body;
    if (!section || typeof section !== 'string') return res.status(400).json({ ok: false, error: 'section is required' });
    if (!flag || typeof flag !== 'string' || flag.trim().length === 0) return res.status(400).json({ ok: false, error: 'flag text is required' });

    const recordId = await getAnalystRecordId(expert.analystId);
    if (!recordId) return res.status(404).json({ ok: false, error: 'Analyst record not found' });

    // Fetch current flags to append
    const currentRes = await queryAirtableCE(
      CE_ANALYSTS_TABLE,
      `{Analyst ID} = '${escapeAirtableString(expert.analystId)}'`,
      'fields%5B%5D=expertFlags&maxRecords=1'
    );
    let existingFlags: any[] = [];
    try {
      const raw = currentRes.records?.[0]?.fields?.expertFlags;
      if (raw) existingFlags = JSON.parse(raw as string);
    } catch { /* start fresh */ }

    const newFlag = {
      section: section.trim(),
      flag: flag.trim().substring(0, 2000),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    const updatedFlags = [...existingFlags, newFlag];

    await updateAirtableCERecord(CE_ANALYSTS_TABLE, recordId, {
      expertFlags: JSON.stringify(updatedFlags)
    });

// ---------------------------------------------------------------------------
// GET /api/expert/me/activity
// Returns query count in the last 7 days and recent questions for the expert.
// ---------------------------------------------------------------------------
router.get('/me/activity', async (req: any, res) => {
  try {
    const expert = await resolveExpert(req);
    if (!expert) return res.status(403).json({ ok: false, error: 'Not a registered expert' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cleanId = escapeAirtableString(expert.analystId);
    
    // Filter by graphId or vertical matching analystId, or matching expert email
    const filter = `AND(IS_AFTER({Date}, '${sevenDaysAgo}'), NOT(FIND('[Coverage Request]', {question}) > 0), OR({graphId} = '${cleanId}', FIND('${cleanId}', {graphId}) > 0, {vertical} = '${cleanId}'))`;

    const logsRes = await queryAirtableAll(LOGS_TABLE_QUESTIONS, filter);
    const records = logsRes.records || [];

    const recentQuestions = records.slice(0, 15).map((r: any) => ({
      id: r.id,
      question: r.fields?.question || r.fields?.apiCall || 'Query',
      timestamp: r.fields?.Date || new Date().toISOString(),
      source: r.fields?.source || 'mcp',
      graphId: r.fields?.graphId || expert.analystId,
      userEmail: r.fields?.userEmail || 'anonymous'
    }));

    return res.json({
      ok: true,
      queryCount7d: records.length,
      recentQuestions
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error('[ExpertRouter] GET /me/activity failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
