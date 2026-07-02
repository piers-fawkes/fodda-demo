import fetch from "node-fetch";

async function run() {
    console.log("Testing which retailers...");
    const res = await fetch("https://api.fodda.ai/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: "Which retailers today are seen as most influential globally?",
            limit: 5,
            filters: { node_types: ["Trend"] }
        })
    });
    console.log(res.status);
    const json = await res.json();
    console.log(Object.keys(json));
    console.log(JSON.stringify(json.rows, null, 2));
}
run();
