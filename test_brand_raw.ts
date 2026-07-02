import fetch from "node-fetch";

async function run() {
    const q = "fast fashion";
    const res = await fetch("https://fodda-api-new-rglj7xzxsa-uk.a.run.app/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: q,
            limit: 2,
            use_semantic: true
        })
    });
    const json = await res.json();
    console.log(JSON.stringify(json.rows?.[0], null, 2));
}
run();
