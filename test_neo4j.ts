import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://... (from env)',
    neo4j.auth.basic(process.env.NEO4J_USER || '', process.env.NEO4J_PASSWORD || '')
);

async function runTest() {
    const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    try {
        const query = `
          MATCH (n) WHERE n.id = 'pew_npors_2025'
          RETURN n, labels(n) as labels
        `;
        const res = await session.run(query);
        const node = res.records[0]?.get('n')?.properties;
        const labels = res.records[0]?.get('labels');
        console.log('Node:', node);
        console.log('Labels:', labels);
    } catch (e) {
        console.error(e);
    } finally {
        await session.close();
        await driver.close();
    }
}
runTest();
