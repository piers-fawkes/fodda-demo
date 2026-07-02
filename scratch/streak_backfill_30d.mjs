/**
 * Streak Backfill — 30-day confirmed users
 * 
 * Queries Airtable for email-confirmed users created in the last 30 days
 * and ensures they exist in the Fodda Sales → Self Demo stage in Streak CRM.
 * Skips test accounts (@example.com, test+, debug, repro_).
 * 
 * Run: node scratch/streak_backfill_30d.mjs
 */

import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_BASE = 'https://api.streak.com/api/v1';
const PIPELINE_NAME = 'Fodda Sales';
const TARGET_STAGE = 'Self Demo';
const PROMOTABLE_STAGES = ['Lead / Cold Call', 'In Contact'];

// Test account patterns to skip
const SKIP_PATTERNS = [
  /@example\.com$/i,
  /^test[\+@]/i,
  /^debug/i,
  /^repro_/i,
  /^bob@gmail\.com$/i,
  /^hh@t\.com$/i,
];

function isTestAccount(email) {
  return SKIP_PATTERNS.some(p => p.test(email));
}

// ---------- helpers ----------

function authHeader() {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function streakFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${STREAK_BASE}${path}`;
  const res = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Streak ${opts.method || 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function airtableFetch(tableId, formula, fields = []) {
  const params = new URLSearchParams();
  if (formula) params.set('filterByFormula', formula);
  for (const f of fields) params.append('fields[]', f);
  params.set('pageSize', '100');

  let allRecords = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);

  return allRecords;
}

// ---------- Streak pipeline / stage lookup ----------

let pipelineKey = null;
let stageMap = {};

async function init() {
  const pipelines = await streakFetch('/pipelines');
  const pipeline = pipelines.find(p => p.name === PIPELINE_NAME);
  if (!pipeline) throw new Error(`Pipeline "${PIPELINE_NAME}" not found`);
  pipelineKey = pipeline.pipelineKey || pipeline.key;
  console.log(`✅ Pipeline: "${PIPELINE_NAME}" → ${pipelineKey}`);

  const detail = await streakFetch(`/pipelines/${pipelineKey}`);
  const stages = detail.stages || {};
  for (const [key, val] of Object.entries(stages)) {
    const name = (val && val.name) ? val.name : val;
    stageMap[name] = key;
  }
  console.log(`✅ Stages: ${Object.keys(stageMap).join(', ')}\n`);
}

// Cache all boxes once
let allBoxesCache = null;
let emailToBoxCache = null;

async function loadAllBoxes() {
  if (allBoxesCache) return;
  console.log('📦 Loading all Streak boxes (one-time)...');
  allBoxesCache = await streakFetch(`/pipelines/${pipelineKey}/boxes`);
  emailToBoxCache = new Map();
  for (const box of allBoxesCache) {
    for (const email of (box.linkedEmails || [])) {
      emailToBoxCache.set(email.toLowerCase(), box);
    }
    if (box.name) {
      // Also check name-based matching
      emailToBoxCache.set(`__name__${box.name.toLowerCase()}`, box);
    }
  }
  console.log(`   Loaded ${allBoxesCache.length} boxes\n`);
}

async function findBoxByEmail(email) {
  await loadAllBoxes();
  
  // Check cached linked emails
  let box = emailToBoxCache.get(email.toLowerCase());
  if (box) return box;

  // Check by name (email prefix)
  const prefix = email.split('@')[0].toLowerCase();
  box = emailToBoxCache.get(`__name__${prefix}`);
  if (box) return box;

  // Try Streak search API as last resort
  try {
    const results = await streakFetch(`/search?query=${encodeURIComponent(email)}`);
    const boxes = results.results?.boxes || results.boxes || [];
    const match = boxes.find(b => b.pipelineKey === pipelineKey);
    if (match) return match;
  } catch (e) {
    // search failed
  }

  return null;
}

async function upsertToStreak(email, name, company) {
  const selfDemoStageKey = stageMap[TARGET_STAGE];
  if (!selfDemoStageKey) throw new Error(`Stage "${TARGET_STAGE}" not in stage map`);

  const existing = await findBoxByEmail(email);

  if (existing) {
    const currentStageName = Object.entries(stageMap).find(([, k]) => k === existing.stageKey)?.[0];
    console.log(`  📦 Existing: "${existing.name}" — stage: "${currentStageName}"`);

    if (currentStageName && PROMOTABLE_STAGES.includes(currentStageName)) {
      await streakFetch(`/boxes/${existing.boxKey}`, {
        method: 'POST',
        body: JSON.stringify({ stageKey: selfDemoStageKey }),
      });
      console.log(`  ✅ Moved → Self Demo`);
      return { action: 'promoted', box: existing.name, from: currentStageName };
    } else if (currentStageName === TARGET_STAGE) {
      console.log(`  ✔ Already in Self Demo`);
      return { action: 'already_ok', box: existing.name };
    } else {
      console.log(`  ⏭ Stage "${currentStageName}" — leaving as-is`);
      return { action: 'left_alone', box: existing.name, stage: currentStageName };
    }
  }

  // Create new box
  const boxName = name || email.split('@')[0];
  const createUrl = `${STREAK_BASE}/pipelines/${pipelineKey}/boxes`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ name: boxName, stageKey: selfDemoStageKey }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Streak box create → ${createRes.status}: ${body}`);
  }
  const newBox = await createRes.json();
  console.log(`  🆕 Created box: "${boxName}" in Self Demo (${newBox.boxKey})`);

  // Add notes
  if (company || email) {
    await streakFetch(`/boxes/${newBox.boxKey}`, {
      method: 'POST',
      body: JSON.stringify({
        notes: `Company: ${company || 'N/A'}\nEmail: ${email}\nSource: Self-Demo Sign-up (backfill ${new Date().toISOString().split('T')[0]})\nDate: ${new Date().toISOString()}`,
      }),
    });
  }

  // Add to cache so we don't re-create if script is re-run
  emailToBoxCache.set(email.toLowerCase(), newBox);

  return { action: 'created', box: boxName };
}

// ---------- main ----------

async function main() {
  console.log('\n🔧 Streak Backfill — Confirmed users, last 30 days\n');
  await init();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const formula = `AND(IS_AFTER(CREATED_TIME(), '${thirtyDaysAgo.toISOString().split('T')[0]}'), {emailConfirmed} = TRUE())`;

  console.log(`📋 Querying Airtable for confirmed users since ${thirtyDaysAgo.toISOString().split('T')[0]}...`);
  const users = await airtableFetch(USERS_TABLE, formula, [
    'email', 'First Name', 'Last Name', 'emailConfirmed', 'Company', 'User Full Name'
  ]);
  console.log(`   Found ${users.length} confirmed users\n`);

  if (users.length === 0) {
    console.log('No confirmed users found in the last 30 days.');
    return;
  }

  const results = { created: [], already_ok: [], left_alone: [], promoted: [], skipped: [], errors: [] };

  for (const user of users) {
    const f = user.fields;
    const email = (f.email || '').trim();
    if (!email) continue;

    const name = f['User Full Name'] || `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim();
    const company = f.Company || '';

    if (isTestAccount(email)) {
      console.log(`  ⏭ Skipping test account: ${email}`);
      results.skipped.push(email);
      continue;
    }

    console.log(`\n👤 ${email} — ${name} — ${company}`);

    try {
      const result = await upsertToStreak(email, name, company);
      results[result.action]?.push({ email, name, company, ...result });
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      results.errors.push({ email, error: err.message });
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 BACKFILL SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  🆕 Created in Streak:     ${results.created.length}`);
  console.log(`  ✅ Already in Self Demo:   ${results.already_ok.length}`);
  console.log(`  ⏭ Left at existing stage: ${results.left_alone.length}`);
  console.log(`  📈 Promoted to Self Demo: ${results.promoted.length}`);
  console.log(`  🧪 Test accounts skipped: ${results.skipped.length}`);
  console.log(`  ❌ Errors:                ${results.errors.length}`);

  if (results.created.length > 0) {
    console.log('\n🆕 Newly created:');
    for (const r of results.created) {
      console.log(`   ${r.email} → "${r.box}"`);
    }
  }
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const r of results.errors) {
      console.log(`   ${r.email}: ${r.error}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
