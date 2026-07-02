import fetch from "node-fetch";

const q = "fast fashion";

async function run() {
    const res = await fetch("https://fodda-api-new-rglj7xzxsa-uk.a.run.app/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: q,
            limit: 5,
            use_semantic: true
        })
    });
    const json = await res.json();
    console.log("Search path:", json.search_path);
    if (json.rows && json.rows.length > 0) {
        json.rows.forEach((r: any, i: number) => {
            console.log(`[${i + 1}] ${r.name || r.trendName}`);
            console.log(`    Score: ${r._score}`);
        });
    }
}
run();
