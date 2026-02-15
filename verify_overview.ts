
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:8080';
// Use the same key from verify_mcp_harness.ts
const API_KEY = process.env.FODDA_API_KEY || '';

async function testOverview() {
    console.log('\n--- Testing /v1/psfk/overview ---');

    const params = {
        industry: "Retail",
        sector: "Luxury",
        region: "North America",
        timeframe: "last_90d"
    };

    console.log("1. Sending VALID request...");
    try {
        const t0 = Date.now();
        const res = await fetch(`${API_BASE_URL}/v1/psfk/overview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(params)
        });

        const data: any = await res.json();
        console.log(`   Status: ${res.status} (${Date.now() - t0}ms)`);

        if (res.ok) {
            console.log('   ✅ Valid Response Received');
            if (data.analysis_cycle) console.log('   ✅ Structure: Analysis Cycle present');
            if (data.generated_from) console.log('   ✅ Structure: Generated From present');
            if (data.meta_patterns?.length > 0) console.log(`   ✅ Content: ${data.meta_patterns.length} Meta Patterns`);
        } else {
            console.log('   ❌ Request Failed:', JSON.stringify(data));
        }

    } catch (e: any) {
        console.error('   ❌ Request Error:', e.message);
    }

    console.log("\n2. Sending INVALID request (Missing params)...");
    try {
        const res = await fetch(`${API_BASE_URL}/v1/psfk/overview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({}) // Missing industry/sector
        });
        const data: any = await res.json();
        if (res.status === 400) {
            console.log('   ✅ Correctly Rejected (400 Bad Request)');
        } else {
            console.log(`   ❌ Unexpected Status: ${res.status}`, data);
        }
    } catch (e: any) {
        console.error('   ❌ Request Error:', e.message);
    }

    console.log("\n3. Sending UNAUTHENTICATED request...");
    try {
        const res = await fetch(`${API_BASE_URL}/v1/psfk/overview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No Key
            },
            body: JSON.stringify(params)
        });
        const data: any = await res.json();
        if (res.status === 401) {
            console.log('   ✅ Correctly Rejected (401 Unauthorized)');
        } else {
            console.log(`   ❌ Unexpected Status: ${res.status}`, data);
        }
    } catch (e: any) {
        console.error('   ❌ Request Error:', e.message);
    }
}

testOverview();
