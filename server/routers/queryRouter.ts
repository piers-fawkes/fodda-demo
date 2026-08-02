import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { 
  queryAirtable, 
  createAirtableRecord, 
  DatabaseUnavailableError 
} from '../db.js';
import { 
  LOGS_TABLE_QUESTIONS, 
  FODDA_API_URL, 
  SCHEMA_VERSION,
  ACCOUNTS_TABLE,
} from '../constants.js';
import { 
  extractValue, 
  resolveIdentity, 
  resolveEmailFromApiKey,
  checkTrialLimit,
  incrementUsage,
  signOutboundRequest,
  extractNumericLimit,
  autoProvisionUser
} from '../helpers.js';
import { calculateQueryUnits } from "../../shared/metering.js";
import { detectAccountType } from "../services/accountTypeService.js";
import { generateSetupUrl } from "../services/stripeOverageService.js";

const router = Router();
const OVERVIEW_TTL = 24 * 60 * 60 * 1000;
const overviewCache = new Map<string, { data: any; expires: number }>();

// --- Finding 5: Lightweight rate limiter for /api/log ---
// Prevents log poisoning and Airtable rate-limit exhaustion from external callers.
const logRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LOG_RATE_LIMIT = 30;    // max requests per window
const LOG_RATE_WINDOW = 60_000; // 1 minute

function isLogRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = logRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    logRateLimitMap.set(ip, { count: 1, resetAt: now + LOG_RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > LOG_RATE_LIMIT;
}

// Trim the map periodically to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of logRateLimitMap) {
    if (now > entry.resetAt) logRateLimitMap.delete(ip);
  }
}, 5 * 60_000).unref();

// Allowed targets for the import proxy
const ALLOWED_IMPORT_TARGETS = new Set(['trends', 'articles']);

// Internal service key for trusted server-to-server calls
const INTERNAL_API_KEY = process.env.FODDA_INTERNAL_API_KEY || '';

/**
 * Auto-fetch relevant supplemental data snapshots based on vertical.
 */
async function fetchSupplementalContext(vertical: string, query: string): Promise<string> {
  const v = (vertical || '').toLowerCase();
  const fetches: Promise<{ label: string; data: any }>[] = [];
  const internalKey = process.env.FODDA_INTERNAL_API_KEY || "";

  const safeFetch = async (url: string, label: string): Promise<{ label: string; data: any }> => {
    try {
      const res = await fetch(url, { headers: { 'X-API-Key': internalKey } });
      if (!res.ok) return { label, data: null };
      return { label, data: await res.json() };
    } catch { return { label, data: null }; }
  };

  fetches.push(safeFetch(`${FODDA_API_URL}/v1/supplemental/fred/economic-snapshot`, 'FRED Economic Indicators'));

  if (['retail', 'fashion'].includes(v)) {
    fetches.push(safeFetch(`${FODDA_API_URL}/v1/supplemental/census/retail-snapshot`, 'US Census Retail Sales'));
    fetches.push(safeFetch(`${FODDA_API_URL}/v1/supplemental/bea/spending-snapshot`, 'BEA Consumer Spending'));
  }
  if (['beauty', 'health'].includes(v)) {
    fetches.push(safeFetch(`${FODDA_API_URL}/v1/supplemental/fda/ingredient-safety?ingredients=${encodeURIComponent(query.substring(0, 50))}`, 'FDA Ingredient Safety'));
  }

  try {
    const results = await Promise.all(fetches);
    const blocks = results
      .filter(r => r.data !== null)
      .map(r => `\n--- ${r.label} ---\n${JSON.stringify(r.data, null, 0).substring(0, 2000)}`)
      .join('\n');

    return blocks.length === 0 ? '' : `\n\nSUPPLEMENTAL INSTITUTIONAL DATA:\n${blocks}`;
  } catch { return ''; }
}

router.post("/query", async (req, res) => {
  const startTime = Date.now();
  const requestId = randomBytes(8).toString('hex');

  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ ok: false, error: "API Key required.", requestId });

    const trialCheck = await checkTrialLimit(apiKey, req, requestId);
    if (trialCheck.blocked) return res.status(403).json(trialCheck.response);

    const identity = await resolveIdentity(apiKey);
    const tenantId = identity?.tenantId;
    const userId = (req.headers['x-user-id'] as string) || (req.body.userId as string);

    if (userId && typeof userId === 'string' && userId.includes('@') && tenantId && tenantId !== 'unknown_tenant') {
      autoProvisionUser(userId, tenantId).catch(err => console.error('[QueryRouter] Auto-provision check failed:', err));
    }

    let accountFields: any = null;
    if (tenantId && tenantId !== 'unknown_tenant') {
      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${tenantId}'`);
      if (accountQuery.records?.[0]) {
        const acc = accountQuery.records[0];
        accountFields = acc.fields;
        const monthlyLimit = extractNumericLimit(acc.fields, 100);
        const bonusTokens = Number(acc.fields.bonusTokens || 0);
        const effectiveLimit = monthlyLimit + bonusTokens;
        // Enforce against CURRENT-CYCLE usage (queriesUsedThisCycle), which resets each
        // billing cycle. `monthlyQueries` is an un-resettable lifetime rollup — enforcing on
        // it permanently locks accounts out once their lifetime total crosses the monthly
        // limit (the "usage never resets" bug). Cycle counter is maintained by incrementUsage
        // and zeroed by /cron/monthly-reset + the Stripe renewal webhook.
        const currentUsage = Number(acc.fields.queriesUsedThisCycle || 0);

        // Track usage percentage for warning headers
        const usagePercent = effectiveLimit > 0 ? Math.round((currentUsage / effectiveLimit) * 100) : 0;

        if (acc.fields.limitReached || currentUsage >= effectiveLimit) {
          // Soft cap: allow if payment method on file + overage enabled
          if (acc.fields.hasPaymentMethod && acc.fields.overageEnabled) {
            // Mark as overage — incrementUsage will handle Stripe reporting
            (req as any).__isOverage = true;
            (req as any).__overageTokens = currentUsage - effectiveLimit;
          } else {
            // No card on file — block and provide setup URL
            let setupUrl: string | undefined;
            try {
              const ownerEmail = await resolveEmailFromApiKey(apiKey);
              setupUrl = await generateSetupUrl(tenantId!, ownerEmail);
            } catch { /* non-critical */ }

            return res.status(403).json({
              ok: false,
              error: "Monthly API call limit exceeded. Add a payment method to continue at $0.50/API call.",
              code: "PLAN_LIMIT_EXCEEDED",
              setupUrl,
              upgradeUrl: `${process.env.APP_URL || 'https://app.fodda.ai'}?view=billing`,
              requestId
            });
          }
        }

        // Stash usage info for response headers
        (req as any).__usagePercent = usagePercent;
        (req as any).__currentUsage = currentUsage;
        (req as any).__effectiveLimit = effectiveLimit;
      }
    }

    const queryGraphId = req.body.graphId || req.body.vertical || 'retail';
    
    // Determine Search Mode
    let searchSlug = queryGraphId;
    if (searchSlug === 'psfk') {
      const v = (req.body.vertical || '').toLowerCase();
      searchSlug = ['retail', 'sports', 'beauty'].includes(v) ? v : 'retail';
    }

    const forwardHeaders: Record<string, string> = { "Content-Type": "application/json", "X-API-Key": apiKey, "X-Request-Id": requestId };
    const queryBody = { query: req.body.q || req.body.query || '', limit: req.body.limit || 10, use_semantic: true, include_evidence: true };

    signOutboundRequest(forwardHeaders, 'POST', `/v1/graphs/${searchSlug}/search`, queryBody);
    const response = await fetch(`${FODDA_API_URL}/v1/graphs/${searchSlug}/search`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ ok: false, error: text, requestId });
    }

    const data = await response.json();
    const usage = { tokens: calculateQueryUnits(queryGraphId), graph_weight: 1.0, billable_tokens: calculateQueryUnits(queryGraphId) };
    const responseTimeMs = Date.now() - startTime;
    const resultCount = data?.data?.trends?.length || data?.data?.rows?.length || 0;
    const resultQuality = resultCount >= 5 ? 'STRONG' : resultCount > 0 ? 'WEAK' : 'MISS';

    // Add usage warning headers (80% threshold)
    const usagePercent = (req as any).__usagePercent || 0;
    if (usagePercent >= 80 && usagePercent < 100) {
      res.set('X-Usage-Warning', 'approaching-limit');
      res.set('X-Usage-Percent', String(usagePercent));
    } else if ((req as any).__isOverage) {
      res.set('X-Usage-Warning', 'overage-active');
      res.set('X-Usage-Overage-Tokens', String((req as any).__overageTokens || 0));
    }

    // Send response immediately — everything below is fire-and-forget
    res.json({
      requestId,
      graphId: queryGraphId,
      version: "v1",
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      data,
      meta: {
        usage,
        ...(usagePercent >= 80 ? { usageWarning: usagePercent >= 100 ? 'overage-active' : 'approaching-limit', usagePercent } : {}),
      }
    });

    // --- Fire-and-forget telemetry (never blocks the response) ---
    incrementUsage(userId, tenantId, usage.tokens, (req as any).__isOverage).catch(() => {});

    // Enriched query log
    resolveEmailFromApiKey(apiKey).then(email => {
      const accountType = accountFields ? detectAccountType(accountFields) : null;
      createAirtableRecord(LOGS_TABLE_QUESTIONS, {
        "question": queryBody.query,
        "userEmail": email,
        "graphId": queryGraphId,
        "searchSlug": searchSlug,
        "Date": new Date().toISOString(),
        "resultCount": resultCount,
        "stepCount": req.body.stepCount || 1,
        "responseTimeMs": responseTimeMs,
        "resultQuality": resultQuality,
        "source": (apiKey.startsWith('sk_trial_') || accountType === 'trial') ? 'trial' : 'api',
        "accountId": tenantId || '',
        "promptSource": req.body.promptSource || '',
        "taxonomy_node": (queryGraphId || 'unknown').substring(0, 100),
      }).catch(() => {});
    }).catch(() => {});

  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, requestId });
  }
});

router.post("/log", async (req, res) => {
  // Rate limit: 30 req/min per IP to prevent log poisoning
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (isLogRateLimited(clientIp)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  try {
    const { email, query, vertical, graphId, accessKey, context, apiCall, promptSource } = req.body;

    // Guard: silently accept but don't persist system signals — they pollute query analytics
    const normalizedQuery = (query || '').trim().substring(0, 1000); // cap length
    if (!normalizedQuery || normalizedQuery === '[SESSION_START]' || normalizedQuery === '[EMPTY]') {
      return res.json({ ok: true, skipped: true });
    }

    let resolvedEmail = extractValue(email) || "";
    if (!resolvedEmail && accessKey) resolvedEmail = await resolveEmailFromApiKey(extractValue(accessKey));

    await createAirtableRecord(LOGS_TABLE_QUESTIONS, {
      "question": normalizedQuery,
      "apiCall": (apiCall || normalizedQuery).substring(0, 1000),
      "userEmail": (resolvedEmail || "anonymous").substring(0, 254),
      "accessKey": (extractValue(accessKey) || "").substring(0, 100),
      "graphId": (extractValue(graphId) || "psfk").substring(0, 100),
      "vertical": (extractValue(vertical) || "unknown").substring(0, 100),
      "Date": new Date().toISOString(),
      "userContext": (context?.userContext || "").substring(0, 500),
      "accountContext": (context?.accountContext || "").substring(0, 500),
      "promptSource": (promptSource || "").substring(0, 100),
      "source": "app",
      "taxonomy_node": (extractValue(graphId) || extractValue(vertical) || "unknown").substring(0, 100),
    });
    res.json({ ok: true });
  } catch (err: any) {
    // Still return ok so the client never blocks on logging, but make the
    // failure visible in Cloud Run logs — silent drops here masked broken
    // query tracking for weeks.
    console.error('[QueryLog] Airtable write failed:', err?.message);
    res.status(200).json({ ok: true });
  }
});

router.post("/gemini-search", async (req, res) => {
  // Authentication check: Clerk session or valid API key
  const clerkUserId = (req as any).auth?.userId;
  const clientApiKey = req.headers['x-api-key'] as string;
  let isAuthenticated = false;

  if (clerkUserId) {
    isAuthenticated = true;
  } else if (clientApiKey) {
    try {
      const identity = await resolveIdentity(clientApiKey);
      if (identity && identity.keyStatus !== 'Pending') {
        isAuthenticated = true;
      }
    } catch (err) {
      console.error('[GeminiSearchAuth] Error checking API key:', err);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({ ok: false, error: "Unauthorized - API Key or Clerk session required." });
  }

  try {
    const { query, vertical, graphContext } = req.body;
    // Finding 7: always use server-side key — never accept a caller-supplied key
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ ok: false, error: "Gemini API Key not configured." });

    const supplementalContext = await fetchSupplementalContext(vertical || '', query);
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: `You are Fodda intelligence assistant. ${supplementalContext}`,
        temperature: 0.3,
        tools: [{ googleSearch: {} }]
      }
    });

    res.json({ ok: true, answer: response.text, suggestedQuestions: [] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/overview", async (req, res) => {
    const { industry, sector } = req.query;
    if (!industry && !sector) return res.status(400).json({ ok: false, error: "Missing scope" });
    const cacheKey = `${industry || ''}:${sector || ''}`;
    const cached = overviewCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) return res.json(cached.data);

    const data = { executive_summary: `Macro analysis for ${industry || sector}...`, meta_patterns: [] };
    overviewCache.set(cacheKey, { data, expires: Date.now() + OVERVIEW_TTL });
    res.json(data);
});

// Finding 8: guarded import proxy — internal key required, target must be allowlisted
router.post("/import/:target", async (req, res) => {
  const { target } = req.params;

  // Only allow trusted internal callers
  const callerKey = req.headers['x-api-key'] as string || '';
  if (!INTERNAL_API_KEY || INTERNAL_API_KEY.trim() === '' || callerKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // Allowlist targets to prevent arbitrary upstream proxying
  if (!ALLOWED_IMPORT_TARGETS.has(target)) {
    return res.status(400).json({ ok: false, error: `Unknown import target: ${target}` });
  }

  try {
    const response = await fetch(`${FODDA_API_URL}/api/import/${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": INTERNAL_API_KEY },
      body: JSON.stringify(req.body)
    });
    res.json(await response.json());
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
