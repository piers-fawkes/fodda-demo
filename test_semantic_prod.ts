import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://fodda-api-new-rglj7xzxsa-uk.a.run.app/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: "premium menswear trends",
            limit: 3,
            use_semantic: true
        })
    });
    const json = await res.json();
    console.log("Search path:", json.search_path);
    console.log("Version:", json.version);
    if (json.rows) {
        json.rows.forEach((r: any, i: number) => {
            console.log(`[${i+1}] ${r.trendName} (score: ${r._score})`);
        });
    }
}
run();
