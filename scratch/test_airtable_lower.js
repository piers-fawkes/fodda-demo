import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function queryAirtable(tableId, filterByFormula) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        return null;
    }
    const data = await res.json();
    return data.records;
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
    return res.json();
}

async function deleteRecord(tableId, recordId) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
    await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
}

async function run() {
    console.log('Creating user with mixed-case email: Test.Casing.Email@gmail.com');
    const userRes = await createRecord(USERS_TABLE, {
        "User Name": "testcasing" + Date.now().toString().slice(-4),
        "email": "Test.Casing.Email@gmail.com",
        "Role": "Employee",
        "User Full Name": "Test Casing"
    });
    const recordId = userRes.records[0].id;
    console.log(`Created record: ${recordId}`);

    try {
        console.log('\n--- 1. Querying with LOWER({email}) and lowercase target ---');
        const r1 = await queryAirtable(USERS_TABLE, `LOWER({email}) = 'test.casing.email@gmail.com'`);
        console.log(`Matched records: ${r1 ? r1.length : 0}`);
        if (r1 && r1.length > 0) {
            console.log(`✅ MATCHED! email value: "${r1[0].fields.email}"`);
        }

        console.log('\n--- 2. Querying with case-sensitive {email} and lowercase target ---');
        const r2 = await queryAirtable(USERS_TABLE, `{email} = 'test.casing.email@gmail.com'`);
        console.log(`Matched records: ${r2 ? r2.length : 0}`);

        console.log('\n--- 3. Querying with case-sensitive {email} and mixed-case target ---');
        const r3 = await queryAirtable(USERS_TABLE, `{email} = 'Test.Casing.Email@gmail.com'`);
        console.log(`Matched records: ${r3 ? r3.length : 0}`);
        if (r3 && r3.length > 0) {
            console.log(`✅ MATCHED! email value: "${r3[0].fields.email}"`);
        }
    } finally {
        console.log(`\nCleaning up created record ${recordId}...`);
        await deleteRecord(USERS_TABLE, recordId);
        console.log('Cleaned up.');
    }
}

run().catch(console.error);
