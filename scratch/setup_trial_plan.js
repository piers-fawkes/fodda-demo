import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the Fodda App directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appXUeeWN1uD9NdCW';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';

if (!AIRTABLE_PAT) {
  console.error('Error: AIRTABLE_PAT is not set in environment.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${AIRTABLE_PAT}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('Fetching plans from Airtable...');
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch plans: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`Found ${data.records.length} plans.`);

  const trialPlan = data.records.find(r => String(r.fields.planCode) === '13');
  if (trialPlan) {
    console.log('Trial plan (planCode 13) already exists:', JSON.stringify(trialPlan.fields, null, 2));
    return;
  }

  console.log('Trial plan (planCode 13) not found. Creating it...');
  const newPlanFields = {
    "Package Name": "Trial",
    "planCode": "13",
    "Monthly API Limit": 25,
    "Graphs Included": "Single Graph",
    "Pricing": "One-Off",
    "billingMode": "one_time",
    "Target Audience": "New User",
    "showinApp?": false,
    "Includes Public APIs?": true,
    "Package Description": "- 25 API calls for your trial period\n- MCP & in-app access\n- Full evidence & source tracing"
  };

  const createRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ records: [{ fields: newPlanFields }] })
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create plan: ${createRes.status} ${await createRes.text()}`);
  }

  const createData = await createRes.json();
  console.log('Successfully created Trial plan:', JSON.stringify(createData.records[0].fields, null, 2));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
