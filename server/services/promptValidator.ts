/**
 * Prompt Validator
 * 
 * Tests each candidate prompt against the live Fodda API before including
 * it in the onboarding email. Swaps in backup prompts when one fails.
 * Alerts piers@psfk.com if we can't fill all slots after exhausting the bank.
 * Persists all validation results to PROMPT_AUDIT_TABLE for accountability tracking.
 */

import { createAirtableRecord } from '../db.js';
import { PROMPT_AUDIT_TABLE } from '../constants.js';

const FODDA_API_URL = process.env.FODDA_API_URL || 'https://fodda-api-v4-rglj7xzxsa-uk.a.run.app';

// Graph slug → API graph_id (must match what trial keys authorize)
// Trial keys follow the pattern sk_trial_{graphId}
const GRAPH_SLUG_MAP: Record<string, string> = {
  retail: 'retail',
  beauty: 'beauty',
  sports: 'sports',
  sic: 'sic',
  'ce-design': 'ce-design',
  'mlb-sponsorship': 'mlb-sponsorship',
  default: 'retail'
};

export interface ValidationResult {
  prompts: string[];            // 5 validated prompts ready to send
  allPassed: boolean;           // false if we had to alert Piers
  failedPrompts: string[];      // prompts that returned no results
  alertSent: boolean;           // true if piers@psfk.com was emailed
}

/**
 * Test a single prompt against the Fodda API.
 * Returns true if the results look usable (≥ 3 trend rows returned).
 */
export async function testPrompt(prompt: string, graphSlug: string, requestId: string): Promise<boolean> {
  const apiGraphId = GRAPH_SLUG_MAP[graphSlug] || 'psfk';
  // Use the graph-specific V1 search endpoint with a trial key
  // Trial keys are guaranteed to have access to their respective graphs
  const url = `${FODDA_API_URL}/v1/graphs/${apiGraphId}/search`;
  const trialKey = `sk_trial_${graphSlug === 'default' ? 'retail' : graphSlug}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s per prompt max

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': trialKey,
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        query: prompt,
        limit: 5,
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[PromptValidator] API error for prompt "${prompt.slice(0, 40)}...": ${res.status}`);
      return false;
    }

    const data = await res.json();
    // V1 puts rows at top level; legacy wraps in data.rows/data.trends
    const rowCount = data?.rows?.length || data?.data?.trends?.length || data?.data?.rows?.length || 0;
    const passed = rowCount >= 3;

    console.log(`[PromptValidator] [${requestId}] "${prompt.slice(0, 50)}" → ${rowCount} rows — ${passed ? 'PASS' : 'FAIL'}`);
    return passed;

  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.warn(`[PromptValidator] Timeout for: "${prompt.slice(0, 40)}..."`);
    } else {
      console.error(`[PromptValidator] Error testing prompt:`, e);
    }
    return false;
  }
}

/**
 * Validate and fill 5 prompts from a ranked candidate list.
 * Iterates through candidates, testing each until 5 pass.
 * Any that fail are collected for the alert.
 * Persists all results to PROMPT_AUDIT_TABLE for accountability.
 */
export async function validateAndSelectPrompts(
  candidates: string[],
  graphSlug: string | null,
  userEmail: string,
  sendAlertFn: (to: string, templateKey: string, data: any) => Promise<any>
): Promise<ValidationResult> {
  const validated: string[] = [];
  const failed: string[] = [];
  const slug = graphSlug || 'default';
  const requestId = `val-${Date.now()}`;

  console.log(`[PromptValidator] [${requestId}] Validating ${candidates.length} candidate prompts for graph "${slug}"`);

  for (const prompt of candidates) {
    if (validated.length >= 5) break;

    const passed = await testPrompt(prompt, slug, requestId);
    if (passed) {
      validated.push(prompt);
    } else {
      failed.push(prompt);
    }
  }

  const allPassed = validated.length >= 5 && failed.length === 0;
  let alertSent = false;

  // If we couldn't fill all 5 slots, alert Piers
  if (validated.length < 5) {
    console.error(`[PromptValidator] Only ${validated.length}/5 prompts passed for user ${userEmail}. Alerting Piers.`);
    try {
      await sendAlertFn('piers@psfk.com', 'PROMPT_VALIDATION_ALERT', {
        userEmail,
        graphSlug: slug,
        validatedCount: validated.length,
        failedPrompts: failed,
        validatedPrompts: validated,
        needsReview: candidates.slice(0, 10) // Full candidate list for Piers to review
      });
      alertSent = true;
    } catch (e) {
      console.error('[PromptValidator] Failed to send alert to Piers:', e);
    }

    // Pad with whatever validated prompts we have — don't block email send
    // If we have nothing at all, the caller should fall back to hardcoded safe defaults
  }

  // --- Persist validation results (fire-and-forget) ---
  const auditDate = new Date().toISOString();
  for (const prompt of validated) {
    createAirtableRecord(PROMPT_AUDIT_TABLE, {
      "prompt": prompt,
      "graphId": slug,
      "userEmail": userEmail,
      "status": "PASS",
      "source": "onboarding_email",
      "Date": auditDate,
    }).catch(() => {});
  }
  for (const prompt of failed) {
    createAirtableRecord(PROMPT_AUDIT_TABLE, {
      "prompt": prompt,
      "graphId": slug,
      "userEmail": userEmail,
      "status": "FAIL",
      "source": "onboarding_email",
      "Date": auditDate,
    }).catch(() => {});
  }

  return {
    prompts: validated.slice(0, 5),
    allPassed,
    failedPrompts: failed,
    alertSent
  };
}
