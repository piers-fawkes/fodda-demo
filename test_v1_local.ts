import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function run() {
    console.log("Using Key:", process.env.GEMINI_API_KEY ? "Set" : "Not Set");
    const res = await fetch("http://localhost:8080/v1/graphs/retail/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
        },
        body: JSON.stringify({
            query: "Which retailers today are seen as most influential globally?",
            limit: 5,
            use_semantic: true,
        })
    });
    console.log(res.status);
    const json = await res.json();
    console.log("Vector search result count:", json.rows?.length);
    if (json.rows?.length > 0) {
        console.log("Top Result:", json.rows[0].name || json.rows[0].display);
        console.log("Is Retail:", json.rows.every((r: any) => r.graphId === 'retail' || r.psfk_vertical === 'retail' || r.psfk_graph_slug === 'retail' || r.psfk_graph_slug?.includes('retail')));
        console.log("Results:\n" + json.rows.map((r: any) => "- " + (r.name||r.display) + " (" + r.psfk_graph_slug + ")").join("\n"));
    } else {
        console.log("No rows:", json);
    }
}
run();
