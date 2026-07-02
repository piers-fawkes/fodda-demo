import fetch from "node-fetch";

const API_BASE = "https://api.fodda.ai";
const API_KEY = process.env.GEMINI_API_KEY || "fodda-internal-service-key"; // The verify script uses this key var, but actually we use fodda API key? Fodda may not need it if not enforced.

const questions = [
    "What’s the current share of “knowledge workers” among millennials and gen Z consumers?",
    "To what extent are ‘Zillennials’ (currently 25-35 y/o) trending towards or away from “knowledge work” as a career?",
    "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”",
    "What evidence is there of a shift to “fewer, better” as a purchasing philosophy?",
    "What is the ascendant trend in premium menswear?",
    "What is the ascendant tend in premium womenswear?",
    "What cities are setting the global style agenda right now?",
    "How does place of origin or place of construction of an item effect purchase decisions for consumers 25-35 globally?",
    "Which retailers today are seen as most influential globally?",
    "How does membership figure into the marketing of premium fashion brands today?"
];

async function testQuery(q: string) {
    console.log(`\n================================`);
    console.log(`Q: "${q}"`);
    const response = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY, // from verify_relevance_results
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

    if (data.rows && data.rows.length > 0) {
        console.log(`\nTop 3 Nodes:`);
        data.rows.slice(0, 3).forEach((row: any, i: number) => {
            console.log(`[${i + 1}] ${row.nodeType}: ${row.name || row.rowName} (ID: ${row.id || row.rowId})`);
            console.log(`    Summary: ${(row.summary || row.rowSummary || "").substring(0, 150)}...`);
        });
    } else {
        console.log("No nodes returned for this query.");
    }
}

async function main() {
    for (const q of questions) {
        await testQuery(q);
    }
}

main().catch(console.error);
