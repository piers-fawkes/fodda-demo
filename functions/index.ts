/**
 * 3) POST /api/query
 */
app.post("/api/query", async (req, res) => {
  const q = String(req.body?.q ?? "").trim();

  // vertical: allow null/empty string
  const verticalRaw = req.body?.vertical;
  const vertical =
    verticalRaw === null ||
    verticalRaw === undefined ||
    String(verticalRaw).trim() === ""
      ? null
      : String(verticalRaw).trim();

  // limit: force integer
  const limit = Math.min(
    Math.max(parseInt(String(req.body?.limit ?? "10"), 10) || 10, 1),
    50
  );

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
      LIMIT toInteger($limit)

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
