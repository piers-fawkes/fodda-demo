/**
 * PSFK Pipeline Integration Test
 * Tests the full PSFK pipeline end-to-end:
 *   1. Infrastructure health (Neo4j, deploy check)
 *   2. V1 graph search across all PSFK verticals (using trial keys)
 *   3. Evidence retrieval
 *   4. Graph registry (Airtable)
 */
import dotenv from "dotenv";
dotenv.config();

// The Fodda API proxy (server/index.ts) — deployed as the main app
const FODDA_API = process.env.FODDA_API_URL || "https://fodda-api-new-rglj7xzxsa-uk.a.run.app";
// The internal key for direct Neo4j API calls
const INTERNAL_KEY = process.env.FODDA_INTERNAL_API_KEY || "fodda-internal-service-key";

const PSFK_GRAPHS = ["retail", "beauty", "sports", "fashion", "sic", "waldo"];

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start, details });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
    if (details) console.log(`   ${details}`);
  } catch (err: any) {
    results.push({ name, passed: false, durationMs: Date.now() - start, details: err.message });
    console.log(`❌ ${name} (${Date.now() - start}ms): ${err.message}`);
  }
}

// ─── Test 1: Neo4j Health Check ────────────────────────────────────
async function testHealth(): Promise<string> {
  const res = await fetch(`${FODDA_API}/api/neo4j/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  if (!data.ok) throw new Error(`Health check returned ok: false`);
  return `Neo4j connected: database=${data.database}`;
}

// ─── Test 2: Deploy Check ──────────────────────────────────────────
async function testDeployCheck(): Promise<string> {
  const res = await fetch(`${FODDA_API}/__deploy_check`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: any = await res.json();
  return `Deploy: ${data.deployCheck} | Status: ${data.status} | Time: ${data.time}`;
}

// ─── Test 3: V1 Graph Search (per graph, using trial keys) ─────────
const queryMap: Record<string, string[]> = {
  retail: ["AI in retail", "sustainability packaging"],
  beauty: ["personalized skincare", "clean beauty"],
  sports: ["fan engagement", "wearable tech"],
  fashion: ["circular fashion", "digital fashion"],
  sic: ["AI innovation", "brand experience"],
  waldo: ["workplace culture", "remote work"],
};

async function testV1Search(graphId: string, query: string): Promise<string> {
  // Use trial key for each graph
  const apiKey = `sk_trial_${graphId}`;

  const res = await fetch(`${FODDA_API}/v1/graphs/${graphId}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ query, limit: 5 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
  }

  const json: any = await res.json();
  const data = json.data || json;
  const rows = data.rows || [];
  const totalResults = data.totalResults ?? rows.length;
  const schemaVersion = json.schema_version || "N/A";

  const trendNames = rows.slice(0, 3).map((r: any) =>
    r.trendName || r.name || r.rowName || "?"
  );

  return `rows=${totalResults} schema=${schemaVersion} top=[${trendNames.join(", ")}]`;
}

// ─── Test 4: Evidence Retrieval ────────────────────────────────────
async function testEvidence(graphId: string): Promise<string> {
  const apiKey = `sk_trial_${graphId}`;

  // First, search to get a trend/node ID
  const searchRes = await fetch(`${FODDA_API}/v1/graphs/${graphId}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ query: "innovation", limit: 1 }),
  });

  if (!searchRes.ok) throw new Error(`Search failed: HTTP ${searchRes.status}`);
  const searchJson: any = await searchRes.json();
  const rows = (searchJson.data?.rows || searchJson.rows || []);
  if (rows.length === 0) return "No trends found, evidence test skipped";

  const nodeId = rows[0].trendId || rows[0].id || rows[0].rowId;

  const evidenceRes = await fetch(`${FODDA_API}/v1/graphs/${graphId}/evidence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ for_node_id: nodeId, limit: 5 }),
  });

  if (!evidenceRes.ok) {
    const text = await evidenceRes.text();
    throw new Error(`Evidence HTTP ${evidenceRes.status}: ${text.substring(0, 200)}`);
  }

  const evidenceJson: any = await evidenceRes.json();
  const evidence = evidenceJson.data?.evidence || evidenceJson.evidence || [];
  return `node=${nodeId} evidence_count=${evidence.length}`;
}

// ─── Test 5: Graph Registry (Airtable) ────────────────────────────
async function testGraphRegistry(): Promise<string> {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
  if (!AIRTABLE_PAT) return "SKIPPED: no AIRTABLE_PAT";

  const BASE_ID = 'appXUeeWN1uD9NdCW';
  const TABLE_ID = process.env.GRAPH_REGISTRY_TABLE_ID || 'tblezSucv8qmbSSy9';
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?maxRecords=20`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  if (!res.ok) throw new Error(`Airtable HTTP ${res.status}`);
  const data: any = await res.json();
  const records = data.records || [];

  // Check for PSFK graphs
  const psfkSlugs = records
    .map((r: any) => r.fields.graphSlug || r.fields.graphName || '?')
    .filter((s: string) => PSFK_GRAPHS.includes(s.toLowerCase()) || s.toLowerCase().includes('psfk'));

  return `Total registry records: ${records.length} | PSFK-related: [${psfkSlugs.join(', ')}]`;
}

// ─── Test 6: Graph List (public endpoint) ──────────────────────────
async function testGraphList(): Promise<string> {
  const res = await fetch(`${FODDA_API}/api/graphs`);
  if (!res.ok) {
    // Try alternate endpoint
    const res2 = await fetch(`${FODDA_API}/v1/graphs/registry`);
    if (!res2.ok) throw new Error(`Both /api/graphs and /v1/graphs/registry failed`);
    const data: any = await res2.json();
    const graphs = data.graphs || data.data?.graphs || [];
    return `Registry endpoint returned ${graphs.length} graphs`;
  }
  const data: any = await res.json();
  const graphs = data.graphs || data.data || [];
  return `Graph list returned ${Array.isArray(graphs) ? graphs.length : 'N/A'} graphs`;
}

// ─── Run All ───────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   PSFK Pipeline Integration Test Suite");
  console.log(`   Target: ${FODDA_API}`);
  console.log(`   Time:   ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Infrastructure
  console.log("── 1. Infrastructure ─────────────────────────────────────");
  await runTest("Neo4j Health", testHealth);
  await runTest("Deploy Check", testDeployCheck);

  // V1 Graph Searches
  console.log("\n── 2. V1 Graph Search (per vertical) ─────────────────────");
  for (const graphId of PSFK_GRAPHS) {
    const queries = queryMap[graphId] || ["test"];
    for (const q of queries) {
      await runTest(`Search [${graphId}] "${q}"`, () => testV1Search(graphId, q));
    }
  }

  // Evidence
  console.log("\n── 3. Evidence Retrieval ──────────────────────────────────");
  await runTest("Evidence [retail]", () => testEvidence("retail"));

  // Registry
  console.log("\n── 4. Graph Registry ─────────────────────────────────────");
  await runTest("Airtable Registry", testGraphRegistry);
  await runTest("Graph List Endpoint", testGraphList);

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const avgMs = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`   RESULTS: ${passed}/${total} passed, ${failed} failed`);
  console.log(`   Average latency: ${avgMs}ms`);
  console.log("═══════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n❌ Failures:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`   - ${r.name}: ${r.details}`);
    }
  }

  console.log("\n── Latency Breakdown ─────────────────────────────────────");
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`   ${icon} ${r.durationMs.toString().padStart(5)}ms  ${r.name}`);
  }
}

main().catch(console.error);
