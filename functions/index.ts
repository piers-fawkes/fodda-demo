
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import neo4j, { Driver, Session } from "neo4j-driver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.options("*", cors());
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
 * 1) GET /__deploy_check
 */
app.get("/__deploy_check", (req, res) => {
  res.json({
    deployCheck: "api-v1",
    time: new Date().toISOString(),
    status: "ready"
  });
});

/**
 * 2) GET /api/neo4j/health
 */
app.get("/api/neo4j/health", async (req, res) => {
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
    console.error("[Health Check Failed]", e.message);
    res.status(500).json({
      ok: false,
      error: e?.message ?? "Failed to connect to Neo4j",
      hint: "Verify NEO4J_URI, USER, and PASSWORD are set correctly."
    });
  }
});

/**
 * 3) POST /api/query
 */
app.post("/api/query", async (req, res) => {
  const q = String(req.body?.q ?? "").trim();
  const vertical = req.body?.vertical || null;
  const limitNum = Number(req.body?.limit ?? 10);
  const limit = Math.min(Math.max(Number.isFinite(limitNum) ? limitNum : 10, 1), 50);

  let session: Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    const cypher = `
      MATCH (t:Trend)
      WHERE 
        ($q = "" OR 
          toLower(t.trendName) CONTAINS toLower($q) OR 
          toLower(coalesce(t.trendDescription, "")) CONTAINS toLower($q)
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
    console.error("[Query Error]", e.message);
    res.status(500).json({ ok: false, error: e?.message ?? "Database query failed" });
  } finally {
    if (session) await session.close();
  }
});

/**
 * Serve Frontend Static Files
 * This assumes the frontend has been built into the 'dist' folder.
 */
const distPath = path.join(__dirname, "../dist");
// Fix: Use 'as any' to avoid TypeScript overload mismatch error for express.static middleware on line 153.
app.use(express.static(distPath) as any);

// Fallback to index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // If index.html is missing (e.g. during dev without build), 
      // just let the user know we're in API mode or it's not built.
      res.status(404).send("Frontend assets not found. Run 'npm run build' first.");
    }
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`STARTUP api-v1 listening on ${PORT}`);
});

app.get("/api/debug/env", (_req, res) => {
  res.json({
    hasUri: Boolean(process.env.NEO4J_URI),
    hasUser: Boolean(process.env.NEO4J_USER),
    hasPassword: Boolean(process.env.NEO4J_PASSWORD),
    database: process.env.NEO4J_DATABASE || null,
  });
});
