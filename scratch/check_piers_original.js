import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    const email = 'piers.fawkes@gmail.com';
    const filter = `LOWER({email}) = '${email}'`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    console.log(`Found ${data.records ? data.records.length : 0} user records for ${email}:`);
    if (data.records) {
        for (const r of data.records) {
            console.log(`\n- User ID: ${r.id}`);
            console.log(`  Name: ${r.fields['User Full Name']}`);
            console.log(`  Email: ${r.fields.email}`);
            console.log(`  Account: ${JSON.stringify(r.fields.Account)}`);
            const accountId = r.fields.Account?.[0];
            if (accountId) {
                // Check key
                const keyFilter = `AND({Account} = '${accountId}', {API Key Status} = 'Active')`;
                const keyUrl = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(keyFilter)}`;
                const keyRes = await fetch(keyUrl, {
                    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
                });
                const keyData = await keyRes.json();
                console.log(`  Active keys: ${keyData.records ? keyData.records.length : 0}`);
                if (keyData.records) {
                    keyData.records.forEach(k => {
                        console.log(`    - Key: ${k.fields['API Key']}`);
                    });
                }
            }
        }
    }
}

run().catch(console.error);
