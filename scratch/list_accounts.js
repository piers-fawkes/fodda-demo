import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';

async function listAccounts() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}?maxRecords=5`;
    console.log(`Querying accounts table...`);
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error (${res.status}): ${errorBody}`);
        return;
    }
    const data = await res.json();
    console.log(`Found ${data.records.length} accounts:`);
    for (const record of data.records) {
        console.log(JSON.stringify({
            id: record.id,
            fields: record.fields
        }, null, 2));
    }
}

listAccounts();
