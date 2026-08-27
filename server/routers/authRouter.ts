import { Router } from 'express';
import { requireAuth, clerkClient } from '@clerk/express';
import { randomBytes } from 'crypto';
import { 
  queryAirtable, 
  createAirtableRecord, 
  updateAirtableRecord, 
  DatabaseUnavailableError,
  escapeAirtableString
} from '../db.js';
import { 
  USERS_TABLE, 
  ACCOUNTS_TABLE, 
  PLANS_TABLE, 
  API_KEYS_TABLE,
  BASE_ID,
  CE_ANALYSTS_TABLE
} from '../constants.js';
import { 
  extractValue, 
  extractNumericLimit, 
  extractRealValue,
  rewriteContext,
  resolveEmailFromApiKey
} from '../helpers.js';
import { isValidRedirectUrl, isInternalAppUrl } from '../../shared/redirectAllowlist.js';
import { sendSystemEmail } from "../services/emailService.js";
import { addToStreakPipeline, STAGE_SELF_DEMO } from "../services/streakService.js";
import { enrichUserBuyerType } from "../services/userEnrichmentService.js";
import { selectPrompts } from "../services/promptSelector.js";
import { validateAndSelectPrompts } from "../services/promptValidator.js";
import { buildMcpConnection } from "../services/mcpConnectionService.js";
import { detectAccountType } from "../services/accountTypeService.js";

const router = Router();

// --- Auth Rate Limiting (Finding 7) ---
// Prevents account enumeration, magic-link flooding, and bulk registration.
type RateEntry = { count: number; resetAt: number };
const authRateLimits = new Map<string, RateEntry>();

function authRateLimited(ip: string, key: string, limit: number, windowMs: number): boolean {
  const mapKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = authRateLimits.get(mapKey);
  if (!entry || now > entry.resetAt) {
    authRateLimits.set(mapKey, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Trim stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authRateLimits) {
    if (now > v.resetAt) authRateLimits.delete(k);
  }
}, 15 * 60_000).unref();

// --- Auth Endpoints ---

router.post("/register", async (req, res) => {
  // Rate limit: 5 registrations per 10 minutes per IP
  const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (authRateLimited(clientIp, 'register', 5, 10 * 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
  }

  try {
    const { email, firstName: rawFirstName, lastName: rawLastName, company: rawCompany, jobTitle, companyContext, userContext, apiUse, intent, referralGraph, isProfessionalServices, promoTag } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const firstName = rawFirstName || normalizedEmail.split('@')[0];
    const lastName = rawLastName || '';
    const company = rawCompany || normalizedEmail;

    // Accept referralGraph as-is (single slug or comma-separated list like "psfk-retail,juan-isaza")
    const accountVertical = referralGraph ? referralGraph.toLowerCase().trim() : 'all';

    const existingUser = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      return res.status(409).json({ ok: false, error: "User already exists. Please log in." });
    }


    const freePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
    const freePlanRecord = freePlanQuery.records?.[0];
    const freePlanId = freePlanRecord?.id;

    const fullName = `${firstName} ${lastName}`;
    const baseHandle = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    let accountId: string;
    let finalAccountFields: any;
    let isNewAccount = false;
    let apiKeyForEmail = "";
    const existingAccountQuery = await queryAirtable(ACCOUNTS_TABLE, `{Account Name} = '${escapeAirtableString(company)}'`);
    const existingAccountCursor = existingAccountQuery.records?.[0];

    if (existingAccountCursor) {
      accountId = existingAccountCursor.id;
      finalAccountFields = existingAccountCursor.fields;
      try {
        const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
        if (keysQuery.records && keysQuery.records.length > 0) {
          apiKeyForEmail = keysQuery.records[0].fields['API Key'] as string;
        }
      } catch (e) {
        console.error("Failed to fetch API key for existing account:", e);
      }
    } else {
      isNewAccount = true;
      const todayISO = new Date().toISOString().split('T')[0];
      const accountFields: any = {
        "Account Name": company,
        "legalName": company,
        "signupCode": randomBytes(4).toString('hex').toUpperCase(),
        "accountContext": companyContext || "", // Store raw initially for speed
        "vertical": accountVertical,
        "lastPaidDate": todayISO,
        "lastAmountPaid": 0,
        "Is Professional Services": !!isProfessionalServices,
        "accountStatus": "active"
      };
      if (freePlanId) accountFields["Plan"] = [freePlanId];
      const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
      accountId = accountRecord.records[0].id;
      finalAccountFields = accountFields;

      const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
      apiKeyForEmail = apiKeyString;
      await createAirtableRecord(API_KEYS_TABLE, {
        "API Key": apiKeyString,
        "API Key Status": "Active",
        "Account": [accountId]
      });
    }

    // Skills default to OFF for new users — opt-in only
    const DEFAULT_DISABLED_SKILLS = 'Igloo,paralogy';
    const userRole = isNewAccount ? "Owner" : "Employee";
    const userFields = {
      "User Name": uniqueHandle,
      "First Name": firstName,
      "Last Name": lastName,
      "User Full Name": fullName,
      "email": normalizedEmail,
      "Job Title": jobTitle || "",
      "Role": userRole,
      "Account": [accountId],
      "userContext": userContext || "", // Store raw initially for speed
      "emailConfirmed": false,
      "apiUse": apiUse,
      "onboardingIntent": intent,
      "Company": company,
    };
    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // Skills default to OFF — set via update to avoid typecast linked-record issues on create
    updateAirtableRecord(USERS_TABLE, userId, { "disabledGraphs": DEFAULT_DISABLED_SKILLS }).catch(e => console.error('[Auth] Failed to set default disabled skills:', e));

    if (isNewAccount) {
      await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });
    }

    // --- Fire-and-forget Context Refinement in Background ---
    // Finding 1: always use server-side GEMINI_API_KEY — never accept a caller-supplied key
    (async () => {
      try {
        const [refinedCompanyContext, refinedUserContext] = await Promise.all([
          companyContext ? rewriteContext(companyContext, 'company') : Promise.resolve(""),
          userContext ? rewriteContext(userContext, 'user') : Promise.resolve("")
        ]);
        if (refinedCompanyContext && isNewAccount) {
          await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "accountContext": refinedCompanyContext });
        }
        if (refinedUserContext) {
          await updateAirtableRecord(USERS_TABLE, userId, { "userContext": refinedUserContext });
        }
      } catch (e) {
        console.error("[Background Context Refinement] Failed:", e);
      }
    })();

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(normalizedEmail)}`;
    sendSystemEmail('SIGNUP_CONFIRMATION', normalizedEmail, { name: firstName, confirmationLink, intent: intent || 'account' }).catch(e => console.error("Failed to send confirmation email:", e));

    // Add to Streak CRM in 'Email Not Confirmed' stage
    addToStreakPipeline(normalizedEmail, fullName, company, 'Email Not Confirmed', promoTag, { airtableId: userId }).catch(e => console.error("[Streak] Initial sync failed:", e));

    res.json({
      ok: true,
      user: { id: userId, signupDate: new Date().toLocaleDateString(), ...userFields },
      account: { id: accountId, ...finalAccountFields }
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/join", async (req, res) => {
  // Rate limit: 10 joins per 10 minutes per IP
  const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (authRateLimited(clientIp, 'join', 10, 10 * 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
  }

  try {
    const { email, firstName, lastName, signupCode, jobTitle, userContext } = req.body;
    if (!email || !firstName || !lastName || !signupCode) return res.status(400).json({ ok: false, error: "Missing required fields." });

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
    if (existingUser.records && existingUser.records.length > 0) return res.status(409).json({ ok: false, error: "User already exists. Please log in." });

    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{signupCode} = '${escapeAirtableString(signupCode)}'`);
    const accountRecord = accountQuery.records?.[0];
    if (!accountRecord) return res.status(404).json({ ok: false, error: "Invalid Signup Code." });

    // --- Domain Validation ---
    const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'live.com', 'msn.com', 'me.com', 'gmx.com'];
    const joinerDomain = normalizedEmail.split('@')[1];
    
    if (!joinerDomain) return res.status(400).json({ ok: false, error: "Invalid email address." });
    
    if (FREE_EMAIL_DOMAINS.includes(joinerDomain)) {
      return res.status(400).json({ ok: false, error: "Please use your work email to join a team. Free email providers (Gmail, Yahoo, etc.) are not allowed for team members." });
    }

    // Check domain matches account owner
    const ownerIds = accountRecord.fields['Account Owner'] as string[];
    if (ownerIds && ownerIds[0]) {
      const ownerRecordQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(ownerIds[0])}'`);
      const ownerRecord = ownerRecordQuery.records?.[0];
      if (ownerRecord) {
        const ownerEmail = (ownerRecord.fields?.email || ownerRecord.fields?.Email || '') as string;
        const ownerDomain = ownerEmail.split('@')[1]?.toLowerCase();
        // Only enforce domain match if owner has a non-free domain
        if (ownerDomain && !FREE_EMAIL_DOMAINS.includes(ownerDomain) && joinerDomain !== ownerDomain) {
          return res.status(400).json({ ok: false, error: `Team members must use a @${ownerDomain} email address to join this account.` });
        }
      }
    }

    const fullName = `${firstName} ${lastName}`;
    const baseHandle = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    // Finding 1: always use server-side GEMINI_API_KEY — never accept a caller-supplied key
    const refinedUserContext = userContext ? await rewriteContext(userContext, 'user') : "";

    const userFields = {
      "User Name": uniqueHandle,
      "First Name": firstName,
      "Last Name": lastName,
      "User Full Name": fullName,
      "email": normalizedEmail,
      "Job Title": jobTitle || "",
      "Role": "Employee",
      "Account": [accountRecord.id],
      "userContext": refinedUserContext,
      "emailConfirmed": false,
    };

    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);

    // Skills default to OFF — set via update to avoid typecast linked-record issues on create
    updateAirtableRecord(USERS_TABLE, userRecord.records[0].id, { "disabledGraphs": "Igloo,paralogy" }).catch(e => console.error('[Auth] Failed to set default disabled skills:', e));
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(normalizedEmail)}`;
    
    // Notify Admin
    queryAirtable(USERS_TABLE, `AND({Account} = '${escapeAirtableString(accountRecord.id)}', OR({Role} = 'Owner', {Role} = 'Admin'))`).then(q => {
      const admins = q.records || [];
      for (const admin of admins) {
        const adminEmail = (admin.fields.email || admin.fields.Email) as string;
        if (adminEmail && adminEmail !== normalizedEmail) {
          sendSystemEmail('NEW_USER_JOINED', adminEmail, {
            newUserName: fullName, newUserEmail: normalizedEmail, newUserRole: "Employee",
            accountName: accountRecord.fields['Account Name'] || 'your team', portalLink: baseUrl
          }).catch(e => console.error(`[Join] Failed to notify admin ${adminEmail}:`, e));
        }
      }
    }).catch(e => console.error("[Join] Failed to notify admins:", e));

    sendSystemEmail('SIGNUP_CONFIRMATION', normalizedEmail, { name: firstName, confirmationLink }).catch(e => console.error("Failed to send confirmation email:", e));

    res.json({
      ok: true,
      user: { id: userRecord.records[0].id, signupDate: new Date().toLocaleDateString(), ...userFields },
      account: { id: accountRecord.id, ...accountRecord.fields }
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/confirm", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).send("Invalid link");
    const normalizedEmail = email.toLowerCase().trim();

    const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      console.error("[Auth] Confirm: user not found for email:", normalizedEmail);
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      return res.redirect(`${baseUrl}/?email=${encodeURIComponent(normalizedEmail)}`);
    }

    const wasAlreadyConfirmed = !!userRecord.fields["emailConfirmed"];
    await updateAirtableRecord(USERS_TABLE, userRecord.id, { "emailConfirmed": true });

    // ── Activate Pending API keys ────────────────────────────────────
    // Website-provisioned Base accounts start with 'Pending' keys.
    // Confirming email activates them so the user can make API calls.
    const confirmAccountIds: string[] = userRecord.fields.Account || [];
    if (confirmAccountIds[0]) {
      try {
        const pendingKeys = await queryAirtable(API_KEYS_TABLE,
          `AND({Account} = '${escapeAirtableString(confirmAccountIds[0])}', {API Key Status} = 'Pending')`
        );
        for (const keyRec of (pendingKeys.records || [])) {
          await updateAirtableRecord(API_KEYS_TABLE, keyRec.id, {
            "API Key Status": "Active"
          });
          console.log(`[Auth] Activated pending API key ${keyRec.id} for account ${confirmAccountIds[0]}`);
        }
      } catch (keyErr) {
        console.error('[Auth] Failed to activate pending keys:', keyErr);
      }
    }


    if (!wasAlreadyConfirmed) {
      const confirmedUserId = userRecord.id;
      const uf = userRecord.fields;
      enrichUserBuyerType(normalizedEmail, String(uf['First Name'] || ''), String(uf['Last Name'] || ''), '', updateAirtableRecord, USERS_TABLE, confirmedUserId).catch(e => console.error('[Enrichment] Failed:', e));
      
      const fullName = `${uf['First Name']} ${uf['Last Name']}`.trim();
      const company = String(uf['Company'] || '');
      addToStreakPipeline(normalizedEmail, fullName, company, STAGE_SELF_DEMO, undefined, { airtableId: confirmedUserId }).catch(e => console.error('[Streak] Promotion failed:', e));

      // Schedule onboarding
      setTimeout(async () => {
        try {
          const freshUser = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(confirmedUserId)}'`);
          const fuf = freshUser.records?.[0]?.fields || {};
          const accountIds: string[] = fuf.Account || [];
          let graphSlug = 'default';
          let devMcpUrl: string | undefined;
          if (accountIds[0]) {
            const acct = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
            const acctFields = acct.records?.[0]?.fields || {};
            graphSlug = String(acctFields.vertical || 'default').toLowerCase();
            
            try {
              const devConn = await buildMcpConnection(normalizedEmail);
              if (devConn.ok && devConn.mcpUrl) devMcpUrl = devConn.mcpUrl;
            } catch (e) {
              console.error("Failed to build MCP connection for onboarding email:", e);
            }

            if (fuf.buyer_type === 'AI Startup/Developer') {
              await sendSystemEmail('DEVELOPER_ONBOARDING', normalizedEmail, { firstName: uf['First Name'], mcpUrl: devMcpUrl });
            } else {
              const candidates = selectPrompts(graphSlug, fuf.buyer_type || 'Unknown', fuf.buyer_industry || '', 10);
              const { prompts } = await validateAndSelectPrompts(candidates, graphSlug, normalizedEmail, sendSystemEmail) as any;
              const finalPrompts = prompts.length >= 3 ? prompts : candidates.slice(0, 5);

              // Contextual Onboarding
              const accountType = detectAccountType(acctFields);
            if (accountType === 'client') {
              await sendSystemEmail('CLIENT_WELCOME_PROMPTS', normalizedEmail, { 
                firstName: uf['First Name'], 
                graphId: graphSlug, 
                buyerType: fuf.buyer_type || 'Unknown', 
                buyerIndustry: fuf.buyer_industry || '', 
                prompts: finalPrompts 
              }, { cc: ['team@fodda.ai'] });
            } else {
              await sendSystemEmail('ONBOARDING_PROMPTS', normalizedEmail, { 
                firstName: uf['First Name'], 
                graphId: graphSlug, 
                buyerType: fuf.buyer_type || 'Unknown', 
                buyerIndustry: fuf.buyer_industry || '', 
                prompts: finalPrompts 
              });
              }
            }
          }
        } catch (e) { console.error('[Onboarding] Failed:', e); }
      }, 5 * 60 * 1000);
    }

    const loginToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await updateAirtableRecord(USERS_TABLE, userRecord.id, { "loginToken": loginToken, "loginTokenExpires": expiresAt });

    // ── OAuth / Custom redirect support ──────────────────────────────
    const redirectParam = (req.query.redirect as string) || (req.query.redirect_url as string);
    if (redirectParam && isValidRedirectUrl(redirectParam)) {
      const isInternal = isInternalAppUrl(redirectParam);
      if (isInternal) {
        // Internal app path on app.fodda.ai: safe to append login token
        const separator = redirectParam.includes('?') ? '&' : '?';
        return res.redirect(`${redirectParam}${separator}confirmed=true&token=${loginToken}`);
      } else {
        // External allowlisted destination (e.g. Clerk OAuth continue URL):
        // Redirect WITHOUT appending the internal login token (prevents token leakage)
        return res.redirect(redirectParam);
      }
    }

    // ── Intent-based redirect ────────────────────────────────────────
    const onboardingIntent = userRecord.fields.onboardingIntent || 'api';
    const dashboardBase = 'https://app.fodda.ai';

    switch (onboardingIntent) {
      case 'claude':
        return res.redirect(`${dashboardBase}/dashboard?tab=claude&confirmed=true&token=${loginToken}`);
      case 'app':
        return res.redirect(`${dashboardBase}/sandbox?confirmed=true&token=${loginToken}`);
      case 'trial':
        // Legacy trial confirm — trials don't normally require confirmation
        return res.redirect(`${dashboardBase}/?token=${loginToken}`);
      case 'api':
      default:
        return res.redirect(`${dashboardBase}/dashboard?tab=api&confirmed=true&token=${loginToken}`);
    }
  } catch (err: any) {
    console.error("[Auth] Confirmation failed for:", req.query.email, err?.message || err);
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    // Redirect back to the app with the email pre-filled so they can re-register or sign in
    const email = req.query.email as string || '';
    const normalizedEmail = email.toLowerCase().trim();
    const redirectParam = (req.query.redirect as string) || (req.query.redirect_url as string);
    const validRedirect = isValidRedirectUrl(redirectParam) ? redirectParam : '';
    const redirectQuery = validRedirect ? `&redirect_url=${encodeURIComponent(validRedirect)}` : '';
    res.redirect(`${baseUrl}/?email=${encodeURIComponent(normalizedEmail)}${redirectQuery}`);
  }
});

// NOTE: Old /login, /resend-confirmation, /verify, /validate-session endpoints removed.
// Authentication is now handled entirely via Clerk (email links + sign-in tokens).
// Session management uses Clerk JWTs, not Airtable loginToken/sessionToken fields.

// Clerk Sign-In Fallback: Check if user exists in Airtable (for seamless auto-registration)
router.post("/check-user", async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    if (authRateLimited(ip, 'check-user', 10, 10 * 60 * 1000)) {
      return res.status(429).json({ ok: false, error: 'Rate limited' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

    const normalizedEmail = email.toLowerCase().trim();
    const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      return res.json({ ok: true, exists: false });
    }

    const userData = userRecord.fields;
    res.json({
      ok: true,
      exists: true,
      firstName: userData['First Name'] || '',
      lastName: userData['Last Name'] || '',
      company: userData['Company'] || '',
      jobTitle: userData['Job Title'] || userData.jobTitle || '',
      apiUse: userData.apiUse || '',
      intent: userData.onboardingIntent || 'account'
    });
  } catch (err: any) {
    console.error('[AuthRouter] check-user failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/auth/patch-oauth-metadata
 *
 * Called by SsoCallbackPage after a successful OAuth sign-in to backfill
 * company, job title, and apiUse on the Airtable User and Account records.
 *
 * OAuth redirects don't carry unsafeMetadata like the email sign-up form does,
 * so the Clerk webhook fires with empty company / jobTitle. This endpoint lets
 * the frontend patch those fields immediately after the redirect completes.
 *
 * Auth: requires a valid Clerk session (JWT in Authorization header).
 */
router.patch('/patch-oauth-metadata', requireAuth(), async (req: any, res) => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { company: rawCompany, jobTitle, apiUse } = req.body;
    if (!rawCompany || !jobTitle) {
      return res.status(400).json({ ok: false, error: 'company and jobTitle are required' });
    }

    const company = String(rawCompany).trim();
    const normalizedJobTitle = String(jobTitle).trim();
    const normalizedApiUse = String(apiUse || 'Mainly Claude').trim();

    // Find the user record by clerkUserId
    const userQuery = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      console.warn(`[AuthRouter] patch-oauth-metadata: no Airtable user found for clerkUserId ${clerkUserId}`);
      return res.status(404).json({ ok: false, error: 'User record not found. It may still be syncing — try again in a moment.' });
    }

    // Update User record
    await updateAirtableRecord(USERS_TABLE, userRecord.id, {
      'Job Title': normalizedJobTitle,
      'Company': company,
      'apiUse': normalizedApiUse,
    });

    // If the user's Account has a placeholder name (email domain or default),
    // update it to the real company name.
    const accountIds: string[] = userRecord.fields.Account || [];
    if (accountIds[0]) {
      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
      const accountRecord = accountQuery.records?.[0];
      if (accountRecord) {
        const existingName = String(accountRecord.fields['Account Name'] || '');
        // Only overwrite if current name looks like an auto-generated placeholder
        // (email domain, "Default Company", or a bare email address)
        const looksLikePlaceholder =
          existingName === 'Default Company' ||
          existingName.includes('@') ||
          /^[a-z0-9.-]+\.[a-z]{2,}$/.test(existingName.toLowerCase());

        if (looksLikePlaceholder) {
          await updateAirtableRecord(ACCOUNTS_TABLE, accountIds[0], {
            'Account Name': company,
            'legalName': company,
          });
          console.log(`[AuthRouter] patch-oauth-metadata: updated Account name to "${company}" for ${clerkUserId}`);
        }
      }
    }

    console.log(`[AuthRouter] patch-oauth-metadata: patched user ${userRecord.id} for ${clerkUserId}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[AuthRouter] patch-oauth-metadata failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


router.get("/profile", async (req: any, res) => {
  try {
    const clerkAuth = req.auth;
    console.log("[AuthRouter] GET /profile - req.auth status:", {
      exists: !!clerkAuth,
      userId: clerkAuth?.userId,
      sessionId: clerkAuth?.sessionId,
      claims: clerkAuth?.sessionClaims,
      orgId: clerkAuth?.orgId,
      debug: clerkAuth ? Object.keys(clerkAuth) : 'null'
    });

    let clerkUserId = clerkAuth?.userId;
    let claimsEmail = clerkAuth?.sessionClaims?.email;
    let clerkSessionId: string | undefined = clerkAuth?.sessionId;

    // Fallback: if Clerk middleware didn't resolve userId, verify JWT locally
    if (!clerkUserId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (process.env.CLERK_JWT_KEY) {
              const { createVerify } = await import('crypto');
              const signature = Buffer.from(parts[2], 'base64url');
              const dataToVerify = parts[0] + '.' + parts[1];
              const verifier = createVerify('RSA-SHA256');
              verifier.update(dataToVerify);
              const pem = process.env.CLERK_JWT_KEY.replace(/\\n/g, '\n');
              const isValid = verifier.verify(pem, signature);
              if (isValid) {
                console.log(`[AuthRouter] JWT fallback verification SUCCESS. User: ${payload.sub}`);
                clerkUserId = payload.sub;
                claimsEmail = payload.email || payload.sessionClaims?.email;
                clerkSessionId = clerkSessionId || payload.sid;
              } else {
                console.warn(`[AuthRouter] JWT fallback verification FAILED: signature mismatch`);
              }
            }
          }
        } catch (verifErr: any) {
          console.error(`[AuthRouter] JWT fallback error:`, verifErr.message);
        }
      }
    }

    if (!clerkUserId) {
      return res.status(401).json({ 
        ok: false, 
        error: "Unauthorized - Clerk user ID not resolved from session token",
        authExists: !!clerkAuth,
        debugKeys: clerkAuth ? Object.keys(clerkAuth) : []
      });
    }

    // Look up user by clerkUserId in Airtable
    let userQuery = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`);
    let userRecord = userQuery.records?.[0];

    // Fallback: If not found by clerkUserId, look up by token's email if available, or query Clerk API
    if (!userRecord) {
      let email = claimsEmail ? String(claimsEmail).toLowerCase().trim() : null;
      
      if (!email) {
        try {
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          email = clerkUser.emailAddresses[0]?.emailAddress || null;
        } catch (clerkErr) {
          console.error("[AuthRouter] Failed to fetch user from Clerk Client:", clerkErr);
        }
      }

      if (email) {
        const normalizedEmail = String(email).toLowerCase().trim();
        console.log(`[AuthRouter] Fallback lookup by email: ${normalizedEmail}`);
        const userByEmailQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
        userRecord = userByEmailQuery.records?.[0];
        if (userRecord) {
          // Link the clerkUserId immediately for future lookups and confirm email
          await updateAirtableRecord(USERS_TABLE, userRecord.id, { 
            clerkUserId,
            emailConfirmed: true // Clerk session is verified
          });
          console.log(`[AuthRouter] Linked clerkUserId ${clerkUserId} to user ${normalizedEmail} and confirmed email`);

          // Activate pending keys since Clerk session is active and verified
          const confirmAccountIds: string[] = userRecord.fields.Account || [];
          if (confirmAccountIds[0]) {
            try {
              const pendingKeys = await queryAirtable(API_KEYS_TABLE,
                `AND({Account} = '${escapeAirtableString(confirmAccountIds[0])}', {API Key Status} = 'Pending')`
              );
              for (const keyRec of (pendingKeys.records || [])) {
                await updateAirtableRecord(API_KEYS_TABLE, keyRec.id, {
                  "API Key Status": "Active"
                });
                console.log(`[AuthRouter] Activated pending API key ${keyRec.id} for account ${confirmAccountIds[0]} via profile fallback`);
              }
            } catch (keyErr) {
              console.error('[AuthRouter] Failed to activate pending keys via profile fallback:', keyErr);
            }
          }
        }
      }
    }

    if (!userRecord) {
      console.warn(`[AuthRouter] User profile not found for clerkUserId: ${clerkUserId}`);
      return res.status(404).json({ ok: false, error: "Profile not created in Airtable yet. Please wait a moment for sync." });
    }

    const userData = userRecord.fields;
    let accountIdLink = (userData.Account && userData.Account.length > 0) ? userData.Account[0] : null;
    let accountData: any = {};
    if (accountIdLink) {
      accountData = await (async () => {
        try {
          const accRes = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIdLink)}'`);
          const accRec = accRes.records?.[0];
          if (!accRec) return { id: accountIdLink };
          const baseAccount = { id: accRec.id, ...accRec.fields };
          const planIdLink = baseAccount.Plan ? baseAccount.Plan[0] : null;
          if (planIdLink) {
            const planRecRes = await queryAirtable(PLANS_TABLE, `RECORD_ID() = '${escapeAirtableString(planIdLink)}'`);
            const planRec = planRecRes.records?.[0];
            if (planRec) {
              return { 
                ...baseAccount, 
                fetchedPlanName: planRec.fields['Package Name'] || planRec.fields.Name || 'Custom', 
                fetchedPlanCode: Number(planRec.fields['planCode']) || baseAccount.planCode || 0, 
                fetchedMonthlyQueryLimit: planRec.fields['Monthly API Limit'] || extractNumericLimit(baseAccount, 10), 
                fetchedIncludesPublicApis: planRec.fields['Includes Public APIs?'] || false 
              };
            }
          }
          return baseAccount;
        } catch (e) { return { id: accountIdLink }; }
      })();
    }

    const user = { 
      id: userRecord.id, 
      email: userData.email || userData.Email, 
      name: `${userData['First Name'] || ''} ${userData['Last Name'] || ''}`.trim(), 
      role: userData.Role || 'User', 
      accountId: accountData.id, 
      userContext: userData.userContext || '', 
      company: accountData.name || '', 
      planName: accountData.fetchedPlanName || 'Free', 
      disabledGraphs: userData.disabledGraphs || '', 
      apiUse: userData.apiUse || '', 
      onboardingIntent: userData.onboardingIntent || '', 
      firstName: userData['First Name'] || '', 
      lastName: userData['Last Name'] || '', 
      jobTitle: userData.jobTitle || '', 
      currentPersonaText: userData.current_persona_text || '', 
      confirmedPersonaText: userData.confirmed_persona_text || '', 
      personaConfirmed: !!userData.persona_confirmed, 
      interestsCurrent: userData.interests_current || '', 
      topEngagementDomains: userData.top_engagement_domains || '', 
      confirmedExpertiseDomains: userData.confirmed_expertise_domains || '', 
      shareContextInSessions: !userData.share_context_disabled,
      monthlyQueries: userData.apiUseCount || userData.monthlyQueries || 0,
      lastLogin: userData.lastLogin || null,
      isExpert: !!userData.isExpert,
      analystId: userData.analystId || ''
    };
    
    const account = { 
      id: accountData.id, 
      name: accountData['Account Name'] || 'Unknown', 
      apiKey: extractRealValue(userData['apiKey']) || extractRealValue(accountData['apiKey']) || '', 
      monthlyQueryLimit: accountData.fetchedMonthlyQueryLimit || 10,
      // currentQueryCount = usage in the CURRENT billing cycle (resettable), NOT the
      // lifetime rollup. `monthlyQueries` is an Airtable rollup that accumulates for the
      // life of the account and can never be reset, so it must not be shown as "this month".
      // See queriesUsedThisCycle (reset by /cron/monthly-reset + Stripe renewal webhook).
      currentQueryCount: Number(accountData.queriesUsedThisCycle || 0),
      lifetimeQueries: Number(accountData.lifetimeQueries || accountData.monthlyQueries || accountData.monthlyQuerytotal || accountData.totalQueries || 0),
      totalQueries: Math.max(Number(accountData.lifetimeQueries || accountData.monthlyQueries || accountData.monthlyQuerytotal || accountData.totalQueries || 0), Number(accountData.queriesUsedThisCycle || 0)),
      stripeCustomerId: accountData.stripeCustomerId || '',
      subscriptionStatus: accountData.subscriptionStatus || 'none', 
      planName: accountData.fetchedPlanName || 'Free', 
      planCode: accountData.fetchedPlanCode || 0, 
      accountContext: accountData.accountContext || '', 
      currentAccountPersonaText: accountData.current_account_persona_text || '', 
      confirmedAccountPersonaText: accountData.confirmed_account_persona_text || '', 
      accountPersonaConfirmed: !!accountData.account_persona_confirmed, 
      teamInterestsCurrent: accountData.team_interests_current || '', 
      teamEngagementDomains: accountData.team_engagement_domains || '', 
      activeKnowledgeDomains: accountData.active_knowledge_domains || '', 
      shareAccountContextInSessions: !accountData.share_account_context_disabled,
      clerkOrgId: accountData.clerkOrgId || '',
      signupCode: accountData.signupCode || '',
      autoProvisionToggle: !!accountData.autoProvisionToggle,
      autoProvisionDomain: accountData.autoProvisionDomain || ''
    };

    // Compute isFirstLogin and stamp lastLogin on first access
    const isFirstLogin = !userData.lastLogin;
    if (isFirstLogin) {
      updateAirtableRecord(USERS_TABLE, userRecord.id, { lastLogin: new Date().toISOString() })
        .catch(e => console.error('[AuthRouter] Failed to stamp firstLogin:', e));
    }

    // ── Distinct-login tracking ──────────────────────────────────────────────
    // "Login" = a new Clerk session, NOT a profile fetch. The Clerk session id is
    // stable across page reloads within a session and changes on each new sign-in,
    // so counting distinct session ids counts genuine logins rather than app-opens.
    const prevSessionId = userData.lastSessionId;
    const isNewLogin = !!clerkSessionId && clerkSessionId !== prevSessionId;
    let loginCount = Number(userData.loginCount) || 0;
    if (isNewLogin) {
      loginCount += 1;
      updateAirtableRecord(USERS_TABLE, userRecord.id, { loginCount, lastSessionId: clerkSessionId })
        .catch(e => console.error('[AuthRouter] Failed to update loginCount/lastSessionId:', e));
    }

    // Schedule agent payment nudge email on the user's SECOND distinct login, once ever.
    // By the second login, expert detection from the first login has already
    // set isExpert/analystId, so experts are properly excluded.
    //
    // HARD GUARD — this is an ONBOARDING email, so only genuinely NEW accounts may
    // ever receive it. An established account (e.g. months old) must never be
    // nudged, regardless of login count or whether loginCount/paymentNudgeSent were
    // backfilled. This check is read-only against the record's immutable Airtable
    // creation time, so it holds even if those flag writes fail. Fail-closed: if we
    // can't determine the age, treat the account as old and do NOT nudge.
    const NUDGE_MAX_AGE_DAYS = 14;
    const createdMs = userRecord.createdTime ? new Date(userRecord.createdTime).getTime() : NaN;
    const accountAgeDays = Number.isFinite(createdMs)
      ? (Date.now() - createdMs) / (1000 * 60 * 60 * 24)
      : Infinity;
    const isNewAccount = accountAgeDays <= NUDGE_MAX_AGE_DAYS;

    // Env kill-switch — set DISABLE_AGENT_PAYMENT_NUDGE=true to stop all nudges
    // instantly via config, no code deploy needed.
    const nudgeDisabled = process.env.DISABLE_AGENT_PAYMENT_NUDGE === 'true';

    const isExpert = userData.isExpert || userData.analystId;
    const alreadyNudged = userData.paymentNudgeSent;
    if (!nudgeDisabled && isNewAccount && isNewLogin && loginCount === 2 && !isExpert && !alreadyNudged) {
      const scheduledAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const ownerEmail = (userData.email || userData.Email) as string;
      if (ownerEmail) {
        // Mark as nudged BEFORE scheduling, and await it so rapid *sequential*
        // session calls observe the flag and skip re-scheduling. Note: userData
        // was read at the top of this handler, so truly *concurrent* calls can
        // both still pass the guard above — the Resend idempotency key below is
        // what guarantees at most one email actually goes out.
        await updateAirtableRecord(USERS_TABLE, userRecord.id, { paymentNudgeSent: true })
          .catch(e => console.error('[AuthRouter] Failed to stamp paymentNudgeSent:', e));

        (async () => {
          let setupUrl: string | undefined;
          try {
            const { generateSetupUrl } = await import('../services/stripeOverageService.js');
            setupUrl = await generateSetupUrl(ownerEmail, accountData.id);
          } catch (e) { /* non-critical */ }

          sendSystemEmail('AGENT_PAYMENT_NUDGE', ownerEmail, {
            name: userData['First Name'] || 'there',
            setupUrl,
          }, { scheduledAt, idempotencyKey: `agent-nudge-${userRecord.id}` }).catch(e => console.error('[AuthRouter] Agent payment nudge failed:', e));
        })();
        console.log(`[AuthRouter] Scheduled agent payment nudge for ${ownerEmail} (login #${loginCount}) at ${scheduledAt}`);
      }
    }

    // ── One-time Expert detection ──────────────────────────────────────────────
    // Runs for ANY user whose isExpert flag hasn't been set yet.
    // Uses the 'Linked to' linked-record field on the Analyst record (CE base)
    // which links directly to this user's record ID — far more reliable than
    // email matching. Once checked, result is cached so future logins skip it.
    if (userData.isExpert === undefined && !userData.analystId) {
      const userId = userRecord.id;
      (async () => {
        try {
          const { queryAirtableCE } = await import('../db.js');
          // FIND on ARRAYJOIN handles both single and multi-linked records
          const analystRes = await queryAirtableCE(
            CE_ANALYSTS_TABLE,
            `FIND('${escapeAirtableString(userId)}', ARRAYJOIN({Linked to})) > 0`,
            'fields%5B%5D=Analyst+ID&fields%5B%5D=Linked+to&maxRecords=1'
          );
          const analystRec = analystRes.records?.[0];
          if (analystRec) {
            const analystId = String(analystRec.fields['Analyst ID'] || analystRec.id || '');
            await updateAirtableRecord(USERS_TABLE, userId, { isExpert: true, analystId });
            console.log(`[AuthRouter] Expert detected via linked record: ${userId} → ${analystId}`);
          } else {
            // Mark as checked-not-an-expert so future logins skip this lookup
            await updateAirtableRecord(USERS_TABLE, userId, { isExpert: false });
          }
        } catch (expertErr: any) {
          console.error('[AuthRouter] Expert detection failed (non-critical):', expertErr.message);
        }
      })();
    }

    res.json({ ok: true, user, account, isFirstLogin });
  } catch (err: any) {
    console.error("[AuthRouter] Profile fetch failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
