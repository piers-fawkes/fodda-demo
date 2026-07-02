import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function query(tableId, formula, fields) {
  let url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;
  if (fields) fields.forEach(f => url += `&fields[]=${encodeURIComponent(f)}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  if (!res.ok) { console.error(`Error ${res.status}:`, await res.text()); return { records: [] }; }
  return res.json();
}

async function run() {
  // Find users with no clerkUserId, created recently (emailConfirmed = false OR true)
  // who have never logged in
  console.log('=== Users with no clerkUserId (potential stuck signups) ===\n');
  
  const result = await query(USERS_TABLE, 
    `AND({clerkUserId} = '', {Role} = 'Owner')`,
    ['email', 'First Name', 'emailConfirmed', 'lastLogin', 'clerkUserId', 'buyer_type', 'onboardingIntent', 'apiUse']
  );
  
  const records = result.records || [];
  console.log(`Total users with no clerkUserId and Role=Owner: ${records.length}\n`);
  
  for (const r of records) {
    const f = r.fields;
    console.log(`  ${f.email || 'NO EMAIL'}`);
    console.log(`    Created: ${r.createdTime}`);
    console.log(`    emailConfirmed: ${f.emailConfirmed || false}`);
    console.log(`    lastLogin: ${f.lastLogin || 'NEVER'}`);
    console.log(`    buyer_type: ${f.buyer_type || 'NOT ENRICHED'}`);
    console.log(`    onboardingIntent: ${f.onboardingIntent || 'none'}`);
    console.log('');
  }
}

run().catch(console.error);
