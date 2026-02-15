
// verify_api.ts
import fetch from 'node-fetch';

const API_URL = 'http://localhost:8080/api';

async function testLogin() {
    console.log('Testing /api/auth/login...');
    // Using an email that likely exists or observing the error
    // The user provided links to airtable, I can try to use a dummy one or just see if it connects
    const email = 'piers@psfk.com'; // Guessing a valid email, or should I use one that definitely exists?
    // I'll try one that might fail to ensure it's hitting the server logic, or rely on handling.

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        console.log('Login Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.ok) {
            console.log('✅ Login Endpoint reachable and processed request.');
        } else {
            console.log('⚠️ Login Endpoint returned error (expected if email not in DB):', data.error);
        }
    } catch (e: any) {
        console.error('❌ Login Test Failed:', e.message);
    }
}

async function testLog() {
    console.log('Testing /api/log...');
    try {
        const res = await fetch(`${API_URL}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@fodda.ai',
                query: 'Verification Test Query',
                vertical: 'Retail',
                accessKey: 'test-key',
                context: { userContext: 'Tester', accountContext: 'TestAccount' }
            })
        });

        const data = await res.json();
        console.log('Log Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.ok) {
            console.log('✅ Log Endpoint reachable and processed request.');
        } else {
            console.log('❌ Log Endpoint returned error:', data.error);
        }

    } catch (e: any) {
        console.error('❌ Log Test Failed:', e.message);
    }
}

async function run() {
    await testLogin();
    await testLog();
}

run();
