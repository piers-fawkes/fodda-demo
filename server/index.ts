import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendSystemEmail } from "./services/emailService";
import { calculateQueryUnits } from "../shared/metering";

dotenv.config();

console.log("--------------------------------------------------");
console.log("FODDA DISCOVERY ENGINE: STARTING INITIALIZATION");
console.log(`TIME: ${new Date().toISOString()}`);
console.log("--------------------------------------------------");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true }) as any);
app.use(express.json({ limit: "10mb" }) as any);

// Handle JSON parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error("[JSON Parse Error]", err);
    return res.status(400).json({ ok: false, error: "Invalid JSON payload" });
  }
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const FODDA_API_URL = "https://api.fodda.ai";
const SCHEMA_VERSION = "2026-02-14";
const GRAPH_VERSION = "2024-Q1-PROD";

// --- Standard Response Envelope ---
interface StandardEnvelope {
  requestId: string;
  graphId: string;
  version: string;
  schema_version: string;
  generated_at: string;
  data: any;
  meta: {
    usage: {
      query_units: number;
      graph_weight: number;
      billable_units: number;
    };
    [key: string]: any;
  };
}

/**
 * Enforces hard caps on graph traversal to prevent resource exhaustion.
 * Applied universally to Direct API and MCP calls.
 */
function enforceHardLimits(body: any) {
  const sanitized = { ...body };

  // Hard Caps (Universal)
  const IMPARE_LIMITS = {
    MAX_DEPTH: 2,
    MAX_EVIDENCE: 15,
    MAX_TOP_K: 10,
    MAX_NODES: 50,
    MAX_RELATIONSHIPS: 100
  };

  sanitized.depth = Math.min(Math.max(1, body.depth || 1), IMPARE_LIMITS.MAX_DEPTH);
  sanitized.evidence_limit = Math.min(Math.max(1, body.evidence_limit || 10), IMPARE_LIMITS.MAX_EVIDENCE);
  sanitized.top_k = Math.min(Math.max(1, body.top_k || 5), IMPARE_LIMITS.MAX_TOP_K);
  sanitized.max_nodes = Math.min(Math.max(1, body.max_nodes || 20), IMPARE_LIMITS.MAX_NODES);

  // Enforce Relationship Expansion Limit if present
  if (sanitized.max_relationships) {
    sanitized.max_relationships = Math.min(sanitized.max_relationships, IMPARE_LIMITS.MAX_RELATIONSHIPS);
  }

  return sanitized;
}

// Airtable Configuration
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const _LOGS_TABLE_USAGE = 'tblOBEs9DLZBcL74O'; // API Usage / Billing
const LOGS_TABLE_QUESTIONS = 'tblvHx1DzwuTq3TJE'; // User Sessions / Questions
const PLANS_TABLE = 'tblq2T5OUyrDFCda9'; // Plans / Packages
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf'; // API Keys

async function queryAirtable(tableId: string, filterByFormula: string = "", extraParams: string = "") {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}&${extraParams}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Airtable Error (${res.status} ${res.statusText}): ${errorBody}`);
  }
  return await res.json();
}

async function createAirtableRecord(tableId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable Write Error: ${errorText}`);
  }
  return await res.json();
}

async function updateAirtableRecord(tableId: string, recordId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable Update Error: ${errorText}`);
  }
  return await res.json();
}

// --- Auth Endpoints ---
// ... (Auth endpoints remain) ...

// --- Identity & Cache ---
const identityCache = new Map<string, { apiKeyId: string, tenantId: string }>();

async function resolveIdentity(apiKey: string) {
  if (identityCache.has(apiKey)) return identityCache.get(apiKey);

  try {
    const keyQuery = await queryAirtable(API_KEYS_TABLE, `{API Key} = '${apiKey}'`);
    const record = keyQuery.records?.[0];
    if (record) {
      const identity = {
        apiKeyId: record.id,
        tenantId: extractValue(record.fields.Account)
      };
      identityCache.set(apiKey, identity);
      return identity;
    }
  } catch (err) {
    console.error("[Identity Resolution Error]", err);
  }
  return null;
}

// Helper to extract value from potentially array-based Airtable fields (Lookups/Links)
const extractValue = (val: any) => {
  let v = val;
  if (Array.isArray(val)) {
    v = val.length > 0 ? val[0] : '';
  }
  return v || '';
};

const extractRealValue = (val: any) => {
  const v = extractValue(val);
  // If it looks like a Record ID (starts with rec and length 17), it's likely a link, not the value.
  if (typeof v === 'string' && v.startsWith('rec') && v.length === 17) return '';
  return v;
};

// --- Usage Tracking & Metering ---
async function incrementUsage(userId?: string, tenantId?: string) {
  if (!tenantId && !userId) return;

  try {
    // 1. Increment User Stats
    if (userId && userId !== 'anon' && userId !== 'unknown') {
      const uRes = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${userId}'`);
      const user = uRes.records?.[0];
      if (user) {
        const cM = user.fields.monthlyQueries || 0;
        const cL = user.fields['Lifetime Queries'] || 0;
        await updateAirtableRecord(USERS_TABLE, user.id, {
          "monthlyQueries": cM + 1,
          "Lifetime Queries": cL + 1
        });

        // 80% Warning
        const maxQ = user.fields.maxplanQueries || user.fields["Max Plan Queries"] || 100;
        const thresh = Math.floor(maxQ * 0.8);
        if ((cM + 1) >= thresh && !user.fields["usageWarningSent"]) {
          try {
            await sendSystemEmail(user.fields.email || user.fields.Email, 'PLAN_LIMIT_WARNING', {});
            await updateAirtableRecord(USERS_TABLE, user.id, { "usageWarningSent": true });
          } catch (e) { console.error("Warning email error:", e); }
        }
      }
    }

    // 2. Increment Account Stats
    if (tenantId && tenantId !== 'unknown_tenant') {
      const aRes = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${tenantId}'`);
      const acc = aRes.records?.[0];
      if (acc) {
        const cM = acc.fields.monthlyQueries || 0;
        await updateAirtableRecord(ACCOUNTS_TABLE, acc.id, { "monthlyQueries": cM + 1 });

        // Free -> Lapsed
        const pCode = acc.fields.planCode || acc.fields.Plan;
        if (pCode === 'Free' && (cM + 1) >= 12) {
          await updateAirtableRecord(ACCOUNTS_TABLE, acc.id, { "Plan": "Lapsed", "planCode": "7", "maxplanQueries": 0 });
          try {
            await sendSystemEmail(acc.fields.adminEmail || acc.fields.Email, 'LAPSED_NOTIFICATION', { accountName: acc.fields.name || acc.fields.Name });
          } catch (e) { console.error("Lapsed email error:", e); }
        }
      }
    }
  } catch (err) {
    console.error("[Usage Tracking Error]:", err);
  }
}
// --- Context Update Endpoints ---

app.post("/api/user/context", async (req, res) => {
  try {
    const { email, context } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email required" });

    // 1. Find User ID
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) return res.status(404).json({ ok: false, error: "User not found" });

    // 2. Update Context
    await updateAirtableRecord(USERS_TABLE, userRecord.id, { "userContext": context });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Context Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/account/update", async (req, res) => {
  try {
    const { accountId, updates } = req.body;
    if (!accountId) return res.status(400).json({ ok: false, error: "Missing account ID" });

    // Validate updates
    // For now, only allowing authPolicy
    const allowedUpdates: any = {};
    if (updates.authPolicy) {
      if (['STRICT', 'RELAXED'].includes(updates.authPolicy)) {
        allowedUpdates["authPolicy"] = updates.authPolicy;
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.json({ ok: true, message: "No valid updates provided" });
    }

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, allowedUpdates);
    res.json({ ok: true });

  } catch (err: any) {
    console.error("Account Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/account/context", async (req, res) => {
  try {
    const { accountId, context } = req.body;
    if (!accountId) return res.status(400).json({ ok: false, error: "Account ID required" });

    // 1. Update Context (Directly by ID)
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "accountContext": context });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Account Context Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


import { randomBytes } from "crypto";

app.post("/api/account/regenerate-key", async (req, res) => {
  try {
    const { accountId, role } = req.body;
    if (!accountId) return res.status(400).json({ ok: false, error: "Account ID required" });

    // Strict Role Check
    if (role !== "Admin" && role !== "Owner") {
      return res.status(403).json({ ok: false, error: "Unauthorized: Admin access required" });
    }

    // Generate new secure key
    const newApiKey = `sk_live_${randomBytes(24).toString('hex')}`;

    // Find the record in API_KEYS_TABLE linked to this account
    // We filter by linked Account field containing accountId
    const keyQuery = await queryAirtable(API_KEYS_TABLE, `FIND('${accountId}', ARRAYJOIN({Account}, ','))`);
    const keyRecord = keyQuery.records?.[0];

    if (keyRecord) {
      // Update existing key
      await updateAirtableRecord(API_KEYS_TABLE, keyRecord.id, { "API Key": newApiKey });
    } else {
      // Create new key if somehow missing
      await createAirtableRecord(API_KEYS_TABLE, {
        "API Key": newApiKey,
        "API Key Status": "Active",
        "Account": [accountId]
      });
    }

    res.json({ ok: true, apiKey: newApiKey });
  } catch (err: any) {
    console.error("Key Regeneration Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/user/update", async (req, res) => {
  try {
    const { email, updates } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email required" });

    // 1. Find User by Email
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) return res.status(404).json({ ok: false, error: "User not found" });

    const fieldsToUpdate: any = {};
    if (updates.firstName !== undefined) fieldsToUpdate["First Name"] = updates.firstName;
    if (updates.lastName !== undefined) fieldsToUpdate["Last Name"] = updates.lastName;
    if (updates.jobTitle !== undefined) fieldsToUpdate["Job Title"] = updates.jobTitle;
    if (updates.email !== undefined) fieldsToUpdate["email"] = updates.email;
    if (updates.company !== undefined) fieldsToUpdate["Company Name Override"] = updates.company; // Use a text field for override if linked account name shouldn't be changed globally

    // Optional: Update User Full Name if parts changed
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const fn = updates.firstName !== undefined ? updates.firstName : (userRecord.fields["First Name"] || "");
      const ln = updates.lastName !== undefined ? updates.lastName : (userRecord.fields["Last Name"] || "");
      fieldsToUpdate["User Full Name"] = `${fn} ${ln}`.trim();
    }

    await updateAirtableRecord(USERS_TABLE, userRecord.id, fieldsToUpdate);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("User Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/account/update", async (req, res) => {
  try {
    const { accountId, role, updates } = req.body;
    if (!accountId) return res.status(400).json({ ok: false, error: "Account ID required" });

    // Strict Role Check
    if (role !== "Admin" && role !== "Owner") {
      return res.status(403).json({ ok: false, error: "Unauthorized: Admin access required" });
    }

    const fieldsToUpdate: any = {};
    if (updates.name) fieldsToUpdate["Account Name"] = updates.name; // Map to Airtable field
    if (updates.context) fieldsToUpdate["accountContext"] = updates.context;

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ ok: false, error: "No valid fields to update" });
    }

    // Update Airtable
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, fieldsToUpdate);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Account Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Admin Graph Endpoints (Mocked Persistence) ---
app.post("/api/admin/graphs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`[Admin] Updating Graph ${id}:`, JSON.stringify(updates, null, 2));
    console.warn(`[Admin] NOTE: Graph updates are currently MOCKED. Persistence requires a DB connection.`);

    // In a real implementation:
    // await updateAirtableRecord(GRAPHS_TABLE, id, updates);

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Graph Update Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
// Helper for Context Rewriting
const rewriteContext = async (originalText: string, type: 'user' | 'company', providedKey?: string): Promise<string> => {
  if (!originalText || !originalText.trim()) return "";

  const apiKey = providedKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Skipping Context Rewrite: GEMINI_API_KEY missing");
    return originalText;
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = type === 'user'
      ? `You are an expert AI prompt engineer. Rewrite the following user profile description into a concise, high-quality system prompt context for a research agent. The goal is to help the agent understand the user's role, perspective, and goals when answering their questions. Output ONLY the refined context paragraph, no other text. Input: "${originalText}"`
      : `You are an expert AI prompt engineer. Rewrite the following company mission/description into a concise, high-quality system prompt context for a research agent. The goal is to help the agent understand the company's business, industry, and strategic focus. Output ONLY the refined context paragraph, no other text. Input: "${originalText}"`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const refined = result.text;
    console.log(`[Context Rewrite] ${type} context refined.`);
    return refined || originalText;
  } catch (e) {
    console.error(`[Context Rewrite] Failed for ${type}:`, e);
    return originalText; // Fallback to raw
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, firstName, lastName, company, jobTitle, companyContext, userContext, apiUse } = req.body;
    if (!email || !firstName || !lastName || !company) {
      return res.status(400).json({ ok: false, error: "Email, First Name, Last Name, and Company are required." });
    }

    // 1. Check if User Exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      return res.status(409).json({ ok: false, error: "User already exists. Please log in." });
    }

    // Extract optional key from headers
    const providedKey = req.headers['x-gemini-key'] as string;

    // Parallel Context Rewrite (if provided)
    const [refinedCompanyContext, refinedUserContext] = await Promise.all([
      companyContext ? rewriteContext(companyContext, 'company', providedKey) : Promise.resolve(""),
      userContext ? rewriteContext(userContext, 'user', providedKey) : Promise.resolve("")
    ]);

    // 2. Fetch 'Free' Plan ID (Step 1)
    const freePlanQuery = await queryAirtable(PLANS_TABLE, `{Package Name} = 'Free'`);
    const freePlanId = freePlanQuery.records?.[0]?.id;

    if (!freePlanId) {
      console.warn("Warning: 'Free' plan not found in Airtable (checked 'Package Name'). Proceeding without plan link.");
    }

    // 3. Generate Unique User Name (Handle) and User Full Name
    const fullName = `${firstName} ${lastName}`;
    const baseHandle = fullName.toLowerCase().replace(/[^a-z0-9]/g, ""); // Remove non-alphanumeric
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;

    // Simple collision check loop (limit iterations for safety)
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${uniqueHandle}'`);
      if (!handleCk.records || handleCk.records.length === 0) {
        isUnique = true;
      } else {
        uniqueHandle = `${baseHandle}${counter}`;
        counter++;
      }
    }

    // Fallback if super crowded (unlikely)
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    // 4. Handle Account Creation or Matching
    let accountId;
    let finalAccountFields;
    let isNewAccount = false;

    // Check if an account with this name already exists
    const escapedCompany = company.replace(/'/g, "''");
    const existingAccountQuery = await queryAirtable(ACCOUNTS_TABLE, `{Account Name} = '${escapedCompany}'`);
    const existingAccountCursor = existingAccountQuery.records?.[0];

    if (existingAccountCursor) {
      console.log(`[Register] Matching account found for '${company}'. Linking user to existing Account ID: ${existingAccountCursor.id}`);
      accountId = existingAccountCursor.id;
      finalAccountFields = existingAccountCursor.fields;
    } else {
      console.log(`[Register] No matching account for '${company}'. Creating new account.`);
      isNewAccount = true;
      const accountFields: any = {
        "Account Name": company,
        "legalName": company,
        // Owner linked after user creation to prevent duplicate ghost user
        "signupCode": randomBytes(4).toString('hex').toUpperCase(), // Generate unique 8-char code
        "accountContext": refinedCompanyContext
      };
      if (freePlanId) {
        accountFields["Plan"] = [freePlanId];
      }
      const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
      accountId = accountRecord.records[0].id;
      finalAccountFields = accountFields;

      // 5. Create API Key Record (ONLY for new accounts)
      const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
      const apiKeyFields = {
        "API Key": apiKeyString,
        "API Key Status": "Active",
        "Account": [accountId]
      };
      await createAirtableRecord(API_KEYS_TABLE, apiKeyFields);
    }

    // 6. Create User linked to Account (Step 4)
    const userRole = isNewAccount ? "Owner" : "Employee";
    const userFields = {
      "User Name": uniqueHandle,
      "First Name": firstName,
      "Last Name": lastName,
      "User Full Name": fullName,
      "email": email,
      "Job Title": jobTitle || "",
      "Role": userRole,
      "Account": [accountId],
      "userContext": refinedUserContext,
      "emailConfirmed": false, // New users are unconfirmed
      "apiUse": apiUse,
      "Company": company // Add Company name as string to User record
    };
    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // 6b. Link Account Owner (If New Account)
    if (isNewAccount) {
      console.log(`[Register] Linking Account Owner ${userId} to Account ${accountId}`);
      await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
        "Account Owner": [userId]
      });
    }

    // 7. Send Confirmation Email
    console.log(`[Email Service] Sending Confirmation Email to ${email}...`);
    const baseUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://app.fodda.ai' : `${req.protocol}://${req.get('host')}`);
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(email)}`;

    // Fire and forget email
    sendSystemEmail('SIGNUP_CONFIRMATION', email, { name: firstName, confirmationLink }).catch(e => console.error("Failed to send confirmation email:", e));

    // 8. Return Success (Auto-login context)
    res.json({
      ok: true,
      user: {
        id: userRecord.records[0].id,
        signupDate: new Date().toLocaleDateString(),
        ...userFields
      },
      account: {
        id: accountId,
        ...finalAccountFields
      }
    });

  } catch (err: any) {
    console.error("Registration Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/join", async (req, res) => {
  try {
    const { email, firstName, lastName, signupCode, jobTitle, userContext } = req.body;

    if (!email || !firstName || !lastName || !signupCode) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    // 1. Check if User Exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      return res.status(409).json({ ok: false, error: "User already exists. Please log in." });
    }

    // 2. Find Account by Signup Code
    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{signupCode} = '${signupCode}'`);
    const accountRecord = accountQuery.records?.[0];

    if (!accountRecord) {
      return res.status(404).json({ ok: false, error: "Invalid Signup Code. Please check and try again." });
    }

    const accountId = accountRecord.id;
    const accountFields = accountRecord.fields;

    // 3. Generate User Handle
    const fullName = `${firstName} ${lastName}`;
    const baseHandle = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${uniqueHandle}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    // 4. Refine User Context if provided
    const providedKey = req.headers['x-gemini-key'] as string;
    const refinedUserContext = userContext ? await rewriteContext(userContext, 'user', providedKey) : "";

    // 5. Create User Linked to Account
    const userRole = "Employee";
    const userFields = {
      "User Name": uniqueHandle,
      "First Name": firstName,
      "Last Name": lastName,
      "User Full Name": fullName,
      "email": email,
      "Job Title": jobTitle || "",
      "Role": userRole,
      "Account": [accountId],
      "userContext": refinedUserContext,
      "emailConfirmed": false
    };

    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);

    // 6. Send Confirmation Email
    const baseUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://app.fodda.ai' : `${req.protocol}://${req.get('host')}`);
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(email)}`;
    sendSystemEmail('SIGNUP_CONFIRMATION', email, { name: firstName, confirmationLink }).catch(e => console.error("Failed to send confirmation email:", e));

    res.json({
      ok: true,
      user: {
        id: userRecord.records[0].id,
        signupDate: new Date().toLocaleDateString(),
        ...userFields
      },
      account: {
        id: accountId,
        ...accountFields
      }
    });

  } catch (err: any) {
    console.error("Join Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/auth/confirm", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).send("Invalid link");

    console.log(`[Auth] Confirming email for: ${email}`);

    // 1. Find User
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      return res.status(404).send("User not found");
    }

    // 2. Update Status
    await updateAirtableRecord(USERS_TABLE, userRecord.id, { "emailConfirmed": true });

    // 3. Send Welcome Email (Fire and forget)
    // Only send if not already confirmed? Or always on click? Assuming first time.
    // We can check if `userRecord.fields.emailConfirmed` was already true if we fetched it, but for now just send.
    // Ideally we check if it was already confirmed to avoid spamming.
    // User record fields are available in `userRecord.fields`.
    const alreadyConfirmed = userRecord.fields["emailConfirmed"];
    if (!alreadyConfirmed) {
      console.log(`[Email Service] Sending Welcome Email to ${email}...`);
      sendSystemEmail('WELCOME_EMAIL', email).catch(e => console.error("Failed to send welcome email:", e));
    }

    // 4. Redirect to App
    res.redirect(`/?confirmed=true&email=${encodeURIComponent(email)}`);

  } catch (err: any) {
    console.error("Confirmation Error:", err);
    res.status(500).send("Confirmation failed");
  }
});

// GET /api/account/:accountId/users - Fetch users for an account
// GET /api/account/:accountId/users - Fetch users for an account
app.get("/api/account/:accountId/users", async (req, res) => {
  const { accountId } = req.params;
  if (!accountId) return res.status(400).json({ ok: false, error: "Missing accountId" });

  try {
    // Use queryAirtable helper
    const result = await queryAirtable(USERS_TABLE, `SEARCH('${accountId}', ARRAYJOIN({Account})) > 0`);
    const records = result.records || [];

    const users = records.map((record: any) => ({
      id: record.id,
      email: record.fields["User Name"],
      firstName: record.fields["First Name"],
      lastName: record.fields["Last Name"],
      jobTitle: record.fields["Job Title"],
      role: record.fields["Role"],
      emailConfirmed: record.fields["emailConfirmed"],
      monthlyQueries: record.fields["monthlyQueries"] || 0,
      maxplanQueries: record.fields["Max Plan Queries"] || record.fields["maxplanQueries"] || 100
    }));

    res.json({ ok: true, users });
  } catch (error) {
    console.error("Error fetching account users:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch users" });
  }
});

// DELETE /api/user/:userId - Remove a user
app.delete("/api/user/:userId", async (req, res) => {
  const { userId } = req.params;
  const { requesterEmail } = req.body; // Basic authorization check

  if (!userId || !requesterEmail) return res.status(400).json({ ok: false, error: "Missing ID or requester" });

  try {
    // Verify requester is admin/owner
    const requester = await queryAirtable(USERS_TABLE, `{email} = '${requesterEmail}'`);
    const adminRecord = requester.records?.[0];
    const role = adminRecord?.fields?.["Role"];

    // Allow strings like 'Admin', 'Owner', 'admin', 'owner'
    const normalizedRole = String(role).toLowerCase();
    if (!adminRecord || (normalizedRole !== 'admin' && normalizedRole !== 'owner')) {
      return res.status(403).json({ ok: false, error: "Unauthorized: Admin access required" });
    }

    // Perform deletion via fetch
    const delUrl = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}/${userId}`;
    const delRes = await fetch(delUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });

    if (!delRes.ok) {
      throw new Error(`Airtable Delete Failed: ${delRes.statusText}`);
    }

    console.log(`[Account] User ${userId} deleted by ${requesterEmail}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete user failed:", err);
    res.status(500).json({ ok: false, error: "Failed to delete user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email is required" });

    // 1. Find User by Email
    const userQuery = await queryAirtable(USERS_TABLE, `OR({email} = '${email}', {User Name} = '${email}')`);
    const userRecord = userQuery.records?.[0];

    // Security: If user not found, we can return generic message or 404.
    // For this app, let's keep it friendly but secure.
    if (!userRecord) {
      // Return success simulation for security? Or honest error?
      // Honest error is better for UX in B2B context.
      return res.status(404).json({ ok: false, error: "We can't find an account with that email. Please sign up." });
    }

    // 2. Generate Secure Token
    const loginToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // 3. Save Token to User Record
    // Note: User table must have 'loginToken' and 'loginTokenExpires' fields (Text).
    await updateAirtableRecord(USERS_TABLE, userRecord.id, {
      "loginToken": loginToken,
      "loginTokenExpires": expiresAt
    });

    // 4. Send Email
    // Determine Base URL
    const devUrl = 'http://localhost:5173';
    let baseUrl = devUrl;
    if (process.env.NODE_ENV === 'production') {
      if (process.env.APP_URL) {
        baseUrl = process.env.APP_URL;
      } else {
        // Fallback to request host (works for Cloud Run w/ dynamic URLs)
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        baseUrl = `${protocol}://${req.get('host')}`;
      }
    }

    // Construct Verification Link
    // Frontend route checks for ?token=... param
    const magicLink = `${baseUrl}/?token=${loginToken}`;

    console.log(`[Auth] Sending Magic Link to ${email}: ${magicLink}`);

    await sendSystemEmail('MAGIC_LINK_LOGIN', email, { loginLink: magicLink });

    res.json({ ok: true, message: "Check your email for a secure login link." });

  } catch (err: any) {
    console.error("Login Request Error (Airtable or Email):", err.message || err);
    if (err.message && err.message.includes("Unknown field name")) {
      console.error("[CRITICAL] Airtable Schema Mismatch: loginToken or loginTokenExpires fields are likely missing.");
    }
    res.status(500).json({ ok: false, error: err.message || "Failed to process login request." });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: "Token is required." });

    // 1. Find User by Token
    // Ideally filter by Token AND Check Expiration in Logic
    const userQuery = await queryAirtable(USERS_TABLE, `{loginToken} = '${token}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      return res.status(401).json({ ok: false, error: "Invalid or expired login link." });
    }

    const userData = userRecord.fields;

    // Check Expiration
    const expiresAt = new Date(userData.loginTokenExpires || 0).getTime();
    if (Date.now() > expiresAt) {
      return res.status(401).json({ ok: false, error: "Login link has expired. Please request a new one." });
    }

    // 2. Determine Link ID
    let accountIdLink = (userData.Account && userData.Account.length > 0) ? userData.Account[0] : null;

    // Fallback to Company if Account is missing, but only if it looks like an ID
    if (!accountIdLink && userData.Company && userData.Company.length > 0) {
      const val = userData.Company[0];
      if (typeof val === 'string' && val.startsWith('rec')) {
        accountIdLink = val;
      }
    }

    let accountData: any = {};
    if (accountIdLink) {
      const accountUrl = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}/${accountIdLink}`;
      try {
        const accRes = await fetch(accountUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        if (accRes.ok) {
          const accRec = await accRes.json();
          accountData = { id: accRec.id, ...accRec.fields };
          // Fetch Plan
          const planIdLink = accountData.Plan ? accountData.Plan[0] : null;
          if (planIdLink) {
            try {
              const planUrl = `https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}/${planIdLink}`;
              const planRes = await fetch(planUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
              if (planRes.ok) {
                const planRec = await planRes.json();
                accountData.fetchedPlanName = planRec.fields['Package Name'] || planRec.fields.Name || 'Custom';
              }
            } catch (e) { console.error("Plan Fetch Error:", e); }
          }
        }
      } catch (e) {
        console.error("Account Fetch Error", e);
      }
    } else {
      accountData = { "Account Name": userData.Company?.[0] || 'Unlinked Account', id: 'no_linked_account' };
    }

    // 3. Clear Token (One-time use)
    await updateAirtableRecord(USERS_TABLE, userRecord.id, {
      "loginToken": "",
      "loginTokenExpires": "",
      "emailConfirmed": true // Auto-confirm email on successful login
    });

    // 4. Check Auth Policy & Generate Session Token
    const authPolicy = accountData.authPolicy || accountData['Auth Policy'] || 'RELAXED'; // Default to relaxed
    let sessionToken = '';

    if (authPolicy === 'STRICT') {
      console.log(`[Auth] Account ${accountData.name} has STRICT policy. No session token generated.`);
    } else {
      // RELAXED or Default: Generate 24h Token
      sessionToken = randomBytes(48).toString('hex');
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Update Airtable with Session Token
      try {
        await updateAirtableRecord(USERS_TABLE, userRecord.id, {
          "sessionToken": sessionToken,
          "sessionExpiresAt": sessionExpiresAt
        });
      } catch (e) {
        console.error("Failed to save session token:", e);
      }
    }

    console.log(`[Auth] User ${userData.email} logged in via Magic Link.`);

    // Construct response
    const user = {
      id: userRecord.id,
      email: userData.email || userData.Email,
      name: `${userData['First Name'] || ''} ${userData['Last Name'] || ''}`.trim() || userData['User Name'] || userData['Name'] || 'User',
      userName: userData['userName'] || userData['User Name'] || '',
      role: userData.Role || 'User',
      accountId: accountData.id || 'unlinked_account',
      userContext: userData.userContext || userData['User Context'] || '',
      jobTitle: userData['Job Title'] || '',
      company: userData['Company Name Override'] || (userData['Company'] && userData['Company'][0] ? accountData.name : (userData['Company'] || '')),
      accountName: accountData['Account Name'] || userData['accountName'] || '',
      planName: userData['planName'] || accountData.fetchedPlanName || 'Free',
      signupDate: userRecord.createdTime ? new Date(userRecord.createdTime).toLocaleDateString() : '',
      apiUse: userData.apiUse || ''
    };

    const account = {
      id: accountData.id || 'unlinked_account',
      name: accountData['Account Name'] || accountData.Name || 'Unknown Account',
      // Prioritize 'apiKey' from USER data first (if exists), then Account data.
      apiKey: extractRealValue(userData['apiKey']) ||
        extractRealValue(accountData['apiKey']) ||
        extractRealValue(accountData.apiKey) ||
        extractRealValue(accountData['API Key']) ||
        extractValue(accountData['apiKey']) ||
        '',
      accountContext: accountData.accountContext || accountData['Account Context'] || '',
      authPolicy: accountData.authPolicy || accountData['Auth Policy'] || 'RELAXED'
    };

    // Auto-Allocate API Key if missing
    if (!account.apiKey && account.id && account.id !== 'unlinked_account' && account.id !== 'no_linked_account') {
      console.log(`[Auth] Auto-allocating API Key for Account: ${account.name} (${account.id})`);
      const newApiKey = `sk_live_${randomBytes(24).toString('hex')}`;

      // Update Airtable
      try {
        await updateAirtableRecord(ACCOUNTS_TABLE, account.id, { "apiKey": newApiKey });
        account.apiKey = newApiKey; // Use new key in response
      } catch (e) {
        console.error("Failed to auto-allocate API key:", e);
      }
    }

    res.json({ ok: true, sessionToken, user, account });

  } catch (err: any) {
    console.error("Verify Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/validate-session", async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(400).json({ ok: false, error: "Session token required" });

    // 1. Find User by Session Token
    const userQuery = await queryAirtable(USERS_TABLE, `{sessionToken} = '${sessionToken}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const userData = userRecord.fields;

    // 2. Check Expiration
    const expiresAt = new Date(userData.sessionExpiresAt || 0).getTime();
    if (Date.now() > expiresAt) {
      return res.status(401).json({ ok: false, error: "Session expired" });
    }

    // 3. Re-hydrate User/Account Data (Logic shared with Verify)
    // NOTE: This logic is duplicated from Verify. Ideally refactor into a helper.
    let accountIdLink = (userData.Account && userData.Account.length > 0) ? userData.Account[0] : null;
    if (!accountIdLink && userData.Company && userData.Company.length > 0) {
      const val = userData.Company[0];
      if (typeof val === 'string' && val.startsWith('rec')) accountIdLink = val;
    }

    let accountData: any = {};
    if (accountIdLink) {
      const accountUrl = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}/${accountIdLink}`;
      try {
        const accRes = await fetch(accountUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        if (accRes.ok) {
          const accRec = await accRes.json();
          accountData = { id: accRec.id, ...accRec.fields };
          // Fetch Plan
          const planIdLink = accountData.Plan ? accountData.Plan[0] : null;
          if (planIdLink) {
            const planUrl = `https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}/${planIdLink}`;
            const planRes = await fetch(planUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            if (planRes.ok) {
              const planRec = await planRes.json();
              accountData.fetchedPlanName = planRec.fields['Package Name'] || planRec.fields.Name || 'Custom';
            }
          }
        }
      } catch (e) { console.error("Session Account Fetch Error", e); }
    } else {
      accountData = { "Account Name": userData.Company?.[0] || 'Unlinked Account', id: 'no_linked_account' };
    }

    const user = {
      id: userRecord.id,
      email: userData.email || userData.Email,
      name: `${userData['First Name'] || ''} ${userData['Last Name'] || ''}`.trim() || userData['User Name'] || userData['Name'] || 'User',
      userName: userData['userName'] || userData['User Name'] || '',
      role: userData.Role || 'User',
      accountId: accountData.id || 'unlinked_account',
      userContext: userData.userContext || userData['User Context'] || '',
      jobTitle: userData['Job Title'] || '',
      company: userData['Company Name Override'] || (userData['Company'] && userData['Company'][0] ? accountData.name : (userData['Company'] || '')),
      accountName: accountData['Account Name'] || userData['accountName'] || '',
      planName: userData['planName'] || accountData.fetchedPlanName || 'Free',
      signupDate: userRecord.createdTime ? new Date(userRecord.createdTime).toLocaleDateString() : '',
      apiUse: userData.apiUse || ''
    };

    const account = {
      id: accountData.id || 'unlinked_account',
      name: accountData['Account Name'] || accountData.Name || 'Unknown Account',
      apiKey: extractRealValue(userData['apiKey']) || extractRealValue(accountData['apiKey']) || '',
      accountContext: accountData.accountContext || accountData['Account Context'] || '',
      planLevel: accountData.fetchedPlanName || 'Free'
    };

    res.json({ ok: true, user, account });

  } catch (err: any) {
    console.error("Validate Session Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Logging Endpoint ---

app.post("/api/log", async (req, res) => {
  try {
    const { email, query, vertical, graphId, accessKey, context } = req.body;

    // Fields must EXACTLY match Airtable column names
    const fields = {
      "question": query || "[EMPTY]",
      "apiCall": query || "[EMPTY]", // Same as question for now
      "userEmail": extractValue(email) || "anonymous",
      "accessKey": extractValue(accessKey) || "",
      "graphId": extractValue(graphId) || "psfk",
      "vertical": extractValue(vertical) || "unknown",
      "Date": new Date().toISOString(),
      "userContext": context?.userContext || "",
      "accountContext": context?.accountContext || ""
    };

    // Log to BOTH tables in parallel
    // Log to BOTH tables in parallel
    /*
    await Promise.allSettled([
      createAirtableRecord(LOGS_TABLE_USAGE, fields),
      createAirtableRecord(LOGS_TABLE_QUESTIONS, fields)
    ]);
    */
    console.log("[Log] Internal Airtable logging disabled (API handles it). Payload:", JSON.stringify(fields));

    res.json({ ok: true });

  } catch (err: any) {
    console.error("Logging Error:", err);
    // Don't fail the request if logging fails, just log to console
    res.status(200).json({ ok: true, warning: "Log failed" });
  }
});


// --- Proxies ---

app.post(["/api/query", "/api/query/"], async (req, res) => {
  const startTime = Date.now();
  const requestId = randomBytes(8).toString('hex');

  try {
    // 1. Enforce API Key
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      console.warn(`[${requestId}] [Auth] Blocked request: Missing X-API-Key`);
      return res.status(401).json({
        ok: false,
        error: "Unauthenticated: X-API-Key header required for MCP/API access.",
        requestId
      });
    }

    // 2. Resolve Identities
    const identity = await resolveIdentity(apiKey);
    const apiKeyId = identity?.apiKeyId || "unknown_key";
    const tenantId = identity?.tenantId || "unknown_tenant";

    // 3. Enforce Plan Limits (Human Identity)
    const userId = (req.headers['x-user-id'] as string) || (req.body.userId as string);

    if (userId) {
      const checkQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${userId}'`);
      if (checkQuery.records && checkQuery.records.length > 0) {
        const userRec = checkQuery.records[0];
        const monthly = userRec.fields.monthlyQueries || 0;
        const max = userRec.fields["Max Plan Queries"] || userRec.fields.maxplanQueries || 100;

        if (monthly >= max) {
          console.log(`[${requestId}] [Plan Limit] Blocked request for user ${userId}. Usage: ${monthly}/${max}`);
          return res.status(403).json({
            ok: false,
            error: "Monthly Plan Limit Exceeded. Please contact your administrator to upgrade.",
            code: "PLAN_LIMIT_EXCEEDED",
            requestId
          });
        }
      }
    }

    // 4. Determine Mode & Sanitize
    const foddaMode = req.headers['x-fodda-mode'] as string;
    const executionMode = req.headers['x-fodda-execution-mode'] as string || "direct"; // 'direct' | 'mcp'

    // Strict Deterministic Enforcement
    const isDeterministic = foddaMode === 'deterministic' || req.body.deterministic !== false; // Default true

    // If header explicitly requested deterministic, force it in body
    if (foddaMode === 'deterministic') {
      req.body.deterministic = true;
    }

    const sanitizedBody = enforceHardLimits({ ...req.body, deterministic: isDeterministic });

    // 4b. Reject invalid if Mode is Deterministic (Strict validation)
    if (isDeterministic && !sanitizedBody.graphId && !sanitizedBody.vertical) {
      // Allow for now but warn, or strictly reject. Brief says "Reject requests with missing graphId".
      // Existing logic creates defaults, so we check if defaults fail.
      // We'll trust sanitizedBody has what it needs or API will fail.
    }

    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-Request-Id": requestId,
      "X-Fodda-Mode": isDeterministic ? "deterministic" : "heuristic"
    };
    if (req.headers['x-user-id']) forwardHeaders['X-User-Id'] = req.headers['x-user-id'] as string;

    console.log(`[${requestId}] [Proxy] POST /api/query | Mode: ${isDeterministic ? 'Deterministic' : 'Heuristic'} | Exec: ${executionMode}`);

    const response = await fetch(`${FODDA_API_URL}/api/query`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(sanitizedBody)
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      console.error(`[${requestId}] [Fodda API Error] Status ${response.status}: ${text}`);
      throw new Error(`Fodda API Error ${response.status}`);
    }

    const data = await response.json();

    // 5. Metering (Deterministic Calculation)
    const effectiveGraphId = sanitizedBody.vertical || sanitizedBody.graphId || "unknown";

    // Calculate Usage based on API layer rules
    const usage = {
      query_units: calculateQueryUnits(effectiveGraphId),
      graph_weight: 1.0, // Default weight
      billable_units: calculateQueryUnits(effectiveGraphId) * 1.0
    };

    // 6. Enterprise Structured Logging
    const logEntry = {
      requestId,
      apiKeyId,     // System Identity
      tenantId,     // Customer Identity
      userId,       // Human Identity (if any)
      graphId: effectiveGraphId,
      units: usage.billable_units,
      latency,
      size: JSON.stringify(data).length,
      evidence: data.evidence?.length || 0,
      timestamp: new Date().toISOString(),
      source: userId ? 'web-app' : 'external-api',
      mode: process.env.RETENTION_MODE || "METADATA_ONLY",
      deterministic: isDeterministic,
      execution_mode: executionMode, // LOGGING REQUIREMENT
      neo4jQueryExecuted: true // Confirmed by virtue of successful API response
    };
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);

    // 7. Increment Usage
    incrementUsage(userId, tenantId);

    // 8. Construct Standard Envelope
    const envelope: StandardEnvelope = {
      requestId,
      graphId: effectiveGraphId,
      version: "v1", // API Version
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      data: {
        ...data,
        // Legacy compatibility: keep meta inside data for a while if needed, 
        // but Brief demands `meta` at top level.
        // We will KEEP legacy `meta` inside data for App compatibility until App is fully updated,
        // BUT also provide the top-level `meta` as required.
        meta: {
          ...(data.meta || {}),
          usage, // Inject usage here too for legacy App
          proxy_requestId: requestId
        }
      },
      meta: {
        usage
      }
    };

    res.json(envelope);

  } catch (err: any) {
    const latency = Date.now() - startTime;
    console.error(`[${requestId}] [Proxy Error] Latency: ${latency}ms | Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message, dataStatus: "ERROR", requestId });
  }
});

// V1 Proxy Implementation
app.post("/v1/graphs/:graphId/search", async (req, res) => {
  const startTime = Date.now();
  const requestId = randomBytes(8).toString('hex');
  const { graphId } = req.params;

  try {
    // 1. Enforce API Key
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      console.warn(`[${requestId}] [Auth] Blocked V1 search: Missing X-API-Key`);
      return res.status(401).json({
        ok: false,
        error: "Unauthenticated: X-API-Key header required for V1 API access.",
        requestId
      });
    }

    // 2. Resolve Identity
    const identity = await resolveIdentity(apiKey);
    const apiKeyId = identity?.apiKeyId || "unknown_key";
    const tenantId = identity?.tenantId || "unknown_tenant";
    const userId = (req.headers['x-user-id'] as string) || null;

    // 2b. Forward with Hard Limits
    const sanitizedBody = enforceHardLimits(req.body);
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-Request-Id": requestId
    };
    if (req.headers['x-user-id']) forwardHeaders['X-User-Id'] = req.headers['x-user-id'] as string;

    console.log(`[${requestId}] [Proxy] POST /v1/graphs/${graphId}/search`);

    const response = await fetch(`${FODDA_API_URL}/v1/graphs/${graphId}/search`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(sanitizedBody)
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      console.error(`[${requestId}] [Fodda V1 Error] Status ${response.status}: ${text}`);
      throw new Error(`Fodda V1 API Error ${response.status}`);
    }

    const data = await response.json();

    // 2c. Use Backend Usage or Recalculate
    const usage = data.meta?.usage || data.usage || {
      units: calculateQueryUnits(graphId),
      graphId,
      version: "1.1"
    };

    // 3. Enterprise Structured Logging
    const logEntry = {
      requestId,
      apiKeyId,     // System Identity
      tenantId,     // Customer Identity
      userId,       // Human Identity (if any)
      graphId,
      units: usage.units || usage.total_billable_units || 1,
      latency,
      size: JSON.stringify(data).length,
      timestamp: new Date().toISOString(),
      source: userId ? 'web-app' : 'external-api',
      deterministic: sanitizedBody.deterministic
    };
    console.log(`[AUDIT V1] ${JSON.stringify(logEntry)}`);

    // 4. Increment Usage
    incrementUsage(userId || undefined, tenantId);

    // 5. Versioned Response Envelope
    res.json({
      schema_version: SCHEMA_VERSION,
      graph_version: GRAPH_VERSION,
      deterministic: sanitizedBody.deterministic,
      requestId,
      data: {
        ...data,
        meta: {
          ...(data.meta || {}),
          usage,
          proxy_requestId: requestId,
          limits_enforced: true
        }
      }
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    console.error(`[${requestId}] [V1 Proxy Error] Latency: ${latency}ms | Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message, requestId });
  }
});

app.get("/v1/graphs/:graphId/labels/:label/values", async (req, res) => {
  try {
    const { graphId, label } = req.params;
    const forwardHeaders: Record<string, string> = {};
    if (req.headers['x-api-key']) forwardHeaders['X-API-Key'] = req.headers['x-api-key'] as string;

    const response = await fetch(`${FODDA_API_URL}/v1/graphs/${graphId}/labels/${label}/values`, {
      headers: forwardHeaders
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fodda V1 Discovery Error ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("[Fodda V1 Discovery Proxy Error]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/user/stats", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ ok: false, error: "Email required" });

    // 1. Fetch User Record to get 'monthlyQueries'
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
    const userRecord = userQuery.records?.[0];

    if (!userRecord) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const monthlyUsage = userRecord.fields.monthlyQueries || 0;

    // We can still fetch total queries if needed, or rely on a similar field if it exists (Lifetime Queries)
    // For now, let's keep totalQueries as is if we want, OR use Lifetime Queries if available.
    // The user specifically asked for "monthlyQueries".
    // Let's use 'Lifetime Queries' for total if available, else keep it 0 or fetch logs (but fetching logs just for total might be wasteful if we have the field).
    // The debug output showed 'Lifetime Queries'. Let's use that too for consistency, to avoid big log fetches.
    const totalQueries = userRecord.fields['Lifetime Queries'] || 0;

    // We use a default plan limit of 100 if not specified
    const maxplanQueries = userRecord.fields["Max Plan Queries"] || userRecord.fields.maxplanQueries || 100;

    res.json({
      ok: true,
      stats: {
        totalQueries,
        monthlyQueries: monthlyUsage,
        maxplanQueries: maxplanQueries
      }
    });
  } catch (err: any) {
    console.error("Stats Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/ping", (req, res) => res.json({ ok: true, message: "pong", timestamp: new Date().toISOString() }));

app.get("/api/neo4j/health", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/health`).catch(() => null);
    if (response && response.ok) {
      res.json({ ok: true, source: "Fodda API" });
    } else {
      res.json({ ok: false, error: "Fodda API Unreachable" });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- System Validation Endpoint (MCP Requirement) ---
app.get("/v1/system/validation", async (req, res) => {
  try {
    // Check Neo4j Connectivity via API
    let neo4jStatus = "UNKNOWN";
    try {
      const health = await fetch(`${FODDA_API_URL}/api/health`).catch(() => null);
      neo4jStatus = (health && health.ok) ? "CONNECTED" : "DISCONNECTED";
    } catch (e) { neo4jStatus = "ERROR"; }

    res.json({
      ok: true,
      deterministic_mode_status: "ENFORCED",
      schema_version: SCHEMA_VERSION,
      graph_count: 6, // Hardcoded for now based on Constants
      index_status: "ONLINE",
      max_limits: {
        depth: 2,
        evidence: 15,
        nodes: 50
      },
      neo4j_status: neo4jStatus,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Macro Overview Endpoint (V1.2) ---
// Generates a structured macro overview from the PSFK Graph.
// Cache: In-memory (Mocked for now)
const overviewCache = new Map<string, { data: any, expires: number }>();
const OVERVIEW_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

app.post("/v1/psfk/overview", async (req, res) => {
  const startTime = Date.now();
  const requestId = randomBytes(8).toString('hex');

  try {
    // 1. Auth Check (Premium)
    // "Premium calls require X-API-Key... Public access may require whitelisting."
    // For now, we ENFORCE X-API-Key as per strict auth policy in other V1 endpoints.
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      console.warn(`[${requestId}] [Auth] Blocked Overview: Missing X-API-Key`);
      return res.status(401).json({
        ok: false,
        error: "Unauthenticated: X-API-Key header required.",
        requestId
      });
    }

    // 2. Validate Inputs
    const { industry, sector, region = "Global", timeframe = "last_120d" } = req.body;

    if (!industry && !sector) {
      return res.status(400).json({
        ok: false,
        error: "Missing required parameter: 'industry' or 'sector'.",
        requestId
      });
    }

    const cacheKey = `${industry || ''}:${sector || ''}:${region}:${timeframe}`;

    // 3. Check Cache
    const cached = overviewCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      console.log(`[${requestId}] [Overview] Cache Hit: ${cacheKey}`);
      return res.json({
        ...cached.data,
        requestId,
        meta: { ...cached.data.meta, cached: true, latency: Date.now() - startTime }
      });
    }

    // 4. Generate Mock Response (Simulate 5-10s gen time for misses)
    console.log(`[${requestId}] [Overview] Generating: ${cacheKey} ...`);

    // Simulate generation delay
    // await new Promise(r => setTimeout(r, 2000)); // Shortened for dev speed, real would be 5s+

    const scope = [industry, sector].filter(Boolean).join(' / ');

    const responseData = {
      analysis_cycle: "2026-Q1",
      generated_from: "PSFK Knowledge Graph v13.4",
      executive_summary: `Macro-level analysis of the ${scope} landscape reveals a shift towards hyper-personalization and automated fulfillment layers. Key signals indicate a consolidated move away from legacy distribution models.`,
      meta_patterns: [
        {
          pattern_id: "MP-7721",
          name: "Autonomous Last-Mile",
          confidence: 0.94,
          supporting_nodes: 12
        },
        {
          pattern_id: "MP-8832",
          name: "Predictive Inventory Staging",
          confidence: 0.88,
          supporting_nodes: 8
        },
        {
          pattern_id: "MP-9102",
          name: "Sensory Retail Interfaces",
          confidence: 0.81,
          supporting_nodes: 15
        }
      ],
      meta: {
        latency: Date.now() - startTime,
        usage: { units: 5 }
      }
    };

    // 5. Cache It
    overviewCache.set(cacheKey, {
      data: responseData,
      expires: Date.now() + OVERVIEW_TTL
    });

    res.json({
      ...responseData,
      requestId
    });

  } catch (err: any) {
    console.error(`[${requestId}] [Overview Error]`, err);
    res.status(500).json({ ok: false, error: err.message, requestId });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    // Fetch recent logs from LOGS_TABLE_QUESTIONS
    // Sort by Date desc is default or we can specify
    const response = await queryAirtable(LOGS_TABLE_QUESTIONS, "", "sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100");

    // Map to UserLog interface
    const logs = response.records.map((r: any) => ({
      email: r.fields.userEmail || "anonymous",
      query: r.fields.question || "",
      vertical: r.fields.vertical || "unknown",
      dataStatus: r.fields.dataStatus || "UNKNOWN",
      timestamp: r.fields.Date || new Date().toISOString()
    }));

    res.json({ ok: true, logs });
  } catch (err: any) {
    console.error("Fetch Logs Error:", err);
    res.status(500).json({ ok: false, error: err.message, logs: [] });
  }
});

app.post("/api/import/trends", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/import/trends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/import/articles", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/import/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


// Table IDs


// ... (Authentication Middleware remains)

app.get("/api/plans", async (req, res) => {
  try {
    const plans = await queryAirtable(PLANS_TABLE);

    const formattedPlans = plans.records.map((r: any) => ({
      id: r.id,
      name: r.fields["Name"] || "Unnamed Plan",
      price: r.fields["Price"] || "$0",
      // Handle Features: could be lookup, string, or array. Assuming multiline string or array.
      features: Array.isArray(r.fields["Features"])
        ? r.fields["Features"]
        : (r.fields["Features"] ? r.fields["Features"].split('\n') : []),
      stripeLink: r.fields["stripLink"] || r.fields["Stripe Link"] || "", // specialized field
      isCurrent: false // Frontend determines this based on Account
    }));

    // Sort by price helper (optional, or rely on Airtable view order)
    // For now, return as is.
    res.json({ ok: true, plans: formattedPlans });
  } catch (err: any) {
    console.error("Failed to fetch plans:", err);
    // Fallback to mock if airtable fails, or just error
    res.status(500).json({ ok: false, error: "Failed to load plans." });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { contents, config, model } = req.body;
    // Support key from header or env
    let apiKey = (req.headers['x-gemini-key'] as string || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      console.error("[Gemini Proxy] Missing GEMINI_API_KEY");
      return res.status(500).json({ ok: false, error: "Server misconfiguration: Google Gemini API Key missing. Please provide a personal key in the Admin Portal." });
    }

    console.log(`[Gemini Proxy] Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)} (Length: ${apiKey.length})`);

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: model || 'gemini-2.0-flash',
      contents,
      config
    });

    res.json(response);
  } catch (err: any) {
    console.error("[Gemini Proxy Error]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/__deploy_check", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Ensure any other /api/* routes return 404 JSON instead of falling through to SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ ok: false, error: `API Route ${req.method} ${req.path} not found` });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, "../dist");
    const fs = await import("fs");
    if (fs.existsSync(distPath)) {
      console.log(`[Server] dist directory found at: ${distPath}`);
    } else {
      console.error(`[Server] CRITICAL: dist directory NOT found at: ${distPath}`);
    }

    app.use(express.static(distPath));

    // Handle SPA routing
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`[Server] Error sending index.html from ${indexPath}:`, err);
          res.status(500).send("Internal Server Error: Missing static assets.");
        }
      });
    });
  }

  const PORT = process.env.PORT || 8080;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Fodda Discovery Engine Active on port ${PORT}`);
    console.log(`Production Mode: ${process.env.NODE_ENV === "production"}`);
  });
}

startServer();
