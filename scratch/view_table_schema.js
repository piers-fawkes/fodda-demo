import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function run() {
    console.log('Querying table metadata...');
    // Airtable Meta API requires the BASE_ID and tables endpoint
    const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        console.error('Fetch metadata failed:', await res.text());
        return;
    }
    const data = await res.json();
    const table = data.tables.find(t => t.id === API_KEYS_TABLE || t.name === 'API Keys');
    if (table) {
        console.log(`Table: ${table.name} (${table.id})`);
        console.log('Fields:');
        table.fields.forEach(f => {
            console.log(`- ${f.name} (Type: ${f.type})`);
        });
    } else {
        console.log('Table not found in metadata.');
    }
}

run().catch(console.error);
