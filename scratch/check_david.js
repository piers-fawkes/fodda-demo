import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function query(tableId, formula) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  if (!res.ok) { console.error(`Error ${res.status}:`, await res.text()); return { records: [] }; }
  return res.json();
}

async function run() {
  // Look up the API key directly by value
  const keys = await query(API_KEYS_TABLE, `{API Key} = 'sk_live_REDACTED'`);
  if (keys.records.length === 0) {
    console.log('API key not found');
    return;
  }
  const k = keys.records[0];
  console.log('=== API Key Record ===');
  console.log('Record ID:', k.id);
  console.log('API Key:', k.fields['API Key']);
  console.log('Status:', k.fields['API Key Status']);
  console.log('Account:', k.fields['Account']);
  console.log('All fields:', JSON.stringify(k.fields, null, 2));
}

run().catch(console.error);
