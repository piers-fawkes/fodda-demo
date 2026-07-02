import fetch from "node-fetch";

async function run() {
    console.log("Testing which retailers with psfk...");
    const res = await fetch("https://api.fodda.ai/v1/graphs/psfk/search", {
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
    console.log(res.status);
    const json = await res.json();
    console.log(JSON.stringify(json.rows?.map((r: any) => ({
        id: r.id, display: r.display, name: r.name, type: r.type,  _score: r._score
    })), null, 2));
}
run();
