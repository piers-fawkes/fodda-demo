// verify_real_login.ts
// Test login with a real email

const PRODUCTION_URL = 'https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app';

async function testRealLogin() {
    console.log('🔍 Testing login with real email: piers.fawkes@psfk.com');

    try {
        const res = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'piers.fawkes@psfk.com' })
        });

        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (res.status === 200 && data.ok) {
            console.log('✅ SUCCESS! Airtable authentication is working!');
            console.log('   Magic link email should be sent.');
            return true;
        } else if (res.status === 404) {
            console.log('⚠️ User not found in Airtable (but API is working)');
            return false;
        } else {
            console.log('❌ Unexpected response');
            return false;
        }
    } catch (e: any) {
        console.error('❌ Error:', e.message);
        return false;
    }
}

testRealLogin();
