
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import crypto from 'crypto';
import fetch from 'node-fetch'; // Standard fetch might be available but let's be safe if environment varies

const PORT = 8084;
const BASE_URL = `http://localhost:${PORT}`;
const SECRET = "secret-test-key-123";

async function run() {
    console.log("--- Starting HMAC Verification ---");

    // Start Server with SECRET
    const server = spawn('npx', ['tsx', 'server/index.ts'], {
        cwd: '../Fodda',
        env: { ...process.env, PORT: String(PORT), FODDA_MCP_SECRET: SECRET },
        stdio: 'inherit'
    });

    console.log(`Server spawning on port ${PORT}...`);

    // Wait for server
    let attempts = 0;
    while (attempts < 20) {
        try {
            // Check health
            const res = await fetch(`${BASE_URL}/api/ping`); // assuming GET /api/ping exists from previous checks
            if (res.ok) {
                console.log("Server is up.");
                break;
            }
        } catch (e) {
            await setTimeout(1000);
            attempts++;
        }
    }

    if (attempts === 20) {
        console.error("Server failed to start.");
        server.kill();
        process.exit(1);
    }

    try {
        const url = `${BASE_URL}/api/user/context`; // POST endpoint
        const body = { email: "test@example.com", context: "foo" };
        const bodyStr = JSON.stringify(body);

        // 1. No Signature (Should pass auth middleware, fail logic if invalid data, or 200)
        // Actually /api/user/context checks Airtable. It might fail 404 User Not Found.
        // We look for NOT 401.
        console.log("\nTest 1: No Signature");
        const res1 = await fetch(url, {
            method: 'POST',
            body: bodyStr,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Status: ${res1.status}`);
        if (res1.status !== 401) {
            console.log("✅ PASSED: Request without signature allowed (as expected for direct API).");
        } else {
            console.log("❌ FAILED: Request without signature blocked.");
        }

        // 2. Valid Signature
        console.log("\nTest 2: Valid Signature");
        const timestamp = Date.now().toString();
        const payload = timestamp + "." + bodyStr;
        const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

        const res2 = await fetch(url, {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/json',
                'X-Fodda-Signature': signature,
                'X-Fodda-Timestamp': timestamp
            }
        });
        console.log(`Status: ${res2.status}`);
        if (res2.status !== 401) {
            console.log("✅ PASSED: Valid signature accepted.");
        } else {
            console.log("❌ FAILED: Valid signature rejected.");
        }

        // 3. Invalid Signature
        console.log("\nTest 3: Invalid Signature");
        const res3 = await fetch(url, {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/json',
                'X-Fodda-Signature': 'invalid_signature_hash',
                'X-Fodda-Timestamp': timestamp
            }
        });
        console.log(`Status: ${res3.status}`);
        if (res3.status === 401) {
            console.log("✅ PASSED: Invalid signature rejected.");
        } else {
            console.log("❌ FAILED: Invalid signature accepted.");
        }

        // 4. Expired Timestamp
        console.log("\nTest 4: Expired Timestamp");
        const oldTime = (Date.now() - 10 * 60 * 1000).toString(); // 10 mins ago
        const oldPayload = oldTime + "." + bodyStr;
        const oldSig = crypto.createHmac("sha256", SECRET).update(oldPayload).digest("hex");

        const res4 = await fetch(url, {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/json',
                'X-Fodda-Signature': oldSig,
                'X-Fodda-Timestamp': oldTime
            }
        });
        console.log(`Status: ${res4.status}`);
        if (res4.status === 401) {
            console.log("✅ PASSED: Expired timestamp rejected.");
        } else {
            console.log("❌ FAILED: Expired timestamp accepted.");
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        server.kill();
        console.log("Server stopped.");
        process.exit(0);
    }
}

run();
