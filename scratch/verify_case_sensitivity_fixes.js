import 'dotenv/config';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
const USERS_TABLE = 'tblGWh6XpdEZxw8AE';

async function queryAirtable(tableId, filterByFormula) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
    console.log(`Querying: ${filterByFormula}`);
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error (${res.status}): ${errorBody}`);
        return null;
    }
    const data = await res.json();
    return data.records;
}

async function run() {
    console.log('🧪 Starting case-sensitivity verification tests on Airtable...');
    
    // We know 'piers.fawkes@gmail.com' exists (with some casing, e.g. mixed/lower).
    // Let's test three queries:
    // 1. Lowercase target on LOWER({email})
    // 2. Uppercase/mixed target on LOWER({email})
    // 3. Compare with standard case-sensitive {email} query on mismatched casing.
    
    const emailLower = 'piers.fawkes@gmail.com';
    const emailMixed = 'Piers.Fawkes@Gmail.com';
    
    console.log('\n--- 1. Lowercase lookup with LOWER() ---');
    const records1 = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${emailLower}'`);
    if (records1 && records1.length > 0) {
        console.log(`✅ Passed: found ${records1.length} record(s). Actual stored email: "${records1[0].fields.email}"`);
    } else {
        console.log('❌ Failed: could not find record with lowercase lookup');
    }

    console.log('\n--- 2. Mixed-case lookup with LOWER() ---');
    const records2 = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${emailMixed.toLowerCase()}'`);
    if (records2 && records2.length > 0) {
        console.log(`✅ Passed: found ${records2.length} record(s). Actual stored email: "${records2[0].fields.email}"`);
    } else {
        console.log('❌ Failed: could not find record with mixed-case lookup');
    }
    
    console.log('\n--- 3. Testing case-sensitive {email} lookup with mismatch ---');
    // If the database has it as 'piers.fawkes@gmail.com' and we query 'Piers.Fawkes@Gmail.com' case-sensitively:
    const records3 = await queryAirtable(USERS_TABLE, `{email} = '${emailMixed}'`);
    console.log(`Result: found ${records3 ? records3.length : 0} record(s).`);
    if (records3 && records3.length === 0) {
        console.log('ℹ️ As expected, standard case-sensitive check missed the record if stored in a different casing.');
    }
    
    console.log('\n🌟 Verification complete!');
}

run().catch(err => {
    console.error('Fatal error running verification:', err);
});
