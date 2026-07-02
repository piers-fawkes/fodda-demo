/**
 * clerk_cleanup.js
 *
 * Deletes ALL Clerk organizations and users, and clears clerkOrgId/clerkUserId
 * from Airtable. Run this before re-running the migration script.
 *
 * Usage:
 *   node scripts/clerk_cleanup.js --dry    # preview only
 *   node scripts/clerk_cleanup.js          # live run
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const CLERK_API = 'https://api.clerk.com/v1';
const DRY_RUN = process.argv.includes('--dry');
const RATE_LIMIT_MS = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clerkGet(endpoint) {
  await sleep(RATE_LIMIT_MS);
  const res = await fetch(`${CLERK_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk GET ${endpoint} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function clerkDelete(endpoint) {
  await sleep(RATE_LIMIT_MS);
  const res = await fetch(`${CLERK_API}${endpoint}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk DELETE ${endpoint} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function fetchAllAirtableRecords(tableName, filterFormula) {
  const records = [];
  let offset;
  do {
    const url = new URL(`${AIRTABLE_API}/${tableName}`);
    if (offset) url.searchParams.set('offset', offset);
    if (filterFormula) url.searchParams.set('filterByFormula', filterFormula);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    });
    if (!res.ok) throw new Error(`Airtable fetch failed: ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function patchAirtableRecord(tableName, recordId, fields) {
  if (DRY_RUN) return;
  const res = await fetch(`${AIRTABLE_API}/${tableName}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH failed: ${await res.text()}`);
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🧹  Clerk Cleanup Script');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE RUN'}`);
  console.log('═'.repeat(60) + '\n');

  // ── Step 1: Delete all Clerk Organizations ──
  console.log('🏢  Step 1: Deleting all Clerk Organizations...');
  let orgOffset = 0;
  let orgsDeleted = 0;
  let totalOrgs = 0;

  // Clerk pagination: limit + offset
  while (true) {
    const orgs = await clerkGet(`/organizations?limit=100&offset=${orgOffset}`);
    const orgList = orgs.data || orgs;
    if (!Array.isArray(orgList) || orgList.length === 0) break;
    totalOrgs += orgList.length;

    for (const org of orgList) {
      if (DRY_RUN) {
        console.log(`  🔍 [DRY] Would DELETE org: "${org.name}" (${org.id})`);
      } else {
        try {
          await clerkDelete(`/organizations/${org.id}`);
          console.log(`  ✅ Deleted org: "${org.name}" (${org.id})`);
        } catch (err) {
          console.log(`  ❌ Failed to delete org "${org.name}": ${err.message}`);
        }
      }
      orgsDeleted++;
    }

    if (orgList.length < 100) break;
    orgOffset += 100;
  }
  console.log(`  → ${orgsDeleted} orgs ${DRY_RUN ? 'would be' : ''} deleted\n`);

  // ── Step 2: Delete all Clerk Users ──
  console.log('👤  Step 2: Deleting all Clerk Users...');
  let userOffset = 0;
  let usersDeleted = 0;

  while (true) {
    const users = await clerkGet(`/users?limit=100&offset=${userOffset}`);
    const userList = users.data || users;
    if (!Array.isArray(userList) || userList.length === 0) break;

    for (const user of userList) {
      const email = user.email_addresses?.[0]?.email_address || user.id;
      if (DRY_RUN) {
        console.log(`  🔍 [DRY] Would DELETE user: "${email}" (${user.id})`);
      } else {
        try {
          await clerkDelete(`/users/${user.id}`);
          console.log(`  ✅ Deleted user: "${email}" (${user.id})`);
        } catch (err) {
          console.log(`  ❌ Failed to delete user "${email}": ${err.message}`);
        }
      }
      usersDeleted++;
    }

    if (userList.length < 100) break;
    userOffset += 100;
  }
  console.log(`  → ${usersDeleted} users ${DRY_RUN ? 'would be' : ''} deleted\n`);

  // ── Step 3: Clear clerkOrgId from Airtable Accounts ──
  console.log('📋  Step 3: Clearing clerkOrgId from Airtable Accounts...');
  const accounts = await fetchAllAirtableRecords(ACCOUNTS_TABLE, "NOT({clerkOrgId} = '')");
  let accountsCleared = 0;
  for (const acc of accounts) {
    if (DRY_RUN) {
      console.log(`  🔍 [DRY] Would clear clerkOrgId from: "${acc.fields['Account Name']}"`);
    } else {
      await patchAirtableRecord(ACCOUNTS_TABLE, acc.id, { clerkOrgId: '' });
      console.log(`  ✅ Cleared clerkOrgId: "${acc.fields['Account Name']}"`);
    }
    accountsCleared++;
  }
  console.log(`  → ${accountsCleared} accounts ${DRY_RUN ? 'would be' : ''} cleared\n`);

  // ── Step 4: Clear clerkUserId from Airtable Users ──
  console.log('📋  Step 4: Clearing clerkUserId from Airtable Users...');
  const users = await fetchAllAirtableRecords(USERS_TABLE, "NOT({clerkUserId} = '')");
  let usersCleared = 0;
  for (const user of users) {
    if (DRY_RUN) {
      console.log(`  🔍 [DRY] Would clear clerkUserId from: "${user.fields.email}"`);
    } else {
      await patchAirtableRecord(USERS_TABLE, user.id, { clerkUserId: '' });
      console.log(`  ✅ Cleared clerkUserId: "${user.fields.email}"`);
    }
    usersCleared++;
  }
  console.log(`  → ${usersCleared} users ${DRY_RUN ? 'would be' : ''} cleared\n`);

  // ── Summary ──
  console.log('═'.repeat(60));
  console.log(DRY_RUN ? '  📋  DRY RUN SUMMARY' : '  📋  CLEANUP SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Clerk Orgs deleted:       ${orgsDeleted}`);
  console.log(`  Clerk Users deleted:      ${usersDeleted}`);
  console.log(`  Airtable clerkOrgId cleared:  ${accountsCleared}`);
  console.log(`  Airtable clerkUserId cleared: ${usersCleared}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('\n💀 Fatal error:', err.message);
  process.exit(1);
});
