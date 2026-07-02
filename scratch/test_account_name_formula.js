import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function testFormula(label, filter) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`\n--- Formula: ${label} ---`);
    console.log(`Query: ${filter}`);
    console.log(`Found: ${data.records ? data.records.length : 0} records.`);
    if (data.records) {
        data.records.forEach(r => {
            console.log(`  - Key: ${r.fields['API Key']} (Account relation: ${JSON.stringify(r.fields.Account)})`);
        });
    }
}

async function run() {
    // We try to query by Account Name
    await testFormula('Account Name match', `{Account} = "Jess's Trial Account"`);
}

run().catch(console.error);
