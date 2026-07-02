import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function searchAirtable() {
  console.log('--- Searching Airtable for "cneff@anomaly.com" ---');
  
  // Search Users table
  const userFilter = `OR(FIND('cneff', LOWER({email})), FIND('anomaly', LOWER({email})))`;
  const userUrl = `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?filterByFormula=${encodeURIComponent(userFilter)}`;
  const userRes = await fetch(userUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  const userData = await userRes.json();
  
  console.log(`Users found: ${userData.records?.length || 0}`);
  userData.records?.forEach(r => {
    console.log(`User: ${r.fields.fullName} (${r.fields.email})`);
    console.log(`  ID: ${r.id}`);
    console.log(`  Account: ${JSON.stringify(r.fields.Account)}`);
  });

  // Search Accounts table
  const accountFilter = `OR(FIND('anomaly', LOWER({name})), FIND('cneff', LOWER({name})))`;
  const accountUrl = `https://api.airtable.com/v0/${BASE_ID}/${ACCOUNTS_TABLE}?filterByFormula=${encodeURIComponent(accountFilter)}`;
  const accountRes = await fetch(accountUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  const accountData = await accountRes.json();
  
  console.log(`\nAccounts found: ${accountData.records?.length || 0}`);
  accountData.records?.forEach(r => {
    console.log(`Account Name: ${r.fields.name} (Plan: ${r.fields.planName}, Code: ${r.fields.planCode})`);
    console.log(`  ID: ${r.id}`);
  });

  // Search Keys table
  // Fetch keys and find any key associated with these accounts
  if (accountData.records?.length > 0) {
    const accountIds = accountData.records.map(r => r.id);
    const keysUrl = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}`;
    const keysRes = await fetch(keysUrl, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    const keysData = await keysRes.json();
    
    console.log(`\nKeys linked to these accounts:`);
    keysData.records?.forEach(r => {
      const acc = r.fields.Account;
      if (acc && acc.some(id => accountIds.includes(id))) {
        console.log(`Key: ${r.fields['API Key']} | Status: ${r.fields['API Key Status']} | Account: ${JSON.stringify(acc)}`);
      }
    });
  }
}

searchAirtable().catch(console.error);
