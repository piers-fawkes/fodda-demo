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
            limit: 5,
            use_semantic: true
        })
    });
    const json = await res.json();
    console.log("Search Path:", json.search_path);
    console.log("Rows returned:", json.rows?.length);
    console.log("First row graphId:", json.rows?.[0]?.graphId);
}
run();
