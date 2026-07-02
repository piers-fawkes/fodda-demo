import { GoogleGenerativeAI } from "@google/generative-ai";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const q = "Consumers 25-35 leaning into / gravitating away from fast fashion";

async function run() {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    
    let embedding;
    try {
        const response = await ai.getGenerativeModel({ model: "text-embedding-004" }).embedContent(q);
        embedding = response.embedding.values;
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
        RETURN coalesce(n.trendName, n.name, n.title) AS name, score
        ORDER BY score DESC
        LIMIT 5
    `;

    try {
        const result = await session.run(cypher, { embedding });
        console.log(`\nResults for "${q}":`);
        result.records.forEach(r => {
            console.log(`- ${r.get('name')} (Score: ${r.get('score').toFixed(3)})`);
        });
    } catch(e: any) {
        console.error("Neo4j Error:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}
run();
