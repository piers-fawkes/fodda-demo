
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:8080';
const API_KEY = process.env.FODDA_API_KEY || 'sk_live_test_key_123'; // Use a dummy key if env not set for this test

async function testSimulationMode() {
    console.log('\n--- Testing Simulation Mode (Gemini Echo) ---');

    const payload = {
        query: "What is the future of retail?",
        vertical: "retail"
    };

    try {
        console.log('Sending request with X-Fodda-Simulation-Mode: gemini_echo...');
        const t0 = Date.now();
        const res = await fetch(`${API_BASE_URL}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Fodda-Simulation-Mode': 'gemini_echo'
            },
            body: JSON.stringify(payload)
        });

        const data: any = await res.json();
        const latency = Date.now() - t0;
        console.log(`Response Status: ${res.status} (${latency}ms)`);

        if (data.meta?.simulation?.active === true && data.meta?.simulation?.type === 'gemini_echo') {
            console.log('✅ Simulation Mode Verified: Response indicates echo mode.');
            console.log('   Meta:', JSON.stringify(data.meta.simulation));
        } else {
            console.log('❌ Simulation Mode Failed: Response missing simulation meta.');
            console.log('   Meta:', JSON.stringify(data.meta));
        }

        if (data.data?.answer?.includes("SIMULATED")) {
            console.log('✅ Mock Data Verified: Response contains simulated answer.');
        } else {
            console.log('❌ Mock Data Failed: Response missing simulated answer text.');
        }

    } catch (e: any) {
        console.error('❌ Simulation Request Failed:', e.message);
    }
}

testSimulationMode();
