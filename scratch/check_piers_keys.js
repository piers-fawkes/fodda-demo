import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    console.log('Querying keys for account recV9QUqIkXGzM2xT...');
    const filter = `AND({Account} = 'recV9QUqIkXGzM2xT', {API Key Status} = 'Active')`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`Found ${data.records ? data.records.length : 0} active keys:`);
    if (data.records) {
        data.records.forEach(r => {
            console.log(`- Key: ${r.fields['API Key']}`);
            console.log(`  Status: ${r.fields['API Key Status']}`);
        });
    }
}

run().catch(console.error);
