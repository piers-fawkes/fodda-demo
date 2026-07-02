import 'dotenv/config';
import crypto from 'crypto';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';

const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

function escapeAirtableString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function queryAirtable(tableId, filterByFormula = "") {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
  if (!res.ok) {
    throw new Error(`Airtable query failed: ${res.status} - ${await res.text()}`);
  }
  return res.json();
}

async function createRecord(tableId, fields) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true })
  });
  if (!res.ok) {
    throw new Error(`Airtable create failed: ${res.status} - ${await res.text()}`);
  }
  return res.json();
}

async function updateRecord(tableId, recordId, fields) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} - ${await res.text()}`);
  }
  return res.json();
}

async function run() {
  const email = 'cneff@anomaly.com';
  const firstName = 'Chris';
  const lastName = 'Neff';
  const company = 'Anomaly';
  
  console.log(`Checking if user ${email} already exists...`);
  const existQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(email.toLowerCase())}'`);
  if (existQuery.records && existQuery.records.length > 0) {
    const userRec = existQuery.records[0];
    const accountId = userRec.fields.Account?.[0];
    console.log(`User already exists (ID: ${userRec.id}, Account ID: ${accountId})`);
    
    // Fetch active API Key
    const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(userRec.fields.AccountName || '')}', {API Key Status} = 'Active')`);
    let apiKey = keysQuery.records?.[0]?.fields?.['API Key'];
    
    if (!apiKey) {
      // Create new key
      const newKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
      await createRecord(API_KEYS_TABLE, {
        "API Key": newKey,
        "API Key Status": "Active",
        "Account": [accountId]
      });
      apiKey = newKey;
      console.log(`Generated new key for existing user: ${apiKey}`);
    } else {
      console.log(`Found existing active key: ${apiKey}`);
    }
    
    const mcpUrl = `https://mcp.fodda.ai/mcp?api_key=${apiKey}&user_id=${encodeURIComponent(email)}`;
    const claudeUrl = `https://claude.ai/integrations/mcp?url=${encodeURIComponent(mcpUrl)}`;
    console.log(`MCP URL: ${mcpUrl}`);
    console.log(`Claude Connector Link: ${claudeUrl}`);
    return;
  }
  
  console.log('Fetching Trial plan (planCode 13)...');
  const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 13`);
  const trialPlan = planQuery.records?.[0];
  if (!trialPlan) {
    throw new Error('Trial plan (planCode 13) not found in Plans table!');
  }
  console.log(`Found Trial plan (ID: ${trialPlan.id})`);
  
  console.log('Creating Account...');
  const todayISO = new Date().toISOString().split('T')[0];
  const accountFields = {
    "Account Name": `${company} (Trial)`,
    "legalName": `${company} (Trial)`,
    "signupCode": crypto.randomBytes(4).toString('hex').toUpperCase(),
    "vertical": "retail",
    "lastPaidDate": todayISO,
    "lastAmountPaid": 0,
    "sourceGraphId": "retail",
    "Plan": [trialPlan.id],
    "accountStatus": "active"
  };
  const accountRec = await createRecord(ACCOUNTS_TABLE, accountFields);
  const accountId = accountRec.records[0].id;
  console.log(`Account created (ID: ${accountId})`);
  
  console.log('Generating API Key...');
  const apiKeyString = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  await createRecord(API_KEYS_TABLE, {
    "API Key": apiKeyString,
    "API Key Status": "Active",
    "Account": [accountId]
  });
  console.log(`API Key created: ${apiKeyString}`);
  
  console.log('Generating unique handle...');
  const baseHandle = firstName.toLowerCase().replace(/[^a-z0-9]/g, "") || 'user';
  let uniqueHandle = baseHandle;
  let counter = 1;
  let isUnique = false;
  while (!isUnique && counter < 20) {
    const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
    if (!handleCk.records || handleCk.records.length === 0) {
      isUnique = true;
    } else {
      uniqueHandle = `${baseHandle}${counter}`;
      counter++;
    }
  }
  if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;
  console.log(`Unique handle resolved: ${uniqueHandle}`);
  
  console.log('Creating User...');
  const userFields = {
    "User Name": uniqueHandle,
    "First Name": firstName,
    "Last Name": lastName,
    "User Full Name": `${firstName} ${lastName}`,
    "email": email,
    "Role": "Owner",
    "Account": [accountId],
    "emailConfirmed": false,
    "Company": company,
    "Job Title": "CMO",
    "apiUse": "Mainly Claude",
    "onboardingIntent": "trial"
  };
  const userRec = await createRecord(USERS_TABLE, userFields);
  const userId = userRec.records[0].id;
  console.log(`User created (ID: ${userId})`);
  
  console.log('Linking Account Owner...');
  await updateRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });
  console.log('Account owner linked successfully!');
  
  const mcpUrl = `https://mcp.fodda.ai/mcp?api_key=${apiKeyString}&user_id=${encodeURIComponent(email)}`;
  const claudeUrl = `https://claude.ai/integrations/mcp?url=${encodeURIComponent(mcpUrl)}`;
  console.log('\n--- SUCCESS ---');
  console.log(`API Key: ${apiKeyString}`);
  console.log(`MCP URL: ${mcpUrl}`);
  console.log(`Claude Connector Link: ${claudeUrl}`);
}

run().catch(console.error);
