import { randomBytes, createHash, createHmac } from 'crypto';
import { clerkClient } from '@clerk/express';
import { 
  queryAirtable, 
  updateAirtableRecord, 
  USERS_TABLE, 
  ACCOUNTS_TABLE, 
  API_KEYS_TABLE,
  createAirtableRecord,
  escapeAirtableString
} from './db.js';
import { sendSystemEmail, sendDirectEmail } from "./services/emailService.js";
import { enrichUserBuyerType } from "./services/userEnrichmentService.js";
import { selectPrompts } from "./services/promptSelector.js";
import { validateAndSelectPrompts } from "./services/promptValidator.js";
import { reportOverageToStripe } from "./services/stripeOverageService.js";

// --- Identity & Cache ---
export const identityCache = new Map<string, { apiKeyId: string, tenantId: string, keyStatus: string }>();
const identityPromises = new Map<string, Promise<{ apiKeyId: string, tenantId: string, keyStatus: string } | null>>();

export async function resolveIdentity(apiKey: string) {
  if (identityCache.has(apiKey)) return identityCache.get(apiKey);
  if (identityPromises.has(apiKey)) return identityPromises.get(apiKey);

  const lookup = (async () => {
    try {
      const keyQuery = await queryAirtable(API_KEYS_TABLE, `{API Key} = '${escapeAirtableString(apiKey)}'`);
      const record = keyQuery.records?.[0];
      if (record) {
        const identity = {
          apiKeyId: record.id,
          tenantId: extractValue(record.fields.Account),
          keyStatus: (record.fields['API Key Status'] as string) || 'Active'
        };
        identityCache.set(apiKey, identity);
        return identity;
      }
    } catch (err) {
      console.error("[Identity Resolution Error]", err);
    } finally {
      identityPromises.delete(apiKey);
    }
    return null;
  })();

  identityPromises.set(apiKey, lookup);
  return lookup;
}

export function isPendingKey(identity: { keyStatus?: string } | null | undefined): boolean {
  return identity?.keyStatus === 'Pending';
}

/**
 * Enforces hard caps on graph traversal to prevent resource exhaustion.
 */
export function enforceHardLimits(body: any) {
  const sanitized = { ...body };
  const caps = { MAX_DEPTH: 2, MAX_EVIDENCE: 15, MAX_TOP_K: 10, MAX_NODES: 50 };

  sanitized.depth = Math.min(Math.max(1, body.depth || 1), caps.MAX_DEPTH);
  sanitized.evidence_limit = Math.min(Math.max(1, body.evidence_limit || 10), caps.MAX_EVIDENCE);
  sanitized.top_k = Math.min(Math.max(1, body.top_k || 5), caps.MAX_TOP_K);
  sanitized.max_nodes = Math.min(Math.max(1, body.max_nodes || 20), caps.MAX_NODES);

  return sanitized;
}

/**
 * Enrich evidence items with a pre-formatted markdown citation.
 */
export function enrichEvidence(items: any[]): any[] {
    if (!Array.isArray(items)) return items;
    return items.map(item => {
        if (item.formatted_citation) return item;
        const title = item.title?.trim();
        const url = item.sourceUrl?.trim();
        if (title && url) item.formatted_citation = `[${title}](${url})`;
        else if (title) item.formatted_citation = `${title} (no link available)`;
        else if (url) item.formatted_citation = `[Source](${url})`;
        return item;
    });
}

// --- Resolve human-readable email/label from an API key ---
export const emailFromKeyCache = new Map<string, string>();
const emailFromKeyPromises = new Map<string, Promise<string>>();

export async function resolveEmailFromApiKey(apiKey: string): Promise<string> {
  if (!apiKey) return 'anonymous';
  if (apiKey.startsWith('sk_trial_')) return apiKey;
  if (emailFromKeyCache.has(apiKey)) return emailFromKeyCache.get(apiKey)!;
  if (emailFromKeyPromises.has(apiKey)) return emailFromKeyPromises.get(apiKey)!;

  const lookup = (async () => {
    try {
      const identity = await resolveIdentity(apiKey);
      if (identity?.tenantId && identity.tenantId !== 'unknown_tenant') {
        const accQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${identity.tenantId}'`);
        const acc = accQuery.records?.[0];
        if (acc) {
          const email = acc.fields.adminEmail || acc.fields['Admin Email'] || '';
          if (email) {
            emailFromKeyCache.set(apiKey, email);
            return email;
          }
          const name = acc.fields['Account Name'] || acc.fields.Name || '';
          if (name) {
            const label = `${name} (API)`;
            emailFromKeyCache.set(apiKey, label);
            return label;
          }
        }
      }
    } catch (err) {
      console.warn('[resolveEmailFromApiKey] Lookup failed, using key stub:', err);
    } finally {
      emailFromKeyPromises.delete(apiKey);
    }

    const stub = `${apiKey.slice(0, 12)}…`;
    emailFromKeyCache.set(apiKey, stub);
    return stub;
  })();

  emailFromKeyPromises.set(apiKey, lookup);
  return lookup;
}

// Helper to extract value from potentially array-based Airtable fields
export const extractValue = (val: any) => {
  let v = val;
  if (Array.isArray(val)) {
    v = val.length > 0 ? val[0] : '';
  }
  return v || '';
};

export const extractRealValue = (val: any) => {
  const v = extractValue(val);
  if (typeof v === 'string' && v.startsWith('rec') && v.length === 17) return '';
  return v;
};

export function extractNumericLimit(fields: any, fallback = 100): number {
  const candidates = [
    fields.monthlyQueryLimit,
    fields['Monthly API Limit'],
    fields['Max Plan Queries'],
    fields['Max API Calls Number'],
    fields.maxplanQueries
  ];
  for (const val of candidates) {
    if (val == null) continue;
    const num = Number(Array.isArray(val) ? val[0] : val);
    if (!isNaN(num) && num > 0) return num;
  }
  return fallback;
}

export function isPublicEmailDomain(domain: string): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase().trim();
  const exactSet = new Set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
    'mail.com', 'msn.com', 'pm.me', 'hey.com', 'zoho.com'
  ]);
  if (exactSet.has(d)) return true;
  if (d.startsWith('gmx.') || d.startsWith('yandex.')) return true;
  return false;
}

export function extractCorporateDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase().trim();
  if (isPublicEmailDomain(domain)) return null;
  return domain;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number = 10 * 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

export async function autoProvisionUser(userId: string | undefined, accountId: string): Promise<void> {
  if (!userId || !userId.includes('@')) return; // Must be a valid email
  const email = userId.toLowerCase().trim();

  try {
    const existingUser = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(email)}'`);
    if (existingUser.records && existingUser.records.length > 0) return; // User exists

    const acct = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
    const acctFields = acct.records?.[0]?.fields;
    if (!acctFields) return;

    if (!acctFields.autoProvisionToggle || !acctFields.autoProvisionDomain) return;

    const reqDomain = email.split('@')[1];
    if (reqDomain !== acctFields.autoProvisionDomain.toLowerCase().trim()) return;

    // Domain matches and toggle is on! Provision the user with a personal connector token.
    const uniqueHandle = email.split('@')[0] + randomBytes(2).toString('hex');
    const mcpToken = randomBytes(24).toString('base64url');

    const userFields = {
      "User Name": uniqueHandle,
      "email": email,
      "Role": 'Member',
      "Account": [accountId],
      "emailConfirmed": true,
      "User Full Name": email.split('@')[0],
      "mcpConnectionToken": mcpToken,
      "apiUse": "Auto-Provisioned via API/MCP"
    };

    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const newUserId = userRecord.records[0].id;
    const inviteFirstName = String(email.split('@')[0]);

    // Send email notification to Account Owner
    const ownerIdLink = acctFields['Account Owner'];
    if (ownerIdLink && ownerIdLink.length > 0) {
      queryAirtable(USERS_TABLE, `RECORD_ID() = '${ownerIdLink[0]}'`).then(ownerQuery => {
        const ownerRecord = ownerQuery.records?.[0];
        const ownerEmail = ownerRecord?.fields?.email || ownerRecord?.fields?.Email;
        if (ownerEmail) {
          sendDirectEmail(
            ownerEmail,
            `New team member ${email} joined ${acctFields['Account Name'] || 'your account'}`,
            `Hello,\n\nA new team member (${email}) has automatically joined your Fodda account (${acctFields['Account Name'] || ''}) via corporate domain auto-provisioning.\n\nYou can manage team members and access roles in your Fodda Account Portal at https://app.fodda.ai.\n\nBest,\nThe Fodda Team`,
            'internal'
          ).catch((err: any) => console.error('[Auto-Provision] Admin notification email failed:', err));
        }
      }).catch((err: any) => console.error('[Auto-Provision] Owner lookup failed:', err));
    }

    enrichUserBuyerType(email, inviteFirstName, '', '', updateAirtableRecord, USERS_TABLE, newUserId).catch(e => console.error('[Enrichment] Failed:', e));

    setTimeout(async () => {
      try {
        const freshUser = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${newUserId}'`);
        const uf = freshUser.records?.[0]?.fields || {};
        const graphSlug = (acctFields.vertical || 'default').toLowerCase();
        const candidates = selectPrompts(graphSlug, uf.buyer_type || 'Unknown', uf.buyer_industry || '', 10);
        const { prompts } = await validateAndSelectPrompts(candidates, graphSlug, email, sendSystemEmail) as any;
        const finalPrompts = prompts.length >= 3 ? prompts : candidates.slice(0, 5);
        await sendSystemEmail('ONBOARDING_PROMPTS', email, { firstName: inviteFirstName, graphId: graphSlug, buyerType: uf.buyer_type || 'Unknown', buyerIndustry: uf.buyer_industry || '', prompts: finalPrompts });
      } catch (e) { console.error('[Onboarding] Failed for auto-provisioned user:', e); }
    }, 5 * 60 * 1000);

    console.log(`[Auto-Provision] Successfully provisioned ${email} into account ${accountId}`);
  } catch (err) {
    console.error("[Auto-Provision Error]", err);
  }
}

// Helper for Context Rewriting
export const rewriteContext = async (originalText: string, type: 'user' | 'company', providedKey?: string): Promise<string> => {
  if (!originalText || !originalText.trim()) {
    return type === 'user' ? "No further context at this time from the user" : "No further context at this time from the company";
  }
  const normalized = originalText.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const throwawayPhrases = ['no info', 'none', 'na', 'n a', 'nothing', 'no', 'test', 'skip', 'idk', 'dont know', 'no context', 'no description', 'not sure', 'tbd', 'later', 'nil'];
  if (normalized.length < 8 || throwawayPhrases.some(p => normalized === p || normalized.startsWith(p + ' '))) {
    return type === 'user' ? "No further context at this time from the user" : "No further context at this time from the company";
  }

  const apiKey = providedKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return originalText;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const prompt = type === 'user'
      ? `Rewrite user profile into concise context for a research agent. Input: "${originalText}"`
      : `Rewrite company mission into concise context for a research agent. Input: "${originalText}"`;
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return result.text || originalText;
  } catch (e) { return originalText; }
};

/**
 * Sign outbound requests to the Fodda API with HMAC.
 */
export function signOutboundRequest(
  headers: Record<string, string>,
  method: 'GET' | 'POST',
  path: string,
  body?: any
): void {
  const secret = process.env.FODDA_MCP_SECRET;
  if (!secret) return;

  const timestamp = Date.now().toString();
  const payload = method === 'POST' && body
    ? timestamp + '.' + JSON.stringify(body)
    : timestamp + '.' + path;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');

  headers['X-Fodda-Timestamp'] = timestamp;
  headers['X-Fodda-Signature'] = signature;
}

// --- Trial Metering (Airtable-backed with in-memory fallback) ---
const trialSessionStore = new Map<string, { count: number; firstSeen: number }>();
const TRIAL_TOKEN_LIMIT = 50;

// Cache Airtable trial records to avoid repeated lookups within same session
const trialRecordCache = new Map<string, { recordId: string; tokensTotal: number; tokensUsed: number; status: string } | null>();

/**
 * Check trial limits. For provisioned trials (in Airtable Trials table),
 * uses persistent token tracking. For ad-hoc sk_trial_ keys, falls back
 * to in-memory counting.
 */
export async function checkTrialLimit(apiKey: string, req: any, requestId: string) {
    if (!apiKey.startsWith('sk_trial_')) return { blocked: false };

    const graph = apiKey.replace('sk_trial_', '');
    const isAllGraphs = graph === 'all';
    const signupUrl = isAllGraphs ? 'https://app.fodda.ai' : `https://app.fodda.ai?graph=${graph}`;

    // --- Try Airtable-backed trial first ---
    try {
      if (!trialRecordCache.has(apiKey)) {
        const { queryAirtable } = await import('./db.js');
        const { TRIALS_TABLE } = await import('./constants.js');
        const result = await queryAirtable(TRIALS_TABLE, `{trial_key} = '${escapeAirtableString(apiKey)}'`);
        const rec = result.records?.[0];
        if (rec) {
          trialRecordCache.set(apiKey, {
            recordId: rec.id,
            tokensTotal: Number(rec.fields.tokens_total || rec.fields.tokensTotal || 50),
            tokensUsed: Number(rec.fields.tokens_used || rec.fields.tokensUsed || 0),
            status: String(rec.fields.status || 'active')
          });
        } else {
          trialRecordCache.set(apiKey, null); // Not a provisioned trial
        }
      }

      const cached = trialRecordCache.get(apiKey);
      if (cached && cached.status === 'active') {
        // Provisioned trial — check Airtable-tracked tokens
        cached.tokensUsed++;
        if (cached.tokensUsed > cached.tokensTotal) {
          // Update status in Airtable (fire-and-forget)
          import('./db.js').then(({ updateAirtableRecord }) => {
            import('./constants.js').then(({ TRIALS_TABLE }) => {
              updateAirtableRecord(TRIALS_TABLE, cached.recordId, {
                tokens_used: cached.tokensUsed,
                status: 'exhausted'
              }).catch(() => {});
            });
          });
          cached.status = 'exhausted';
          return { blocked: true, response: { ok: false, error: "Trial API call limit exceeded. Sign up for a free Base account to get 100 API calls/month.", code: "TRIAL_LIMIT_EXCEEDED", signupUrl, requestId } };
        }
        // Increment usage in Airtable (fire-and-forget)
        import('./db.js').then(({ updateAirtableRecord }) => {
          import('./constants.js').then(({ TRIALS_TABLE }) => {
            updateAirtableRecord(TRIALS_TABLE, cached.recordId, {
              tokens_used: cached.tokensUsed
            }).catch(() => {});
          });
        });
        return { blocked: false };
      }

      if (cached && cached.status === 'exhausted') {
        return { blocked: true, response: { ok: false, error: "Trial API call limit exceeded. Sign up for a free Base account to get 100 API calls/month.", code: "TRIAL_LIMIT_EXCEEDED", signupUrl, requestId } };
      }
    } catch (err) {
      console.warn('[Trial] Airtable lookup failed, falling back to in-memory:', err);
    }

    // --- Fallback: in-memory trial for non-provisioned keys ---
    const sessionId = (req.headers['mcp-session-id'] || req.headers['x-mcp-session'] || '') as string;
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') as string;
    const ua = (req.headers['user-agent'] || '') as string;
    const fingerprint = createHash('sha256').update(`${apiKey}:${sessionId || ip + ua}`).digest('hex').slice(0, 16);
    const session = trialSessionStore.get(fingerprint) || { count: 0, firstSeen: Date.now() };
    session.count++;
    trialSessionStore.set(fingerprint, session);
    if (session.count > TRIAL_TOKEN_LIMIT) {
        return { blocked: true, response: { ok: false, error: "Trial API call limit exceeded. Sign up for a free Base account to get 100 API calls/month.", code: "TRIAL_LIMIT_EXCEEDED", signupUrl, requestId } };
    }
    return { blocked: false };
}

// --- API Call Usage Tracking (Optimized to parallelize updates) ---
export async function incrementUsage(userId: string | undefined, tenantId: string | undefined, tokenCost: number = 1, isOverage: boolean = false) {
  if (!tenantId || tenantId === 'unknown_tenant') return;
  
  const tasks: Promise<any>[] = [];

  // 1. Account Usage Task
  tasks.push((async () => {
    try {
      const accQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${tenantId}'`);
      const accRec = accQuery.records?.[0];
      if (accRec) {
        const current = accRec.fields.monthlyQueries || 0;
        const countCycle = accRec.fields.queriesUsedThisCycle || 0;
        const effectiveLimit = extractNumericLimit(accRec.fields, 100) + Number(accRec.fields.bonusTokens || 0);
        const updates: any = { "queriesUsedThisCycle": countCycle + tokenCost };
        const newUsage = current + tokenCost;

        // 80% warning email — fires once when usage crosses the 80% threshold
        const eightyPercent = Math.floor(effectiveLimit * 0.8);
        if (newUsage >= eightyPercent && current < eightyPercent) {
          const ownerIdLink = accRec.fields['Account Owner'];
          if (ownerIdLink && ownerIdLink.length > 0) {
            queryAirtable(USERS_TABLE, `RECORD_ID() = '${ownerIdLink[0]}'`).then(async (ownerQuery) => {
              const ownerRecord = ownerQuery.records?.[0];
              if (ownerRecord) {
                const ownerEmail = ownerRecord.fields.email || ownerRecord.fields.Email;
                if (ownerEmail) {
                  // Generate one-click Stripe setup link for the email
                  let setupUrl: string | undefined;
                  try {
                    const { generateSetupUrl } = await import('./services/stripeOverageService.js');
                    setupUrl = await generateSetupUrl(ownerEmail, tenantId);
                  } catch (e) { /* non-critical */ }

                  sendSystemEmail('PLAN_LIMIT_WARNING', ownerEmail, {
                    name: ownerRecord.fields['First Name'] || 'there',
                    planName: accRec.fields.planName || accRec.fields.planLevel || 'Free',
                    limit: effectiveLimit,
                    setupUrl,
                  }).catch(e => console.error('[Usage] 80% warning email failed:', e));
                }
              }
            }).catch(() => {});
          }
          console.log(`[Usage] Account ${tenantId} hit 80% (${newUsage}/${effectiveLimit})`);
        }

        if (newUsage >= effectiveLimit) {
          if (accRec.fields.hasPaymentMethod && accRec.fields.overageEnabled) {
            // Overage billing active — report to Stripe instead of blocking
            const prevOverage = Number(accRec.fields.overageTokensThisCycle || 0);
            updates["overageTokensThisCycle"] = prevOverage + tokenCost;

            // Report usage to Stripe Meter (fire-and-forget)
            if (accRec.fields.stripeCustomerId) {
              // Graph multiplier defaults to 1.0 — enhanced when metering.ts is integrated
              reportOverageToStripe(accRec.fields.stripeCustomerId, tokenCost, 1.0)
                .catch(err => console.error('[Overage] Meter reporting failed:', err));
            }

            // First time hitting overage? Send notification email
            if (prevOverage === 0) {
              const ownerIdLink = accRec.fields['Account Owner'];
              if (ownerIdLink && ownerIdLink.length > 0) {
                queryAirtable(USERS_TABLE, `RECORD_ID() = '${ownerIdLink[0]}'`).then(ownerQuery => {
                  const ownerRecord = ownerQuery.records?.[0];
                  if (ownerRecord) {
                    const ownerEmail = ownerRecord.fields.email || ownerRecord.fields.Email;
                    if (ownerEmail) {
                      sendSystemEmail('OVERAGE_ACTIVATED', ownerEmail, {
                        name: ownerRecord.fields['First Name'] || 'there',
                        limit: effectiveLimit,
                        overageRate: '$0.50',
                      }).catch(e => console.error('[Overage] Activation email failed:', e));
                    }
                  }
                }).catch(() => {});
              }
            }
          } else {
            updates["limitReached"] = true;
          }
        }

        await updateAirtableRecord(ACCOUNTS_TABLE, tenantId, updates);
      }
    } catch (err) { console.error(`[Usage-Account] Failed:`, err); }
  })());

  // 2. User Usage Task
  if (userId) {
    tasks.push((async () => {
      try {
        const isRecordId = userId.startsWith('rec');
        const userFilter = isRecordId
          ? `RECORD_ID() = '${userId}'`
          : `LOWER({email}) = '${escapeAirtableString(userId.toLowerCase().trim())}'`;
        const userQuery = await queryAirtable(USERS_TABLE, userFilter);
        const userRec = userQuery.records?.[0];
        if (userRec) await updateAirtableRecord(USERS_TABLE, userRec.id, { "apiUseCount": (userRec.fields.apiUseCount || 0) + tokenCost });
      } catch (err) { console.error(`[Usage-User] Failed:`, err); }
    })());
  }

  // Run updates in parallel
  Promise.all(tasks).catch(err => console.error("[Usage-Parallel] Error in tasks:", err));
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  accountId: string;
}

/**
 * Authenticates a user session from the X-Session-Token header, request body, query params, or Clerk email.
 * Fail-closed: returns null if no valid token or matching user email is found.
 */
export async function authenticateSession(req: any): Promise<AuthenticatedUser | null> {
  const sessionToken = (req.headers['x-session-token'] || req.body?.sessionToken || req.query?.sessionToken) as string | undefined;

  if (sessionToken) {
    try {
      const result = await queryAirtable(USERS_TABLE, `{sessionToken} = '${escapeAirtableString(sessionToken)}'`);
      const record = result.records?.[0];
      if (record) {
        const expiresAt = record.fields?.sessionExpiresAt;
        if (!expiresAt || Date.now() <= new Date(expiresAt).getTime()) {
          const email = record.fields?.email;
          if (email) {
            const role = record.fields?.Role || record.fields?.role || 'User';
            const accountArray = record.fields?.Account;
            const accountId = Array.isArray(accountArray) && accountArray.length > 0 ? accountArray[0] : '';
            return {
              id: record.id,
              email: String(email).toLowerCase().trim(),
              role: String(role),
              accountId: String(accountId)
            };
          }
        }
      }
    } catch (err) {
      console.error("[Auth] Session token lookup failed:", err);
    }
  }

  // Verified Clerk Authentication fallback (req.auth)
  let verifiedEmail: string | undefined = req.auth?.sessionClaims?.email || req.auth?.claims?.email;

  // If sessionClaims does not expose email directly, resolve verified email via Clerk API
  if (!verifiedEmail && req.auth?.userId) {
    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);
      verifiedEmail = clerkUser.emailAddresses?.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;
    } catch (err) {
      console.error("[Auth] Clerk user lookup failed:", err);
    }
  }

  // Fallback: Check x-user-id header or body/query email
  const fallbackEmail = (req.headers['x-user-id'] || req.body?.userEmail || req.body?.email || req.query?.userEmail || req.query?.email) as string | undefined;
  if (!verifiedEmail && fallbackEmail && typeof fallbackEmail === 'string' && fallbackEmail.includes('@')) {
    verifiedEmail = fallbackEmail;
  }

  if (verifiedEmail && typeof verifiedEmail === 'string') {
    const cleanEmail = verifiedEmail.toLowerCase().trim();
    try {
      const result = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(cleanEmail)}'`);
      const record = result.records?.[0];
      if (record) {
        const role = record.fields?.Role || record.fields?.role || 'User';
        const accountArray = record.fields?.Account;
        const accountId = Array.isArray(accountArray) && accountArray.length > 0 ? accountArray[0] : '';
        return {
          id: record.id,
          email: cleanEmail,
          role: String(role),
          accountId: String(accountId)
        };
      }
    } catch (err) {
      console.error("[Auth] Verified email lookup failed:", err);
    }
  }

  console.warn(`[Auth] No valid sessionToken or verified Clerk user email found for path ${req.path}`);
  return null;
}

// --- Legacy Trial Key Handler ---
// Intercepts old-style sk_trial_* keys and either auto-provisions a Base
// account (if we have an email) or tells the user to sign up.

export async function handleLegacyTrialKey(req: any, res: any): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  const trialKey = apiKey; // e.g. sk_trial_retail, sk_trial_all

  // Extract email from all known sources
  const rawEmail =
    (req.headers['x-user-id'] as string) ||
    req.body?.userId ||
    req.body?.user_id ||
    (req.query?.user_id as string) ||
    (req.query?.userId as string) ||
    '';

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const hasEmail = email.includes('@');

  if (!hasEmail) {
    // No email — can't provision, just tell them to sign up
    console.log(`[Legacy Trial] Blocked ${trialKey} — no email provided`);
    return res.status(403).json({
      ok: false,
      error: "Legacy trial keys are no longer supported. Sign in at https://app.fodda.ai to get a free Base account with 100 API calls/month.",
      code: "LEGACY_TRIAL_RETIRED",
      signupUrl: "https://app.fodda.ai"
    });
  }

  // We have an email — check if user already exists
  try {
    const existingUser = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(email)}'`);

    if (existingUser.records && existingUser.records.length > 0) {
      // User already has an account
      console.log(`[Legacy Trial] Blocked ${trialKey} — user ${email} already exists`);
      return res.status(403).json({
        ok: false,
        error: "Legacy trial keys have been retired. You already have a Fodda account — sign in at https://app.fodda.ai to find your API key.",
        code: "LEGACY_TRIAL_RETIRED",
        signupUrl: "https://app.fodda.ai"
      });
    }

    // New user — auto-provision via trial-convert (fire-and-forget)
    const appUrl = process.env.APP_URL || 'https://app.fodda.ai';
    const selfUrl = process.env.SELF_URL || `http://localhost:${process.env.PORT || 8080}`;
    const firstName = email.split('@')[0];

    fetch(`${selfUrl}/api/account/trial-convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, trialKey, firstName, intent: 'legacy_migration' })
    }).then(async (provRes) => {
      const body = await provRes.json().catch(() => ({}));
      console.log(`[Legacy Trial] Auto-provisioned ${email} via ${trialKey}:`, body.ok ? 'success' : body.error);
    }).catch(err => {
      console.error(`[Legacy Trial] Provisioning failed for ${email}:`, err.message);
    });

    console.log(`[Legacy Trial] Blocked ${trialKey} — provisioning Base account for ${email}`);
    return res.status(403).json({
      ok: false,
      error: "Legacy trial keys have been retired. We've set up a free Base account for you with 100 API calls/month. Check your email to confirm your account and get your new API key.",
      code: "LEGACY_TRIAL_RETIRED",
      signupUrl: appUrl
    });

  } catch (err: any) {
    console.error(`[Legacy Trial] Error handling ${trialKey} for ${email}:`, err.message);
    // Fail gracefully — still block the legacy key
    return res.status(403).json({
      ok: false,
      error: "Legacy trial keys are no longer supported. Sign in at https://app.fodda.ai to get a free Base account with 100 API calls/month.",
      code: "LEGACY_TRIAL_RETIRED",
      signupUrl: "https://app.fodda.ai"
    });
  }
}

