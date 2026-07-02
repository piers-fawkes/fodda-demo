import { dataService } from "./shared/dataService.js";
import { API_ENDPOINTS } from "./shared/apiConfig.js";

const BASE = "https://api.fodda.ai";
API_ENDPOINTS.QUERY = `${BASE}/api/query`;
API_ENDPOINTS.V1_SEARCH = (graphId: string) => `${BASE}/v1/graphs/${graphId}/search`;

const questions = [
    "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”",
    "What is the ascendant trend in premium menswear?",
    "Which retailers today are seen as most influential globally?"
];

async function run() {
    for (const q of questions) {
        console.log(`\nQ: ${q}`);
        try {
            const res = await dataService.retrieve(q, "retail", 10, {}, { apiKey: process.env.GEMINI_API_KEY || "fodda-internal-service-key" });
            console.log(`Rows: ${res.rows?.length}, Trends: ${res.trends?.length}`);
            if (res.trends && res.trends.length > 0) {
                console.log(`Top trend: ${res.trends[0].name}`);
            }
        } catch (e) {
            console.error("Error:", e.message);
        }
    }
}
run();
