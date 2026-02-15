
import neo4j from "neo4j-driver";
import dotenv from "dotenv";
dotenv.config();

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

async function run() {
    const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    const session = driver.session();
    try {
        const result = await session.run('MATCH (n {id: "pew_npors_2025"}) RETURN n');
        if (result.records.length > 0) {
            console.log(JSON.stringify(result.records[0].get("n").properties, null, 2));
        } else {
            console.log("Node not found");
        }
    } finally {
        await session.close();
        await driver.close();
    }
}
run();
