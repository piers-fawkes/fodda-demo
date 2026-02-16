import fetch from "node-fetch";

const API_BASE = "https://fodda-contextual-demo-p3uz7zw7ja-uw.a.run.app";
const API_KEY = process.env.GEMINI_API_KEY || "";

async function diagnoseTrends() {
    const titles = [
        "Pop-Ups Drive E-Commerce Traffic",
        "Product Trial “Proving Ground” Pop-Ups for Performance Gear",
        "Pop-Up Counters Offering On-Site Gift Personalization"
    ];

    console.log("Diagnosing specific Trend nodes...");

    for (const title of titles) {
        console.log(`\nSearching for: "${title}"`);
        // search_graph v1 endpoint
        const response = await fetch(`${API_BASE}/v1/graphs/psfk/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY
            },
            body: JSON.stringify({
                query: title,
                limit: 1,
                filters: { node_types: ["Trend"] }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`Error searching for "${title}": ${response.status} - ${errBody}`);
            continue;
        }

        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const node = data.results[0];
            console.log(`✅ Found: "${node.trendName || node.name}" (ID: ${node.node_id})`);
            console.log(`   Labels: ${JSON.stringify(node.labels || "N/A")}`);
            console.log(`   GraphID property: ${node.graphId || "N/A"}`);
            console.log(`   Vertical property: ${node.vertical || "N/A"}`);

            // Let's also check if it's connected to any PSFKGraph nodes
            // We can't do direct cypher easily without the driver, but we can look for "psfk_graph_slug"
            console.log(`   PSFK Graph Slugs: ${node.psfk_graph_slug || "N/A"}`);
        } else {
            console.log(`❌ NOT Found: "${title}"`);
        }
    }
}

diagnoseTrends().catch(console.error);
