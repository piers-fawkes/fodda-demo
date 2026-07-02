import fetch from "node-fetch";

async function run() {
    console.log("Testing which retailers with large limit...");
    const res = await fetch("https://api.fodda.ai/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: "Which retailers today are seen as most influential globally?",
            limit: 100,
            use_semantic: true
        })
    });
    console.log(res.status);
    const json = await res.json();
    const rows = json.data?.rows || json.rows;
    console.log("Total rows:", rows?.length);
    const psfkRows = rows?.filter(r => r.graphId === 'retail' || r.psfk_graph_slug === 'retail' || (!r.graphId && !r.psfk_graph_slug));
    console.log("PSFK Rows:", psfkRows?.length);
    if (psfkRows?.length > 0) {
        console.log("Top PSFK:", psfkRows[0].name || psfkRows[0].display);
    }
}
run();
