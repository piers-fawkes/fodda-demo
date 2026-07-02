/**
 * Skill Executor Service — Catalog-driven post-processing skills
 *
 * Skills are loaded from the Airtable Graph List table (graph_type = 'skill').
 * Each skill defines its MCP endpoint, tool name, and phase.
 * Auth tokens are read from env vars: SKILL_TOKEN_{SKILL_ID_UPPER}
 *
 * Adding a new skill requires:
 *   1. Add a row to Airtable Graph List with graphType='skill'
 *   2. Set SKILL_TOKEN_{ID} env var
 *   3. Deploy — zero code changes
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { queryAirtable } from '../db.js';
import { GRAPH_LIST_TABLE } from '../constants.js';

// ── Types ──────────────────────────────────────────────────────

export interface SkillConfig {
  id: string;
  name: string;
  mcpUrl: string;
  toolName: string;
  phase: 'output' | 'input' | 'routing';
  status: string;
  attribution: string;       // e.g. "🔀 Paralogy Analysis"
  attributionEmoji: string;  // e.g. "🔀"
}

export interface SkillPayload {
  query: string;
  trends: Array<{ name: string; summary: string; evidence_count?: number; [k: string]: any }>;
  evidence: Array<{ title: string; sourceUrl?: string; snippet?: string; [k: string]: any }>;
  fodda_output: {
    answer: string;
    graphName?: string;
    curator?: string;
    domain?: string;
    supplementalData?: any;
  };
  depth: 'quick' | 'standard' | 'deep';
}

export interface SkillResult {
  skillId: string;
  skillName: string;
  attribution: string;
  protocol: string;
  durationMs: number;
  error?: string;
}

// ── Registry (Airtable-backed, cached) ─────────────────────────

const registryCache: { skills: SkillConfig[] | null; lastFetch: number } = {
  skills: null,
  lastFetch: 0,
};
const REGISTRY_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSkillRegistry(): Promise<SkillConfig[]> {
  const now = Date.now();
  if (registryCache.skills && (now - registryCache.lastFetch) < REGISTRY_TTL) {
    return registryCache.skills;
  }

  try {
    const result = await queryAirtable(
      GRAPH_LIST_TABLE,
      `AND({graphType} = 'skill', OR({graphStatus} = 'live', {graphStatus} = 'beta'))`
    );

    const skills: SkillConfig[] = (result.records || [])
      .map((r: any) => {
        const f = r.fields;
        const id = f.graphId || '';
        const mcpUrl = f.mcpUrl || '';
        const toolName = f.skillToolName || '';
        if (!id || !mcpUrl || !toolName) return null;

        const emoji = f.skillAttribution || '⚡';
        const name = f['Graph Name'] || id;

        return {
          id,
          name,
          mcpUrl,
          toolName,
          phase: (f.skillPhase || 'output') as SkillConfig['phase'],
          status: f.graphStatus || 'beta',
          attribution: `${emoji} ${name} Analysis`,
          attributionEmoji: emoji,
        };
      })
      .filter(Boolean) as SkillConfig[];

    registryCache.skills = skills;
    registryCache.lastFetch = now;
    console.log(`[SkillExecutor] Registry loaded: ${skills.length} skills (${skills.map(s => s.id).join(', ')})`);
    return skills;
  } catch (err: any) {
    console.error('[SkillExecutor] Failed to load registry:', err.message);
    return registryCache.skills || [];
  }
}

/** Force-clear the registry cache (e.g. after config change) */
export function clearSkillRegistryCache(): void {
  registryCache.skills = null;
  registryCache.lastFetch = 0;
}

// ── Depth Detection ────────────────────────────────────────────

const DEEP_TRIGGERS = /\b(give me ideas|brainstorm|what should we do|what are the options|approaches|solutions?\s+for|how might we|ideation|action\s+plan|what can we do|strategies\s+for|recommend|possibilities)\b/i;

export function detectDepth(query: string): 'quick' | 'standard' | 'deep' {
  if (DEEP_TRIGGERS.test(query)) return 'deep';
  // Future: detect "quick" for short follow-ups
  return 'standard';
}

// ── Skip Detection ─────────────────────────────────────────────

export function isSkipRequested(query: string, skillName: string): boolean {
  const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\bskip\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bwithout\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bno\\s+${escaped}\\b`, 'i'),
  ];
  return patterns.some(p => p.test(query));
}

// ── Token Lookup ───────────────────────────────────────────────

function getSkillToken(skillId: string): string | null {
  // Pattern: SKILL_TOKEN_PARALOGY, SKILL_TOKEN_IGLOO, etc.
  const envKey = `SKILL_TOKEN_${skillId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey] || null;
}

// ── Individual Skill Call ──────────────────────────────────────

const SKILL_TIMEOUT_MS = 10_000;

async function callSkill(config: SkillConfig, payload: SkillPayload): Promise<SkillResult> {
  const start = Date.now();
  let client: Client | null = null;

  try {
    const token = getSkillToken(config.id);
    if (!token) {
      console.warn(`[SkillExecutor] No token for skill ${config.id} (env: SKILL_TOKEN_${config.id.toUpperCase()})`);
      return { skillId: config.id, skillName: config.name, attribution: config.attribution, protocol: '', durationMs: 0, error: 'no_token' };
    }

    // Empty trends → fail-open per spec
    if (!payload.trends || payload.trends.length === 0) {
      console.log(`[SkillExecutor] Skipping ${config.id} — no trends to analyze`);
      return { skillId: config.id, skillName: config.name, attribution: config.attribution, protocol: '', durationMs: 0 };
    }

    client = new Client({ name: 'fodda-skill-client', version: '1.0.0' });

    const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
      requestInit: {
        headers: { 'Authorization': `Bearer ${token}` },
      },
    });

    // Race against timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Skill connection timeout')), SKILL_TIMEOUT_MS)
    );
    await Promise.race([connectPromise, timeoutPromise]);

    // Call the skill's tool
    const toolResult = await client.callTool({
      name: config.toolName,
      arguments: {
        query: payload.query,
        trends: payload.trends,
        evidence: payload.evidence || [],
        fodda_output: payload.fodda_output,
        depth: payload.depth,
      },
    });

    const contentArr = Array.isArray(toolResult.content) ? toolResult.content : [];
    const protocol = contentArr
      .map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c))
      .join('\n') || '';

    const durationMs = Date.now() - start;
    console.log(`[SkillExecutor] ${config.id} completed in ${durationMs}ms (${protocol.length} chars)`);

    return { skillId: config.id, skillName: config.name, attribution: config.attribution, protocol, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`[SkillExecutor] ${config.id} failed (${durationMs}ms):`, err.message);
    return { skillId: config.id, skillName: config.name, attribution: config.attribution, protocol: '', durationMs, error: err.message };
  } finally {
    try { if (client) await client.close(); } catch { /* ignore */ }
  }
}

// ── Main Orchestrator ──────────────────────────────────────────

export async function executeOutputSkills(params: {
  query: string;
  trends: any[];
  evidence: any[];
  foddaAnswer: string;
  disabledSkills: Set<string>;
  metadata?: { graphName?: string; curator?: string; domain?: string };
}): Promise<SkillResult[]> {
  const { query, trends, evidence, foddaAnswer, disabledSkills, metadata } = params;

  // 1. Load registry
  const allSkills = await getSkillRegistry();
  const outputSkills = allSkills.filter(s => s.phase === 'output');

  if (outputSkills.length === 0) {
    console.log('[SkillExecutor] No output-phase skills registered');
    return [];
  }

  // 2. Filter: enabled, not skipped, not disabled
  const activeSkills = outputSkills.filter(s => {
    if (disabledSkills.has(s.id)) {
      console.log(`[SkillExecutor] ${s.id} — disabled by user`);
      return false;
    }
    if (isSkipRequested(query, s.name)) {
      console.log(`[SkillExecutor] ${s.id} — skipped via query`);
      return false;
    }
    return true;
  });

  if (activeSkills.length === 0) {
    console.log('[SkillExecutor] All skills filtered out (disabled or skipped)');
    return [];
  }

  // 3. Build payload
  const depth = detectDepth(query);
  const payload: SkillPayload = {
    query,
    trends: trends.slice(0, 20), // Cap to avoid payload bloat
    evidence: evidence.slice(0, 30),
    fodda_output: {
      answer: foddaAnswer,
      graphName: metadata?.graphName,
      curator: metadata?.curator,
      domain: metadata?.domain,
    },
    depth,
  };

  console.log(`[SkillExecutor] Executing ${activeSkills.length} skills (depth: ${depth}): ${activeSkills.map(s => s.id).join(', ')}`);

  // 4. Call all active skills in parallel
  const results = await Promise.all(
    activeSkills.map(skill => callSkill(skill, payload))
  );

  const successful = results.filter(r => r.protocol && !r.error);
  console.log(`[SkillExecutor] ${successful.length}/${results.length} skills returned protocols`);

  return results;
}
