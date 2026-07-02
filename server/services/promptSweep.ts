/**
 * Prompt Sweep Service
 *
 * Nightly/weekly cron job that tests all suggested prompts (static + catalog)
 * against the live API to ensure they still return good results.
 * Emails an alert to piers@psfk.com if any suggested prompt fails.
 * Persists results to PROMPT_AUDIT_TABLE for longitudinal tracking.
 *
 * Triggered via: POST /api/cron/prompt-sweep (Cloud Scheduler or manual)
 */

import { testPrompt } from './promptValidator.js';
import { createAirtableRecord, queryAirtable } from '../db.js';
import { PROMPT_AUDIT_TABLE } from '../constants.js';
import { GRAPH_REGISTRY_TABLE } from '../constants.js';
import { sendDirectEmail } from './emailService.js';

// Static suggested questions — imported at runtime from shared constants
// We read the file directly instead of importing to avoid ESM/CJS issues in server context
interface PromptToTest {
  prompt: string;
  graphId: string;
  source: 'static' | 'catalog';
}

// Known static suggested questions per graph (mirrored from shared/constants.ts)
// We keep this lightweight — just the text, since that's what we test
const STATIC_PROMPTS: Record<string, string[]> = {
  'sports': [
    "Fan engagement tech at live events",
    "Inclusive sportswear design trends",
    "Athlete-led brands and DTC models",
  ],
  'retail': [
    "AI-powered personalization in stores",
    "Frictionless checkout innovations",
    "Small-format retail concepts",
  ],
  'beauty': [
    "Clinical skincare meets retail",
    "Wellness and beauty convergence",
    "Fragrance and scent innovation",
    "In-store beauty experiences",
  ],
  'sic': [
    "AI and brand authenticity",
    "New status signals beyond luxury",
    "Creator-led commerce models",
  ],
  'ce-design': [
    "Smart home device innovation",
    "Wearable technology trends",
    "Sustainable electronics design",
  ],
};

/**
 * Fetch example_queries from the Airtable Graph List (catalog prompts).
 */
async function fetchCatalogPrompts(): Promise<PromptToTest[]> {
  const prompts: PromptToTest[] = [];

  try {
    const result = await queryAirtable(GRAPH_REGISTRY_TABLE, '', '');
    for (const rec of (result.records || [])) {
      const f = rec.fields || {};
      const graphId = f.graph_id || f.id || '';
      const exampleQueries = f.example_queries || '';

      if (graphId && exampleQueries) {
        // example_queries is a comma-separated or newline-separated string
        const queries = exampleQueries.split(/[,\n]/).map((q: string) => q.trim()).filter((q: string) => q.length > 0);
        for (const q of queries) {
          prompts.push({ prompt: q, graphId, source: 'catalog' });
        }
      }
    }
  } catch (e: any) {
    console.error('[PromptSweep] Failed to fetch catalog prompts:', e.message);
  }

  return prompts;
}

/**
 * Collect all static + catalog prompts to test.
 */
async function collectAllPrompts(): Promise<PromptToTest[]> {
  const allPrompts: PromptToTest[] = [];

  // Static prompts
  for (const [graphId, prompts] of Object.entries(STATIC_PROMPTS)) {
    for (const prompt of prompts) {
      allPrompts.push({ prompt, graphId, source: 'static' });
    }
  }

  // Catalog prompts from Airtable
  const catalogPrompts = await fetchCatalogPrompts();
  allPrompts.push(...catalogPrompts);

  return allPrompts;
}

export interface SweepResult {
  tested: number;
  passed: number;
  failed: number;
  failures: Array<{ prompt: string; graphId: string; source: string }>;
}

/**
 * Run the prompt sweep: test all prompts, persist results, send alert if needed.
 */
export async function runPromptSweep(): Promise<SweepResult> {
  console.log('[PromptSweep] Starting prompt sweep...');

  const prompts = await collectAllPrompts();
  console.log(`[PromptSweep] Testing ${prompts.length} prompts (${prompts.filter(p => p.source === 'static').length} static, ${prompts.filter(p => p.source === 'catalog').length} catalog)`);

  const failures: SweepResult['failures'] = [];
  const auditDate = new Date().toISOString();
  const requestId = `sweep-${Date.now()}`;
  let passed = 0;

  for (const { prompt, graphId, source } of prompts) {
    const ok = await testPrompt(prompt, graphId, requestId);

    // Persist result (fire-and-forget)
    createAirtableRecord(PROMPT_AUDIT_TABLE, {
      "prompt": prompt,
      "graphId": graphId,
      "userEmail": "system/sweep",
      "status": ok ? "PASS" : "FAIL",
      "source": `sweep_${source}`,
      "Date": auditDate,
    }).catch(() => {});

    if (ok) {
      passed++;
    } else {
      failures.push({ prompt, graphId, source });
    }

    // Throttle to avoid hammering the API
    await new Promise(r => setTimeout(r, 500));
  }

  const result: SweepResult = {
    tested: prompts.length,
    passed,
    failed: failures.length,
    failures,
  };

  // Send alert if any failures
  if (failures.length > 0) {
    const failLines = failures
      .map(f => `❌ "${f.prompt}" → ${f.graphId} (${f.source})`)
      .join('\n');

    const subject = `⚠️ Prompt Sweep — ${failures.length} of ${prompts.length} suggested prompts failed`;
    const body = `${subject}

${failLines}

✅ ${passed}/${prompts.length} prompts returned ≥3 results

Action: Review and update these prompts in:
• Static: shared/constants.ts (SUGGESTED_QUESTIONS)
• Catalog: Airtable Graph List table (example_queries field)

---
Sweep ran at ${auditDate}
`.trim();

    await sendDirectEmail('piers@psfk.com', subject, body, 'formal');
    console.log(`[PromptSweep] Alert sent — ${failures.length} failures`);
  } else {
    console.log(`[PromptSweep] All clear — ${passed}/${prompts.length} prompts passed`);
  }

  return result;
}
