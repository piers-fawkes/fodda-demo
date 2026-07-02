/**
 * Generate an API key for a manually-added Airtable account.
 * 
 * Usage: npx tsx scripts/generate-api-key.ts "Next Revolution Group"
 * 
 * Looks up the account by name, generates a sk_live_ key,
 * creates it in the API Keys table, and prints the result.
 */

import { randomBytes } from 'crypto';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

if (!AIRTABLE_PAT) {
  console.error('❌ AIRTABLE_PAT env var is required. Set it or run with: AIRTABLE_PAT=pat... npx tsx scripts/generate-api-key.ts "Account Name"');
  process.exit(1);
}

const accountName = process.argv[2];
if (!accountName) {
  console.error('❌ Usage: npx tsx scripts/generate-api-key.ts "Account Name"');
  process.exit(1);
}

async function main() {
  // 1. Find the account by name
  const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}?filterByFormula=${encodeURIComponent(`{Account Name} = '${accountName}'`)}`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
  if (!searchRes.ok) {
    console.error('❌ Airtable query failed:', await searchRes.text());
    process.exit(1);
  }
  const searchData = await searchRes.json();
  
  if (!searchData.records || searchData.records.length === 0) {
    console.error(`❌ No account found with name "${accountName}"`);
    console.error('   Check the exact name in Airtable (case-sensitive).');
    process.exit(1);
  }

  const account = searchData.records[0];
  const accountId = account.id;
  console.log(`✅ Found account: "${account.fields['Account Name']}" (${accountId})`);

  // 2. Check if there's already an active API key
  const existingKeysUrl = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(`AND({Account} = '${accountId}', {API Key Status} = 'Active')`)}`;
  const existingRes = await fetch(existingKeysUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    if (existingData.records && existingData.records.length > 0) {
      const existingKey = existingData.records[0].fields['API Key'];
      console.log(`⚠️  Account already has an active API key: ${existingKey}`);
      console.log(`   MCP URL: https://mcp.fodda.ai/mcp?api_key=${existingKey}`);
      console.log(`   If you want a NEW key, revoke the existing one in Airtable first.`);
      return;
    }
  }

  // 3. Generate a new API key
  const apiKey = `sk_live_${randomBytes(24).toString('hex')}`;

  // 4. Create the key record in Airtable
  const createUrl = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      records: [{
        fields: {
          "API Key": apiKey,
          "API Key Status": "Active",
          "Account": [accountId]
        }
      }],
      typecast: true
    })
  });

  if (!createRes.ok) {
    console.error('❌ Failed to create API key:', await createRes.text());
    process.exit(1);
  }

  const createData = await createRes.json();
  const keyRecordId = createData.records[0].id;

  console.log(`\n🎉 API Key created successfully!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Account:  ${accountName}`);
  console.log(`   Key:      ${apiKey}`);
  console.log(`   MCP URL:  https://mcp.fodda.ai/mcp?api_key=${apiKey}`);
  console.log(`   Record:   ${keyRecordId}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
