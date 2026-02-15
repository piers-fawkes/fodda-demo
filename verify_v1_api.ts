
// verify_v1_api.ts
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:8080'; // Update with your local server port

const API_KEY = process.env.FODDA_API_KEY || '';

async function testV1Search() {
    console.log('--- Testing /v1/graphs/psfk/search ---');
    try {
        const res = await fetch(`${API_BASE_URL}/v1/graphs/psfk/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ query: 'future of retail', limit: 5 })
        });
        const envelope: any = await res.json();
        console.log('Response Status:', res.status);

        // Check for Envelope
        if (envelope.schema_version) {
            console.log(`✅ Standard Envelope Detected (Schema: ${envelope.schema_version})`);
        } else {
            console.log('❌ Standard Envelope Missing');
        }

        const data = envelope.data || envelope; // Fallback if no envelope (legacy)

        if (data.rows) {
            console.log('✅ Found rows:', data.rows.length);
            const firstRow = data.rows[0];
            if (firstRow?.trendId) console.log('✅ TrendID present:', firstRow.trendId);
            if (firstRow?.articleId) console.log('✅ ArticleID present:', firstRow.articleId);
            if (firstRow?.evidence_counts) {
                console.log('✅ Evidence counts present:', firstRow.evidence_counts);
            } else {
                console.log('⚠️ Evidence counts missing in first row');
            }
        } else {
            console.log('❌ No rows returned:', data.error || 'Unknown error');
            console.log('Full Response:', JSON.stringify(envelope, null, 2));
        }
    } catch (e: any) {
        console.error('❌ Search test failed:', e.message);
    }
}

async function testV1Discovery() {
    console.log('\n--- Testing /v1/graphs/psfk/labels/RetailerType/values ---');
    try {
        const res = await fetch(`${API_BASE_URL}/v1/graphs/psfk/labels/RetailerType/values`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data: any = await res.json();
        console.log('Response Status:', res.status);
        if (Array.isArray(data) || data.values) {
            console.log('✅ Discovery values found');
        } else {
            console.log('❌ Discovery failed:', data.error || 'Unknown error');
        }
    } catch (e: any) {
        console.error('❌ Discovery test failed:', e.message);
    }
}

async function run() {
    await testV1Search();
    await testV1Discovery();
}

run();
