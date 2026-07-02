import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function checkAccountKeys(accountId) {
    console.log(`\nQuerying keys for account ${accountId}...`);
    const filter = `{Account} = '${accountId}'`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`Found ${data.records ? data.records.length : 0} keys:`);
    if (data.records) {
        data.records.forEach(r => {
            console.log(`- ID: ${r.id}`);
            console.log(`  Key: ${r.fields['API Key']}`);
            console.log(`  Status: ${r.fields['API Key Status']}`);
            console.log(`  Account: ${JSON.stringify(r.fields.Account)}`);
        });
    }
}

async function run() {
    const accounts = ['recCcMuuhlVl8HLDk', 'rec4Ui2FgQgo5BTOW', 'recX0X3khtQHOYPMv'];
    for (const acc of accounts) {
        await checkAccountKeys(acc);
    }
}

run().catch(console.error);
