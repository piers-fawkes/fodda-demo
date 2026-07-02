import fetch from "node-fetch";

async function run() {
    console.log("Testing older endpoint with deterministic mode...");
    const res = await fetch("https://api.fodda.ai/api/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key",
            "X-Fodda-Mode": "deterministic"
        },
        body: JSON.stringify({
            q: "Which retailers today are seen as most influential globally?",
            vertical: "psfk",
            limit: 5,
            deterministic: true
        })
    });
    console.log(res.status);
    const json = await res.json();
    console.log("Status:", json.dataStatus);
    console.log("Terms Used:", json.termsUsed);
    console.log("Rows count:", json.rows?.length);
    if (json.rows?.length > 0) {
        console.log(JSON.stringify(json.rows.map((r: any) => ({
            id: r.id || r.rowId || r.trendId,
            name: r.name || r.rowName || r.display,
            type: r.nodeType || r.type
        })), null, 2));
    }
}
run();
