import { Router } from 'express';
import { queryAirtable } from '../db.js';
import { GRAPH_LIST_TABLE } from '../constants.js';

const router = Router();

// ── Helpers ──
function safeJsonParse(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Cache ──
const graphCatalogCache: { data: any[] | null; lastFetch: number } = { data: null, lastFetch: 0 };
const GRAPH_CATALOG_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/graph-catalog
 * Returns the full graph catalog from the Airtable Graph List table.
 * Cached for 5 minutes. This is the single source of truth for graph categorization.
 */
router.get("/graph-catalog", async (req, res) => {
  try {
    const now = Date.now();
    if (graphCatalogCache.data && (now - graphCatalogCache.lastFetch) < GRAPH_CATALOG_TTL) {
      console.log('[Graph Catalog] Serving from cache');
      return res.json({ ok: true, graphs: graphCatalogCache.data, source: 'cache' });
    }

    console.log('[Graph Catalog] Fetching from Airtable Graph List...');
    const result = await queryAirtable(
      GRAPH_LIST_TABLE,
      `OR({graphStatus} = 'live', {graphStatus} = 'beta', {graphStatus} = 'coming_soon')`
    );

    const graphs = (result.records || []).map((r: any) => {
      const f = r.fields;
      const graphId = f.graphId || '';
      const name = f['Graph Name'] || graphId;
      const headline = f.Headline || '';
      const curator = f.curator || '';
      const curatorUrl = f.curatorUrl || '';
      const status = f.graphStatus || 'coming-soon';
      const domain = f.domain || '';
      const topicsRaw = f.topics || '';
      const tags = typeof topicsRaw === 'string'
        ? topicsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
        : (Array.isArray(topicsRaw) ? topicsRaw : []);
      const exampleQueries = safeJsonParse(f.exampleQueries);
      const portraitAttachment = f['Portrait Attachment'] || [];
      const headshotUrl = portraitAttachment.length > 0 ? portraitAttachment[0].url : '';

      return {
        // Core fields (backward compatible with KnowledgeGraph interface)
        id: graphId,
        graph_id: graphId,
        name,
        description: headline,
        headline,
        owner: curator,
        isCustom: false,
        verticalName: domain || name,
        // Catalog fields
        curator,
        curator_url: curatorUrl,
        domain,
        graph_type: f.graphType || 'expert',
        topics: tags,
        status,
        example_queries: exampleQueries,
        portrait_url: headshotUrl,
        trend_count: f.trendCount || f.trend_count || 0,
        evidence_count: f.evidenceCount || f.evidence_count || 0,
        last_synced: f.lastSynced || f.last_synced || '',
        geography: f.geography || f.Geography || '',
        available_as: f.availableAs || f.available_as || '',
        is_playground: f.isPlayground || f.is_playground || false,
        published_date: f.publishedDate || f.published_date || '',
        last_updated: f.lastUpdated || f.last_updated || '',
        approved_date: f['Approved Date'] || f.approvedDate || '',
        quality_checker_name: f.qualityCheckerName || f.quality_checker_name || '',
        // Skill-specific fields (only populated for graph_type='skill')
        mcp_url: f.mcpUrl || null,
        skill_phase: f.skillPhase || 'output',
        skill_tool_name: f.skillToolName || null,
        skill_attribution: f.skillAttribution || null,
      };
    }).filter((g: any) => g.id);

    graphCatalogCache.data = graphs;
    graphCatalogCache.lastFetch = now;
    console.log(`[Graph Catalog] Loaded ${graphs.length} graphs from Airtable`);
    res.json({ ok: true, graphs, source: 'airtable' });
  } catch (err: any) {
    console.error('[Graph Catalog] Airtable fetch failed:', err.message);
    // Return cached data if available, even if stale
    if (graphCatalogCache.data) {
      return res.json({ ok: true, graphs: graphCatalogCache.data, source: 'stale-cache' });
    }
    // Final fallback: return empty (frontend has its own static fallback)
    res.json({ ok: true, graphs: [], source: 'fallback', error: err.message });
  }
});

export default router;
