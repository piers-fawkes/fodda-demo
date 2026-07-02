/**
 * Graph Ingestion Service
 * Reads Google Sheets (and future: Airtable), validates data, caches as JSON,
 * and exposes query functions that match the existing Neo4j response shapes.
 */

import { google } from 'googleapis';
import { getGraph, updateGraphStats, updateGraphStatus } from './graph-registry.js';
import fs from 'fs';
import path from 'path';

// --- Types ---

export interface CachedGraph {
  graphSlug: string;
  lastIngested: string;
  signals: CachedSignal[];
  patterns: CachedPattern[];
  entities: CachedEntity[];
  meta: GraphMeta;
}

export interface CachedSignal {
  articleId: number;
  title: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
  brands: string;
  technologies: string;
  audiences: string;
  sector: string;
  industry: string;
  geography: string;
  trendIds_csv: string;
  dateAdded: string;
}

export interface CachedPattern {
  trendId: number;
  trendName: string;
  trendDescription: string;
  confidenceScore: number;
  sectorNames: string;
  industryNames: string;
  relatedPatterns: string;
  dateIdentified: string;
}

export interface CachedEntity {
  entityId: number;
  name: string;
  type: string;
  patternNames: string;
  notes: string;
}

export interface GraphMeta {
  graphName: string;
  graphSlug: string;
  description: string;
  creator: string;
  organization: string;
  contactEmail: string;
  sectors: string;
  industries: string;
  geography: string;
  updateFrequency: string;
  license: string;
}

// --- In-memory Cache ---
const graphCache = new Map<string, CachedGraph>();
const CACHE_DIR = '/tmp/graph-cache';

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function saveCacheToDisk(slug: string, data: CachedGraph) {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`[Graph Ingestion] Cache written to disk: ${filePath}`);
}

function loadCacheFromDisk(slug: string): CachedGraph | null {
  const filePath = path.join(CACHE_DIR, `${slug}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      console.warn(`[Graph Ingestion] Failed to parse cache file for ${slug}`);
    }
  }
  return null;
}

// --- Google Sheets Reader ---

function getGoogleSheetsAuth() {
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyEnv) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set. Cannot read Google Sheets.');
  }

  let credentials: any;
  try {
    credentials = JSON.parse(keyEnv);
  } catch {
    // Might be a file path
    try {
      credentials = JSON.parse(fs.readFileSync(keyEnv, 'utf-8'));
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is neither valid JSON nor a readable file path.');
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return auth;
}

/**
 * Read all 4 tabs from a Google Sheet and return a CachedGraph.
 */
export async function readGoogleSheet(sheetId: string, graphSlug: string): Promise<CachedGraph> {
  const auth = getGoogleSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Read all 4 tabs in parallel
  const [signalsRes, patternsRes, entitiesRes, metaRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Signals!A:N' }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Patterns!A:H' }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entities!A:E' }).catch(() => null),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Graph Meta!A:B' }).catch(() => null),
  ]);

  if (!signalsRes || !patternsRes || !entitiesRes || !metaRes) {
    const missing: string[] = [];
    if (!signalsRes) missing.push('Signals');
    if (!patternsRes) missing.push('Patterns');
    if (!entitiesRes) missing.push('Entities');
    if (!metaRes) missing.push('Graph Meta');
    throw new Error(`Cannot access sheet tabs: ${missing.join(', ')}. Make sure the sheet is shared with the Fodda service account and all 4 tabs exist.`);
  }

  // Parse Signals
  const signalRows = signalsRes.data.values || [];
  const signalHeaders = signalRows[0] || [];
  const signals: CachedSignal[] = signalRows.slice(1).map((row: string[]) => {
    const obj = rowToObj(signalHeaders, row);
    return {
      articleId: parseInt(obj.signal_id || '0', 10),
      title: obj.title || '',
      sourceUrl: obj.source_url || '',
      summary: obj.summary || '',
      publishedAt: obj.published_date || '',
      brands: obj.brands || '',
      technologies: obj.technologies || '',
      audiences: obj.audiences || '',
      sector: obj.sector || '',
      industry: obj.industry || '',
      geography: obj.geography || '',
      trendIds_csv: obj.pattern_name || '',
      dateAdded: obj.date_added || '',
    };
  }).filter((s: CachedSignal) => s.title); // skip empty rows

  // Parse Patterns
  const patternRows = patternsRes.data.values || [];
  const patternHeaders = patternRows[0] || [];
  const patterns: CachedPattern[] = patternRows.slice(1).map((row: string[]) => {
    const obj = rowToObj(patternHeaders, row);
    return {
      trendId: parseInt(obj.pattern_id || '0', 10),
      trendName: obj.pattern_name || '',
      trendDescription: obj.description || '',
      confidenceScore: parseFloat(obj.confidence || '0'),
      sectorNames: obj.sector || '',
      industryNames: obj.industry || '',
      relatedPatterns: obj.related_patterns || '',
      dateIdentified: obj.date_identified || '',
    };
  }).filter((p: CachedPattern) => p.trendName);

  // Parse Entities
  const entityRows = entitiesRes.data.values || [];
  const entityHeaders = entityRows[0] || [];
  const entities: CachedEntity[] = entityRows.slice(1).map((row: string[]) => {
    const obj = rowToObj(entityHeaders, row);
    return {
      entityId: parseInt(obj.entity_id || '0', 10),
      name: obj.name || '',
      type: obj.type || '',
      patternNames: obj.pattern_names || '',
      notes: obj.notes || '',
    };
  }).filter((e: CachedEntity) => e.name);

  // Parse Graph Meta (key-value pairs)
  const metaRows = metaRes.data.values || [];
  const meta: GraphMeta = {
    graphName: '',
    graphSlug: graphSlug,
    description: '',
    creator: '',
    organization: '',
    contactEmail: '',
    sectors: '',
    industries: '',
    geography: '',
    updateFrequency: '',
    license: '',
  };
  for (const row of metaRows) {
    const key = (row[0] || '').toLowerCase().replace(/\s+/g, '');
    const value = row[1] || '';
    if (key === 'graphname') meta.graphName = value;
    else if (key === 'graphslug') meta.graphSlug = value || graphSlug;
    else if (key === 'description') meta.description = value;
    else if (key === 'creator') meta.creator = value;
    else if (key === 'organization') meta.organization = value;
    else if (key === 'contactemail') meta.contactEmail = value;
    else if (key === 'sectors') meta.sectors = value;
    else if (key === 'industries') meta.industries = value;
    else if (key === 'geography') meta.geography = value;
    else if (key === 'updatefrequency') meta.updateFrequency = value;
    else if (key === 'license') meta.license = value;
  }

  return {
    graphSlug,
    lastIngested: new Date().toISOString(),
    signals,
    patterns,
    entities,
    meta,
  };
}

function rowToObj(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]?.toLowerCase().replace(/\s+/g, '_') || `col${i}`] = row[i] || '';
  }
  return obj;
}

// --- Validation ---

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  stats: {
    signalCount: number;
    patternCount: number;
    entityCount: number;
    summaryCoverage: number;
  };
}

export function validateGraph(data: CachedGraph): ValidationResult {
  const errors: string[] = [];

  // Minimum thresholds
  if (data.signals.length < 5) {
    errors.push('Graph needs at least 5 signals.');
  }
  if (data.patterns.length < 2) {
    errors.push('Graph needs at least 2 patterns.');
  }
  if (data.entities.length < 1) {
    errors.push('Graph needs at least 1 entity.');
  }

  // Summary quality — summaries must be ≥250 chars for effective AI/clustering
  const withSummary = data.signals.filter(s => s.summary && s.summary.trim().length >= 250).length;
  const summaryCoverage = data.signals.length > 0 ? (withSummary / data.signals.length) : 0;
  if (summaryCoverage < 0.8) {
    errors.push(`80% of signals need a summary of at least 250 characters for AI to work effectively. Current coverage: ${Math.round(summaryCoverage * 100)}% (${withSummary}/${data.signals.length} signals meet the threshold).`);
  }

  // Pattern inflation guard — each pattern must be referenced by ≥2 signals
  const underlinkedPatterns: string[] = [];
  for (const pattern of data.patterns) {
    const patternNameLower = pattern.trendName.toLowerCase();
    const linkedSignals = data.signals.filter(s =>
      s.trendIds_csv.toLowerCase().includes(patternNameLower)
    ).length;
    if (linkedSignals < 2) {
      underlinkedPatterns.push(`"${pattern.trendName}" (${linkedSignals} signal${linkedSignals === 1 ? '' : 's'})`);
    }
  }
  if (underlinkedPatterns.length > 0) {
    errors.push(`Each pattern needs at least 2 linked signals. Under-linked: ${underlinkedPatterns.join(', ')}.`);
  }

  // Meta completeness
  const missingMeta: string[] = [];
  if (!data.meta.graphName) missingMeta.push('graphName');
  if (!data.meta.description) missingMeta.push('description');
  if (!data.meta.creator) missingMeta.push('creator');
  if (!data.meta.sectors) missingMeta.push('sectors');
  if (missingMeta.length > 0) {
    errors.push(`Missing required metadata: ${missingMeta.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      signalCount: data.signals.length,
      patternCount: data.patterns.length,
      entityCount: data.entities.length,
      summaryCoverage: Math.round(summaryCoverage * 100),
    },
  };
}

// --- Ingestion Orchestration ---

/**
 * Ingest a graph from its data source, validate, cache, and update registry.
 */
export async function ingestGraph(graphSlug: string): Promise<{ success: boolean; errors?: string[]; stats?: any }> {
  const entry = await getGraph(graphSlug);
  if (!entry) throw new Error(`Graph "${graphSlug}" not found in registry.`);

  let graphData: CachedGraph;

  try {
    if (entry.sourceType === 'sheets') {
      if (!entry.sheetId) throw new Error('No sheetId configured for this graph.');
      graphData = await readGoogleSheet(entry.sheetId, graphSlug);
    } else if (entry.sourceType === 'airtable') {
      // TODO: Implement Airtable reader (fast-follow)
      throw new Error('Airtable source type not yet supported. Coming soon.');
    } else if (entry.sourceType === 'mcp') {
      // TODO: Phase B
      throw new Error('MCP source type not yet supported.');
    } else {
      throw new Error(`Unknown source type: ${entry.sourceType}`);
    }
  } catch (err: any) {
    const accessError = `Cannot access data source — ${err.message}`;
    await updateGraphStatus(graphSlug, 'pending', [accessError]);
    return { success: false, errors: [accessError] };
  }

  // Validate
  const validation = validateGraph(graphData);

  if (!validation.valid) {
    await updateGraphStatus(graphSlug, 'pending', validation.errors);
    return { success: false, errors: validation.errors };
  }

  // Cache
  graphCache.set(graphSlug, graphData);
  saveCacheToDisk(graphSlug, graphData);

  // Update registry stats + status
  await updateGraphStats(graphSlug, {
    signalCount: validation.stats.signalCount,
    patternCount: validation.stats.patternCount,
    entityCount: validation.stats.entityCount,
    lastSynced: new Date().toISOString().split('T')[0],
  });
  await updateGraphStatus(graphSlug, 'active');

  console.log(`[Graph Ingestion] Successfully ingested ${graphSlug}: ${validation.stats.signalCount} signals, ${validation.stats.patternCount} patterns, ${validation.stats.entityCount} entities`);

  return { success: true, stats: validation.stats };
}

// --- Query Functions ---

/**
 * Get cached graph data, loading from disk if not in memory.
 */
async function getCachedGraph(graphSlug: string): Promise<CachedGraph> {
  // In-memory first
  let cached = graphCache.get(graphSlug);
  if (cached) return cached;

  // Try disk
  cached = loadCacheFromDisk(graphSlug) || undefined;
  if (cached) {
    graphCache.set(graphSlug, cached);
    return cached;
  }

  // Neither in memory nor on disk — try to ingest
  const result = await ingestGraph(graphSlug);
  if (!result.success) {
    throw new Error(`Graph "${graphSlug}" is not available. ${result.errors?.join(' ') || ''}`);
  }

  cached = graphCache.get(graphSlug);
  if (!cached) throw new Error(`Graph "${graphSlug}" cache missing after successful ingestion.`);
  return cached;
}

/**
 * Search patterns (trends) by keyword.
 * Returns results in the same shape as the Neo4j search endpoint.
 */
export async function searchPatterns(graphSlug: string, query: string, limit: number = 10): Promise<any> {
  const cached = await getCachedGraph(graphSlug);
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Score each pattern by number of keyword matches
  const scored = cached.patterns.map(p => {
    const text = `${p.trendName} ${p.trendDescription}`.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      const matches = text.split(term).length - 1;
      score += matches;
    }
    // Exact phrase match gets a bonus
    if (text.includes(queryLower)) score += 5;
    return { pattern: p, score };
  });

  // Filter and sort by score
  const results = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Format as rows matching the existing API response shape
  const rows = results.map(r => ({
    trendId: r.pattern.trendId,
    trendName: r.pattern.trendName,
    trendDescription: r.pattern.trendDescription,
    confidenceScore: r.pattern.confidenceScore,
    sectorNames: r.pattern.sectorNames,
    industryNames: r.pattern.industryNames,
    relevanceScore: r.score,
    graphId: graphSlug,
    psfk_graph_slug: graphSlug,
    // Include signal count for this pattern
    articleCount: cached.signals.filter(s =>
      s.trendIds_csv.toLowerCase().includes(r.pattern.trendName.toLowerCase())
    ).length,
  }));

  return {
    rows,
    totalResults: results.length,
    query,
    graphId: graphSlug,
    source: 'community-graph-cache',
  };
}

/**
 * Get evidence (signals/articles) for a pattern.
 */
export async function getEvidence(graphSlug: string, patternId: number, limit: number = 10): Promise<any> {
  const cached = await getCachedGraph(graphSlug);

  // Find the pattern
  const pattern = cached.patterns.find(p => p.trendId === patternId);
  if (!pattern) {
    return { evidence: [], patternId, graphId: graphSlug };
  }

  // Find signals that reference this pattern (by name, since sheets use pattern_name)
  const patternNameLower = pattern.trendName.toLowerCase();
  const evidence = cached.signals
    .filter(s => s.trendIds_csv.toLowerCase().includes(patternNameLower))
    .slice(0, limit)
    .map(s => ({
      articleId: s.articleId,
      title: s.title,
      summary: s.summary,
      sourceUrl: s.sourceUrl,
      publishedAt: s.publishedAt,
      brands: s.brands,
      sector: s.sector,
      industry: s.industry,
      graphId: graphSlug,
    }));

  return {
    evidence,
    trendId: patternId,
    trendName: pattern.trendName,
    graphId: graphSlug,
    source: 'community-graph-cache',
  };
}

/**
 * Get neighbors (entities related to a pattern or signal).
 */
export async function getNeighbors(graphSlug: string, nodeId: number, nodeType: string): Promise<any> {
  const cached = await getCachedGraph(graphSlug);

  if (nodeType.toLowerCase() === 'trend' || nodeType.toLowerCase() === 'pattern') {
    const pattern = cached.patterns.find(p => p.trendId === nodeId);
    if (!pattern) return { neighbors: [], nodeId, nodeType, graphId: graphSlug };

    const patternNameLower = pattern.trendName.toLowerCase();

    // Find related entities
    const relatedEntities = cached.entities
      .filter(e => e.patternNames.toLowerCase().includes(patternNameLower))
      .map(e => ({
        nodeId: e.entityId,
        name: e.name,
        type: e.type,
        relationship: 'RELATED_TO',
        graphId: graphSlug,
      }));

    // Find related signals
    const relatedSignals = cached.signals
      .filter(s => s.trendIds_csv.toLowerCase().includes(patternNameLower))
      .slice(0, 10)
      .map(s => ({
        nodeId: s.articleId,
        name: s.title,
        type: 'Signal',
        relationship: 'EVIDENCED_BY',
        graphId: graphSlug,
      }));

    // Find related patterns
    const relatedPatternNames = pattern.relatedPatterns
      .split(',')
      .map(rp => rp.trim().toLowerCase())
      .filter(rp => rp);

    const relatedPatterns = cached.patterns
      .filter(p => p.trendId !== nodeId && relatedPatternNames.includes(p.trendName.toLowerCase()))
      .map(p => ({
        nodeId: p.trendId,
        name: p.trendName,
        type: 'Trend',
        relationship: 'RELATED_PATTERN',
        graphId: graphSlug,
      }));

    return {
      neighbors: [...relatedEntities, ...relatedSignals, ...relatedPatterns],
      nodeId,
      nodeType,
      graphId: graphSlug,
      source: 'community-graph-cache',
    };
  }

  // For other node types (signals, entities), return basic neighbors
  return { neighbors: [], nodeId, nodeType, graphId: graphSlug, source: 'community-graph-cache' };
}

/**
 * Get a single node by ID and type.
 */
export async function getNode(graphSlug: string, nodeId: number, nodeType: string): Promise<any> {
  const cached = await getCachedGraph(graphSlug);

  if (nodeType.toLowerCase() === 'trend' || nodeType.toLowerCase() === 'pattern') {
    const pattern = cached.patterns.find(p => p.trendId === nodeId);
    if (!pattern) return null;
    return {
      nodeId: pattern.trendId,
      name: pattern.trendName,
      description: pattern.trendDescription,
      type: 'Trend',
      confidence: pattern.confidenceScore,
      sector: pattern.sectorNames,
      industry: pattern.industryNames,
      graphId: graphSlug,
    };
  }

  if (nodeType.toLowerCase() === 'signal' || nodeType.toLowerCase() === 'article') {
    const signal = cached.signals.find(s => s.articleId === nodeId);
    if (!signal) return null;
    return {
      nodeId: signal.articleId,
      name: signal.title,
      summary: signal.summary,
      sourceUrl: signal.sourceUrl,
      type: 'Article',
      publishedAt: signal.publishedAt,
      brands: signal.brands,
      sector: signal.sector,
      graphId: graphSlug,
    };
  }

  if (nodeType.toLowerCase() === 'entity') {
    const entity = cached.entities.find(e => e.entityId === nodeId);
    if (!entity) return null;
    return {
      nodeId: entity.entityId,
      name: entity.name,
      type: entity.type,
      notes: entity.notes,
      graphId: graphSlug,
    };
  }

  return null;
}

/**
 * Read only the Graph Meta tab for metadata preview during registration.
 */
export async function readSheetMeta(sheetId: string): Promise<GraphMeta | null> {
  try {
    const auth = getGoogleSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const metaRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Graph Meta!A:B',
    });

    const metaRows = metaRes.data.values || [];
    const meta: GraphMeta = {
      graphName: '', graphSlug: '', description: '', creator: '', organization: '',
      contactEmail: '', sectors: '', industries: '', geography: '', updateFrequency: '', license: '',
    };

    for (const row of metaRows) {
      const key = (row[0] || '').toLowerCase().replace(/\s+/g, '');
      const value = row[1] || '';
      if (key === 'graphname') meta.graphName = value;
      else if (key === 'graphslug') meta.graphSlug = value;
      else if (key === 'description') meta.description = value;
      else if (key === 'creator') meta.creator = value;
      else if (key === 'organization') meta.organization = value;
      else if (key === 'contactemail') meta.contactEmail = value;
      else if (key === 'sectors') meta.sectors = value;
      else if (key === 'industries') meta.industries = value;
      else if (key === 'geography') meta.geography = value;
      else if (key === 'updatefrequency') meta.updateFrequency = value;
      else if (key === 'license') meta.license = value;
    }

    return meta;
  } catch (err) {
    console.error('[Graph Ingestion] Failed to read Sheet meta:', err);
    return null;
  }
}

/**
 * Check if a cached graph exists and return its basic info.
 */
export function isCached(graphSlug: string): boolean {
  return graphCache.has(graphSlug) || loadCacheFromDisk(graphSlug) !== null;
}
