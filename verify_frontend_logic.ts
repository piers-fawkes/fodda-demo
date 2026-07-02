
import { dataService } from './shared/dataService';
import { Vertical } from './shared/types';
import assert from 'assert';

// Mock fetch
const originalFetch = global.fetch;
let lastFetchArgs: any[] | null = null;

global.fetch = async (url: any, options: any) => {
    lastFetchArgs = [url, options];
    return {
        ok: true,
        json: async () => ({
            data: {
                ok: true,
                rows: [],
                meta: { simulation: { active: true } }
            },
            ok: true,
            meta: { simulation: { active: true } }
        }),
        text: async () => JSON.stringify({})
    } as any;
};

// Polyfill Crypto if needed (Node 15+ has it, but ensuring)
if (!global.crypto) {
    (global as any).crypto = require('crypto').webcrypto;
}

async function run() {
    console.log("--- Verifying Frontend Logic ---");

    try {
        // Test 1: Simulation Mode
        console.log("\nTest 1: Simulation Mode Header");
        lastFetchArgs = null;
        await dataService.retrieve("test query", Vertical.Retail, 10, {}, {}, 'direct', 'gemini_echo');

        const [url1, options1] = lastFetchArgs || [];
        const headers1 = options1.headers;
        console.log("Headers:", headers1);

        assert.strictEqual(headers1['X-Fodda-Simulation-Mode'], 'gemini_echo', "Simulation header missing or incorrect");
        console.log("✅ Simulation Mode Header Verified");

        // Test 2: MCP Mode (HMAC)
        console.log("\nTest 2: MCP Mode HMAC Headers");
        lastFetchArgs = null;
        await dataService.retrieve("test query", Vertical.Retail, 10, {}, {}, 'mcp', null);

        const [url2, options2] = lastFetchArgs || [];
        const headers2 = options2.headers;
        console.log("Headers:", headers2);

        assert.ok(headers2['X-Fodda-Signature'], "HMAC Signature missing");
        assert.ok(headers2['X-Fodda-Timestamp'], "Timestamp missing");
        console.log("✅ HMAC Headers Verified");

    } catch (e: any) {
        console.error("❌ Verification Failed:", e);
        process.exit(1);
    }
}

run();
