
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:8080';
const API_KEY = process.env.FODDA_API_KEY || '';

async function testSystemValidation() {
    console.log('\n--- Testing /v1/system/validation ---');
    try {
        const res = await fetch(`${API_BASE_URL}/v1/system/validation`);
        const data: any = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (data.ok && data.deterministic_mode_status === 'ENFORCED') {
            console.log('✅ System Validation Passed');
        } else {
            console.log('❌ System Validation Failed');
        }
    } catch (e: any) {
        console.error('❌ System Validation Error:', e.message);
    }
}

async function testDualMode() {
    console.log('\n--- Testing Dual Mode (Direct vs MCP) ---');

    const query = "future of retail";
    const basePayload = {
        query,
        vertical: "retail",
        deterministic: true
    };

    // 1. Direct Call
    console.log('1. Sending DIRECT request...');
    const t0 = Date.now();
    let directRes: any;
    try {
        const res = await fetch(`${API_BASE_URL}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Fodda-Execution-Mode': 'direct'
            },
            body: JSON.stringify(basePayload)
        });
        directRes = await res.json();
        console.log(`   Direct Status: ${res.status} (${Date.now() - t0}ms)`);

        // Log envelope check
        if (directRes.schema_version) console.log('   ✅ Direct: Standard Envelope Detected');
        else console.log('   ❌ Direct: Missing Envelope');

    } catch (e: any) {
        console.error('   ❌ Direct Request Failed:', e.message);
    }

    // 2. MCP Call
    console.log('2. Sending MCP request...');
    const t1 = Date.now();
    let mcpRes: any;
    try {
        const res = await fetch(`${API_BASE_URL}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Fodda-Execution-Mode': 'mcp',
                'X-Fodda-Mode': 'deterministic'
            },
            body: JSON.stringify(basePayload)
        });
        mcpRes = await res.json();
        console.log(`   MCP Status: ${res.status} (${Date.now() - t1}ms)`);

        if (mcpRes.schema_version) console.log('   ✅ MCP: Standard Envelope Detected');
        else console.log('   ❌ MCP: Missing Envelope');

    } catch (e: any) {
        console.error('   ❌ MCP Request Failed:', e.message);
    }

    // 3. Comparison
    if (directRes && mcpRes) {
        // We compare usage and data structure. 
        // Note: If upstream returns 500, we might strictly compare error responses/envelopes.
        const directUsage = directRes.meta?.usage?.billable_units || directRes.usage?.billable_units;
        const mcpUsage = mcpRes.meta?.usage?.billable_units || mcpRes.usage?.billable_units;

        console.log(`\nComparison:`);
        console.log(`   Direct Usage: ${directUsage}`);
        console.log(`   MCP Usage:    ${mcpUsage}`);

        if (directUsage === mcpUsage) {
            console.log('✅ Usage Equivalence Verified');
        } else {
            console.log('❌ Usage Mismatch');
        }

        if (directRes.requestId && mcpRes.requestId && directRes.requestId !== mcpRes.requestId) {
            console.log('✅ Request IDs differ (Correct)');
        }
    }
}

async function run() {
    await testSystemValidation();
    await testDualMode();
}

run();
