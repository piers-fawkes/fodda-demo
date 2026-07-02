
import neo4j from "neo4j-driver";

const NEO4J_URI = "neo4j+s://337edc3e.databases.neo4j.io";
const NEO4J_USER = "neo4j";
const NEO4J_PASSWORD = "y2Fp1PU1QeuiYrwLPHjjOpebpAbvST6Z9hPwUG9CWHU";

async function run() {
  // Test WITH vs WITHOUT disableLosslessIntegers
  const driver1 = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
    disableLosslessIntegers: true,
    maxConnectionPoolSize: 50,
    connectionTimeout: 30000,
  });

  const driver2 = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  const session1 = driver1.session({ database: "neo4j" });
  const session2 = driver2.session({ database: "neo4j" });

  try {
    console.log("=== WITH disableLosslessIntegers: true (same as deployed API) ===");
    const r1 = await session1.run(`
      WITH ['fulfillment'] AS terms, 'retail' AS vertical, null AS tId, 'psfk' AS graphId
      MATCH (n:Trend)
      OPTIONAL MATCH (n)-[:PART_OF_SECTOR]->(sec:Sector)
      WHERE (
        (toLower(graphId) = 'psfk' AND (
          (n)<-[:CONTAINS_TREND]-(:PSFKGraph {slug: vertical}) OR
          toLower(coalesce(n.psfk_vertical, "")) = toLower(vertical)
        ))
      )
      AND (
        (size(terms) > 0 AND any(term IN terms WHERE
          (size(term) > 3 AND (
            toLower(coalesce(n.trendName,"")) CONTAINS term OR 
            toLower(coalesce(n.trendDescription,"")) CONTAINS term
          ))
        ))
      )
      RETURN toString(coalesce(n.trendId, n.id, id(n))) AS rowId,
        coalesce(n.trendName, n.name, "Trend") AS rowName
      LIMIT 5
    `);
    console.log(`Found: ${r1.records.length} trends`);
    for (const r of r1.records) {
      console.log(`  - [${r.get("rowId")}] ${r.get("rowName")}`);
    }

    console.log("\n=== WITHOUT disableLosslessIntegers (default) ===");
    const r2 = await session2.run(`
      WITH ['fulfillment'] AS terms, 'retail' AS vertical, null AS tId, 'psfk' AS graphId
      MATCH (n:Trend)
      OPTIONAL MATCH (n)-[:PART_OF_SECTOR]->(sec:Sector)
      WHERE (
        (toLower(graphId) = 'psfk' AND (
          (n)<-[:CONTAINS_TREND]-(:PSFKGraph {slug: vertical}) OR
          toLower(coalesce(n.psfk_vertical, "")) = toLower(vertical)
        ))
      )
      AND (
        (size(terms) > 0 AND any(term IN terms WHERE
          (size(term) > 3 AND (
            toLower(coalesce(n.trendName,"")) CONTAINS term OR 
            toLower(coalesce(n.trendDescription,"")) CONTAINS term
          ))
        ))
      )
      RETURN toString(coalesce(n.trendId, n.id, id(n))) AS rowId,
        coalesce(n.trendName, n.name, "Trend") AS rowName
      LIMIT 5
    `);
    console.log(`Found: ${r2.records.length} trends`);
    for (const r of r2.records) {
      console.log(`  - [${r.get("rowId")}] ${r.get("rowName")}`);
    }

  } finally {
    await session1.close();
    await session2.close();
    await driver1.close();
    await driver2.close();
  }
}

run().catch(console.error);
