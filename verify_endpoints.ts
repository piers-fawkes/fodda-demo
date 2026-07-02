// verify_endpoints.ts
// Test specific API endpoints on production

const PRODUCTION_URL = 'https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app';
const API_KEY = process.env.FODDA_API_KEY || 'test-key';

interface TestResult {
    endpoint: string;
    status: number;
    success: boolean;
    message: string;
    responseTime?: number;
}

const results: TestResult[] = [];

async function testEndpoint(
    name: string,
    path: string,
    options: RequestInit = {}
): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`\n🔍 Testing ${name}...`);
    console.log(`   ${options.method || 'GET'} ${path}`);

    try {
        const res = await fetch(`${PRODUCTION_URL}${path}`, options);
        const responseTime = Date.now() - startTime;

        let data;
        const contentType = res.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            data = text.substring(0, 200); // First 200 chars
        }

        console.log(`   Status: ${res.status} (${responseTime}ms)`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Response:`, typeof data === 'string' ? data : JSON.stringify(data, null, 2).substring(0, 300));

        const success = res.status >= 200 && res.status < 300;
        const result: TestResult = {
            endpoint: name,
            status: res.status,
            success,
            message: success ? 'OK' : `HTTP ${res.status}`,
            responseTime
        };

        if (success) {
            console.log(`   ✅ ${name} passed`);
        } else {
            console.log(`   ⚠️ ${name} returned ${res.status}`);
        }

        return result;
    } catch (e: any) {
        const responseTime = Date.now() - startTime;
        console.log(`   ❌ Error: ${e.message}`);
        return {
            endpoint: name,
            status: 0,
            success: false,
            message: e.message,
            responseTime
        };
    }
}

async function run() {
    console.log('🚀 Testing Specific API Endpoints');
    console.log(`📍 Target: ${PRODUCTION_URL}\n`);
    console.log('═'.repeat(70));

    // Test 1: Root endpoint
    results.push(await testEndpoint('Root /', '/', { method: 'GET' }));

    // Test 2: System Validation
    results.push(await testEndpoint(
        'System Validation',
        '/v1/system/validation',
        {
            headers: { 'X-Fodda-Execution-Mode': 'direct' }
        }
    ));

    // Test 3: PSFK Search
    results.push(await testEndpoint(
        'PSFK Search',
        '/v1/graphs/psfk/search',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ query: 'AI trends', limit: 3 })
        }
    ));

    // Test 4: PSFK Overview
    results.push(await testEndpoint(
        'PSFK Overview',
        '/v1/psfk/overview',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ industry: 'Retail' })
        }
    ));

    // Test 5: Discovery Endpoint
    results.push(await testEndpoint(
        'Discovery - RetailerType',
        '/v1/graphs/psfk/labels/RetailerType/values',
        {
            headers: { 'X-API-Key': API_KEY }
        }
    ));

    // Test 6: Auth Login
    results.push(await testEndpoint(
        'Auth Login',
        '/api/auth/login',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@fodda.ai' })
        }
    ));

    // Test 7: Log Endpoint
    results.push(await testEndpoint(
        'Log Endpoint',
        '/api/log',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@fodda.ai',
                query: 'Test query',
                vertical: 'Retail',
                accessKey: 'test-key'
            })
        }
    ));

    // Test 8: MCP Tools List
    results.push(await testEndpoint(
        'MCP Tools List',
        '/mcp/tools',
        {
            headers: { 'X-API-Key': API_KEY }
        }
    ));

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 ENDPOINT TEST SUMMARY');
    console.log('═'.repeat(70));

    const passed = results.filter(r => r.success).length;
    const total = results.length;

    results.forEach(result => {
        const icon = result.success ? '✅' : '❌';
        const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
        console.log(`${icon} ${result.endpoint.padEnd(30)} [${result.status}] ${time.padStart(8)}`);
    });

    console.log('═'.repeat(70));
    console.log(`\n🎯 Result: ${passed}/${total} endpoints passed`);

    const avgTime = results
        .filter(r => r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;
    console.log(`⏱️  Average Response Time: ${Math.round(avgTime)}ms`);

    if (passed === total) {
        console.log('🎉 All endpoints are healthy!');
    } else if (passed >= total * 0.7) {
        console.log('⚠️ Most endpoints working, some issues detected.');
    } else {
        console.log('❌ Multiple endpoint failures detected.');
    }
}

run();
