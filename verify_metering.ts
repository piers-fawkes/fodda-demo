import fetch from 'node-fetch';

const API_URL = 'http://localhost:8080/api';
const API_URL_V1 = 'http://localhost:8080/v1';
const TEST_KEY = 'sk_live_test_key_12345'; // We don't need a real key if we just want to see the response structure (it might fail auth, but we can check the error structure too)

// Note: This script assumes the server is running locally on 8080.

async function testQueryStructure(graphId: string, expectedUnits: number) {
    console.log(`Testing query for graph: ${graphId} (Expected Units: ${expectedUnits})...`);
    try {
        const res = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'ANY_KEY' // The mock resolver might return something or fail, but we want to see the JSON structure if it hits our code
            },
            body: JSON.stringify({ q: 'test', graphId })
        });

        const body = await res.json();
        console.log(`Response received (status ${res.status}):`, JSON.stringify(body, null, 2));

        if (body.meta && body.meta.usage) {
            const usage = body.meta.usage;
            console.log(`✅ Found meta.usage envelope.`);
            if (usage.units === expectedUnits) {
                console.log(`✅ Units match expected: ${usage.units}`);
            } else {
                console.log(`❌ Units mismatch. Got ${usage.units}, expected ${expectedUnits}`);
            }
            if (usage.graphId.toLowerCase().includes(graphId.toLowerCase())) {
                console.log(`✅ graphId matches.`);
            }
        } else if (body.error && body.requestId) {
            // If it failed auth, it might not have the usage yet depending on where the error was thrown.
            // But our code wraps the SUCCESS response.
            console.log(`ℹ️ Request failed (likely auth), but returned requestId: ${body.requestId}`);
        } else {
            console.log(`❌ Response envelope missing meta.usage`);
        }
    } catch (e: any) {
        console.error(`❌ Test failed: ${e.message}`);
    }
}

async function run() {
    console.log('--- STARTING METERING VERIFICATION ---');
    // We'll test with a few different IDs
    await testQueryStructure('PSFK', 1.0);
    await testQueryStructure('Waldo', 1.5);
    await testQueryStructure('SIC', 2.0);
    await testQueryStructure('Baseline', 0.5);
    console.log('--- VERIFICATION COMPLETE ---');
}

run();
