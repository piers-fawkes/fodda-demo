import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';

async function viewFreePlan() {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${PLANS_TABLE}/recFePJbSswaTTmHX`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error(await res.text());
        return;
    }
    const record = await res.json();
    console.log(`Fields for Base - Free:`, JSON.stringify(record.fields, null, 2));
}

viewFreePlan();
