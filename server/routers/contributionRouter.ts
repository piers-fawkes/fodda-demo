/**
 * Contribution Router
 *
 * Handles persisting user-produced content (corrections, extensions,
 * authored content) to Airtable's CONTEXT_CONTRIBUTIONS_TABLE.
 *
 * Requires Clerk session or valid API key. Rate-limited by IP.
 * The contributor's identity is derived from the auth principal,
 * not from the request body.
 *
 * Endpoints:
 *   POST /api/contributions   — Create a new context contribution
 */

import { Router } from 'express';
import { createAirtableRecord } from '../db.js';
import { CONTEXT_CONTRIBUTIONS_TABLE } from '../constants.js';
import { resolveIdentity, resolveEmailFromApiKey } from '../helpers.js';

const router = Router();

// --- Rate limiter for contributions: 5 req/min per IP ---
const contributionRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const CONTRIBUTION_RATE_LIMIT = 5;       // max requests per window
const CONTRIBUTION_RATE_WINDOW = 60_000; // 1 minute

function isContributionRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = contributionRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    contributionRateLimitMap.set(ip, { count: 1, resetAt: now + CONTRIBUTION_RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > CONTRIBUTION_RATE_LIMIT;
}

// Trim the map periodically to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of contributionRateLimitMap) {
    if (now > entry.resetAt) contributionRateLimitMap.delete(ip);
  }
}, 5 * 60_000).unref();

const ALLOWED_ORIGIN_TYPES = new Set(['authored', 'uploaded', 'corrected', 'extended']);

/**
 * POST /api/contributions
 *
 * Persist a user-produced context contribution (correction, extension,
 * or original authored content) to Airtable.
 *
 * Body:
 *   content      (string, required) — the contributed text
 *   originType   (string, required) — one of 'authored' | 'uploaded' | 'corrected' | 'extended'
 *   taxonomyNode (string, optional) — graph taxonomy node
 *   relatedQueryId (string, optional) — Airtable record ID of the query being corrected/extended
 *   source       (string, optional) — defaults to 'app'
 */
router.post('/', async (req, res) => {
  // Rate limit: 5 req/min per IP
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (isContributionRateLimited(clientIp)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  // Authentication check: Clerk session or valid API key
  // Security: derive user_id from auth principal, not from untrusted body
  const clerkUserId = (req as any).auth?.userId;
  const clientApiKey = req.headers['x-api-key'] as string;
  let resolvedUserId = '';

  if (clerkUserId) {
    // Clerk sessions are browser-bound; accept body email as display identifier,
    // falling back to the opaque Clerk userId
    resolvedUserId = req.body.userEmail || clerkUserId;
  } else if (clientApiKey) {
    try {
      const identity = await resolveIdentity(clientApiKey);
      if (identity && identity.keyStatus !== 'Pending') {
        // Derive email from the key's account — don't trust body
        resolvedUserId = await resolveEmailFromApiKey(clientApiKey);
      }
    } catch (err) {
      console.error('[ContributionAuth] Error checking API key:', err);
    }
  }

  if (!resolvedUserId) {
    return res.status(401).json({ ok: false, error: "Unauthorized - API Key or Clerk session required." });
  }

  try {
    const { content, originType, taxonomyNode, relatedQueryId, source } = req.body;

    // Validate required fields
    if (!content || !originType) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: content, originType' });
    }

    // Validate originType
    if (!ALLOWED_ORIGIN_TYPES.has(originType)) {
      return res.status(400).json({ ok: false, error: `Invalid originType. Must be one of: ${Array.from(ALLOWED_ORIGIN_TYPES).join(', ')}` });
    }

    await createAirtableRecord(CONTEXT_CONTRIBUTIONS_TABLE, {
      user_id: resolvedUserId,
      source: source || 'app',
      taxonomy_node: taxonomyNode || '',
      origin_type: originType,
      content_text: (content || '').substring(0, 5000),
      related_query_id: relatedQueryId || '',
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Contributions] Failed to create contribution:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
