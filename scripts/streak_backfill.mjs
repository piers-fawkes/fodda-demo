/**
 * Streak Backfill Script
 * Queries Airtable for users created in last 7 days and adds them to the
 * Fodda Sales → Self Demo stage in Streak CRM.
 * 
 * Run: node scripts/streak_backfill.mjs
 */

const AIRTABLE_PAT = 'pat_REDACTED';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const STREAK_API_KEY = 'dea2e581262d41b3a6c2803657540bc1';
const STREAK_BASE = 'https://api.streak.com/api/v1';
const PIPELINE_NAME = 'Fodda Sales';
const TARGET_STAGE = 'Self Demo';
const PROMOTABLE_STAGES = ['Lead / Cold Call', 'In Contact'];

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

async function airtableFetch(sinceDate) {
  // Fetch all users, then filter by createdTime in JS (CREATED_TIME() formula is unreliable in filterByFormula for some bases)
  let allRecords = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?pageSize=100`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);

  // Filter to records created after sinceDate
  const since = new Date(sinceDate).getTime();
  return allRecords.filter(r => r.createdTime && new Date(r.createdTime).getTime() >= since);
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
  console.log(`✅ Stages found: ${Object.keys(stageMap).join(', ')}`);
}

async function findBoxByEmail(email) {
  // Try search first
  try {
    const results = await streakFetch(`/search?query=${encodeURIComponent(email)}`);
    const boxes = results.results?.boxes || results.boxes || [];
    const match = boxes.find(b => b.pipelineKey === pipelineKey);
    if (match) return match;
  } catch (e) {
    console.warn(`  ⚠ Search failed, scanning pipeline boxes...`);
  }
  // Fallback: scan pipeline boxes
  const boxes = await streakFetch(`/pipelines/${pipelineKey}/boxes`);
  for (const box of boxes) {
    const linkedEmails = box.linkedEmails || [];
    if (
      linkedEmails.some(e => e.toLowerCase() === email.toLowerCase()) ||
      (box.name || '').toLowerCase().includes(email.split('@')[0].toLowerCase())
    ) {
      return box;
    }
  }
  return null;
}

async function upsertToStreak(email, name, company) {
  const selfDemoStageKey = stageMap[TARGET_STAGE];
  if (!selfDemoStageKey) throw new Error(`Stage "${TARGET_STAGE}" not in stage map`);

  const existing = await findBoxByEmail(email);

  if (existing) {
    const currentStageName = Object.entries(stageMap).find(([, k]) => k === existing.stageKey)?.[0];
    console.log(`  📦 Existing box: "${existing.name}" — stage: "${currentStageName}"`);

    if (currentStageName && PROMOTABLE_STAGES.includes(currentStageName)) {
      await streakFetch(`/boxes/${existing.boxKey}`, {
        method: 'POST',
        body: JSON.stringify({ stageKey: selfDemoStageKey }),
      });
      console.log(`  ✅ Moved "${existing.name}" → Self Demo`);
    } else if (currentStageName === TARGET_STAGE) {
      console.log(`  ✔ Already in Self Demo — no change`);
    } else {
      console.log(`  ⏭ Stage "${currentStageName}" not promotable — skipping stage move`);
    }
    return { action: 'updated', box: existing.name };
  }

  // Create new box — build full URL to avoid path encoding issues with pipeline key
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
  console.log(`  ✅ Created new box: "${boxName}" in Self Demo (${newBox.boxKey})`);

  // Add notes with metadata
  if (company || email) {
    await streakFetch(`/boxes/${newBox.boxKey}`, {
      method: 'POST',
      body: JSON.stringify({
        notes: `Company: ${company || 'N/A'}\nEmail: ${email}\nSource: Self-Demo Sign-up (backfill)\nDate: ${new Date().toISOString()}`,
      }),
    });
  }
  return { action: 'created', box: boxName };
}

// ---------- main ----------

async function main() {
  console.log('\n🔧 Initialising Streak connection...');
  await init();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`\n📋 Querying Airtable for users created after ${sevenDaysAgo}...`);
  const records = await airtableFetch(sevenDaysAgo);
  console.log(`   Found ${records.length} user(s)\n`);

  if (records.length === 0) {
    console.log('No new users found in last 7 days.');
    return;
  }

  const results = [];

  for (const record of records) {
    const f = record.fields;
    const email = f['email'] || f['Email'];
    if (!email) {
      console.log(`  ⚠ Skipping record ${record.id} — no email field`);
      continue;
    }
    const name = `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim() || undefined;
    const companyRaw = f['Company'] || f['Account Name'] || '';
    const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
    const createdDate = record.createdTime ? new Date(record.createdTime).toLocaleDateString() : 'unknown';
    const confirmed = f['emailConfirmed'] ? '✔ confirmed' : '✖ unconfirmed';

    console.log(`👤 ${email} (${name || 'no name'}) — ${company || 'no company'} — signed up ${createdDate} [${confirmed}]`);

    try {
      const result = await upsertToStreak(email, name, company);
      results.push({ email, ...result });
    } catch (err) {
      console.error(`  ❌ Failed for ${email}:`, err.message);
      results.push({ email, action: 'error', error: err.message });
    }
    // Small delay to respect Streak rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n─────────────────────────────────────');
  console.log('📊 Summary:');
  const created = results.filter(r => r.action === 'created').length;
  const updated = results.filter(r => r.action === 'updated').length;
  const skipped = results.filter(r => r.action === 'updated' && r.box).length - updated;
  const errors  = results.filter(r => r.action === 'error').length;
  console.log(`   Created: ${created}`);
  console.log(`   Updated/moved: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log('\nUsers processed:');
  for (const r of results) {
    const icon = r.action === 'error' ? '❌' : r.action === 'created' ? '🆕' : '✔';
    console.log(`  ${icon} ${r.email} → ${r.action}${r.error ? ': ' + r.error : ''}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
