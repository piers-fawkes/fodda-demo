import { dataService } from "./shared/dataService.js";
import { API_ENDPOINTS } from "./shared/apiConfig.js";

const BASE = "https://fodda-api-new-rglj7xzxsa-uk.a.run.app";
API_ENDPOINTS.QUERY = `${BASE}/api/query`;
API_ENDPOINTS.V1_SEARCH = (graphId: string) => `${BASE}/v1/graphs/${graphId}/search`;

const q = "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”";

async function run() {
    try {
        const res = await dataService.retrieve(q, "retail", 10, {}, { apiKey: process.env.GEMINI_API_KEY || "fodda-internal-service-key" });
        if (res.trends && res.trends.length > 0) {
            console.log(`Top Trends for: "${q}"\n`);
            res.trends.slice(0, 5).forEach((t: any, i: number) => {
                console.log(`[${i + 1}] ${t.name}`);
                console.log(`    Score: ${t._score ?? 'N/A'}`); // Might need to check if score is populated
                console.log(`    Brands: ${t.brands ? t.brands.join(', ') : 'None'}`);
                console.log(`    Summary: ${t.summary.slice(0, 100)}...\n`);
            });
        } else {
            console.log("No trends found.");
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}
run();
