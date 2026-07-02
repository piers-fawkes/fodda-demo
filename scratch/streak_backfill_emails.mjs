/**
 * Backfill email addresses into Streak box notes for recently-created boxes.
 * Cross-references Airtable users with Streak boxes in Self Demo / Email Not Confirmed
 * and ensures each box has the user's email in notes.
 * 
 * Note: Streak's emailAddresses field is read-only (populated by Gmail threads).
 * The notes field is the best programmatic way to associate an email with a box.
 */

import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_V1 = 'https://api.streak.com/api/v1';
const PIPELINE_NAME = 'Fodda Sales';

function authHeader() {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function streakFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Streak ${res.status}: ${await res.text()}`);
  return res.json();
}

async function airtableFetch(formula, fields = []) {
  const params = new URLSearchParams();
  if (formula) params.set('filterByFormula', formula);
  for (const f of fields) params.append('fields[]', f);
  params.set('pageSize', '100');
  let allRecords = [], offset = null;
  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?${params}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return allRecords;
}

async function main() {
  console.log('\n🔧 Backfilling email addresses into Streak box notes\n');

  // Get pipeline
  const pipelines = await streakFetch(`${STREAK_V1}/pipelines`);
  const pipeline = pipelines.find(p => p.name === PIPELINE_NAME);
  const pipelineKey = pipeline.pipelineKey || pipeline.key;

  // Get stages
  const detail = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}`);
  const stages = detail.stages || {};
  const stageKeyToName = {};
  for (const [k, v] of Object.entries(stages)) stageKeyToName[k] = v.name || v;

  // Target stages
  const targetStageKeys = Object.entries(stageKeyToName)
    .filter(([, name]) => name === 'Self Demo' || name === 'Email Not Confirmed')
    .map(([key]) => key);
  console.log(`Target stages: ${targetStageKeys.map(k => stageKeyToName[k]).join(', ')}\n`);

  // Get all boxes
  const allBoxes = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}/boxes`);
  const targetBoxes = allBoxes.filter(b => targetStageKeys.includes(b.stageKey));
  console.log(`📦 ${targetBoxes.length} boxes in target stages (${allBoxes.length} total)\n`);

  // Get Airtable users (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await airtableFetch(
    `IS_AFTER(CREATED_TIME(), '${thirtyDaysAgo.toISOString().split('T')[0]}')`,
    ['email', 'First Name', 'Last Name', 'emailConfirmed', 'Company', 'User Full Name']
  );
  console.log(`👥 ${users.length} recent Airtable users\n`);

  // Build name/email lookup from Airtable
  const nameToUser = new Map();
  for (const u of users) {
    const f = u.fields;
    const name = (f['User Full Name'] || `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim()).toLowerCase();
    if (name) nameToUser.set(name, { email: f.email, company: f.Company || '', confirmed: !!f.emailConfirmed });
  }

  let updated = 0, skipped = 0, notMatched = 0;

  for (const box of targetBoxes) {
    const stage = stageKeyToName[box.stageKey];
    const boxName = (box.name || '').trim();
    const existingNotes = box.notes || '';
    const hasEmail = existingNotes.toLowerCase().includes('email:') || existingNotes.includes('@');

    // Try to match box to Airtable user by name
    const user = nameToUser.get(boxName.toLowerCase());

    if (!user) {
      console.log(`  ⚠️ No Airtable match for box "${boxName}" [${stage}]`);
      notMatched++;
      continue;
    }

    if (hasEmail && existingNotes.includes(user.email)) {
      console.log(`  ✔ "${boxName}" already has email in notes`);
      skipped++;
      continue;
    }

    // Build updated notes
    const newNotes = [
      `Email: ${user.email}`,
      `Company: ${user.company || 'N/A'}`,
      `Source: Self-Demo Sign-up`,
      `Date: ${new Date().toISOString()}`
    ].join('\n');
    
    const finalNotes = existingNotes 
      ? `${existingNotes}\n---\n${newNotes}` 
      : newNotes;

    await streakFetch(`${STREAK_V1}/boxes/${box.boxKey}`, {
      method: 'POST',
      body: JSON.stringify({ notes: finalNotes }),
    });

    // Also set the Date of Last Email field (1007) for Email Not Confirmed boxes
    if (stage === 'Email Not Confirmed') {
      try {
        await streakFetch(`${STREAK_V1}/boxes/${box.boxKey}/fields/1007`, {
          method: 'POST',
          body: JSON.stringify({ value: Date.now() }),
        });
      } catch (e) {}
    }

    console.log(`  ✅ Updated "${boxName}" — added ${user.email} [${stage}]`);
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`📊 SUMMARY: ${updated} updated, ${skipped} already OK, ${notMatched} no match`);
  console.log(`═══════════════════════════════════════`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
