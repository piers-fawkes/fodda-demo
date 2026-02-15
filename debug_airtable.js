

import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
const PLANS_TABLE = 'tblq2T5OUyrDFCda9';
const LOGS_TABLE_QUESTIONS = 'tblvHx1DzwuTq3TJE';

async function queryAirtable(tableId, filterByFormula) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
    console.log(`Querying table ${tableId} with formula: ${filterByFormula}`);
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error (${res.status}): ${errorBody}`);
        return;
    }
    const data = await res.json();
    console.log(`Success! Found ${data.records.length} records.`);
}

async function run() {
    console.log("--- Testing Users Table (Email) ---");
    await queryAirtable(USERS_TABLE, "{email} = 'piers.fawkes@psfk.com'");

    console.log("\n--- Testing Plans Table (Name) ---");
    await queryAirtable(PLANS_TABLE, "{Name} = 'Free'");

    console.log("\n--- Testing Users Table (User Name) ---");
    await queryAirtable(USERS_TABLE, "{User Name} = 'testuser'");

    console.log("\n--- Testing Plans Table (Plan Name) ---");
    await queryAirtable(PLANS_TABLE, "{Plan Name} = 'Free'");

    console.log("\n--- Testing Users Table (name - lowercase) ---");
    await queryAirtable(USERS_TABLE, "{name} = 'test'");
    console.log("\n--- Testing WRITE Permission (Create Log) ---");
    const logUrl = `https://api.airtable.com/v0/${BASE_ID}/${LOGS_TABLE_QUESTIONS}`;
    const logData = {
        fields: {
            "question": "DEBUG_TEST_WRITE",
            "userEmail": "debug@test.com",
            "Date": new Date().toISOString()
        }
    };
    try {
        const res = await fetch(logUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_PAT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });
        if (!res.ok) {
            console.error(`WRITE Failed (${res.status}): ${await res.text()}`);
        } else {
            const json = await res.json();
            console.log("WRITE Success! Created record:", json.id);
            // Cleanup?
        }
    } catch (e) {
        console.error("WRITE Error:", e);
    }
}

run();
