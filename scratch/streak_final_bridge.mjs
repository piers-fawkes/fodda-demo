/**
 * Ultimate Streak Backfill & Cleanup
 * 
 * 1. Ensure all recent Airtable users (30d) have a box.
 * 2. Ensure all existing boxes in target stages have:
 *    - Email address in notes.
 *    - Company name in notes.
 *    - Date of Last Email (1007) set if unconfirmed.
 * 3. Use linkedEmails from box if available for matching.
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

function authHeader() {
  const encoded = Buffer.from(`${STREAK_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };
}

async function streakFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Streak Error: ${res.status} ${body}`);
    return null;
  }
  return res.json();
}

async function airtableFetch(formula) {
  const params = new URLSearchParams();
  if (formula) params.set('filterByFormula', formula);
  params.set('pageSize', '100');
  let allRecords = [], offset = null;
  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?${params}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  return allRecords;
}

async function main() {
  console.log('\n🚀 Ultimate Streak cleanup starting...\n');

  const pipelines = await streakFetch(`${STREAK_V1}/pipelines`);
  const pipeline = pipelines.find(p => p.name === PIPELINE_NAME);
  const pipelineKey = pipeline.pipelineKey || pipeline.key;

  const detail = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}`);
  const stages = detail.stages || {};
  const stageMap = {};
  for (const [k, v] of Object.entries(stages)) stageMap[v.name || v] = k;

  const targetStageKeys = [stageMap[STAGE_SELF_DEMO], stageMap[STAGE_NOT_CONFIRMED]];

  // 1. Load users from Airtable (30d)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await airtableFetch(`IS_AFTER(CREATED_TIME(), '${thirtyDaysAgo.toISOString().split('T')[0]}')`);
  console.log(`👥 Loaded ${users.length} recent users from Airtable`);

  const emailToUser = new Map();
  const nameToUser = new Map();
  for (const u of users) {
    const f = u.fields;
    const email = (f.email || '').toLowerCase().trim();
    const fullName = (f['User Full Name'] || `${f['First Name'] || ''} ${f['Last Name'] || ''}`.trim()).toLowerCase();
    const company = f.Company || '';
    const confirmed = !!f.emailConfirmed;
    
    const userObj = { email, fullName, company, confirmed };
    if (email) emailToUser.set(email, userObj);
    if (fullName) nameToUser.set(fullName, userObj);
  }

  // 2. Load all boxes
  const allBoxes = await streakFetch(`${STREAK_V1}/pipelines/${pipelineKey}/boxes`) || [];
  console.log(`📦 Loaded ${allBoxes.length} boxes from Streak`);

  let updated = 0;

  for (const box of allBoxes) {
    if (!targetStageKeys.includes(box.stageKey)) continue;

    const boxName = (box.name || '').trim();
    const notes = box.notes || '';
    const lowerName = boxName.toLowerCase();
    
    // Try to find matching user
    let user = null;
    
    // Try linked email
    if (box.linkedEmails && box.linkedEmails.length > 0) {
      for (const le of box.linkedEmails) {
        user = emailToUser.get(le.toLowerCase());
        if (user) break;
      }
    }
    
    // Try notes
    if (!user) {
      const match = notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match) {
        user = emailToUser.get(match[0].toLowerCase());
      }
    }
    
    // Try name match
    if (!user) {
      user = nameToUser.get(lowerName);
    }
    
    // If we have a user, check if we need to update notes
    if (user) {
      const hasEmail = notes.toLowerCase().includes(user.email);
      const stage = box.stageKey === stageMap[STAGE_SELF_DEMO] ? 'Self Demo' : 'Email Not Confirmed';
      
      if (!hasEmail) {
        const metadata = [
          `Email: ${user.email}`,
          `Company: ${user.company || 'N/A'}`,
          `Source: Self-Demo Sync (Cleanup)`,
          `Date: ${new Date().toISOString()}`
        ].join('\n');
        
        const finalNotes = notes ? `${notes}\n---\n${metadata}` : metadata;
        await streakFetch(`${STREAK_V1}/boxes/${box.boxKey}`, {
          method: 'POST',
          body: JSON.stringify({ notes: finalNotes })
        });
        console.log(`  ✅ Added email to notes for "${boxName}" (${user.email})`);
        updated++;
      }
      
      // Update date field for unconfirmed
      if (stage === 'Email Not Confirmed' && (!box.fields || !box.fields['1007'])) {
        await streakFetch(`${STREAK_V1}/boxes/${box.boxKey}/fields/1007`, {
          method: 'POST',
          body: JSON.stringify({ value: Date.now() })
        });
        console.log(`  📅 Updated date field for unconfirmed user "${boxName}"`);
      }
    } else {
      // console.log(`  ⏭ No match found for box "${boxName}"`);
    }
  }

  console.log(`\n✅ Done. Updated ${updated} boxes.`);
}

main().catch(console.error);
