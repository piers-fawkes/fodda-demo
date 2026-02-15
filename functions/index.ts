import express from "express";
import cors from "cors";
import neo4j, { Driver, Session, QueryResult } from "neo4j-driver";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

/**
 * ESM-safe __dirname / __filename
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

type FoddaReqMeta = {
  requestId: string;
  keyFp: string | null; // hashed fingerprint
};

function makeRequestId(): string {
  // simple, stable enough for tracing; swap for uuid later if you want
  return crypto.randomBytes(12).toString("hex");
}

function hashApiKey(rawKey: string): string {
  // sha256 is fine for fingerprinting. Never store/log the raw key.
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Middleware & CORS
 */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
    maxAge: 86400,
  }) as any
);
app.options("*", cors() as any);
app.use(express.json({ limit: "5mb" }) as any);

// Attach request metadata early so every route can log consistently.
app.use((req: any, res, next) => {
  const requestId = makeRequestId();

  const rawKey = String(req.header("X-API-Key") ?? "").trim();
  const keyFp = rawKey ? hashApiKey(rawKey) : null;

  req.fodda = { requestId, keyFp } as FoddaReqMeta;

  // Helpful for debugging in clients and Cloud Run logs correlation
  res.setHeader("X-Request-Id", requestId);
  if (keyFp) res.setHeader("X-Fodda-Key-Fp", keyFp);

  next();
});

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
  "up",
  "ups",
  "trend",
  "trends",
  "using",
  "alongside",
  "activity",
  "doing",
  "is",
  "signals",
  "brand",
  "brands",
  "up",
  "trends",
  "trend",
  "into",
]);

const GEO_TERMS = new Set(["jordan", "jordanian", "amman", "aqaba", "middle east", "mena"]);

const METRIC_TERMS = new Set([
  "population",
  "gdp",
  "per capita",
  "capita",
  "metric",
  "statistics",
  "stats",
  "club count",
  "clubs",
  "league",
  "fifa",
  "afc",
]);

type Decision = "ANSWER" | "ANSWER_WITH_CAVEATS" | "REFUSE";

function extractRequiredTerms(query: string): string[] {
  const q = String(query ?? "").toLowerCase();
  const required: string[] = [];

  for (const term of GEO_TERMS) {
    if (q.includes(term)) required.push(term);
  }

  for (const term of METRIC_TERMS) {
    if (q.includes(term)) required.push(term);
  }

  // Conservative heuristic: adjectives like "jordanian"
  const adjMatches = q.match(/\b[a-z]{4,}ian\b/g);
  if (adjMatches) {
    for (const m of adjMatches) required.push(m);
  }

  return Array.from(new Set(required));
}

function buildEvidenceHaystack(rows: any[]): string {
  const chunks: string[] = [];

  for (const r of rows) {
    chunks.push(String(r.rowName ?? ""));
    chunks.push(String(r.rowSummary ?? ""));

    if (Array.isArray(r.evidence)) {
      for (const e of r.evidence) {
        chunks.push(String(e.title ?? ""));
        chunks.push(String(e.snippet ?? ""));
        if (Array.isArray(e.brandNames)) chunks.push(e.brandNames.join(" "));
      }
    }
  }

  return chunks.join(" ").toLowerCase();
}

function decideCoverage(
  query: string,
  rows: any[]
): {
  requiredTerms: string[];
  matchedTerms: string[];
  coverageRatio: number;
  decision: Decision;
} {
  const requiredTerms = extractRequiredTerms(query);

  if (requiredTerms.length === 0) {
    return {
      requiredTerms: [],
      matchedTerms: [],
      coverageRatio: 1,
      decision: "ANSWER",
    };
  }

  const haystack = buildEvidenceHaystack(rows);
  const matchedTerms = requiredTerms.filter((t) => haystack.includes(t));
  const coverageRatio = matchedTerms.length / requiredTerms.length;

  const decision: Decision =
    matchedTerms.length === 0
      ? "REFUSE"
      : coverageRatio < 0.5
        ? "ANSWER_WITH_CAVEATS"
        : "ANSWER";

  return { requiredTerms, matchedTerms, coverageRatio, decision };
}

function normalizeVertical(verticalRaw: any): string | null {
  const v =
    verticalRaw === null || verticalRaw === undefined || String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim().toLowerCase();

  if (!v) return null;
  if (v === "sport") return "sports";
  if (v === "sports") return "sports";
  if (v === "beauty") return "beauty";
  if (v === "retail") return "retail";
  if (v === "baseline") return "baseline";
  if (v === "public_baseline") return "baseline";
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
    // Treat hyphens and slashes as spaces to improve matching for compound words like "pop-up"
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanQ) return [];

  const rawTerms = cleanQ.split(/\s+/).filter((t) => t.length > 0);
  const resultTerms = new Set<string>();

  for (const t of rawTerms) {
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    resultTerms.add(t);

    // Support "popups" -> "pop" and "up" (if not stopword) or just "pop"
    if (t === "popups" || t === "popup") {
      resultTerms.add("pop");
    }
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

function fmtShare(val: any): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "";
  // Avoid scientific notation and keep output compact
  const s = n.toFixed(6);
  return s.replace(/0+$/, "").replace(/\.$/, "");
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
    deployCheck: "api-v3-baseline-2026-01-23-001",
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

  // Allow baseline to return full distributions (often >50 rows).
  const limitMax = vertical === "baseline" ? 500 : 50;
  const limit = clampInt(req.body?.limit, 10, 1, limitMax);

  const graphIdRaw = String(req.body?.graphId ?? "").trim();
  const graphId = graphIdRaw ? graphIdRaw.toLowerCase() : null;

  // Default graph for early demo safety.
  // This prevents Waldo trends from leaking into PSFK queries.
  const effectiveGraphId = graphId ?? (vertical === "baseline" ? "pew" : "psfk");

  const trendIdRaw = coalesce(req.body?.trendId, req.body?.contextTrendId, null);
  const trendId =
    trendIdRaw === null || trendIdRaw === undefined || String(trendIdRaw).trim() === ""
      ? null
      : String(trendIdRaw).trim();

  let session: Session | null = null;
  let result: QueryResult;

  try {
    const d = getDriver();
    session = d.session({ database: NEO4J_DATABASE });

    /**
     * Baseline graph handler (NPORS)
     * IMPORTANT: This must run BEFORE any "no terms" early return,
     * because baseline queries are param driven (questionId + segmentType),
     * not term driven.
     */
    if (vertical === "baseline") {
      console.log("[BASELINE HANDLER HIT]", {
        questionId: req.body?.questionId,
        segmentType: req.body?.segmentType,
        excludeBlank: req.body?.excludeBlank,
        limit,
      });

      const questionIdRaw = coalesce(req.body?.questionId, req.body?.question_id, null);
      const segmentTypeRaw = coalesce(req.body?.segmentType, req.body?.segment_type, "AGEGRP");
      const excludeBlank = req.body?.excludeBlank !== false; // default true

      const questionId =
        questionIdRaw === null || questionIdRaw === undefined || String(questionIdRaw).trim() === ""
          ? null
          : String(questionIdRaw).trim();

      const segmentType = String(segmentTypeRaw ?? "AGEGRP").trim().toUpperCase();

      if (!questionId) {
        return res.json({
          ok: true,
          dataStatus: "NO_MATCH",
          rows: [],
          meta: { query: q, vertical, limit, decision: "REFUSE", note: "baseline requires questionId" },
        });
      }

      const baselineCypher = `
        MATCH (q:Question {id:$questionId})<-[:FOR_QUESTION]-(st:Statistic)<-[:HAS_STATISTIC]-(s:Segment)
        MATCH (st)-[:FOR_ANSWER]->(a:AnswerOption)
        WHERE st.dataset_id = 'pew_npors_2025'
          AND s.type = $segmentType
          AND ($excludeBlank = false OR a.value <> 'BLANK')
          AND s.value <> '99'
          AND toLower(coalesce(st.graphId,'')) = $graphId
        RETURN
          (q.id + '|' + coalesce(s.display,s.label,s.value,s.id) + '|' + a.value) AS rowId,
          coalesce(s.display,s.label,s.value,s.id) AS rowName,
          coalesce(a.display,a.label,a.value) AS answerLabel,
          st.share AS share,
          false AS isDiscovery,
          "BASELINE_STAT" AS nodeType
        ORDER BY s.value, a.value
        LIMIT toInteger($limit)
      `;

      result = await session.run(baselineCypher, {
        questionId,
        segmentType,
        excludeBlank,
        limit,
        graphId: effectiveGraphId,
      });

      const rows = result.records.map((rec) => {
        const answerLabel = toStr(rec.get("answerLabel"));
        const share = rec.get("share");
        return {
          rowId: toStr(rec.get("rowId")),
          rowName: toStr(rec.get("rowName")),
          answerLabel,
          share,
          rowSummary: `${answerLabel}: ${fmtShare(share)}`,
          nodeType: toStr(rec.get("nodeType")),
          isDiscovery: Boolean(rec.get("isDiscovery")),
          evidence: [],
        };
      });

      const dataStatus = rows.length ? "BASELINE_MATCH" : "NO_MATCH";
      const decision: Decision = rows.length ? "ANSWER" : "REFUSE";

      const requestId = (req as any).fodda?.requestId;
      const keyFp = (req as any).fodda?.keyFp;
      console.log(
        JSON.stringify({
          event: "api.query.baseline",
          requestId,
          keyFp,
          vertical,
          limit,
          questionId,
          segmentType,
          excludeBlank,
          rowCount: rows.length,
          decision,
          dataStatus,
        })
      );

      return res.json({
        ok: true,
        dataStatus,
        rows,
        meta: {
          query: q,
          vertical,
          limit,
          questionId,
          segmentType,
          excludeBlank,
          rowCount: rows.length,
          decision,
        },
      });
    }

    // Non-baseline path: term-driven PSFK trends and article fallback.
    const providedTerms = normalizeProvidedTerms(req.body?.terms);
    const terms = providedTerms ?? tokenize(q);

    // This early return is now safe because baseline already returned above.
    if (terms.length === 0 && !trendId) {
      return res.json({
        ok: true,
        dataStatus: "NO_MATCH",
        rows: [],
        meta: { query: q, vertical, limit, decision: "REFUSE" },
      });
    }

    const trendCypher = `
  WITH $terms AS terms, $vertical AS vertical, $tId AS tId, $graphId AS graphId
  MATCH (n:Trend)
  WHERE
    toLower(coalesce(n.graphId,'')) = toLower(graphId)
    AND (
      (tId IS NOT NULL AND (toString(n.trendId) = toString(tId) OR toString(n.id) = toString(tId)))
      OR
      (size(terms) > 0 AND any(term IN terms WHERE
        (size(term) > 3 AND (toLower(coalesce(n.trendName,"")) CONTAINS term OR toLower(coalesce(n.trendDescription,"")) CONTAINS term))
        OR
        (size(term) <= 3 AND (toLower(coalesce(n.trendName,"")) =~ ("(?i).*\\b" + term + "\\b.*") OR toLower(coalesce(n.trendDescription,"")) =~ ("(?i).*\\b" + term + "\\b.*")))
      ))
    )

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
    "TREND" AS nodeType,
    coalesce(n.vertical, "") AS inferredVertical
  LIMIT toInteger($limit)
`;

    const articleFallbackCypher = `
  WITH $terms AS terms, $vertical AS vertical, $graphId AS graphId
  MATCH (a:Article)
  OPTIONAL MATCH (a)-[:EVIDENCE_FOR|:IS_CASE_STUDY_OF]->(t:Trend)

  WITH a, t, terms, vertical,
       toLower(coalesce(a.vertical, "")) AS aV,
       toLower(coalesce(t.vertical, "")) AS tV,
       toLower(coalesce(a.graphId, "")) AS aG

  WHERE
    aG = toLower(graphId)
    AND (
      vertical IS NULL
      OR aV CONTAINS vertical
      OR any(v IN split(tV, ",") WHERE trim(v) = vertical)
      OR tV CONTAINS vertical
    )
    AND any(term IN terms WHERE
      (size(term) > 3 AND (
        toLower(coalesce(a.title,"")) CONTAINS term OR
        toLower(coalesce(a.summary,"")) CONTAINS term OR
        toLower(coalesce(a.snippet,"")) CONTAINS term OR
        toLower(coalesce(a.excerpt,"")) CONTAINS term
      )) OR
      (size(term) <= 3 AND (
        toLower(coalesce(a.title,"")) =~ ("(?i).*\\b" + term + "\\b.*") OR
        toLower(coalesce(a.summary,"")) =~ ("(?i).*\\b" + term + "\\b.*") OR
        toLower(coalesce(a.snippet,"")) =~ ("(?i).*\\b" + term + "\\b.*") OR
        toLower(coalesce(a.excerpt,"")) =~ ("(?i).*\\b" + term + "\\b.*")
      ))
    )

  WITH a, t,
       REDUCE(score = 0, term IN $terms |
         score +
         CASE WHEN toLower(coalesce(a.title,""))   =~ ("(?i).*\\b" + term + "\\b.*") THEN 100 ELSE 0 END +
         CASE WHEN toLower(coalesce(a.title,""))   CONTAINS term THEN 20 ELSE 0 END +
         CASE WHEN toLower(coalesce(a.summary,"")) =~ ("(?i).*\\b" + term + "\\b.*") THEN 30  ELSE 0 END +
         CASE WHEN toLower(coalesce(a.snippet,"")) =~ ("(?i).*\\b" + term + "\\b.*") THEN 20  ELSE 0 END +
         CASE WHEN toLower(coalesce(a.excerpt,"")) =~ ("(?i).*\\b" + term + "\\b.*") THEN 10  ELSE 0 END
       ) AS relevance

  ORDER BY relevance DESC, coalesce(a.publishedAt, "") DESC
  LIMIT toInteger($limit)

  OPTIONAL MATCH (a)-[:MENTIONS_BRAND]->(b:Brand)
  WITH a, t, collect(DISTINCT b.name) AS brands

  RETURN
    "sig-" + toString(coalesce(a.articleId, a.id, id(a))) AS rowId,
    coalesce(a.title, "Source Signal") AS rowName,
    coalesce(a.summary, a.snippet, a.excerpt, "") AS rowSummary,
    [a] AS evidenceList,
    brands AS brands,
    true AS isDiscovery,
    "ARTICLE" AS nodeType,
    coalesce(a.vertical, t.vertical, "") AS inferredVertical
`;
    // Trend-first
    result = await session.run(trendCypher, {
      terms,
      vertical,
      limit,
      tId: trendId,
      graphId: effectiveGraphId,
    });

    let rows = result.records.map((rec) => {
      const evidenceList = (rec.get("evidenceList") || []) as any[];
      const brands = (rec.get("brands") || []) as string[];
      const inferredVertical = toStr(rec.get("inferredVertical"));

      const evidence = evidenceList
        .map((e: any) => {
          const p = e?.properties ?? {};
          const id = toStr(coalesce(p.articleId, p.id, e.identity));
          const title = toStr(coalesce(p.title, "Signal"));
          const sourceUrl = toStr(coalesce(p.sourceUrl, p.url, "#"));
          const publishedAt = p.publishedAt ?? null;
          const snippet = toStr(coalesce(p.snippet, p.summary, p.excerpt, ""));
          const v = coalesce(p.vertical, inferredVertical, null);

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

    let dataStatus: "TREND_MATCH" | "SIGNAL_MATCH" | "NO_MATCH" = "TREND_MATCH";
    const hasAnyEvidence = rows.some((r) => Array.isArray(r.evidence) && r.evidence.length > 0);

    if (rows.length === 0 || !hasAnyEvidence) {
      dataStatus = "SIGNAL_MATCH";

      result = await session.run(articleFallbackCypher, { terms, vertical, limit, graphId: effectiveGraphId });

      rows = result.records.map((rec) => {
        const evidenceList = (rec.get("evidenceList") || []) as any[];
        const brands = (rec.get("brands") || []) as string[];
        const inferredVertical = toStr(rec.get("inferredVertical"));

        const evidence = evidenceList
          .map((e: any) => {
            const p = e?.properties ?? {};
            const id = toStr(coalesce(p.articleId, p.id, e.identity));
            const title = toStr(coalesce(p.title, "Signal"));
            const sourceUrl = toStr(coalesce(p.sourceUrl, p.url, "#"));
            const publishedAt = p.publishedAt ?? null;
            const snippet = toStr(coalesce(p.snippet, p.summary, p.excerpt, ""));
            const v = coalesce(p.vertical, inferredVertical, null);

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

      if (rows.length === 0) dataStatus = "NO_MATCH";
    }

    const coverage = decideCoverage(q, rows);
    const requestId = (req as any).fodda?.requestId;
    const keyFp = (req as any).fodda?.keyFp;

    console.log(
      JSON.stringify({
        event: "api.query",
        requestId,
        keyFp,
        vertical,
        limit,
        trendId,
        termsCount: terms.length,
        rowCount: rows.length,
        evidenceCount: rows.reduce((acc: number, r: any) => acc + (r?.evidence?.length ?? 0), 0),
        decision: coverage.decision,
        dataStatus,
      })
    );

    res.json({
      ok: true,
      dataStatus,
      rows,
      meta: {
        query: q,
        vertical,
        limit,
        trendId,
        termsCount: terms.length,
        rowCount: rows.length,
        evidenceCount: rows.reduce((acc: number, r: any) => acc + (r?.evidence?.length ?? 0), 0),
        coverage: {
          requiredTerms: coverage.requiredTerms,
          matchedTerms: coverage.matchedTerms,
          coverageRatio: coverage.coverageRatio,
        },
        decision: coverage.decision,
      },
    });
  } catch (e: any) {
    const requestId = (req as any).fodda?.requestId;
    const keyFp = (req as any).fodda?.keyFp;

    console.error(
      JSON.stringify({
        event: "api.query.error",
        requestId,
        keyFp,
        vertical,
        error: e?.message ?? String(e),
      })
    );

    res.status(500).json({
      ok: false,
      error: e?.message ?? "Database query failed",
    });
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
    ? brandsRaw.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0)
    : [];

  const vertical = normalizeVertical(req.body?.vertical);
  // Restore original limit behavior for this endpoint
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

    const requestId = (req as any).fodda?.requestId;
    const keyFp = (req as any).fodda?.keyFp;

    console.log(
      JSON.stringify({
        event: "api.brand_evidence",
        requestId,
        keyFp,
        vertical,
        limit,
        brandsCount: brands.length,
        rowCount: rows.length,
      })
    );

    res.json({ ok: true, rows });
  } catch (e: any) {
    const requestId = (req as any).fodda?.requestId;
    const keyFp = (req as any).fodda?.keyFp;

    console.error(
      JSON.stringify({
        event: "api.brand_evidence.error",
        requestId,
        keyFp,
        vertical,
        brandsCount: brands.length,
        error: e?.message ?? String(e),
      })
    );

    res.status(500).json({
      ok: false,
      error: e?.message ?? "Brand evidence query failed",
    });
  } finally {
    if (session) await session.close();
  }
});

/**
 * OpenAPI spec for Vertex tool import
 * Serves: https://api.fodda.ai/openapi/fodda-vertex-tool.yaml
 */
app.get("/openapi/fodda-vertex-tool.yaml", (_req, res) => {
  res.type("application/yaml");
  res.sendFile(path.join(__dirname, "openapi", "fodda-vertex-tool.yaml"));
});

/**
 * Minimal stub to stop client console noise (DataService.logPrompt())
 */
app.post("/api/log", (_req, res) => {
  res.json({ ok: true });
});

// Serve static files from the build directory (one level up from functions/)
// In production: dist/functions/index.js -> dist/
const clientBuildPath = path.join(__dirname, "../");
app.use(express.static(clientBuildPath));

// Handle client-side routing by returning index.html for all other routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

/**
 * Start server (Cloud Run)
 */
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`STARTUP api-v3 listening on ${PORT}`);
});
