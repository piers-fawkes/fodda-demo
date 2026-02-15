

// verify_api.js
// Using generic fetch, assuming Node 18+

const API_URL = 'http://localhost:8080/api';

async function testLogin() {
    console.log('Testing /api/auth/login...');
    const email = 'piers@psfk.com';

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        // Check if response is valid JSON
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('❌ Login Response is not JSON:', text);
            return;
        }

        console.log('Login Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.ok) {
            console.log('✅ Login Endpoint reachable and processed request.');
        } else {
            console.log('⚠️ Login Endpoint returned error (expected if email not in DB):', data.error);
        }
    } catch (e) {
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

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('❌ Log Response is not JSON:', text);
            return;
        }

        console.log('Log Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.ok) {
            console.log('✅ Log Endpoint reachable and processed request.');
        } else {
            console.log('❌ Log Endpoint returned error:', data.error);
        }

    } catch (e) {
        console.error('❌ Log Test Failed:', e.message);
    }
}

async function run() {
    await testLogin();
    await testLog();
}

run();
