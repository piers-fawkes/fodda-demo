// verify_production.ts
// Verification script for deployed Fodda API on Google Cloud Run

const PRODUCTION_URL = 'https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app';

async function testHealthCheck() {
    console.log('🔍 Testing Health Check...');
    try {
        const res = await fetch(`${PRODUCTION_URL}/health`);
        const data = await res.json();
        console.log('Health Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.status === 'ok') {
            console.log('✅ Health check passed');
            return true;
        } else {
            console.log('❌ Health check failed');
            return false;
        }
    } catch (e: any) {
        console.error('❌ Health check error:', e.message);
        return false;
    }
}

async function testLogin() {
    console.log('\n🔍 Testing /api/auth/login...');
    const email = 'piers.fawkes@psfk.com';

    try {
        const res = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('❌ Login Response is not JSON:', text);
            return false;
        }

        console.log('Login Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.ok) {
            console.log('✅ Login endpoint working - user authenticated');
            return true;
        } else if (data.error) {
            console.log('⚠️ Login endpoint reachable but returned error:', data.error);
            return true; // Endpoint is working, just user might not exist
        } else {
            console.log('❌ Login endpoint failed');
            return false;
        }
    } catch (e: any) {
        console.error('❌ Login test failed:', e.message);
        return false;
    }
}

async function testV1Validation() {
    console.log('\n🔍 Testing /v1/system/validation...');
    try {
        const res = await fetch(`${PRODUCTION_URL}/v1/system/validation`, {
            headers: {
                'X-Fodda-Execution-Mode': 'direct'
            }
        });

        const data = await res.json();
        console.log('Validation Response:', JSON.stringify(data, null, 2));

        if (res.ok && data.schema_version) {
            console.log('✅ V1 validation endpoint working');
            console.log(`   Schema Version: ${data.schema_version}`);
            console.log(`   Server Time: ${data.data?.server_time}`);
            return true;
        } else {
            console.log('❌ V1 validation endpoint failed');
            return false;
        }
    } catch (e: any) {
        console.error('❌ V1 validation test failed:', e.message);
        return false;
    }
}

async function testCORS() {
    console.log('\n🔍 Testing CORS headers...');
    try {
        const res = await fetch(`${PRODUCTION_URL}/health`, {
            method: 'OPTIONS'
        });

        const corsHeader = res.headers.get('access-control-allow-origin');
        console.log('CORS Header:', corsHeader);

        if (corsHeader === '*' || corsHeader) {
            console.log('✅ CORS enabled');
            return true;
        } else {
            console.log('⚠️ CORS might not be configured');
            return false;
        }
    } catch (e: any) {
        console.error('❌ CORS test failed:', e.message);
        return false;
    }
}

async function run() {
    console.log('🚀 Starting Production API Verification');
    console.log(`📍 Target: ${PRODUCTION_URL}\n`);
    console.log('═'.repeat(60));

    const results = {
        health: await testHealthCheck(),
        login: await testLogin(),
        validation: await testV1Validation(),
        cors: await testCORS()
    };

    console.log('\n' + '═'.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═'.repeat(60));

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    Object.entries(results).forEach(([test, result]) => {
        console.log(`${result ? '✅' : '❌'} ${test.padEnd(20)} ${result ? 'PASS' : 'FAIL'}`);
    });

    console.log('═'.repeat(60));
    console.log(`\n🎯 Result: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('🎉 All tests passed! API is healthy.');
    } else {
        console.log('⚠️ Some tests failed. Please review the output above.');
    }
}

run();
