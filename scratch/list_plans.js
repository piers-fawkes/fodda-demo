import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';

async function listPlans() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}`;
    console.log(`Querying plans table...`);
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error (${res.status}): ${errorBody}`);
        return;
    }
    const data = await res.json();
    console.log(`Found ${data.records.length} plans:`);
    for (const record of data.records) {
        console.log(JSON.stringify({
            id: record.id,
            name: record.fields.Name || record.fields['Package Name'] || record.fields['Plan Name'],
            planCode: record.fields.planCode,
            limit: record.fields['Monthly Query Limit'],
            price: record.fields.price,
            billingMode: record.fields.billingMode
        }, null, 2));
    }
}

listPlans();
