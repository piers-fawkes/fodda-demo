import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function queryAirtable(tableId: string, filterByFormula: string) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
    console.log(`Querying table ${tableId} with formula: ${filterByFormula}`);
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error (${res.status}): ${errorBody}`);
        return;
    }
    const data = await res.json();
    console.log(`Success! Found ${data.records.length} records.`);
}

async function run() {
    console.log("--- Testing Login Query ---");
    const email = "piers.fawkes@gmail.com";
    await queryAirtable(USERS_TABLE, `OR({email} = '${email}', {User Name} = '${email}')`);
}

run();
