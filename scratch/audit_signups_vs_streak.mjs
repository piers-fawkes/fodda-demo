/**
 * Audit: Cross-reference recent Airtable signups against Streak pipeline.
 * 
 * For each user who signed up in the last 30 days:
 *   - Check if they exist in the "Fodda Sales" Streak pipeline
 *   - Report their stage if found
 *   - Flag if missing and try to explain why
 */

import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_BASE = 'https://api.streak.com/api/v1';
const PIPELINE_NAME = 'Fodda Sales';

// ---- Airtable helpers ----

async function airtableFetch(tableId, formula, fields = []) {
  const params = new URLSearchParams();
  if (formula) params.set('filterByFormula', formula);
  for (const f of fields) params.append('fields[]', f);
  params.set('pageSize', '100');

  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return (await res.json()).records || [];
}

// ---- Streak helpers ----

function streakAuth() {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function streakFetch(path) {
  const url = path.startsWith('http') ? path : `${STREAK_BASE}${path}`;
  const res = await fetch(url, { headers: streakAuth() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Streak ${res.status} ${path}: ${body}`);
  }
  return res.json();
}

// ---- Main ----

async function main() {
  console.log('🔍 Auditing recent sign-ups vs Streak pipeline...\n');

  // 1. Get pipeline + stages
  const pipelines = await streakFetch('/pipelines');
  const pipeline = pipelines.find(p => p.name === PIPELINE_NAME);
  if (!pipeline) throw new Error(`Pipeline "${PIPELINE_NAME}" not found`);
  const pipelineKey = pipeline.pipelineKey || pipeline.key;
  console.log(`✅ Pipeline: "${PIPELINE_NAME}" (${pipelineKey})`);

  const pipelineDetail = await streakFetch(`/pipelines/${pipelineKey}`);
  const stages = pipelineDetail.stages || {};
  const stageKeyToName = {};
  for (const [key, val] of Object.entries(stages)) {
    stageKeyToName[key] = val.name || val;
  }
  console.log(`   Stages: ${Object.values(stageKeyToName).join(', ')}\n`);

  // 2. Get all boxes in the pipeline (with emails)
  console.log('📦 Fetching all Streak boxes...');
  const allBoxes = await streakFetch(`/pipelines/${pipelineKey}/boxes`);
  console.log(`   Found ${allBoxes.length} boxes\n`);

  // Build a lookup: lowercase email → box info
  const emailToBox = new Map();
  const nameToBox = new Map();
  for (const box of allBoxes) {
    // Check linkedEmails
    for (const email of (box.linkedEmails || [])) {
      emailToBox.set(email.toLowerCase(), box);
    }
    // Also index by box name (sometimes matches email prefix or full name)
    if (box.name) {
      nameToBox.set(box.name.toLowerCase(), box);
    }
  }

  // 3. Get recent signups from Airtable (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const formula = `IS_AFTER(CREATED_TIME(), '${thirtyDaysAgo.toISOString().split('T')[0]}')`;
  
  console.log(`👥 Fetching users created after ${thirtyDaysAgo.toISOString().split('T')[0]}...`);
  const users = await airtableFetch(USERS_TABLE, formula, [
    'email', 'First Name', 'Last Name', 'emailConfirmed', 'Company', 'User Full Name'
  ]);
  console.log(`   Found ${users.length} recent users\n`);

  // 4. Cross-reference
  const results = { found: [], missing: [] };

  for (const user of users) {
    const f = user.fields;
    const email = (f.email || '').toLowerCase();
    const name = f['User Full Name'] || `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim();
    const confirmed = !!f.emailConfirmed;
    const company = f.Company || '';

    // Try finding in Streak by email
    let box = emailToBox.get(email);

    // Fallback: try by name
    if (!box && name) {
      box = nameToBox.get(name.toLowerCase());
    }

    // Fallback: try by email prefix
    if (!box && email) {
      const prefix = email.split('@')[0].toLowerCase();
      box = nameToBox.get(prefix);
    }

    if (box) {
      const stageName = stageKeyToName[box.stageKey] || 'Unknown';
      results.found.push({ email, name, company, confirmed, stageName, boxName: box.name });
    } else {
      // Try a direct Streak search as last resort
      let searchMatch = null;
      if (email) {
        try {
          const searchResults = await streakFetch(`/search?query=${encodeURIComponent(email)}`);
          const boxes = searchResults.results?.boxes || searchResults.boxes || [];
          searchMatch = boxes.find(b => b.pipelineKey === pipelineKey);
          if (searchMatch) {
            const stageName = stageKeyToName[searchMatch.stageKey] || 'Unknown';
            results.found.push({ email, name, company, confirmed, stageName, boxName: searchMatch.name, foundVia: 'search API' });
            continue;
          }
        } catch (e) {
          // search failed, still missing
        }
      }

      // Determine likely reason
      let reason = '';
      if (!confirmed) {
        reason = '❌ Email NOT confirmed — Streak sync only fires on confirmation';
      } else if (!STREAK_API_KEY) {
        reason = '❌ STREAK_API_KEY was not set at deploy time';
      } else {
        reason = '⚠️  Email IS confirmed — should have been added. Possible API error at confirmation time.';
      }

      results.missing.push({ email, name, company, confirmed, reason });
    }

    // Small delay for Streak rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  // 5. Report
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅ FOUND IN STREAK');
  console.log('═══════════════════════════════════════════════════════');
  if (results.found.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const r of results.found) {
      console.log(`  📧 ${r.email}`);
      console.log(`     Name: ${r.name} | Company: ${r.company}`);
      console.log(`     Stage: ${r.stageName} | Box: "${r.boxName}"${r.foundVia ? ` (found via ${r.foundVia})` : ''}`);
      console.log(`     Email confirmed: ${r.confirmed ? 'Yes' : 'No'}`);
      console.log();
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  ❌ NOT FOUND IN STREAK');
  console.log('═══════════════════════════════════════════════════════');
  if (results.missing.length === 0) {
    console.log('  (none — all users synced!) 🎉\n');
  } else {
    for (const r of results.missing) {
      console.log(`  📧 ${r.email}`);
      console.log(`     Name: ${r.name} | Company: ${r.company}`);
      console.log(`     Email confirmed: ${r.confirmed ? 'Yes' : 'No'}`);
      console.log(`     Reason: ${r.reason}`);
      console.log();
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${results.found.length} in Streak, ${results.missing.length} missing`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
