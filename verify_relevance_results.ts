import fetch from "node-fetch";

const API_BASE = "https://api.fodda.ai";
const API_KEY = "AIzaSyD75zmGJeNOzuF6tiev-ecYADY5Hmravy4"; // From Sandbox deploy script

async function testQuery(q: string) {
    console.log(`\nTesting Query: "${q}"`);
    const response = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY
        },
        body: JSON.stringify({
            q: q,
            vertical: "retail",
            limit: 10
        })
    });

    if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        return;
    }

    const data = await response.json();
    console.log(`Status: ${data.dataStatus}`);
    console.log(`Terms Used: ${JSON.stringify(data.termsUsed)}`);
    console.log(`Results Found: ${data.rows?.length || 0}`);

    data.rows?.forEach((row: any, i: number) => {
        console.log(`[${i + 1}] ${row.nodeType}: ${row.rowName} (ID: ${row.rowId})`);
        // console.log(`    Summary: ${row.rowSummary.substring(0, 100)}...`);
    });
}

async function main() {
    await testQuery("pop up stores");
    await testQuery("popups");
    await testQuery("trends in pop ups");
}

main().catch(console.error);
