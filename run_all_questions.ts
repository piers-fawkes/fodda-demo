import fs from "fs";
import { dataService } from "./shared/dataService.js";
import { API_ENDPOINTS } from "./shared/apiConfig.js";

const BASE = "https://fodda-api-new-rglj7xzxsa-uk.a.run.app";
API_ENDPOINTS.QUERY = `${BASE}/api/query`;
API_ENDPOINTS.V1_SEARCH = (graphId: string) => `${BASE}/v1/graphs/${graphId}/search`;

const questions = [
    "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”",
    "What’s the current share of “knowledge workers” among millennials and gen Z consumers?",
    "To what extent are ‘Zillennials’ (currently 25-35 y/o) trending towards or away from “knowledge work” as a career?",
    "What evidence is there of a shift to “fewer, better” as a purchasing philosophy?",
    "What is the ascendant trend in premium menswear?",
    "What is the ascendant tend in premium womenswear?",
    "What cities are setting the global style agenda right now?",
    "How does place of origin or place of construction of an item effect purchase decisions for consumers 25-35 globally?",
    "Which retailers today are seen as most influential globally?",
    "How does membership figure into the marketing of premium fashion brands today?"
];

async function run() {
    let md = "# PSFK Retail Graph Validation (Semantic Search Fixed)\n\n";
    md += "This document tracks the results of querying the 10 benchmark questions against the fully semantically active V1 API.\n\n";

    for (const q of questions) {
        md += `## Q: ${q}\n\n`;
        try {
            const rawResponse = await fetch(`${BASE}/v1/graphs/retail/search`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
                },
                body: JSON.stringify({ query: q, limit: 10, use_semantic: true })
            });
            const json = await rawResponse.json();

            md += `**Search Engine**: ${json.search_path?.toUpperCase()}\n\n`;

            if (json.rows && json.rows.length > 0) {
                md += `**Result**: ${json.rows.length} relevant trends found.\n\n**Top 5 Trends:**\n`;
                json.rows.slice(0, 5).forEach((t: any, i: number) => {
                    const trendName = t.trendName || t.name || t.title || 'Untitled Trend';
                    md += `${i + 1}. **${trendName}** (Score: ${t._score ? t._score.toFixed(3) : 'N/A'})\n`;
                    const brandsList = Array.isArray(t.Brand) ? t.Brand.join(', ') : (typeof t.Brand === 'string' ? t.Brand : 'None listed');
                    md += `   - **Associated Brands**: ${brandsList || 'None listed'}\n`;
                    const desc = t.trendDescription || t.summary || '';
                    md += `   - ${desc}\n\n`;
                });
            } else {
                md += `**Result**: NO DATA. No confident matches found.\n`;
            }
        } catch (e: any) {
            md += `**Result**: ERROR (${e.message})\n`;
        }
        md += "\n---\n\n";
    }

    fs.writeFileSync('Acceptable_Answers_README.md', md);
    console.log("Wrote Acceptable_Answers_README.md");
}
run();
