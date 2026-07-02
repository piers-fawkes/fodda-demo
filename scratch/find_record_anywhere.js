import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';

const TABLES = {
    USERS_TABLE: 'tblGWh6XpdEZxw8AE',
    ACCOUNTS_TABLE: 'tblt6mh0XQOablFDX',
    API_KEYS_TABLE: 'tblsDGYv8pFpNegcf',
    PLANS_TABLE: 'tblq2T5OUyrDFCda9'
};

async function checkTable(tableName, tableId, id) {
    const filter = `RECORD_ID() = '${id}'`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    if (data.records && data.records.length > 0) {
        console.log(`Found in ${tableName} (${tableId}):`);
        console.log(JSON.stringify(data.records[0], null, 2));
        return true;
    }
    return false;
}

async function run() {
    const id = 'recCcMuuhlVl8HLDk';
    console.log(`Searching for ID ${id} across tables...`);
    for (const [name, tableId] of Object.entries(TABLES)) {
        const found = await checkTable(name, tableId, id);
        if (found) return;
    }
    console.log('Not found in any of the primary tables.');
}

run().catch(console.error);
