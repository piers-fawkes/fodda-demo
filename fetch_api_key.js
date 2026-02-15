
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf';

async function fetchApiKey() {
    console.log("Fetching API Key...");
    const url = `https://api.airtable.com/v0/${BASE_ID}/${API_KEYS_TABLE}?maxRecords=1`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
        });
        if (!res.ok) {
            console.error(`Error fetching key: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(text);
            return;
        }
        const data = await res.json();
        if (data.records && data.records.length > 0) {
            const key = data.records[0].fields['API Key'];
            console.log(`FOUND KEY: ${key}`);
        } else {
            console.log("No keys found in table.");
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

fetchApiKey();
