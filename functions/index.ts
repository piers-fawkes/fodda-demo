import express from "express";
import cors from "cors";
import neo4j, { Driver, Session } from "neo4j-driver";

const app = express();

/**
 * Middleware & CORS
 */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
  }) as any
);
app.options("*", cors() as any);
app.use(express.json({ limit: "5mb" }) as any);

/**
 * Neo4j Configuration
 */
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

let driver: Driver | null = null;

function getDriver(): Driver {
  if (driver) return driver;

  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    console.error("CRITICAL: Missing Neo4j credentials in environment variables.");
    throw new Error("NEO4J_AUTH_MISSING");
  }

  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  );

  return driver;
}

/**
 * Debug: confirm env vars are present (remove later if you want)
 */
app.get("/api/debug/env", (_req, res) => {
  res.json({
    hasUri: Boolean(process.env.NEO4J_URI),
    hasUser: Boolean(process.env.NEO4J_USER),
    hasPassword: Boolean(process.env.NEO4J_PASSWORD),
    database: process.env.NEO4J_DATABASE || null,
  });
});

/**
 * 1) GET /__deploy_check
 */
app.get("/__deploy_check", (_req, res) => {
  res.json({
    deployCheck: "api-v1",
    time: new Date().toISOString(),
    status: "ready",
  });
});

/**
 * 2) GET /api/neo4j/health
 */
app.get("/api/neo4j/health", async (_req, res) => {
  try {
    const d = getDriver();
    await d.verifyConnectivity();

    const session = d.session({ database: NEO4J_DATABASE });
    try {
      await session.run("RETURN 1 AS ok");
      res.json({ ok: true, database: "connected" });
    } finally {
      await session.close();
    }
  } catch (e: any) {
    console.error("[Health Check Failed]", e?.message ?? e);
    res.status(500).json({
      ok: false,
      error: e?.message ?? "Failed to connect to Neo4j",
      hint: "Verify NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD are set correctly.",
    });
  }
});

/**
 * 3) POST /api/query
 */
app.post("/api/query", async (req, res) => {
  const q = String(req.body?.q ?? "").trim();

  const verticalRaw = req.body?.vertical;
  const vertical =
    verticalRaw === null ||
    verticalRaw === undefined ||
    String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim();

  const limit = Math.min(
    Math.max(parseInt(String(req.body?.limit ?? "10"), 10) || 10, 1),
    50
  );

  let session: Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    const cypher = `
CALL {
  // Path A: text search in trend fields
  WITH $q AS q, $vertical AS vertical, $limit AS limit
  MATCH (t:Trend)
  WHERE
    (q = "" OR
      toLower(t.trendName) CONTAINS toLower(q) OR
      toLower(coalesce(t.trendDescription,"")) CONTAINS toLower(q)
    )
    AND (
  $vertical IS NULL OR
  toLower(trim(coalesce(t.vertical,""))) = toLower(trim($vertical))
)
  RETURN t, 0 AS score
  ORDER BY t.trendId DESC
  LIMIT toInteger($limit)

  UNION

  // Path B: brand entity match (e.g. Nike)
  WITH $q AS q, $vertical AS vertical, $limit AS limit
MATCH (b:Brand)
WHERE ('|' + toLower(b.name) + '|') CONTAINS ('|' + toLower($q) + '|')
MATCH (b)<-[:MENTIONS_BRAND]-(a:Article)-[:EVIDENCE_FOR]->(t:Trend)
  WHERE (vertical IS NULL OR t.vertical = vertical)
  WITH t, count(DISTINCT a) AS score
  RETURN t, score
  ORDER BY score DESC
  LIMIT toInteger($limit)
  
}
WITH t, max(score) AS score
ORDER BY score DESC, t.trendId DESC
LIMIT toInteger($limit)

OPTIONAL MATCH (a2:Article)-[:EVIDENCE_FOR]->(t)
WITH t, collect(a2)[0..5] AS evidence
RETURN
  t.trendId AS trendId,
  t.trendName AS trendName,
  t.trendDescription AS trendDescription,
  [e IN evidence | {
    articleId: e.articleId,
    title: e.title,
    sourceUrl: e.sourceUrl,
    publishedAt: e.publishedAt
  }] AS evidence;
    `;

    const result = await session.run(cypher, { q, vertical, limit });

    const rows = result.records.map((record) => ({
      trendId: record.get("trendId"),
      trendName: record.get("trendName"),
      trendDescription: record.get("trendDescription"),
      evidence: record.get("evidence"),
    }));

    res.json({ ok: true, rows });
  } catch (e: any) {
    console.error("[Query Error]", e?.message ?? e);
    res.status(500).json({ ok: false, error: e?.message ?? "Database query failed" });
  } finally {
    if (session) await session.close();
  }
});

/**
 * Start server (Cloud Run)
 */
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`STARTUP api-v1 listening on ${PORT}`);
});
