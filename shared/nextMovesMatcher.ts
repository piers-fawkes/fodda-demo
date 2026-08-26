/**
 * Next Moves Matcher — shared utility
 *
 * Evaluates whether a query matches the prior turn's next_moves recommendation:
 * thread | specific_brand | specific_stat | specific_expert | shelf | scope | none
 *
 * Ported from Fodda MCP sessionTracker.ts (evaluateNextMoveMatch)
 */

import { NextMoveTaken } from './types';

export function evaluateNextMoveMatch(
  currentQuery: string,
  lastNextMoves: any,
  currentTool?: string,
  toolArgs?: any
): NextMoveTaken {
  if (!lastNextMoves) return 'none';

  const q = (currentQuery || '').toLowerCase().trim();

  // 1. Scope check (explicit scoping to deliverable, brand, or brief)
  if (
    currentTool === 'request_deliverable' ||
    /(?:cut\s+(?:this\s+)?to|brief\s+(?:is|for)|working\s+on|for\s+(?:our|the)\s+brand|scope\s+to|apply\s+to|specifically\s+for|scope\s+(?:a\s+)?deliverable|executive\s+brief|project\s+deliverable|commission|scope\s+the\s+work)/i.test(q) ||
    (lastNextMoves.known_brand && q.includes(lastNextMoves.known_brand.toLowerCase()) && /(?:for|to|specifically|cut|scope)/i.test(q))
  ) {
    return 'scope';
  }

  // 2. Specific brand check
  if (lastNextMoves.specific?.brands?.length) {
    if (currentTool === 'brand_tracker' && toolArgs?.brand_name) {
      const bName = String(toolArgs.brand_name).toLowerCase();
      if (lastNextMoves.specific.brands.some((b: string) => b.toLowerCase() === bName || bName.includes(b.toLowerCase()))) {
        return 'specific_brand';
      }
    }
    for (const b of lastNextMoves.specific.brands) {
      const bLower = String(b).toLowerCase();
      if (bLower.length > 1 && q.includes(bLower)) {
        return 'specific_brand';
      }
    }
  }

  // 3. Specific expert check (referrals or alternate expert suggestions)
  if (lastNextMoves.specific?.expert) {
    const expId = (lastNextMoves.specific.expert.analyst_id || '').toLowerCase();
    const expName = (lastNextMoves.specific.expert.display_name || '').toLowerCase();
    if (
      currentTool === 'consult_analyst' ||
      currentTool === 'consult_human_agent'
    ) {
      const reqId = String(toolArgs?.analyst_id || '').toLowerCase();
      if ((expId && reqId === expId) || (expName && reqId.includes(expName))) {
        return 'specific_expert';
      }
    }
    if ((expName && q.includes(expName)) || (expId && q.includes(expId))) {
      return 'specific_expert';
    }
  }

  // 4. Specific stat check — ONLY if line 2 offered statistics_source
  if (lastNextMoves.specific?.statistics_source) {
    if (
      currentTool === 'search_statistics' ||
      currentTool === 'get_supplemental_context' ||
      /(?:statistics|statistical|stats|data\s+series|census|fred|bls|google\s+trends)/i.test(q)
    ) {
      return 'specific_stat';
    }
    const statWords = String(lastNextMoves.specific.statistics_source).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    if (statWords.some((w: string) => q.includes(w))) {
      return 'specific_stat';
    }
  }

  // 5. Thread check (expert thread or graph remainder)
  if (lastNextMoves.thread) {
    const t = lastNextMoves.thread;
    if (t.kind === 'expert_thread') {
      const gId = (t.graph_id || '').toLowerCase();
      const reqId = String(toolArgs?.analyst_id || '').toLowerCase();
      if (
        (currentTool === 'consult_analyst' || currentTool === 'consult_human_agent') &&
        (reqId === gId || !reqId)
      ) {
        return 'thread';
      }
      if (t.next_angle && q.includes(t.next_angle.toLowerCase().slice(0, 20))) {
        return 'thread';
      }
      if (t.theme && q.includes(t.theme.toLowerCase())) {
        return 'thread';
      }
      if (Array.isArray(t.uncited_themes) && t.uncited_themes.some((ut: string) => q.includes(ut.toLowerCase()))) {
        return 'thread';
      }
      if (/(?:stay\s+on\s+this|pull\s+(?:those|them|more)|look\s+into|deeper\s+signals)/i.test(q)) {
        return 'thread';
      }
    } else if (t.kind === 'more_in_graph') {
      if (currentTool !== 'search_statistics' && currentTool !== 'brand_tracker') {
        const gId = (t.graph_id || '').toLowerCase();
        const reqGid = String(toolArgs?.graphId || '').toLowerCase();
        const reqGraphs = Array.isArray(toolArgs?.graphs) ? toolArgs.graphs.map((x: any) => String(x).toLowerCase()) : [];
        if ((gId && (reqGid === gId || reqGraphs.includes(gId))) || (gId && q.includes(gId))) {
          return 'thread';
        }
        if (/(?:pull\s+(?:them|more|signals)|more\s+signals|remaining)/i.test(q)) {
          return 'thread';
        }
        if (t.theme && q.includes(t.theme.toLowerCase())) {
          return 'thread';
        }
      }
    } else if (t.kind === 'adjacent_room' || t.kind === 'honest_thin') {
      if (currentTool !== 'search_statistics' && currentTool !== 'brand_tracker') {
        const adjId = (t.adjacent?.graph_id || t.graph_id || '').toLowerCase();
        const reqGid = String(toolArgs?.graphId || '').toLowerCase();
        const reqGraphs = Array.isArray(toolArgs?.graphs) ? toolArgs.graphs.map((x: any) => String(x).toLowerCase()) : [];
        if ((adjId && (reqGid === adjId || reqGraphs.includes(adjId))) || (adjId && q.includes(adjId))) {
          return 'thread';
        }
        if (/(?:adjacent|other\s+room|want\s+that\s+room|fan\s+side|closest\s+adjacent)/i.test(q)) {
          return 'thread';
        }
      }
    }
  }

  // 6. Shelf graphs exploration
  const shelfList = lastNextMoves.shelf || lastNextMoves.specific?.shelf_graphs;
  if (shelfList && shelfList.length > 0) {
    for (const sg of shelfList) {
      const sgId = (sg.graph_id || '').toLowerCase();
      const sgName = (sg.graph_display || '').toLowerCase();
      const reqGid = String(toolArgs?.graphId || toolArgs?.graph_id || '').toLowerCase();
      const reqGraphs = Array.isArray(toolArgs?.graphs) ? toolArgs.graphs.map((x: any) => String(x).toLowerCase()) : [];
      if ((sgId && (reqGid === sgId || reqGraphs.includes(sgId))) || (sgName && q.includes(sgName))) {
        return 'shelf';
      }
      if (
        (currentTool === 'search_graph' || currentTool === 'get_domain_intelligence' || currentTool === 'get_report_intelligence') &&
        sgId && q.includes(sgId)
      ) {
        return 'shelf';
      }
    }
  }

  return 'none';
}
