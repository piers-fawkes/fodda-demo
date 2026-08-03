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
    const filter = `OR({graphStatus} = 'live', {graphStatus} = 'beta', {graphStatus} = 'coming_soon')`;
    let allRecords: any[] = [];
    let offset = '';
    do {
      const page = await queryAirtable(GRAPH_LIST_TABLE, filter, offset ? `offset=${offset}` : '');
      allRecords = allRecords.concat(page.records || []);
      offset = page.offset || '';
    } while (offset);
    console.log(`[Graph Catalog] Fetched ${allRecords.length} records across all pages`);

    const graphs = allRecords.map((r: any) => {
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
      const askLine = f.askLine || f.ask_line || f['Ask Line'] || f.Ask || f['Ask'] || (Array.isArray(exampleQueries) && exampleQueries.length > 0 ? exampleQueries[0] : '');
      const niche = f.niche || f.Niche || f.expertise || f.Expertise || f['Niche Expertise'] || f['Niche'] || f['Expertise'] || (tags.length > 0 ? tags.join(' · ') : '');
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
        graph_type: f.graphType || 'domain',
        graph_sub_type: f.graphSubType || '',
        topics: tags,
        status,
        example_queries: exampleQueries,
        askLine,
        ask_line: askLine,
        niche,
        expertise: niche,
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
        // Expert-specific fields (enriched from analysts API)
        expert_slug: '',
      };
    }).filter((g: any) => g.id);

    // ── Enrich expert graphs with analyst slugs ──
    try {
      console.log('[Graph Catalog] Fetching analysts for expert_slug enrichment...');
      const analyticsRes = await fetch('https://api.fodda.ai/v1/analysts');
      if (!analyticsRes.ok) {
        console.warn(`[Graph Catalog] Analysts API returned ${analyticsRes.status}, skipping enrichment`);
      } else {
        const analyticsData = await analyticsRes.json() as { analysts?: any[] };
        const analysts = analyticsData.analysts || [];

        // Build a lookup: graphId -> analyst (scoped to Digital Twin analysts with dedicated graphs)
        const graphIdToAnalyst = new Map<string, any>();
        for (const analyst of analysts) {
          const backingGraphs: string[] = Array.isArray(analyst.backingGraphs) ? analyst.backingGraphs : [];
          for (const bgId of backingGraphs) {
            graphIdToAnalyst.set(bgId, analyst);
          }
        }

        let enrichedCount = 0;
        for (const graph of graphs) {
          const matchingAnalyst = graphIdToAnalyst.get(graph.id);
          if (!matchingAnalyst) continue;

          // Derive graph_type from analyst: Digital Twin analysts' backing graphs
          // are always expert graphs — Analyst table is the single source of truth.
          const analystSubType = (matchingAnalyst.graphSubType || '').toLowerCase().trim();
          if (analystSubType === 'digital twin' && graph.graph_type !== 'expert') {
            console.log(`[Graph Catalog] Promoting "${graph.id}" to graph_type=expert (analyst: ${matchingAnalyst.id})`);
            graph.graph_type = 'expert';
          }

          if (graph.graph_type === 'expert') {
            graph.expert_slug = matchingAnalyst.id || '';
            if (!graph.graph_sub_type && matchingAnalyst.graphSubType) {
              graph.graph_sub_type = matchingAnalyst.graphSubType;
            }
            if (matchingAnalyst.askLine || matchingAnalyst.ask_line) {
              graph.askLine = matchingAnalyst.askLine || matchingAnalyst.ask_line;
              graph.ask_line = graph.askLine;
            }
            if (matchingAnalyst.niche || matchingAnalyst.expertise || matchingAnalyst.topic) {
              graph.niche = matchingAnalyst.niche || matchingAnalyst.expertise || (Array.isArray(matchingAnalyst.topic) ? matchingAnalyst.topic.join(' · ') : matchingAnalyst.topic);
              graph.expertise = graph.niche;
            }
            enrichedCount++;
          }
        }
        console.log(`[Graph Catalog] Enriched ${enrichedCount} expert graphs from analyst records`);
      }
    } catch (enrichErr: any) {
      console.warn('[Graph Catalog] Analyst enrichment failed (non-fatal):', enrichErr.message);
    }

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

/**
 * GET /api/graph-trials
 * Admin endpoint: Returns graph-owner trial records with each owner's canonical
 * MCP connection URL (token scheme). Legacy sk_trial_ keys are retired and no
 * longer authenticate, so mcp_url is built from the owner's provisioned account
 * via buildMcpConnection, or null (mcp_status != 'active') if they have none.
 * Gated by X-Cron-Secret / X-Admin-Secret header or Authorization: Bearer token.
 */
router.get("/graph-trials", async (req, res) => {
  try {
    // Security: accept secret via headers only — query-string secrets leak into access logs
    let secret = (req.headers['x-cron-secret'] || req.headers['x-admin-secret']) as string;
    const authHeader = req.headers['authorization'] as string;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      secret = authHeader.substring(7);
    }

    // Finding 3: removed hardcoded 'psfk' backdoor — env var only
    const envSecret = process.env.CRON_SECRET || process.env.FODDA_MCP_SECRET;
    if (!secret || !envSecret || secret !== envSecret) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    const { TRIALS_TABLE } = await import('../constants.js');
    const { buildMcpConnection } = await import('../services/mcpConnectionService.js');
    const trialsResult = await queryAirtable(
      TRIALS_TABLE,
      `OR({status} = 'active', {status} = 'exhausted')`
    );

    const records = (trialsResult.records || []).filter((rec: any) => {
      const f = rec.fields;
      const graphId = f.graph_id || f.graphId || '';
      const trialKey = f.trial_key || f.trialKey || '';
      return graphId && trialKey;
    });

    // Legacy sk_trial_ keys are retired: they're blocked globally at the API gate
    // (see index.ts → handleLegacyTrialKey), so the old
    // `mcp.fodda.ai/mcp?api_key=sk_trial_...` URLs are dead on arrival. Advertise
    // the owner's canonical /c/<token> connection instead, built from their
    // provisioned account. Many trials share an owner, so dedupe the lookups.
    const connectionCache = new Map<string, ReturnType<typeof buildMcpConnection>>();
    const getConnection = (email: string) => {
      const key = email.toLowerCase().trim();
      if (!connectionCache.has(key)) connectionCache.set(key, buildMcpConnection(key));
      return connectionCache.get(key)!;
    };

    const trials: Record<string, any> = {};
    await Promise.all(records.map(async (rec: any) => {
      const f = rec.fields;
      const graphId = f.graph_id || f.graphId || '';
      const trialKey = f.trial_key || f.trialKey || '';
      const ownerEmail = (f.owner_id || f.ownerId || '').toString();

      const tokensTotal = Number(f.tokens_total || f.tokensTotal || 50);
      const tokensUsed = Number(f.tokens_used || f.tokensUsed || 0);

      let mcpUrl: string | null = null;
      let connectUrl: string | null = null;
      let mcpStatus: string;
      if (!ownerEmail.includes('@')) {
        mcpStatus = 'no_owner_email';
      } else {
        try {
          const connection = await getConnection(ownerEmail);
          if (connection.hasActiveKey && connection.mcpUrl) {
            mcpUrl = connection.mcpUrl;
            connectUrl = connection.claudeConnectorUrl;
            mcpStatus = 'active';
          } else {
            mcpStatus = 'no_account';
          }
        } catch (connErr: any) {
          console.warn(`[Graph Trials] Connection build failed for ${ownerEmail}:`, connErr.message);
          mcpStatus = 'error';
        }
      }

      trials[graphId] = {
        // Retained for reference/migration only — sk_trial_ keys no longer authenticate.
        legacy_trial_key: trialKey,
        // Owner's canonical MCP connection (token scheme), or null if unprovisioned.
        mcp_url: mcpUrl,
        connect_url: connectUrl,
        mcp_status: mcpStatus,
        signup_url: 'https://app.fodda.ai',
        status: f.status || 'active',
        credits_remaining: Math.max(0, tokensTotal - tokensUsed),
        credits_total: tokensTotal,
        owner_email: ownerEmail,
      };
    }));

    res.json({ ok: true, trials });
  } catch (err: any) {
    console.error('[Graph Trials] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/analysts
 * Proxy endpoint to fetch analysts from Fodda API without CORS issues.
 */
router.get("/analysts", async (req, res) => {
  try {
    const response = await fetch("https://api.fodda.ai/v1/analysts");
    if (!response.ok) {
      console.warn(`[Proxy Analysts] Fodda API returned ${response.status}`);
      return res.status(response.status).json({ ok: false, error: `Fodda API returned status ${response.status}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("[Proxy Analysts] Error fetching from Fodda API:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

