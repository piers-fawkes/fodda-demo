import express from "express";
import cors from "cors";
import neo4j, { Driver } from "neo4j-driver";

const app = express();

/**
 * Middleware
 */
app.use(
  cors({
    origin: true, // tighten later to your UI origin(s)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
  })
);
app.options("*", cors()); // respond to preflight
app.use(express.json({ limit: "5mb" }));

/**
 * Env + Neo4j driver
 */
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

let driver: Driver | null = null;

function getDriver(): Driver {
  if (driver) return driver;

  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    // Fail fast. Better to error loudly than silently run a broken API.
    throw new Error(
      "Missing Neo4j env vars. Required: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD"
    );
  }

  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  );

  return driver;
}

/**
 * 1) Deploy check
 */
app.get("/__deploy_check", (_req, res) => {
  res.json({
    deployCheck: "api-v1",
    time: new Date().toISOString(),
    status: "ready",
  });
});

/**
 * 2) Neo4j health check
 */
app.get("/api/neo4j/health", async (_req, res) => {
  try {
    const d = getDriver();

    // Fast connectivity check
    await d.verifyConnectivity();

    const session = d.session({ database: NEO4J_DATABASE });
    try {
      await session.run("RETURN 1 AS ok");
      res.json({ ok: true, database: "connected" });
    } finally {
      await session.close();
    }
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: e?.message ?? String(e),
      hint: "Check Cloud Run env vars: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, (optional) NEO4J_DATABASE",
    });
  }
});

/**
 * 3) POST /api/query
 * Request body:
 * { q: string, vertical?: string|null, limit?: number }
 */
app.post("/api/query", async (req, res) => {
  const q = String(req.body?.q ?? "").trim();
  const verticalRaw = req.body?.vertical;
  const vertical =
    verticalRaw === null || verticalRaw === undefined || String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim();

  const limitNum = Number(req.body?.limit ?? 10);
  const limit = Math.min(Math.max(Number.isFinite(limitNum) ? limitNum : 10, 1), 50);

  let session: neo4j.Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    // Safe Cypher: do not string-interpolate clauses.
    // - If q is empty, return latest trends by trendId (or change to lastSeen if you prefer).
    // - If vertical is provided, filter.
    const cypher = `
      MATCH (t:Trend)
      WHERE
        ($q = "" OR
          toLower(t.trendName) CONTAINS toLower($q) OR
          toLower(coalesce(t.trendDescription,"")) CONTAINS toLower($q)
        )
        AND ($vertical IS NULL OR t.vertical = $vertical)
      WITH t
      ORDER BY t.trendId DESC
      LIMIT $limit

      OPTIONAL MATCH (a:Article)-[:EVIDENCE_FOR]->(t)
      WITH t, a
      ORDER BY a.publishedAt DESC

      WITH t, collect(a)[0..5] AS evidence
      RETURN
        t.trendId AS trendId,
        t.trendName AS trendName,
        t.trendDescription AS trendDescription,
        [e IN evidence | {
          articleId: e.articleId,
          title: e.title,
          sourceUrl: e.sourceUrl,
          publishedAt: e.publishedAt
        }] AS evidence
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
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  } finally {
    if (session) await session.close();
  }
});

/**
 * Start server (Cloud Run)
 */
const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
  console.log(`STARTUP api-v1 listening on ${PORT}`);
});
