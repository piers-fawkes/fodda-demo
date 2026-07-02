import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';

async function run() {
    console.log('Querying Accounts table by formula...');
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}?maxRecords=10`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log('Response status:', res.status);
    console.log('Response body:', JSON.stringify(data, null, 2));
}

run().catch(console.error);
