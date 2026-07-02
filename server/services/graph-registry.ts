/**
 * Graph Registry Service
 * CRUD operations for the Graph Registry Airtable table.
 * Manages registration, lookup, listing, and status updates for community pattern graphs.
 */

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appXUeeWN1uD9NdCW';
// IMPORTANT: Replace this with the actual table ID after creating the Graph Registry table in Airtable
const GRAPH_REGISTRY_TABLE = process.env.GRAPH_REGISTRY_TABLE_ID || 'tblezSucv8qmbSSy9';

// Reserved VIP graph slugs that cannot be used for community graphs
const RESERVED_SLUGS = ['retail', 'beauty', 'sports', 'sic', 'pew', 'psfk', 'waldo', 'non-obvious', 'baseline'];

// --- Airtable Helpers (same pattern as server/index.ts) ---

async function queryRegistryTable(filterByFormula: string = '', extraParams: string = '') {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_REGISTRY_TABLE}?filterByFormula=${encodeURIComponent(filterByFormula)}&${extraParams}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Airtable Registry Error (${res.status}): ${errorBody}`);
  }
  return await res.json();
}

async function createRegistryRecord(fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_REGISTRY_TABLE}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable Registry Write Error: ${errorText}`);
  }
  return await res.json();
}

async function updateRegistryRecord(recordId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${GRAPH_REGISTRY_TABLE}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable Registry Update Error: ${errorText}`);
  }
  return await res.json();
}

// --- Types ---

export interface RegistryEntry {
  recordId: string;
  graphSlug: string;
  graphName: string;
  description: string;
  creator: string;
  organization?: string;
  perspective?: string;
  tier: 'basic' | 'sophisticated' | 'vip';
  sourceType: 'sheets' | 'airtable' | 'mcp';
  sheetId?: string;
  airtableBaseId?: string;
  airtableTablePrefix?: string;
  mcpEndpoint?: string;
  sectors: string[];
  industries?: string[];
  geography?: string[];
  updateFrequency?: string;
  status: 'pending' | 'active' | 'suspended';
  ownerId: string;
  signalCount: number;
  patternCount: number;
  entityCount: number;
  lastSynced?: string;
  createdAt?: string;
  validationErrors?: string[];
}

export interface RegisterGraphInput {
  graphSlug?: string;
  graphName: string;
  description: string;
  creator: string;
  organization?: string;
  perspective?: string;
  tier?: 'basic' | 'sophisticated';
  sourceType: 'sheets' | 'airtable' | 'mcp';
  sheetId?: string;
  airtableBaseId?: string;
  airtableTablePrefix?: string;
  mcpEndpoint?: string;
  sectors: string[];
  industries?: string[];
  geography?: string[];
  updateFrequency?: string;
  ownerId: string;
}

// --- Helper Functions ---

function recordToEntry(record: any): RegistryEntry {
  const f = record.fields;
  return {
    recordId: record.id,
    graphSlug: f.graphSlug || '',
    graphName: f.graphName || '',
    description: f.description || '',
    creator: f.creator || '',
    organization: f.organization || undefined,
    perspective: f.perspective || undefined,
    tier: f.tier || 'basic',
    sourceType: f.sourceType || 'sheets',
    sheetId: f.sheetId || undefined,
    airtableBaseId: f.airtableBaseId || undefined,
    airtableTablePrefix: f.airtableTablePrefix || undefined,
    mcpEndpoint: f.mcpEndpoint || undefined,
    sectors: Array.isArray(f.sectors) ? f.sectors : (f.sectors ? [f.sectors] : []),
    industries: Array.isArray(f.industries) ? f.industries : (f.industries ? [f.industries] : undefined),
    geography: Array.isArray(f.geography) ? f.geography : (f.geography ? [f.geography] : undefined),
    updateFrequency: f.updateFrequency || undefined,
    status: f.status || 'pending',
    ownerId: f.ownerId || '',
    signalCount: f.signalCount || 0,
    patternCount: f.patternCount || 0,
    entityCount: f.entityCount || 0,
    lastSynced: f.lastSynced || undefined,
    createdAt: f.createdAt || undefined,
    validationErrors: f.validationErrors ? JSON.parse(f.validationErrors) : undefined,
  };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/^-|-$/g, '');
}

// --- Public Functions ---

/**
 * Register a new community graph in the registry.
 * Generates a slug if not provided, validates uniqueness.
 */
export async function registerGraph(data: RegisterGraphInput): Promise<RegistryEntry> {
  // Generate or validate slug
  const slug = data.graphSlug || generateSlug(data.graphName);

  // Check reserved slugs
  if (RESERVED_SLUGS.includes(slug)) {
    throw new Error(`Graph slug "${slug}" is reserved for a VIP graph. Please choose a different name.`);
  }

  // Check uniqueness
  const existing = await getGraph(slug);
  if (existing) {
    throw new Error(`A graph with slug "${slug}" already exists.`);
  }

  // Validate source-specific required fields
  if (data.sourceType === 'sheets' && !data.sheetId) {
    throw new Error('sheetId is required for Google Sheets source type.');
  }
  if (data.sourceType === 'airtable' && !data.airtableBaseId) {
    throw new Error('airtableBaseId is required for Airtable source type.');
  }
  if (data.sourceType === 'mcp' && !data.mcpEndpoint) {
    throw new Error('mcpEndpoint is required for MCP source type.');
  }

  const fields: any = {
    graphSlug: slug,
    graphName: data.graphName,
    description: data.description,
    creator: data.creator,
    tier: data.tier || 'basic',
    sourceType: data.sourceType,
    sectors: data.sectors,
    status: 'pending',
    ownerId: data.ownerId,
    signalCount: 0,
    patternCount: 0,
    entityCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
  };

  // Optional fields
  if (data.organization) fields.organization = data.organization;
  if (data.perspective) fields.perspective = data.perspective;
  if (data.sheetId) fields.sheetId = data.sheetId;
  if (data.airtableBaseId) fields.airtableBaseId = data.airtableBaseId;
  if (data.airtableTablePrefix) fields.airtableTablePrefix = data.airtableTablePrefix;
  if (data.mcpEndpoint) fields.mcpEndpoint = data.mcpEndpoint;
  if (data.industries) fields.industries = data.industries;
  if (data.geography) fields.geography = data.geography;
  if (data.updateFrequency) fields.updateFrequency = data.updateFrequency;

  const result = await createRegistryRecord(fields);
  const record = result.records?.[0];
  if (!record) throw new Error('Failed to create registry entry — no record returned.');

  console.log(`[Graph Registry] Registered graph: ${slug} (owner: ${data.ownerId})`);
  return recordToEntry(record);
}

/**
 * Get a single graph entry by slug.
 */
export async function getGraph(graphSlug: string): Promise<RegistryEntry | null> {
  try {
    const result = await queryRegistryTable(`{graphSlug} = '${graphSlug}'`);
    const record = result.records?.[0];
    return record ? recordToEntry(record) : null;
  } catch {
    return null;
  }
}

/**
 * List graphs with optional filters.
 */
export async function listGraphs(filters?: {
  status?: string;
  ownerId?: string;
  sector?: string;
  perspective?: string;
}): Promise<RegistryEntry[]> {
  const conditions: string[] = [];

  if (filters?.status) conditions.push(`{status} = '${filters.status}'`);
  if (filters?.ownerId) conditions.push(`{ownerId} = '${filters.ownerId}'`);
  if (filters?.sector) conditions.push(`FIND('${filters.sector}', ARRAYJOIN({sectors}, ','))`);
  if (filters?.perspective) conditions.push(`{perspective} = '${filters.perspective}'`);

  const formula = conditions.length > 0
    ? (conditions.length === 1 ? conditions[0] : `AND(${conditions.join(', ')})`)
    : '';

  try {
    const result = await queryRegistryTable(formula);
    return (result.records || []).map(recordToEntry);
  } catch (err) {
    console.error('[Graph Registry] listGraphs error:', err);
    return [];
  }
}

/**
 * Update graph stats after ingestion.
 */
export async function updateGraphStats(graphSlug: string, stats: {
  signalCount: number;
  patternCount: number;
  entityCount: number;
  lastSynced: string;
}): Promise<void> {
  const entry = await getGraph(graphSlug);
  if (!entry) throw new Error(`Graph "${graphSlug}" not found in registry.`);

  await updateRegistryRecord(entry.recordId, {
    signalCount: stats.signalCount,
    patternCount: stats.patternCount,
    entityCount: stats.entityCount,
    lastSynced: stats.lastSynced,
  });
  console.log(`[Graph Registry] Updated stats for ${graphSlug}: ${stats.signalCount} signals, ${stats.patternCount} patterns, ${stats.entityCount} entities`);
}

/**
 * Update graph status and optionally set validation errors.
 */
export async function updateGraphStatus(
  graphSlug: string,
  status: 'pending' | 'active' | 'suspended',
  validationErrors?: string[]
): Promise<void> {
  const entry = await getGraph(graphSlug);
  if (!entry) throw new Error(`Graph "${graphSlug}" not found in registry.`);

  const fields: any = { status };
  if (validationErrors) {
    fields.validationErrors = JSON.stringify(validationErrors);
  } else {
    fields.validationErrors = '';
  }

  await updateRegistryRecord(entry.recordId, fields);
  console.log(`[Graph Registry] Status update for ${graphSlug}: ${status}${validationErrors ? ` (${validationErrors.length} errors)` : ''}`);
}
