import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    console.log('Querying latest 20 keys...');
    // We sort by createdTime descending (using a standard sort in Airtable if available, or just fetch and sort locally)
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?maxRecords=50`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error('Fetch failed:', await res.text());
        return;
    }
    const data = await res.json();
    console.log(`Total keys returned: ${data.records ? data.records.length : 0}`);
    
    // Sort by createdTime descending
    const sorted = (data.records || []).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    
    sorted.slice(0, 10).forEach(r => {
        console.log(`- ID: ${r.id}`);
        console.log(`  Key: ${r.fields['API Key']}`);
        console.log(`  Status: ${r.fields['API Key Status']}`);
        console.log(`  Account: ${JSON.stringify(r.fields.Account)}`);
        console.log(`  Created: ${r.createdTime}`);
    });
}

run().catch(console.error);
