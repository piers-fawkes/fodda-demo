import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    const id = 'recCSx3MHWYCKzebC';
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}/${id}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
