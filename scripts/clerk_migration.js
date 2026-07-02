/**
 * clerk_migration.js
 *
 * Bulk-migrates Airtable Users & Accounts → Clerk Orgs, Users, and Memberships.
 *
 * Usage:
 *   node scripts/clerk_migration.js          # live run
 *   node scripts/clerk_migration.js --dry    # preview only
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── Load .env from project root ──────────────────────────────────────────────
import { config } from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });

// ── Config ───────────────────────────────────────────────────────────────────
const AIRTABLE_PAT      = process.env.AIRTABLE_PAT;
const CLERK_SECRET_KEY   = process.env.CLERK_SECRET_KEY;
const AIRTABLE_BASE_ID   = 'appXUeeWN1uD9NdCW';
const AIRTABLE_API       = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const CLERK_API          = 'https://api.clerk.com/v1';
const DRY_RUN            = process.argv.includes('--dry');
const RATE_LIMIT_MS      = 60; // ~16 req/s, safely under Clerk's ~20 req/s

// ── Counters ─────────────────────────────────────────────────────────────────
const stats = {
  orgsCreated: 0,
  orgsSkipped: 0,
  orgsFailed: 0,
  usersCreated: 0,
  usersSkipped: 0,
  usersFailed: 0,
  membershipsCreated: 0,
  membershipsSkipped: 0,
  membershipsFailed: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(emoji, ...args) {
  console.log(`${emoji} `, ...args);
}

function logDry(...args) {
  if (DRY_RUN) console.log('  🔍 [DRY]', ...args);
}

/**
 * Fetch all records from an Airtable table, handling pagination.
 */
async function fetchAllAirtableRecords(tableName) {
  const records = [];
  let offset = undefined;

  do {
    const url = new URL(`${AIRTABLE_API}/${encodeURIComponent(tableName)}`);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${tableName} fetch failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

/**
 * PATCH an Airtable record to write-back Clerk IDs.
 */
async function patchAirtableRecord(tableName, recordId, fields) {
  if (DRY_RUN) {
    logDry(`Would PATCH ${tableName}/${recordId}`, JSON.stringify(fields));
    return;
  }

  const res = await fetch(`${AIRTABLE_API}/${encodeURIComponent(tableName)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable PATCH ${tableName}/${recordId} failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Make a rate-limited Clerk API call.
 */
async function clerkRequest(method, endpoint, body) {
  await sleep(RATE_LIMIT_MS);

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${CLERK_API}${endpoint}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const msg = data?.errors?.map((e) => e.long_message || e.message).join('; ') ||
                JSON.stringify(data);
    throw new Error(`Clerk ${method} ${endpoint} failed (${res.status}): ${msg}`);
  }

  return data;
}

// ── Phase 1: Fetch all data ─────────────────────────────────────────────────
async function phase1_fetchData() {
  log('📥', 'Phase 1: Fetching all Airtable data...');

  const [accountRecords, userRecords, planRecords] = await Promise.all([
    fetchAllAirtableRecords('tblt6mh0XQOablFDX'),
    fetchAllAirtableRecords('tblGWh6XpdEZxw8AE'),
    fetchAllAirtableRecords('tblq2T5OUyrDFCda9'),  // Plans table
  ]);

  log('✅', `Fetched ${accountRecords.length} Account records`);
  log('✅', `Fetched ${userRecords.length} User records`);
  log('✅', `Fetched ${planRecords.length} Plan records`);

  // Build plan lookup: Plan record ID → planCode
  const planCodeById = new Map();
  for (const plan of planRecords) {
    planCodeById.set(plan.id, Number(plan.fields.planCode || 0));
  }

  // Resolve each account's planCode from its linked Plan record
  for (const rec of accountRecords) {
    const planLink = rec.fields.Plan;
    if (planLink && planLink.length > 0) {
      rec.fields._resolvedPlanCode = planCodeById.get(planLink[0]) || 0;
    } else {
      rec.fields._resolvedPlanCode = 0;
    }
  }

  // Build lookup maps
  const accountsById = new Map(); // Airtable record ID → account record
  for (const rec of accountRecords) {
    accountsById.set(rec.id, rec);
  }

  return { accountRecords, userRecords, accountsById };
}

// ── Phase 2: Create Clerk Organizations ──────────────────────────────────────
async function phase2_createOrgs(accountRecords) {
  log('🏢', `Phase 2: Creating Clerk Organizations (${accountRecords.length} accounts)...`);

  // Only create Clerk orgs for PAID plans
  const PAID_PLAN_CODES = new Set([3, 4, 5, 6, 8, 10, 11, 12]);

  for (const account of accountRecords) {
    const { fields } = account;
    const accountName = fields['Account Name'] || '(unnamed)';
    const planCode = fields._resolvedPlanCode || 0;

    // Only paid accounts get a Clerk org
    if (!PAID_PLAN_CODES.has(planCode)) {
      log('⏭️ ', `Org SKIP (not paid, planCode=${planCode}): "${accountName}"`);
      stats.orgsSkipped++;
      continue;
    }

    // Skip deleted accounts
    if (fields.accountStatus === 'deleted') {
      log('⏭️ ', `Org SKIP (deleted): "${accountName}"`);
      stats.orgsSkipped++;
      continue;
    }

    // Idempotent: skip if already migrated
    if (fields.clerkOrgId) {
      log('⏭️ ', `Org SKIP (already has clerkOrgId): "${accountName}"`);
      stats.orgsSkipped++;
      continue;
    }

    try {
      const body = { name: accountName };

      if (DRY_RUN) {
        logDry(`Would CREATE org: "${accountName}"`);
        stats.orgsCreated++;
        continue;
      }

      const org = await clerkRequest('POST', '/organizations', body);
      log('✅', `Org CREATED: "${accountName}" → ${org.id}`);

      // Write clerkOrgId back to Airtable
      await patchAirtableRecord('tblt6mh0XQOablFDX', account.id, { clerkOrgId: org.id });
      fields.clerkOrgId = org.id; // update in-memory for Phase 4

      stats.orgsCreated++;
    } catch (err) {
      log('❌', `Org FAILED: "${accountName}" — ${err.message}`);
      stats.orgsFailed++;
    }
  }
}

// ── Phase 3: Create Clerk Users ──────────────────────────────────────────────
async function phase3_createUsers(userRecords, accountsById) {
  log('👤', `Phase 3: Creating Clerk Users (${userRecords.length} users)...`);

  for (const user of userRecords) {
    const { fields } = user;
    const email = fields.email;
    const displayName = fields['User Full Name'] || `${fields['First Name'] || ''} ${fields['Last Name'] || ''}`.trim();

    if (!email) {
      log('⚠️ ', `User SKIP (no email): record ${user.id} "${displayName}"`);
      stats.usersSkipped++;
      continue;
    }

    // Skip users on Trial plan (13) — they auto-register via sign-in fallback
    const linkedAccountId = fields.Account?.[0];
    if (linkedAccountId) {
      const linkedAccount = accountsById.get(linkedAccountId);
      if (linkedAccount) {
        const acctPlanCode = linkedAccount.fields._resolvedPlanCode || 0;
        if (acctPlanCode === 13) {
          log('⏭️ ', `User SKIP (Trial): "${email}"`);
          stats.usersSkipped++;
          continue;
        }
        if (linkedAccount.fields.accountStatus === 'deleted') {
          log('⏭️ ', `User SKIP (deleted account): "${email}"`);
          stats.usersSkipped++;
          continue;
        }
      }
    }

    // Idempotent: skip if already migrated
    if (fields.clerkUserId) {
      log('⏭️ ', `User SKIP (already has clerkUserId): "${email}"`);
      stats.usersSkipped++;
      continue;
    }

    try {
      const body = {
        email_address: [email],
        first_name: fields['First Name'] || undefined,
        last_name: fields['Last Name'] || undefined,
        skip_password_requirement: true,
        skip_password_checks: true,
        created_at: null,
      };

      if (DRY_RUN) {
        logDry(`Would CREATE user: "${email}" (${displayName})`);
        stats.usersCreated++;
        continue;
      }

      const clerkUser = await clerkRequest('POST', '/users', body);
      log('✅', `User CREATED: "${email}" → ${clerkUser.id}`);

      // Write clerkUserId back to Airtable
      await patchAirtableRecord('tblGWh6XpdEZxw8AE', user.id, { clerkUserId: clerkUser.id });
      fields.clerkUserId = clerkUser.id; // update in-memory for Phase 4

      stats.usersCreated++;
    } catch (err) {
      log('❌', `User FAILED: "${email}" — ${err.message}`);
      stats.usersFailed++;
    }
  }
}

// ── Phase 4: Add Members to Organizations ────────────────────────────────────
async function phase4_createMemberships(userRecords, accountsById) {
  log('🔗', `Phase 4: Creating Org Memberships...`);

  for (const user of userRecords) {
    const { fields } = user;
    const email = fields.email || '(no email)';
    const clerkUserId = fields.clerkUserId;

    if (!clerkUserId) {
      log('⏭️ ', `Membership SKIP (no clerkUserId): "${email}"`);
      stats.membershipsSkipped++;
      continue;
    }

    // User.Account is a linked-record array of Airtable record IDs
    const linkedAccountIds = fields.Account;
    if (!linkedAccountIds || linkedAccountIds.length === 0) {
      log('⏭️ ', `Membership SKIP (no linked Account): "${email}"`);
      stats.membershipsSkipped++;
      continue;
    }

    for (const accountRecordId of linkedAccountIds) {
      const account = accountsById.get(accountRecordId);
      if (!account) {
        log('⚠️ ', `Membership SKIP (Account record not found): "${email}" → ${accountRecordId}`);
        stats.membershipsSkipped++;
        continue;
      }

      const clerkOrgId = account.fields.clerkOrgId;
      if (!clerkOrgId) {
        log('⏭️ ', `Membership SKIP (Account has no clerkOrgId): "${email}" → "${account.fields['Account Name']}"`);
        stats.membershipsSkipped++;
        continue;
      }

      // Determine role
      const airtableRole = (fields.Role || '').toLowerCase();
      const clerkRole = (airtableRole === 'owner' || airtableRole === 'admin')
        ? 'org:admin'
        : 'org:member';

      try {
        if (DRY_RUN) {
          logDry(`Would ADD membership: "${email}" → "${account.fields['Account Name']}" as ${clerkRole}`);
          stats.membershipsCreated++;
          continue;
        }

        await clerkRequest('POST', `/organizations/${clerkOrgId}/memberships`, {
          user_id: clerkUserId,
          role: clerkRole,
        });

        log('✅', `Membership CREATED: "${email}" → "${account.fields['Account Name']}" as ${clerkRole}`);
        stats.membershipsCreated++;
      } catch (err) {
        log('❌', `Membership FAILED: "${email}" → "${account.fields['Account Name']}" — ${err.message}`);
        stats.membershipsFailed++;
      }
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log(DRY_RUN ? '  📋  DRY RUN SUMMARY' : '  📋  MIGRATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Organizations:  ${stats.orgsCreated} created, ${stats.orgsSkipped} skipped, ${stats.orgsFailed} failed`);
  console.log(`  Users:          ${stats.usersCreated} created, ${stats.usersSkipped} skipped, ${stats.usersFailed} failed`);
  console.log(`  Memberships:    ${stats.membershipsCreated} created, ${stats.membershipsSkipped} skipped, ${stats.membershipsFailed} failed`);
  console.log('═'.repeat(60) + '\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚀  Clerk Migration Script');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE RUN'}`);
  console.log('═'.repeat(60) + '\n');

  if (!AIRTABLE_PAT) throw new Error('Missing AIRTABLE_PAT in .env');
  if (!CLERK_SECRET_KEY) throw new Error('Missing CLERK_SECRET_KEY in .env');

  // Phase 1
  const { accountRecords, userRecords, accountsById } = await phase1_fetchData();

  // Phase 2
  await phase2_createOrgs(accountRecords);

  // Phase 3
  await phase3_createUsers(userRecords, accountsById);

  // Phase 4
  await phase4_createMemberships(userRecords, accountsById);

  // Done
  printSummary();
}

main().catch((err) => {
  console.error('\n💀 Fatal error:', err.message);
  process.exit(1);
});
