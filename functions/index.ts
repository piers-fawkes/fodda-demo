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
    {
      disableLosslessIntegers: true,
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
    }
  );

  return driver;
}

/**
 * Helpers
 */
const STOPWORDS = new Set([
  "for",
  "the",
  "and",
  "specific",
  "leaning",
  "in",
  "what",
  "how",
  "why",
  "who",
  "where",
  "show",
  "me",
  "describe",
  "evidence",
  "find",
  "dataset",
  "graph",
  "linking",
  "of",
  "about",
  "impact",
  "its",
  "on",
  "to",
  "with",
  "presence",
  "across",
  "regarding",
  "identify",
  "trace",
  "map",
  "into",
  "within",
  "through",
  "using",
  "alongside",
  "activity",
  "doing",
  "is",
  "signals",
  "brand",
  "brands",
]);

function normalizeVertical(verticalRaw: any): string | null {
  const v =
    verticalRaw === null || verticalRaw === undefined || String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim().toLowerCase();

  if (!v) return null;
  if (v === "sport") return "sports";
  if (v === "beauty") return "beauty";
  if (v === "retail") return "retail";
  return v;
}

function clampInt(value: any, def: number, min: number, max: number): number {
  const n = parseInt(String(value ?? def), 10);
  const safe = Number.isFinite(n) ? n : def;
  return Math.min(Math.max(safe, min), max);
}

function tokenize(q: string[] | string): string[] {
  const queryStr = Array.isArray(q) ? q.join(" ") : q;

  const cleanQ = String(queryStr ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanQ) return [];

  const rawTerms = cleanQ.split(/\s+/).filter((t) => t.length > 0);
  const resultTerms = new Set<string>();

  for (const t of rawTerms) {
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    resultTerms.add(t);
  }

  return Array.from(resultTerms).slice(0, 40);
}

function normalizeProvidedTerms(raw: any): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((t: any) => String(t ?? "").toLowerCase().trim())
    .filter((t: string) => t.length > 0);
  return cleaned.length ? Array.from(new Set(cleaned)).slice(0, 50) : null;
}

function coalesce<T>(...args: T[]): T | undefined {
  return args.find((v) => v !== null && v !== undefined);
}

function toStr(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val);
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
    deployCheck: "api-v2",
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
  const vertical = normalizeVertical(req.body?.vertical);

  // Treat UI "limit" as anchor limit (max 50)
  const limit = clampInt(req.body?.limit, 10, 1, 50);

  // Allow either trendId or contextTrendId
  const trendIdRaw = coalesce(req.body?.trendId, req.body?.contextTrendId, null);
  const trendId =
    trendIdRaw === null || trendIdRaw === undefined || String(trendIdRaw).trim() === ""
      ? null
      : String(trendIdRaw).trim();

  // Optional terms override
  const providedTerms = normalizeProvidedTerms(req.body?.terms);
  const terms = providedTerms ?? tokenize(q);

  if (terms.length === 0 && !trendId) {
    return res.json({ ok: true, rows: [] });
  }

  let session: Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    // Stage 1: Trend-anchored retrieval (Interpretations)
    // IMPORTANT: Neo4j environment forbids LIMIT using a variable; use parameters directly.
    const trendCypher = `
      WITH $terms AS terms, $vertical AS vertical, $tId AS tId
      MATCH (n:Trend)
      WHERE
        (tId IS NOT NULL AND (toString(n.trendId) = toString(tId) OR toString(n.id) = toString(tId)))
        OR
        (size(terms) > 0 AND any(term IN terms WHERE
          toLower(coalesce(n.trendName,"")) CONTAINS term OR
          toLower(coalesce(n.trendDescription,"")) CONTAINS term
        ))

      WITH n, vertical, toLower(coalesce(n.vertical, "")) AS nVertical
      WHERE
        (vertical IS NULL OR n.vertical IS NULL
         OR any(v IN split(nVertical, ",") WHERE trim(toLower(v)) = vertical)
         OR nVertical CONTAINS vertical)

      OPTIONAL MATCH (n)<-[:EVIDENCE_FOR|:IS_CASE_STUDY_OF]-(a:Article)
      WITH n, collect(DISTINCT a)[0..30] AS evidenceList

      UNWIND evidenceList AS ea
      OPTIONAL MATCH (ea)-[:MENTIONS_BRAND]->(b:Brand)
      WITH n, evidenceList, collect(DISTINCT b.name) AS brands

      RETURN
        toString(coalesce(n.trendId, n.id, id(n))) AS rowId,
        coalesce(n.trendName, n.name, "Trend") AS rowName,
        coalesce(n.trendDescription, n.summary, "") AS rowSummary,
        evidenceList AS evidenceList,
        brands AS brands,
        false AS isDiscovery,
        "TREND" AS nodeType
      LIMIT toInteger($limit)
    `;

    // Stage 2: Article-first fallback (Signals)
    // IMPORTANT: Neo4j environment forbids LIMIT using a variable; use parameters directly.
    const articleFallbackCypher = `
      WITH $terms AS terms, $vertical AS vertical
      MATCH (a:Article)
      WHERE
        (vertical IS NULL OR a.vertical IS NULL
         OR any(v IN split(toLower(coalesce(a.vertical,"")), ",") WHERE trim(v) = vertical)
         OR toLower(coalesce(a.vertical,"")) CONTAINS vertical)
        AND
        any(term IN terms WHERE
          toLower(coalesce(a.title,"")) CONTAINS term OR
          toLower(coalesce(a.summary,"")) CONTAINS term OR
          toLower(coalesce(a.snippet,"")) CONTAINS term OR
          toLower(coalesce(a.excerpt,"")) CONTAINS term
        )
      WITH a
      ORDER BY coalesce(a.publishedAt, "") DESC
      LIMIT toInteger($limit)

      OPTIONAL MATCH (a)-[:MENTIONS_BRAND]->(b:Brand)
      WITH a, collect(DISTINCT b.name) AS brands

      RETURN
        "sig-" + toString(coalesce(a.articleId, a.id, id(a))) AS rowId,
        coalesce(a.title, "Source Signal") AS rowName,
        coalesce(a.summary, a.snippet, a.excerpt, "") AS rowSummary,
        [a] AS evidenceList,
        brands AS brands,
        true AS isDiscovery,
        "ARTICLE" AS nodeType
    `;

    // Run trend-first
    let result = await session.run(trendCypher, {
      terms,
      vertical,
      limit,
      tId: trendId,
    });

    let rows = result.records.map((rec) => {
      const evidenceList = (rec.get("evidenceList") || []) as any[];
      const brands = (rec.get("brands") || []) as string[];

      const evidence = evidenceList
        .map((e: any) => {
          const p = e?.properties ?? {};
          const id = toStr(coalesce(p.articleId, p.id, e.identity));
          const title = toStr(coalesce(p.title, "Signal"));
          const sourceUrl = toStr(coalesce(p.sourceUrl, p.url, "#"));
          const publishedAt = p.publishedAt ?? null;
          const snippet = toStr(coalesce(p.snippet, p.summary, p.excerpt, ""));
          const v = p.vertical ?? null;

          return {
            id,
            title,
            sourceUrl,
            publishedAt,
            snippet,
            vertical: v,
            brandNames: brands,
          };
        })
        .filter((ev: any) => ev.id && ev.title);

      return {
        rowId: toStr(rec.get("rowId")),
        rowName: toStr(rec.get("rowName")),
        rowSummary: toStr(rec.get("rowSummary")),
        nodeType: toStr(rec.get("nodeType")) as "TREND" | "ARTICLE",
        isDiscovery: Boolean(rec.get("isDiscovery")),
        evidence,
      };
    });

    // If we found zero rows OR we found rows but none have evidence, use signals-first fallback.
    const hasAnyEvidence = rows.some((r) => Array.isArray(r.evidence) && r.evidence.length > 0);
    if (rows.length === 0 || !hasAnyEvidence) {
      result = await session.run(articleFallbackCypher, { terms, vertical, limit });

      rows = result.records.map((rec) => {
        const evidenceList = (rec.get("evidenceList") || []) as any[];
        const brands = (rec.get("brands") || []) as string[];

        const evidence = evidenceList
          .map((e: any) => {
            const p = e?.properties ?? {};
            const id = toStr(coalesce(p.articleId, p.id, e.identity));
            const title = toStr(coalesce(p.title, "Signal"));
            const sourceUrl = toStr(coalesce(p.sourceUrl, p.url, "#"));
            const publishedAt = p.publishedAt ?? null;
            const snippet = toStr(coalesce(p.snippet, p.summary, p.excerpt, ""));
            const v = p.vertical ?? null;

            return {
              id,
              title,
              sourceUrl,
              publishedAt,
              snippet,
              vertical: v,
              brandNames: brands,
            };
          })
          .filter((ev: any) => ev.id && ev.title);

        return {
          rowId: toStr(rec.get("rowId")),
          rowName: toStr(rec.get("rowName")),
          rowSummary: toStr(rec.get("rowSummary")),
          nodeType: toStr(rec.get("nodeType")) as "TREND" | "ARTICLE",
          isDiscovery: Boolean(rec.get("isDiscovery")),
          evidence,
        };
      });
    }

    res.json({
      ok: true,
      rows,
      // Optional debug for troubleshooting:
      // debug: { q, vertical, limit, trendId, terms }
    });
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
 */
app.post("/api/brand/evidence", async (req, res) => {
  const brandsRaw = req.body?.brands;
  const brands: string[] = Array.isArray(brandsRaw)
    ? brandsRaw.map((b: any) => String(b).trim()).filter(Boolean)
    : [];

  const vertical = normalizeVertical(req.body?.vertical);
  const limit = clampInt(req.body?.limit, 50, 1, 200);

  if (brands.length === 0) {
    return res.status(400).json({ ok: false, error: "brands[] is required" });
  }

  let session: Session | null = null;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    const brandNeedles = brands.map((b) => `|${b.toLowerCase()}|`);

    const cypher = `
      WITH $brandNeedles AS needles, $vertical AS vertical

      MATCH (b:Brand)
      WHERE any(n IN needles WHERE ('|' + toLower(b.name) + '|') CONTAINS n)

      MATCH (b)<-[:MENTIONS_BRAND]-(a:Article)
      OPTIONAL MATCH (a)-[:EVIDENCE_FOR|:IS_CASE_STUDY_OF]->(t:Trend)

      WITH b, a, t, vertical,
           toLower(trim(coalesce(a.vertical, ""))) AS aV,
           toLower(trim(coalesce(t.vertical, ""))) AS tV

      WHERE vertical IS NULL OR
        (
          aV CONTAINS vertical OR
          any(v IN split(tV, ",") WHERE trim(v) = vertical) OR
          tV CONTAINS vertical
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
      brand: toStr(r.get("brand")),
      articleId: toStr(r.get("articleId")),
      title: toStr(r.get("title")),
      sourceUrl: toStr(r.get("sourceUrl")),
      publishedAt: r.get("publishedAt") ?? null,
      trendId: r.get("trendId") ? toStr(r.get("trendId")) : null,
      trendName: r.get("trendName") ? toStr(r.get("trendName")) : null,
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
  console.log(`STARTUP api-v2 listening on ${PORT}`);
});
