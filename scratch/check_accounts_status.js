import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';

async function checkAccount(id) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}/${id}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`Account ${id}:`, JSON.stringify(data, null, 2));
}

async function run() {
    await checkAccount('recCcMuuhlVl8HLDk');
    await checkAccount('recX0X3khtQHOYPMv');
}

run().catch(console.error);
