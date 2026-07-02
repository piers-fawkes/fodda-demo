/**
 * Streak Backfill — All recent users (30 days)
 * 
 * - Confirmed users → "Self Demo" stage
 * - Unconfirmed real users → "Email Not Confirmed" stage
 * - Test accounts → skipped
 * 
 * Uses Streak API v2 for box creation (v1 POST broken for our pipeline key).
 * Uses v1 for box updates/notes (still works fine).
 * 
 * Run: node scratch/streak_backfill_final.mjs
 */

import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const STREAK_API_KEY = process.env.STREAK_API_KEY;
const STREAK_V1 = 'https://api.streak.com/api/v1';
const STREAK_V2 = 'https://api.streak.com/api/v2';
const PIPELINE_NAME = 'Fodda Sales';

const STAGE_SELF_DEMO = 'Self Demo';
const STAGE_NOT_CONFIRMED = 'Email Not Confirmed';
const PROMOTABLE_STAGES = ['Lead / Cold Call', 'In Contact'];

// Skip obvious test/garbage accounts
const SKIP_PATTERNS = [
  /@example\.com$/i,
  /^test[\+@]/i,
  /^debug/i,
  /^repro_/i,
  /^bob@gmail\.com$/i,
  /^hh@t\.com$/i,
  /^piers\+test/i,
  /^piers\.fawkes\+test/i,
  /^finaltest/i,
];

function isTestAccount(email) {
  return SKIP_PATTERNS.some(p => p.test(email));
}

// ---------- helpers ----------

function authHeader() {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function streakFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Streak ${opts.method || 'GET'} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function airtableFetch(formula, fields = []) {
  const params = new URLSearchParams();
  if (formula) params.set('filterByFormula', formula);
  for (const f of fields) params.append('fields[]', f);
  params.set('pageSize', '100');

  let allRecords = [];
  let offset = null;
  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?${params}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return allRecords;
}

// ---------- Streak pipeline ----------

let pipelineKey = null;
let stageMap = {};

async function init() {
  const pipelines = await streakFetch(`${STREAK_V1}/pipelines`);
  const pipeline = pipelines.find(p => p.name === PIPELINE_NAME);
  if (!pipeline) throw new Error(`Pipeline "${PIPELINE_NAME}" not found`);
  pipelineKey = pipeline.pipelineKey || pipeline.key;

  const detail = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}`);
  const stages = detail.stages || {};
  for (const [key, val] of Object.entries(stages)) {
    stageMap[val.name || val] = key;
  }
  console.log(`✅ Pipeline: "${PIPELINE_NAME}"`);
  console.log(`   Stages: ${Object.keys(stageMap).join(', ')}\n`);
}

// ---------- Box cache ----------

let emailToBox = new Map();
let nameToBox = new Map();

async function loadAllBoxes() {
  console.log('📦 Loading all Streak boxes...');
  const boxes = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}/boxes`);
  for (const box of boxes) {
    for (const email of (box.linkedEmails || [])) {
      emailToBox.set(email.toLowerCase(), box);
    }
    if (box.name) nameToBox.set(box.name.toLowerCase(), box);
  }
  console.log(`   Loaded ${boxes.length} boxes\n`);
}

function findBox(email, name) {
  let box = emailToBox.get(email.toLowerCase());
  if (box) return box;
  
  const prefix = email.split('@')[0].toLowerCase();
  box = nameToBox.get(prefix);
  if (box) return box;
  
  if (name) {
    box = nameToBox.get(name.toLowerCase());
    if (box) return box;
  }
  return null;
}

// ---------- Box creation (v2) and update (v1) ----------

async function createBox(name, stageKey, email, company) {
  // Use v2 API for box creation — v1 POST is broken for our pipeline key
  const newBox = await streakFetch(`${STREAK_V2}/pipelines/${pipelineKey}/boxes`, {
    method: 'POST',
    body: JSON.stringify({ name, stageKey }),
  });

  // Add notes via v1
  const notes = [
    `Company: ${company || 'N/A'}`,
    `Email: ${email}`,
    `Source: Self-Demo Sign-up (backfill ${new Date().toISOString().split('T')[0]})`,
    `Date: ${new Date().toISOString()}`
  ].join('\n');

  await streakFetch(`${STREAK_V1}/boxes/${newBox.boxKey}`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });

  return newBox;
}

async function moveBoxToStage(boxKey, stageKey) {
  await streakFetch(`${STREAK_V1}/boxes/${boxKey}`, {
    method: 'POST',
    body: JSON.stringify({ stageKey }),
  });
}

// ---------- main ----------

async function main() {
  console.log('\n🔧 Streak Backfill — All recent users (last 30 days)\n');
  await init();
  await loadAllBoxes();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const formula = `IS_AFTER(CREATED_TIME(), '${thirtyDaysAgo.toISOString().split('T')[0]}')`;

  console.log(`📋 Fetching users since ${thirtyDaysAgo.toISOString().split('T')[0]}...`);
  const users = await airtableFetch(formula, [
    'email', 'First Name', 'Last Name', 'emailConfirmed', 'Company', 'User Full Name'
  ]);
  console.log(`   Found ${users.length} users\n`);

  const selfDemoKey = stageMap[STAGE_SELF_DEMO];
  const notConfirmedKey = stageMap[STAGE_NOT_CONFIRMED];
  if (!selfDemoKey) throw new Error(`Stage "${STAGE_SELF_DEMO}" not found`);
  if (!notConfirmedKey) throw new Error(`Stage "${STAGE_NOT_CONFIRMED}" not found — please create it in Streak`);

  const results = { created_demo: [], created_unconfirmed: [], already_ok: [], left_alone: [], promoted: [], skipped: [], errors: [] };

  for (const user of users) {
    const f = user.fields;
    const email = (f.email || '').trim();
    if (!email) continue;

    const name = f['User Full Name'] || `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim();
    const company = f.Company || '';
    const confirmed = !!f.emailConfirmed;

    if (isTestAccount(email)) {
      results.skipped.push(email);
      continue;
    }

    const statusLabel = confirmed ? '✔ confirmed' : '✖ unconfirmed';
    console.log(`\n👤 ${email} — ${name} — ${company} [${statusLabel}]`);

    try {
      const existing = findBox(email, name);

      if (existing) {
        const currentStage = Object.entries(stageMap).find(([, k]) => k === existing.stageKey)?.[0];
        console.log(`  📦 Existing: "${existing.name}" — stage: "${currentStage}"`);

        if (currentStage === STAGE_SELF_DEMO || currentStage === STAGE_NOT_CONFIRMED) {
          // If confirmed but in "Email Not Confirmed", promote
          if (confirmed && currentStage === STAGE_NOT_CONFIRMED) {
            await moveBoxToStage(existing.boxKey, selfDemoKey);
            console.log(`  ✅ Promoted → Self Demo`);
            results.promoted.push({ email, name, from: currentStage });
          } else {
            console.log(`  ✔ Already in correct stage`);
            results.already_ok.push({ email, name, stage: currentStage });
          }
        } else if (PROMOTABLE_STAGES.includes(currentStage)) {
          // If confirmed and at a promotable stage, move up
          if (confirmed) {
            await moveBoxToStage(existing.boxKey, selfDemoKey);
            console.log(`  ✅ Promoted from "${currentStage}" → Self Demo`);
            results.promoted.push({ email, name, from: currentStage });
          } else {
            console.log(`  ⏭ Unconfirmed but already at "${currentStage}" — leaving`);
            results.left_alone.push({ email, name, stage: currentStage });
          }
        } else {
          console.log(`  ⏭ Stage "${currentStage}" — leaving as-is`);
          results.left_alone.push({ email, name, stage: currentStage });
        }
      } else {
        // No box — create one
        const targetStage = confirmed ? STAGE_SELF_DEMO : STAGE_NOT_CONFIRMED;
        const targetKey = confirmed ? selfDemoKey : notConfirmedKey;
        const boxName = name || email.split('@')[0];

        const newBox = await createBox(boxName, targetKey, email, company);
        console.log(`  🆕 Created: "${boxName}" → ${targetStage} (${newBox.boxKey})`);

        if (confirmed) {
          results.created_demo.push({ email, name, company });
        } else {
          results.created_unconfirmed.push({ email, name, company });
        }
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      results.errors.push({ email, error: err.message });
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // ─── Summary ───
  console.log('\n═══════════════════════════════════════');
  console.log('📊 BACKFILL SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  🆕 Created → Self Demo:          ${results.created_demo.length}`);
  console.log(`  🆕 Created → Email Not Confirmed: ${results.created_unconfirmed.length}`);
  console.log(`  ✅ Already in correct stage:       ${results.already_ok.length}`);
  console.log(`  📈 Promoted to Self Demo:          ${results.promoted.length}`);
  console.log(`  ⏭ Left at existing stage:         ${results.left_alone.length}`);
  console.log(`  🧪 Test accounts skipped:          ${results.skipped.length}`);
  console.log(`  ❌ Errors:                         ${results.errors.length}`);

  if (results.created_demo.length > 0) {
    console.log('\n🆕 Created → Self Demo:');
    for (const r of results.created_demo) console.log(`   ${r.email} (${r.name}, ${r.company})`);
  }
  if (results.created_unconfirmed.length > 0) {
    console.log('\n🆕 Created → Email Not Confirmed:');
    for (const r of results.created_unconfirmed) console.log(`   ${r.email} (${r.name}, ${r.company})`);
  }
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const r of results.errors) console.log(`   ${r.email}: ${r.error}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
