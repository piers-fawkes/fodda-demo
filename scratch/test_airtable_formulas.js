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
    console.log(`Status: ${res.status}`);
    console.log(`Found: ${data.records ? data.records.length : 0} records.`);
    if (data.records) {
        data.records.forEach(r => {
            console.log(`  - Key: ${r.fields['API Key']} (Status: ${r.fields['API Key Status']})`);
        });
    }
}

async function run() {
    const accountId = 'recV9QUqIkXGzM2xT';
    
    // Formula 1: Direct comparison
    await testFormula('Direct comparison', `AND({Account} = '${accountId}', {API Key Status} = 'Active')`);
    
    // Formula 2: FIND
    await testFormula('FIND in array', `AND(FIND('${accountId}', {Account}), {API Key Status} = 'Active')`);
    
    // Formula 3: SEARCH
    await testFormula('SEARCH', `AND(SEARCH('${accountId}', {Account}), {API Key Status} = 'Active')`);
    
    // Formula 4: Account only (no status)
    await testFormula('Account only', `{Account} = '${accountId}'`);
}

run().catch(console.error);
