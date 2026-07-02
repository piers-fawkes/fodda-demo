import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function run() {
    console.log('Querying record recGHhlUYzPRUWed4...');
    const url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}/recGHhlUYzPRUWed4`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error('Fetch failed');
        return;
    }
    const data = await res.json();
    console.log('Fields keys in USERS_TABLE:');
    console.log(Object.keys(data.fields));
    console.log('Exact email field value:', data.fields.email);
}

run().catch(console.error);
