import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    const accountId = 'recV9QUqIkXGzM2xT';
    
    // Step 1: Look up account name by ID
    const accUrl = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}/${accountId}`;
    const accRes = await fetch(accUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const accData = await accRes.json();
    const accountName = accData.fields?.['Account Name'];
    console.log(`Account ID: ${accountId}`);
    console.log(`Account Name: "${accountName}"`);
    
    if (!accountName) {
        console.error('Account Name not found!');
        return;
    }
    
    // Step 2: Look up keys by Account Name
    const keyFilter = `AND({Account} = '${accountName.replace(/'/g, "\\'")}', {API Key Status} = 'Active')`;
    const keyUrl = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?filterByFormula=${encodeURIComponent(keyFilter)}`;
    const keyRes = await fetch(keyUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    const keyData = await keyRes.json();
    console.log(`Keys found: ${keyData.records ? keyData.records.length : 0}`);
    if (keyData.records) {
        keyData.records.forEach(k => {
            console.log(`- Key: ${k.fields['API Key']}`);
        });
    }
}

run().catch(console.error);
