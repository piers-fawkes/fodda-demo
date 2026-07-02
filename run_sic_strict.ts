import fs from "fs";

const BASE = "https://fodda-api-new-rglj7xzxsa-uk.a.run.app";
const GRAPH_ID = "sic";
const MIN_SCORE = 0.80;
const TOP_K = 3;

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
    console.log(`Waiting 5 minutes for SIC data cleanup...`);
    await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    console.log(`Starting SIC QA run...`);

    let md = `# SIC Graph QA Validation (Strict)\n\n`;
    md += `**Graph**: \`${GRAPH_ID}\`  \n**Date**: ${new Date().toISOString().split('T')[0]}  \n**Min Score**: ${MIN_SCORE}  \n**Top K**: ${TOP_K}  \n**API**: \`${BASE}\`\n\n---\n\n`;

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

            const relevant = (json.rows || []).filter((t: any) => t._score && t._score >= MIN_SCORE);

            if (relevant.length > 0) {
                md += `**Result**: ${relevant.length} relevant results (of ${json.rows?.length || 0} total, score >= ${MIN_SCORE}).\n\n`;
                relevant.slice(0, TOP_K).forEach((t: any, i: number) => {
                    const name = t.trendName || t.name || t.title || 'Untitled';
                    const desc = t.trendDescription || t.summary || '';
                    // Only show the primary description, not merged sections
                    const primaryDesc = desc.split('---')[0].trim();
                    md += `${i + 1}. **${name}** (Score: ${t._score.toFixed(3)})\n`;
                    if (primaryDesc) md += `   - ${primaryDesc}\n`;
                    md += `\n`;
                });
            } else {
                md += `**Result**: NO RELEVANT DATA. ${json.rows?.length || 0} results returned but none scored >= ${MIN_SCORE}.\n`;
            }
        } catch (e: any) {
            md += `**Result**: ERROR (${e.message})\n`;
        }
        md += `\n---\n\n`;
    }

    const outFile = 'SIC_Graph_QA_Results_Strict.md';
    fs.writeFileSync(outFile, md);
    console.log(`Wrote ${outFile}`);
}
run();
