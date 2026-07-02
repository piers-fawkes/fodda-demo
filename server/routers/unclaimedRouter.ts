import { Router } from 'express';
import crypto from 'crypto';
import { createAirtableRecord, updateAirtableRecord, queryAirtable, escapeAirtableString, DatabaseUnavailableError } from '../db.js';
import { NOTIFICATION_REQUESTS_TABLE } from '../constants.js';
import { sendSystemEmail, sendDirectEmail } from '../services/emailService.js';
import { requireAuth } from '@clerk/express';

const router = Router();

// ---------------------------------------------------------------------------
// Analyst cache (module-level, 5-min TTL)
// ---------------------------------------------------------------------------
let analystCache: { data: any[] | null; lastFetch: number } = { data: null, lastFetch: 0 };
const ANALYST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAnalysts(): Promise<any[]> {
  const now = Date.now();
  if (analystCache.data && (now - analystCache.lastFetch) < ANALYST_CACHE_TTL) {
    return analystCache.data;
  }
  const res = await fetch('https://api.fodda.ai/v1/analysts');
  if (!res.ok) throw new Error(`Analysts API returned ${res.status}`);
  const data = await res.json() as { analysts?: any[] };
  analystCache.data = data.analysts || [];
  analystCache.lastFetch = now;
  return analystCache.data;
}

// ---------------------------------------------------------------------------
// HMAC signing helper
// ---------------------------------------------------------------------------
const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';

function signUrl(requestId: string, action: 'approve' | 'reject'): string {
  const payload = `${requestId}:${action}`;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return sig;
}

function verifySignature(requestId: string, action: string, sig: string): boolean {
  const expected = signUrl(requestId, action as 'approve' | 'reject');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ---------------------------------------------------------------------------
// Admin email constant
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = 'piers.fawkes@psfk.com';

// ---------------------------------------------------------------------------
// Helper to normalize strings for comparison (remove punctuation, spaces, accents)
function normalizeSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Generate possible slug variations for an expert's name
function getPossibleSlugs(name: string): string[] {
  const base = name.toLowerCase();
  // Transliterate (replace accents, e.g. é -> e)
  const transliterated = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Strip non-ascii (remove accents, e.g. é -> '')
  const stripped = base.replace(/[^\x00-\x7F]/g, "");

  const slugify = (s: string) => s.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return [
    slugify(transliterated),
    slugify(stripped),
    slugify(base)
  ];
}

// GET /lookup/:slug
// Look up an unclaimed expert by slug from Airtable, supporting fuzzy/variant matching.
// ---------------------------------------------------------------------------
router.get('/lookup/:slug', async (req: any, res) => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ ok: false, error: 'Slug is required' });
    }

    const airtableRes = await queryAirtable('Analysts');
    const records = airtableRes.records || [];

    const reqSlugNorm = normalizeSlug(slug);

    const matchedRecord = records.find((record: any) => {
      const fields = record.fields || {};
      const analystId = fields['Analyst ID'] || fields['id'] || '';
      const name = fields['Name'] || fields['name'] || '';

      if (!analystId) return false;

      const idNorm = normalizeSlug(analystId);
      
      // 1. Direct or normalized ID match
      if (analystId.toLowerCase() === slug.toLowerCase() || idNorm === reqSlugNorm) {
        return true;
      }

      // 2. Substring ID match (e.g. ben-dietz matching ben-dietz-sic)
      if (idNorm.includes(reqSlugNorm) || reqSlugNorm.includes(idNorm)) {
        return true;
      }

      // 3. Match against possible generated slugs from name
      if (name) {
        const possibleSlugs = getPossibleSlugs(name);
        if (possibleSlugs.some(s => s.toLowerCase() === slug.toLowerCase() || normalizeSlug(s) === reqSlugNorm)) {
          return true;
        }
      }

      return false;
    });

    if (!matchedRecord) {
      console.log(`[UnclaimedRouter] No analyst matched slug: ${slug}`);
      return res.status(404).json({ ok: false, error: 'Expert not found' });
    }

    const fields = matchedRecord.fields;
    console.log(`[UnclaimedRouter] Successfully matched slug "${slug}" to expert: ${fields['Name']} (${fields['Analyst ID']})`);

    return res.json({
      ok: true,
      analyst: {
        id: fields['Analyst ID'] || '',
        name: fields['Name'] || '',
        portraitUrl: fields['imageUrl'] || '',
        isUnclaimed: fields['Status'] === 'Unclaimed',
      },
    });
  } catch (err: any) {
    console.error('[UnclaimedRouter] GET /lookup/:slug failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /notify-interest   (auth required)
// Body: { expertId, expertName, userId, userName, userEmail }
// ---------------------------------------------------------------------------
router.post('/notify-interest', requireAuth(), async (req: any, res) => {
  try {
    const { expertId, expertName, userId, userName, userEmail } = req.body;

    if (!expertId || typeof expertId !== 'string' || !userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'expertId and userId are required' });
    }

    const result = await createAirtableRecord(NOTIFICATION_REQUESTS_TABLE, {
      expertId,
      expertName,
      userId,
      userName,
      userEmail,
      status: 'Queued',
      requestType: 'Interest',
      createdAt: new Date().toISOString(),
    });

    const recordId = result.records?.[0]?.id;

    const appUrl = process.env.APP_URL || 'https://app.fodda.ai';
    const approveUrl = `${appUrl}/api/unclaimed/approve/${recordId}?action=approve&sig=${signUrl(recordId, 'approve')}`;

    await sendDirectEmail(
      ADMIN_EMAIL,
      `Expert interest: ${userName || userEmail} wants to speak to ${expertName}`,
      `A user has expressed interest in speaking to an unclaimed expert.\n\nExpert: ${expertName} (${expertId})\nUser: ${userName || 'N/A'} (${userEmail})\nDate: ${new Date().toISOString()}\n\nTo approve and send an invitation to this expert:\n${approveUrl}\n\nIf no action is needed, you can ignore this email.`,
      'internal'
    );

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[UnclaimedRouter] POST /notify-interest failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /claim   (no auth)
// Body: { expertId, expertName, claimerName, claimerEmail, message }
// ---------------------------------------------------------------------------
router.post('/claim', async (req: any, res) => {
  try {
    const { expertId, expertName, claimerName, claimerEmail, message } = req.body;

    if (!expertId || typeof expertId !== 'string' || !claimerEmail || typeof claimerEmail !== 'string') {
      return res.status(400).json({ ok: false, error: 'expertId and claimerEmail are required' });
    }

    await sendDirectEmail(
      ADMIN_EMAIL,
      `Expert claim request: ${expertName || expertId}`,
      `Someone has claimed to be an expert and wants to claim their profile.\n\nExpert: ${expertName || 'N/A'} (${expertId})\nClaimer: ${claimerName || 'N/A'}\nEmail: ${claimerEmail}\nMessage: ${message || '(no message)'}\nDate: ${new Date().toISOString()}\n\nNext steps: Verify identity and trigger the onboard flow.`,
      'internal'
    );

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[UnclaimedRouter] POST /claim failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /approve/:requestId   (signed URL, no auth)
// ---------------------------------------------------------------------------
router.get('/approve/:requestId', async (req: any, res) => {
  try {
    const { requestId } = req.params;
    const { action, sig } = req.query;

    if (action !== 'approve' || !sig) {
      return res.status(400).json({ ok: false, error: 'Invalid action or missing signature' });
    }

    if (!verifySignature(requestId, action as string, sig as string)) {
      return res.status(403).json({ ok: false, error: 'Invalid signature' });
    }

    await updateAirtableRecord(NOTIFICATION_REQUESTS_TABLE, requestId, {
      status: 'Approved',
      approvedAt: new Date().toISOString(),
    });

    res.setHeader('Content-Type', 'text/html');
    return res.send(`<!DOCTYPE html><html><head><title>Approved</title><style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fafaf8;color:#1a1a1a}div{text-align:center;padding:2rem;border:1px solid #e5e5e0;border-radius:1rem;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.06);max-width:400px}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#666;font-size:.95rem}</style></head><body><div><h1>✅ Approved</h1><p>The notification request has been approved. The expert will be contacted.</p></div></body></html>`);
  } catch (err: any) {
    console.error('[UnclaimedRouter] GET /approve/:requestId failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
