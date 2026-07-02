import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function checkKey(key) {
    const filter = `{API Key} = '${key}'`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`Key ${key}: found ${data.records ? data.records.length : 0} records.`);
    if (data.records && data.records.length > 0) {
        console.log(JSON.stringify(data.records[0], null, 2));
    }
}

async function run() {
    await checkKey('sk_live_REDACTED');
    await checkKey('sk_live_REDACTED');
}

run().catch(console.error);
