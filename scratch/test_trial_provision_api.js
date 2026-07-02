import 'dotenv/config';

const INTERNAL_KEY = process.env.FODDA_INTERNAL_API_KEY || 'fodda-internal-service-key';

async function callApi(email) {
    const url = 'https://app.fodda.ai/api/account/trial-provision';
    console.log(`Calling API for: ${email}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-fodda-internal-key': INTERNAL_KEY
        },
        body: JSON.stringify({
            email,
            firstName: 'Piers',
            lastName: 'Fawkes',
            company: 'Test Case Insensitive',
            suppressEmail: true
        })
    });
    const status = res.status;
    const data = await res.json();
    console.log(`Status: ${status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
}

async function run() {
    console.log('🚀 Testing live trial provisioning case-insensitivity...');
    
    // 1. Call with lowercase (should match the existing record recGHhlUYzPRUWed4)
    console.log('\n--- 1. Lowercase test ---');
    const r1 = await callApi('piers.fawkes@gmail.com');
    
    // 2. Call with mixed case (should ALSO match the existing record and return alreadyExists: true)
    console.log('\n--- 2. Mixed case test ---');
    const r2 = await callApi('Piers.Fawkes@Gmail.com');
    
    if (r2.alreadyExists) {
        console.log('\n✅ SUCCESS: case-insensitive match worked!');
    } else {
        console.log('\n❌ FAILURE: mixed case created a new key/record!');
    }
}

run().catch(console.error);
