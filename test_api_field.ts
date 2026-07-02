import fetch from "node-fetch";

async function run() {
    const q = "What is the ascendant trend in premium menswear?";
    const response = await fetch(`https://api.fodda.ai/v1/graphs/retail/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key",
        },
        body: JSON.stringify({
            query: q,
            use_semantic: true
        })
    });
    console.log("v1/graphs/retail/search:", response.status);
    const data = await response.json();
    console.log(data);
}
run();
