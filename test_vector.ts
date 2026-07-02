import { GoogleGenAI } from "@google/genai";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config({ path: "../Fodda API/Fodda/.env" });
// Override the bad key with the good one
dotenv.config({ path: ".env", override: true });

const q = "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”";

async function run() {
    console.log("Using Key:", process.env.GEMINI_API_KEY?.substring(0, 10));
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let embedding;
    try {
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: q,
            config: { outputDimensionality: 3072 }
        });
        embedding = response.embeddings?.[0]?.values;
        if (!embedding) throw new Error("No embedding returned");
    } catch (e: any) {
        console.error("Embedding Error:", e);
        return;
    }

    const driver = neo4j.driver(
        process.env.NEO4J_URI || "",
        neo4j.auth.basic(process.env.NEO4J_USER || "", process.env.NEO4J_PASSWORD || "")
    );
    const session = driver.session({ database: process.env.NEO4J_DATABASE });

    const cypher = `
        CALL db.index.vector.queryNodes('trend_summary_index', 200, $embedding)
        YIELD node AS n, score
        WHERE (
            any(val IN split(toLower(coalesce(n.psfk_graph_slug, n.graphId, '')), ',') WHERE trim(val) = 'retail')
            OR (n:Trend AND (
            (n)<-[:CONTAINS_TREND]-(:PSFKGraph {slug: 'retail'}) OR
            toLower(coalesce(n.psfk_vertical, "")) = 'retail'
            ))
        )
        RETURN n.trendName AS name, score
        ORDER BY score DESC
        LIMIT 5
    `;

    try {
        const result = await session.run(cypher, { embedding });
        console.log(`\nResults for "${q}":`);
        result.records.forEach(r => {
            console.log(`- ${r.get('name')} (Score: ${r.get('score')})`);
        });
    } catch (e: any) {
        console.error("Neo4j Error:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}
run();
