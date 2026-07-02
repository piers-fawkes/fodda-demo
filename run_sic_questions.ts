import fs from "fs";

const BASE = "https://fodda-api-new-rglj7xzxsa-uk.a.run.app";
const GRAPH_ID = "sic";

const questions = [
    'What do trend lines say about Consumers 25-35 leaning into / gravitating away from "fast fashion"',
    'What is the current share of "knowledge workers" among millennials and gen Z consumers?',
    "To what extent are Zillennials (currently 25-35 y/o) trending towards or away from knowledge work as a career?",
    'What evidence is there of a shift to "fewer, better" as a purchasing philosophy?',
    "What is the ascendant trend in premium menswear?",
    "What is the ascendant trend in premium womenswear?",
    "What cities are setting the global style agenda right now?",
    "How does place of origin or place of construction of an item effect purchase decisions for consumers 25-35 globally?",
    "Which retailers today are seen as most influential globally?",
    "How does membership figure into the marketing of premium fashion brands today?"
];

async function run() {
    let md = `# SIC Graph QA Validation\n\n`;
    md += `This document tracks the results of querying the 10 benchmark questions against the **SIC** graph via the V1 API.\n\n`;
    md += `**Graph**: \`${GRAPH_ID}\`  \n**Date**: ${new Date().toISOString().split('T')[0]}  \n**API**: \`${BASE}\`\n\n---\n\n`;

    for (const q of questions) {
        md += `## Q: ${q}\n\n`;
        try {
            const rawResponse = await fetch(`${BASE}/v1/graphs/${GRAPH_ID}/search`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": process.env.GEMINI_API_KEY || "fodda-internal-service-key"
                },
                body: JSON.stringify({ query: q, limit: 10, use_semantic: true })
            });
            const json = await rawResponse.json();

            md += `**Search Engine**: ${json.search_path?.toUpperCase() || 'UNKNOWN'}\n\n`;

            if (json.rows && json.rows.length > 0) {
                md += `**Result**: ${json.rows.length} results found.\n\n**Top 5 Results:**\n`;
                json.rows.slice(0, 5).forEach((t: any, i: number) => {
                    const name = t.trendName || t.name || t.title || 'Untitled';
                    md += `${i + 1}. **${name}** (Score: ${t._score ? t._score.toFixed(3) : 'N/A'})\n`;
                    const brandsList = Array.isArray(t.Brand) ? t.Brand.join(', ') : (typeof t.Brand === 'string' ? t.Brand : '');
                    if (brandsList) md += `   - **Brands**: ${brandsList}\n`;
                    const desc = t.trendDescription || t.summary || '';
                    if (desc) md += `   - ${desc}\n`;
                    md += `\n`;
                });
            } else {
                md += `**Result**: NO DATA. No matches found for this graph.\n`;
            }
        } catch (e: any) {
            md += `**Result**: ERROR (${e.message})\n`;
        }
        md += `\n---\n\n`;
    }

    const outFile = 'SIC_Graph_QA_Results.md';
    fs.writeFileSync(outFile, md);
    console.log(`Wrote ${outFile}`);
}
run();
