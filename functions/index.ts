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
  let vertical =
    verticalRaw === null || verticalRaw === undefined || String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim().toLowerCase();

  // normalize common variants
  if (vertical === "sport") vertical = "sports";
  if (vertical === "beauty") vertical = "beauty";
  if (vertical === "retail") vertical = "retail";

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
    toLower(trim($vertical)) IN [v IN split(coalesce(t.vertical,""), ",") | toLower(trim(v))]
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
  WHERE (
    vertical IS NULL OR
    toLower(trim(vertical)) IN [v IN split(coalesce(t.vertical,""), ",") | toLower(trim(v))]
  )
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
 * 4) POST /api/brand/evidence
 * Returns brand-mentioned articles even if they are NOT linked to a Trend.
 *
 * Body:
 * {
 *   brands: string[] (required) e.g. ["Sephora","Ulta Beauty"]
 *   vertical?: string | null
 *   limit?: number (default 50, max 200)
 * }
 */
app.post("/api/brand/evidence", async (req, res) => {
  const brandsRaw = req.body?.brands;
  const brands: string[] = Array.isArray(brandsRaw)
    ? brandsRaw.map((b: any) => String(b).trim()).filter(Boolean)
    : [];

  const verticalRaw = req.body?.vertical;
  let vertical =
    verticalRaw === null || verticalRaw === undefined || String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim().toLowerCase();

  // normalize common variants
  if (vertical === "sport") vertical = "sports";

  const limit = Math.min(
    Math.max(parseInt(String(req.body?.limit ?? "50"), 10) || 50, 1),
    200
  );

  if (brands.length === 0) {
    return res.status(400).json({ ok: false, error: "brands[] is required" });
  }

  let session: Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    // pipe-bounded needles, e.g. "|sephora|"
    const brandNeedles = brands.map((b) => `|${b.toLowerCase()}|`);

    const cypher = `
      WITH $brandNeedles AS needles, $vertical AS vertical

      MATCH (b:Brand)
      WHERE any(n IN needles WHERE ('|' + toLower(b.name) + '|') CONTAINS n)

      MATCH (b)<-[:MENTIONS_BRAND]-(a:Article)
      OPTIONAL MATCH (a)-[:EVIDENCE_FOR]->(t:Trend)

      // Vertical filter (best-effort):
      // - Prefer a.vertical if present
      // - Otherwise fall back to t.vertical (supports comma-separated vertical strings)
      WITH b, a, t, vertical
      WHERE vertical IS NULL OR
        (
          toLower(trim(coalesce(a.vertical, ""))) = vertical OR
          vertical IN [v IN split(toLower(trim(coalesce(t.vertical, ""))), ",") | trim(v)]
        )

      RETURN
        b.name AS brand,
        a.articleId AS articleId,
        a.title AS title,
        a.sourceUrl AS sourceUrl,
        a.publishedAt AS publishedAt,
        t.trendId AS trendId,
        t.trendName AS trendName
      ORDER BY coalesce(a.publishedAt, "") DESC
      LIMIT toInteger($limit)
    `;

    const result = await session.run(cypher, {
      brandNeedles,
      vertical,
      limit,
    });

    const rows = result.records.map((r) => ({
      brand: String(r.get("brand") ?? ""),
      articleId: String(r.get("articleId") ?? ""),
      title: String(r.get("title") ?? ""),
      sourceUrl: String(r.get("sourceUrl") ?? ""),
      publishedAt: r.get("publishedAt") ?? null,
      trendId: r.get("trendId") ? String(r.get("trendId")) : null,
      trendName: r.get("trendName") ? String(r.get("trendName")) : null,
    }));

    res.json({ ok: true, rows });
  } catch (e: any) {
    console.error("[Brand Evidence Error]", e?.message ?? e);
    res.status(500).json({ ok: false, error: e?.message ?? "Brand evidence query failed" });
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
