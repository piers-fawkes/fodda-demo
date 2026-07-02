import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';

async function listPlansDetails() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error(await res.text());
        return;
    }
    const data = await res.json();
    for (const record of data.records) {
        console.log(`Plan Name: ${record.fields['Package Name'] || record.fields['Name']}`);
        console.log(`Fields:`, JSON.stringify(record.fields, null, 2));
        console.log(`-----------------------------------`);
    }
}

listPlansDetails();
