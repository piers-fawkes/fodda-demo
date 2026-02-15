
// import fetch from 'node-fetch'; // Use global fetch
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const PORT = 8082; // Use a different port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;

async function run() {
    console.log("--- Starting Latency Profiling Verification ---");

    // Start Server
    const server = spawn('npx', ['tsx', 'server/index.ts'], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: 'inherit' // We want to see [PROFILING] logs in stdout
    });

    console.log(`Server spawning on port ${PORT}...`);

    // Wait for server
    let attempts = 0;
    while (attempts < 20) {
        try {
            await fetch(`${BASE_URL}/api/ping`);
            console.log("Server is up.");
            break;
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
        console.log("Sending request WITH profiling...");
        const res = await fetch(`${BASE_URL}/api/ping`, {
            headers: { 'X-Fodda-Profiling': 'true' }
        });

        console.log(`Status: ${res.status}`);
        const latencyHeader = res.headers.get('x-fodda-latency');
        console.log(`X-Fodda-Latency: ${latencyHeader}`);

        if (latencyHeader && latencyHeader.endsWith('ms')) {
            console.log("✅ PASSED: Latency header present.");
        } else {
            console.log("❌ FAILED: Latency header missing or invalid.");
        }

        console.log("Sending request WITHOUT profiling...");
        const res2 = await fetch(`${BASE_URL}/api/ping`);
        const latencyHeader2 = res2.headers.get('x-fodda-latency');
        if (!latencyHeader2) {
            console.log("✅ PASSED: Latency header correctly absent.");
        } else {
            console.log("❌ FAILED: Latency header present when not requested.");
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
