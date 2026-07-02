import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    const driver = neo4j.driver(
        process.env.NEO4J_URI || "",
        neo4j.auth.basic(process.env.NEO4J_USER || "", process.env.NEO4J_PASSWORD || "")
    );
    const session = driver.session({ database: process.env.NEO4J_DATABASE });

    const cypher = `
        MATCH (n:Trend)
        WHERE n.psfk_vertical = 'retail'
        MATCH (n)-[:CONTAINS_BRAND]->(b:Entity)
        RETURN n.name AS trend, collect(b.name) AS brand_names, collect(b.id) AS brand_ids
        LIMIT 5
    `;

    try {
        const result = await session.run(cypher);
        result.records.forEach(r => {
            console.log("Trend:", r.get('trend'));
            console.log("Brands:", r.get('brand_names'));
            console.log("IDs:", r.get('brand_ids'));
            console.log("---");
        });
    } catch(e: any) {
        console.error("Neo4j Error:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}
run();
