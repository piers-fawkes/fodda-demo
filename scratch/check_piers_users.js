import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function run() {
    console.log('Querying 100 user records...');
    const url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?maxResults=100`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error('Fetch failed');
        return;
    }
    const data = await res.json();
    const records = data.records;
    const todayRecords = records.filter(r => r.createdTime.startsWith('2026-05-29'));
    console.log(`Found ${todayRecords.length} record(s) created on 2026-05-29:`);
    todayRecords.forEach(r => {
        console.log(`- ID: ${r.id}`);
        console.log(`  Email: "${r.fields.email}"`);
        console.log(`  User Full Name: "${r.fields['User Full Name']}"`);
        console.log(`  Account: ${JSON.stringify(r.fields.Account)}`);
        console.log(`  Created Time: ${r.createdTime}`);
    });
}

run().catch(console.error);
