import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://api.fodda.ai/v1/graphs/psfk/nodes/pew_npors_2025", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        }
    });
    console.log(res.status);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}
run();
