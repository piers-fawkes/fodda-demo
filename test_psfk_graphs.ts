import fetch from "node-fetch";

const API_KEY = process.env.FODDA_API_KEY || 'test-key';
const BASE_URL = 'https://fodda-sandbox-p3uz7zw7ja-uc.a.run.app';
const GRAPHS = ['retail', 'sports', 'beauty'];

const testQueries = {
    retail: [
        "AI in retail",
        "in-store automation",
        "inventory management"
    ],
    sports: [
        "fan engagement",
        "sports technology",
        "athlete performance"
    ],
    beauty: [
        "personalized skincare",
        "ar try-on",
        "neuroscience fragrance"
    ]
};

async function testSearch(graphId: string, query: string) {
    const url = `${BASE_URL}/v1/graphs/${graphId}/search`;
    console.log(`\nTesting ${graphId} graph: "${query}"`);
    console.log(`POST ${url}`);

    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Fodda-Execution-Mode': 'direct'
            },
            body: JSON.stringify({ query, limit: 3 })
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            console.error(`❌ HTTP ${response.status} (${duration}ms): ${await response.text()}`);
            return false;
        }

        const json: any = await response.json();

        const hasData = json.data || json;
        const rows = hasData.rows || [];

        console.log(`✅ OK (${duration}ms). Found ${rows.length} results.`);
        rows.forEach((r: any, i: number) => {
            console.log(`   ${i + 1}. [${r.id || r.trendId || r.rowId}] ${r.name || r.trendName || r.rowName}`);
            // if (r.evidence) console.log(`      Evidence count: ${r.evidence.length}`);
        });

        return true;
    } catch (err: any) {
        console.error(`❌ Error (${Date.now() - startTime}ms):`, err.message);
        return false;
    }
}

async function run() {
    console.log("🚀 Running tests on PSFK graphs...");

    let totalPass = 0;
    let totalTests = 0;

    for (const graphId of GRAPHS) {
        const queries = testQueries[graphId as keyof typeof testQueries];
        for (const query of queries) {
            totalTests++;
            const success = await testSearch(graphId, query);
            if (success) totalPass++;
        }
    }

    console.log(`\n🎯 Complete: ${totalPass}/${totalTests} tests passed.`);
}

run().catch(console.error);
