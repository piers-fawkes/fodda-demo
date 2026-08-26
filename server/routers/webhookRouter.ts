import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { randomBytes } from 'crypto';
import { 
  queryAirtable, 
  createAirtableRecord, 
  updateAirtableRecord, 
  escapeAirtableString
} from '../db.js';
import { 
  USERS_TABLE, 
  ACCOUNTS_TABLE, 
  PLANS_TABLE, 
  API_KEYS_TABLE 
} from '../constants.js';
import { 
  rewriteContext
} from '../helpers.js';
import { sendSystemEmail } from '../services/emailService.js';
import { buildMcpConnection } from '../services/mcpConnectionService.js';
import { addToStreakPipeline, STAGE_SELF_DEMO, STAGE_SELF_EXPERT } from '../services/streakService.js';

const router = Router();

// Clerk Webhook Secret (needs to be configured in Clerk Dashboard and local env)
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || '';

/**
 * Helper to provision a new user in Airtable when created in Clerk.
 * Replicates the onboarding logic from Fodda's standard registration route.
 */
async function provisionUserFromClerk(
  clerkUserId: string,
  email: string,
  firstName: string,
  lastName: string,
  companyName: string,
  jobTitle: string = '',
  apiUse: string = '',
  intent: string = 'account',
  referralGraph: string = 'all',
  isProfessionalServices: boolean = false,
  signupCode: string = ''
) {
  const normalizedEmail = email.toLowerCase().trim();
  const todayISO = new Date().toISOString().split('T')[0];
  const company = companyName || normalizedEmail;

  console.log(`[Clerk Webhook] Provisioning user: ${normalizedEmail} (Company: ${company}, Intent: ${intent})`);

  // 1. Fetch the Plan based on signup intent (Trial plan 13 if intent is demo/trial, fallback to Base - Free plan 2)
  let planId: string | undefined;
  try {
    const targetPlanCode = (intent === 'demo' || intent === 'trial' || apiUse === 'Self-Demo') ? 13 : 2;
    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = ${targetPlanCode}`);
    planId = planQuery.records?.[0]?.id;
  } catch (e) {
    console.error(`[Clerk Webhook] Failed to fetch plan ID for intent ${intent}:`, e);
  }

  // 2. Generate a unique User Name handle
  const fullName = `${firstName} ${lastName}`.trim();
  const baseHandle = fullName.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  let uniqueHandle = baseHandle;
  let counter = 1;
  let isUnique = false;
  while (!isUnique && counter < 20) {
    const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
    if (!handleCk.records || handleCk.records.length === 0) {
      isUnique = true;
    } else {
      uniqueHandle = `${baseHandle}${counter}`;
      counter++;
    }
  }
  if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

  // 3. Find or create Account
  let accountId: string;
  let isNewAccount = false;
  let apiKeyForEmail = "";

  let existingAccountRecord;
  if (signupCode) {
    const codeQuery = await queryAirtable(ACCOUNTS_TABLE, `{signupCode} = '${escapeAirtableString(signupCode.toUpperCase().trim())}'`);
    existingAccountRecord = codeQuery.records?.[0];
  }

  if (!existingAccountRecord) {
    const existingAccountQuery = await queryAirtable(ACCOUNTS_TABLE, `{Account Name} = '${escapeAirtableString(company)}'`);
    existingAccountRecord = existingAccountQuery.records?.[0];
  }

  if (existingAccountRecord) {
    accountId = existingAccountRecord.id;
    try {
      // Find active API key
      const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
      if (keysQuery.records && keysQuery.records.length > 0) {
        apiKeyForEmail = keysQuery.records[0].fields['API Key'] as string;
      }
    } catch (e) {
      console.error("[Clerk Webhook] Failed to fetch active API key for existing account:", e);
    }
  } else {
    isNewAccount = true;
    const accountFields: any = {
      "Account Name": company,
      "legalName": company,
      "signupCode": randomBytes(4).toString('hex').toUpperCase(),
      "accountContext": "",
      "vertical": referralGraph || "all",
      "lastPaidDate": todayISO,
      "lastAmountPaid": 0,
      "Is Professional Services": !!isProfessionalServices,
      "accountStatus": "active"
    };
    if (planId) accountFields["Plan"] = [planId];

    const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
    accountId = accountRecord.records[0].id;

    // Create API Key
    const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
    apiKeyForEmail = apiKeyString;
    await createAirtableRecord(API_KEYS_TABLE, {
      "API Key": apiKeyString,
      "API Key Status": "Active",
      "Account": [accountId]
    });
  }

  // 4. Create the User record in Airtable with clerkUserId
  const userFields = {
    "User Name": uniqueHandle,
    "First Name": firstName,
    "Last Name": lastName,
    "User Full Name": fullName,
    "email": normalizedEmail,
    "Role": isNewAccount ? "Owner" : "Employee",
    "Account": [accountId],
    "userContext": "",
    "emailConfirmed": true, // Clerk verified the email address
    "clerkUserId": clerkUserId,
    "Company": company,
    "Job Title": jobTitle || "",
    "apiUse": apiUse || "",
    "onboardingIntent": intent || "account"
  };

  const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
  const userId = userRecord.records[0].id;

  // Set default disabled skills (Igloo, paralogy)
  await updateAirtableRecord(USERS_TABLE, userId, { "disabledGraphs": "Igloo,paralogy" })
    .catch(e => console.error('[Clerk Webhook] Failed to set default disabled skills:', e));

  if (isNewAccount) {
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] })
      .catch(e => console.error('[Clerk Webhook] Failed to update account owner:', e));
  } else {
    // Notify the Account Owner that a new team member has joined
    try {
      const ownerIdLink = existingAccountRecord?.fields?.['Account Owner'];
      if (ownerIdLink && ownerIdLink.length > 0) {
        const ownerQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(ownerIdLink[0])}'`);
        const ownerRecord = ownerQuery.records?.[0];
        if (ownerRecord) {
          const ownerEmail = ownerRecord.fields.email || ownerRecord.fields.Email;
          if (ownerEmail && ownerEmail.toLowerCase() !== normalizedEmail) {
            sendSystemEmail('NEW_USER_JOINED', ownerEmail, {
              newUserName: fullName,
              newUserEmail: normalizedEmail,
              accountName: existingAccountRecord?.fields?.['Account Name'] || company,
              adminLink: 'https://app.fodda.ai/account/team'
            }).catch(e => console.error('[Clerk Webhook] Owner notification email failed:', e));
            console.log(`[Clerk Webhook] Notified owner ${ownerEmail} about new team member ${normalizedEmail}`);
          }
        }
      }
    } catch (e) {
      console.error('[Clerk Webhook] Failed to send owner notification:', e);
    }
  }

  // 5. Trigger onboarding welcome email (OAuth verified) - delayed 2 hours to avoid interrupting initial connector setup
  const OAUTH_WELCOME_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours
  setTimeout(async () => {
    try {
      const mcpConn = await buildMcpConnection(normalizedEmail).catch(() => null);
      await sendSystemEmail('OAUTH_WELCOME', normalizedEmail, { 
        name: firstName,
        level: 'Base',
        mcpUrl: mcpConn?.mcpUrl || undefined,
        claudeConnectorUrl: mcpConn?.claudeConnectorUrl || undefined,
        intent: intent || 'account' 
      });
      console.log(`[Clerk Webhook] Delayed welcome email dispatched to ${normalizedEmail}`);
    } catch (e) {
      console.error(`[Clerk Webhook] Delayed welcome email dispatch failed for ${normalizedEmail}:`, e);
    }
  }, OAUTH_WELCOME_DELAY_MS);

  // Add user to Streak pipeline — experts go to 'Fodda Experts', everyone else to 'Fodda Sales'
  if (intent === 'expert') {
    addToStreakPipeline(normalizedEmail, fullName, company, STAGE_SELF_EXPERT, undefined, { airtableId: userId }, 'Fodda Experts')
      .catch(e => console.error("[Clerk Webhook] Streak CRM sync failed:", e));
  } else {
    addToStreakPipeline(normalizedEmail, fullName, company, STAGE_SELF_DEMO, undefined, { airtableId: userId })
      .catch(e => console.error("[Clerk Webhook] Streak CRM sync failed:", e));
  }
}

// Webhook receiver endpoint
router.post('/clerk', async (req: Request, res: Response) => {
  console.log("[Clerk Webhook] Received webhook call");

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[Clerk Webhook] Missing svix headers. Rejecting request.");
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  // Verify signature if secret is configured (optional for local debugging but mandatory for production)
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (webhookSecret && webhookSecret !== "whsec_placeholder") {
    const payload = (req as any).rawBody || (req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body));
    const wh = new Webhook(webhookSecret);

    try {
      wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
      console.log("[Clerk Webhook] Signature verified successfully.");
    } catch (err: any) {
      console.error("[Clerk Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET is not configured. Rejecting request in production.");
      return res.status(500).json({ error: 'Webhook signature verification secret is not configured' });
    }
    console.warn("[Clerk Webhook] CLERK_WEBHOOK_SECRET is not set. Skipping signature verification (unsafe for production).");
  }

  // Raw body parse if needed, else standard req.body
  const payloadObj = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { type, data } = payloadObj;

  console.log(`[Clerk Webhook] Processing event type: ${type}`);

  try {
    if (type === 'user.created') {
      const clerkUserId = data.id;
      const email = data.email_addresses?.[0]?.email_address;
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';
      
      // Extract unsafe metadata sent from the frontend client
      const meta = data.unsafe_metadata || {};
      const company = meta.company || data.public_metadata?.company || email?.split('@')[1] || 'Default Company';
      const jobTitle = meta.jobTitle || '';
      const apiUse = meta.apiUse || '';
      const intent = meta.signupIntent || 'account';
      const referralGraph = meta.referralGraph || 'all';
      const isProfessionalServices = !!meta.isProfessionalServices;

      if (!email) {
        return res.status(400).json({ error: 'No email address found in user data' });
      }

      // Check if user already exists in Airtable (case-insensitive check)
      const existingUserQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(email.toLowerCase())}'`);
      const existingUser = existingUserQuery.records?.[0];

      if (existingUser) {
        console.log(`[Clerk Webhook] User ${email} already exists in Airtable. Linking clerkUserId.`);
        await updateAirtableRecord(USERS_TABLE, existingUser.id, { 
          clerkUserId: clerkUserId,
          emailConfirmed: true // Clerk emails are pre-verified
        });

        // Activate any pending API keys for the account since Clerk verified the email
        const confirmAccountIds: string[] = existingUser.fields.Account || [];
        if (confirmAccountIds[0]) {
          try {
            const pendingKeys = await queryAirtable(API_KEYS_TABLE,
              `AND({Account} = '${escapeAirtableString(confirmAccountIds[0])}', {API Key Status} = 'Pending')`
            );
            for (const keyRec of (pendingKeys.records || [])) {
              await updateAirtableRecord(API_KEYS_TABLE, keyRec.id, {
                "API Key Status": "Active"
              });
              console.log(`[Clerk Webhook] Activated pending API key ${keyRec.id} for account ${confirmAccountIds[0]}`);
            }
          } catch (keyErr) {
            console.error('[Clerk Webhook] Failed to activate pending keys:', keyErr);
          }
        }
      } else {
        // Provision a new user and account with complete onboarding inputs
        await provisionUserFromClerk(
          clerkUserId, 
          email, 
          firstName, 
          lastName, 
          company, 
          jobTitle, 
          apiUse, 
          intent, 
          referralGraph, 
          isProfessionalServices,
          meta.signupCode || ''
        );
      }
    } 
    else if (type === 'user.updated') {
      const clerkUserId = data.id;
      const email = data.email_addresses?.[0]?.email_address;
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';

      const userQuery = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`);
      const userRecord = userQuery.records?.[0];

      if (userRecord) {
        console.log(`[Clerk Webhook] Updating user details for clerkUserId: ${clerkUserId}`);
        await updateAirtableRecord(USERS_TABLE, userRecord.id, {
          "First Name": firstName,
          "Last Name": lastName,
          "User Full Name": `${firstName} ${lastName}`.trim()
        });
      } else if (email) {
        // Fallback to match by email if clerkUserId was not set yet
        const userByEmailQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(email.toLowerCase())}'`);
        const userByEmail = userByEmailQuery.records?.[0];
        if (userByEmail) {
          console.log(`[Clerk Webhook] Updating user details by email match for: ${email}`);
          await updateAirtableRecord(USERS_TABLE, userByEmail.id, {
            clerkUserId: clerkUserId,
            "First Name": firstName,
            "Last Name": lastName,
            "User Full Name": `${firstName} ${lastName}`.trim()
          });
        }
      }
    } 
    else if (type === 'user.deleted') {
      const clerkUserId = data.id;
      const userQuery = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`);
      const userRecord = userQuery.records?.[0];

      if (userRecord) {
        console.log(`[Clerk Webhook] Clearing clerkUserId for deleted user: ${userRecord.id}`);
        await updateAirtableRecord(USERS_TABLE, userRecord.id, { 
          clerkUserId: "" 
        });
      }
    }
    
    // Add support for Clerk Organization events if enabled
    else if (type === 'organization.created') {
      const clerkOrgId = data.id;
      const orgName = data.name;
      
      // Look up account by name or check if already mapped
      const existingAccountQuery = await queryAirtable(ACCOUNTS_TABLE, `{Account Name} = '${escapeAirtableString(orgName)}'`);
      const existingAccount = existingAccountQuery.records?.[0];
      
      if (existingAccount) {
        console.log(`[Clerk Webhook] Organization ${orgName} matches existing Account. Mapping clerkOrgId.`);
        await updateAirtableRecord(ACCOUNTS_TABLE, existingAccount.id, { clerkOrgId });
      } else {
        console.log(`[Clerk Webhook] Provisioning new account for Organization: ${orgName}`);
        // Provision a base account for this org
        const freePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
        const freePlanId = freePlanQuery.records?.[0]?.id;
        
        const accountFields: any = {
          "Account Name": orgName,
          "legalName": orgName,
          "signupCode": randomBytes(4).toString('hex').toUpperCase(),
          "accountContext": "",
          "vertical": "all",
          "clerkOrgId": clerkOrgId,
          "lastPaidDate": new Date().toISOString().split('T')[0],
          "lastAmountPaid": 0
        };
        if (freePlanId) accountFields["Plan"] = [freePlanId];
        
        const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
        const accountId = accountRecord.records[0].id;
        
        // Key provisioning
        const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
        await createAirtableRecord(API_KEYS_TABLE, {
          "API Key": apiKeyString,
          "API Key Status": "Active",
          "Account": [accountId]
        });
      }
    }
    else if (type === 'organizationMembership.created') {
      const clerkOrgId = data.organization.id;
      const clerkUserId = data.public_user_data.user_id;
      
      // Resolve both records in Airtable
      const userQuery = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${escapeAirtableString(clerkUserId)}'`);
      const userRecord = userQuery.records?.[0];
      
      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{clerkOrgId} = '${escapeAirtableString(clerkOrgId)}'`);
      const accountRecord = accountQuery.records?.[0];
      
      if (userRecord && accountRecord) {
        console.log(`[Clerk Webhook] Linking user ${userRecord.id} to organization account ${accountRecord.id}`);
        // Link user to the Organization's Account
        await updateAirtableRecord(USERS_TABLE, userRecord.id, {
          "Account": [accountRecord.id],
          "Role": data.role === 'org:admin' ? 'Admin' : 'Employee'
        });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Clerk Webhook] Event processing error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
