import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function run() {
  // 1. Check Clerk for David
  console.log('=== Searching Clerk for David ===');
  for (const email of ['dcutler@eatmedia.com', 'dctcutler@gmail.com']) {
    const res = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` }
    });
    const users = await res.json();
    if (Array.isArray(users) && users.length > 0) {
      for (const u of users) {
        console.log(`\nFound in Clerk: ${email}`);
        console.log('  Clerk ID:', u.id);
        console.log('  Name:', u.first_name, u.last_name);
        console.log('  Emails:', u.email_addresses?.map(e => `${e.email_address} (${e.verification?.status})`));
        console.log('  Created:', u.created_at);
        console.log('  Last sign in:', u.last_sign_in_at);
        console.log('  Unsafe metadata:', JSON.stringify(u.unsafe_metadata));
      }
    } else {
      console.log(`Not in Clerk: ${email}`);
    }
  }

  // 2. Activate the API key
  console.log('\n=== Activating API Key ===');
  const keyRecordId = 'rect1AKVzDGUFEgt7';
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}/${keyRecordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: { "API Key Status": "Active" } })
  });
  if (!res.ok) {
    console.error('Failed to activate key:', await res.text());
  } else {
    const data = await res.json();
    console.log('✅ API Key status:', data.fields['API Key Status']);
  }
}

run().catch(console.error);
