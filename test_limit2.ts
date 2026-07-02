import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://api.fodda.ai/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: "Which retailers today are seen as most influential globally?",
            limit: 200,
            use_semantic: true
        })
    });
    const json = await res.json();
    const rows = json.data?.rows || json.rows;
    const psfkRows = rows?.filter(r => r.graphId === 'retail' || r.psfk_graph_slug === 'retail' || (!r.graphId && !r.psfk_graph_slug));
    console.log(JSON.stringify(psfkRows.slice(0, 3).map(r => ({
      name: r.name || r.trendName || r.display,
      id: r.id || r.trendId
    })), null, 2));
}
run();
