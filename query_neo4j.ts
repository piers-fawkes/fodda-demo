import 'dotenv/config';
import neo4j from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI ?? "neo4j+s://337edc3e.databases.neo4j.io";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
if (!NEO4J_PASSWORD) throw new Error("NEO4J_PASSWORD is not set — add it to .env");

const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

async function main() {
    const session = driver.session({ database: 'neo4j' });
    try {
        // 1. What relationship types exist from Trend nodes?
        console.log("=== Relationships FROM Trend ===");
        const r1 = await session.run('MATCH (t:Trend)-[r]->(n) RETURN DISTINCT type(r) as rel, labels(n) as target LIMIT 20');
        r1.records.forEach(r => console.log(`  ${r.get('rel')} -> ${r.get('target')}`));

        // 2. What relationship types exist TO Trend nodes?
        console.log("\n=== Relationships TO Trend ===");
        const r2 = await session.run('MATCH (n)-[r]->(t:Trend) RETURN DISTINCT labels(n) as source, type(r) as rel LIMIT 20');
        r2.records.forEach(r => console.log(`  ${r.get('source')} -[${r.get('rel')}]-> Trend`));

        // 3. Check trend 6559 and its connected articles
        console.log("\n=== Trend 6559 Connected Nodes ===");
        const r3 = await session.run('MATCH (t {trendId: 6559})-[r]-(n) RETURN type(r) as rel, labels(n) as nodeLabels, properties(n) as props LIMIT 10');
        r3.records.forEach(r => {
            const props = r.get('props');
            console.log(`  ${r.get('rel')} -> ${r.get('nodeLabels')}`);
            console.log(`    title: ${props.title || props.articleTitle || props.name || 'N/A'}`);
            console.log(`    url: ${props.sourceUrl || props.url || props.link || 'N/A'}`);
            console.log(`    id: ${props.articleId || props.id || 'N/A'}`);
        });

        // 4. Check what Article nodes look like
        console.log("\n=== Sample Article Node Properties ===");
        const r4 = await session.run('MATCH (a:Article) RETURN keys(a) as keys LIMIT 1');
        r4.records.forEach(r => console.log(`  keys: ${r.get('keys')}`));

        // 5. Try fetching articles by IDs from articleIds_csv
        console.log("\n=== Articles by ID (14452, 14778) ===");
        const r5 = await session.run('MATCH (a:Article) WHERE a.articleId IN [14452, 14778, "14452", "14778"] RETURN a.articleId, a.title, a.sourceUrl, a.snippet LIMIT 5');
        r5.records.forEach(r => {
            console.log(`  ID: ${r.get('a.articleId')}, Title: ${r.get('a.title')}, URL: ${r.get('a.sourceUrl')}`);
        });

    } finally {
        await session.close();
        await driver.close();
    }
}

main().catch(console.error);
