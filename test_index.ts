import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://api.fodda.ai/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key" },
        body: JSON.stringify({ q: "What is fast fashion?" })
    });
    console.log(await res.json());
}
run();
