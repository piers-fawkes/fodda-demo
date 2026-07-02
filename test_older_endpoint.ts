import fetch from "node-fetch";

async function run() {
    console.log("Testing older endpoint for empty...");
    const res = await fetch("https://api.fodda.ai/api/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key",
            "X-Fodda-Mode": "heuristic"
        },
        body: JSON.stringify({
            q: "What is the ascendant trend in premium menswear?",
            limit: 5
        })
    });
    console.log(res.status);
    const json = await res.json();
    console.log("Status:", json.dataStatus);
    console.log("Terms Used:", json.termsUsed);
    console.log("Rows count:", json.rows?.length);
    if (json.rows?.length > 0) {
      console.log(JSON.stringify(json.rows.slice(0, 2).map((r: any) => ({
          id: r.id || r.rowId || r.trendId, 
          name: r.name || r.rowName || r.display, 
          type: r.nodeType || r.type 
      })), null, 2));
    }
}
run();
