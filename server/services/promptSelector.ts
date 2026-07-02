import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompt bank once at startup
const PROMPT_BANK_PATH = path.join(__dirname, '../data/prompt-bank.json');
let promptBank: Record<string, any>;

function loadPromptBank() {
  if (!promptBank) {
    try {
      promptBank = JSON.parse(readFileSync(PROMPT_BANK_PATH, 'utf-8'));
    } catch (e) {
      console.error('[PromptSelector] Failed to load prompt-bank.json:', e);
      promptBank = {};
    }
  }
  return promptBank;
}

// Known graph IDs in the system
const KNOWN_GRAPH_IDS = new Set(['retail', 'beauty', 'sports', 'ce-design', 'mlb-sponsorship']);

// Industries that don't map to our graphs — route these to cross-graph bridge prompts
const BRIDGE_INDUSTRIES = [
  'finance', 'financial', 'banking', 'insurance', 'investment', 'fintech',
  'legal', 'law', 'consulting', 'professional services',
  'healthcare', 'health', 'pharma', 'medical',
  'education', 'academic',
  'government', 'public sector', 'nonprofit',
  'real estate', 'property',
  'manufacturing', 'logistics', 'supply chain',
  'energy', 'oil', 'utilities',
  'telecoms', 'telecommunications',
];

/**
 * Determine whether a buyer's inferred industry maps to one of our graphs,
 * or whether they need cross-graph "bridge" prompts.
 */
function needsBridgePrompts(graphId: string | null, buyerIndustry?: string): boolean {
  // If graph is known and specific, no bridge needed
  if (graphId && KNOWN_GRAPH_IDS.has(graphId)) return false;

  // If we have an industry signal that doesn't match our graphs, use bridge prompts
  if (buyerIndustry) {
    const lower = buyerIndustry.toLowerCase();
    return BRIDGE_INDUSTRIES.some(ind => lower.includes(ind));
  }

  return false;
}

/**
 * Select 5 prompts for the onboarding email.
 * 
 * Priority order:
 * 1. Graph-specific + buyer-type-specific (2-3 prompts)
 * 2. Graph-specific general (fill remaining slots)
 * 3. Cross-graph bridge (if user's industry doesn't match our graphs)
 * 4. Default fallback
 * 
 * Returns more than 5 so the validator can swap out failing ones.
 */
export function selectPrompts(
  graphId: string | null,
  buyerType: string | null,
  buyerIndustry?: string,
  count: number = 8 // Return extras for validator to work with
): string[] {
  const bank = loadPromptBank();
  const prompts: string[] = [];
  const used = new Set<string>();

  const addPrompts = (list: string[], max: number) => {
    for (const p of list) {
      if (!used.has(p) && prompts.length < count) {
        used.add(p);
        prompts.push(p);
      }
      if (prompts.length >= max + (prompts.length - prompts.length)) break;
    }
  };

  const useBridgePrompts = needsBridgePrompts(graphId, buyerIndustry);

  if (useBridgePrompts) {
    // Cross-graph bridge: user's industry doesn't map to our graphs
    const bridgeSection = bank['cross-graph'] || {};
    const buyerKey = buyerType && bridgeSection[buyerType] ? buyerType : 'Unknown';
    
    // 3 buyer-type bridge prompts + 2 general bridge prompts
    addPrompts(bridgeSection[buyerKey] || [], count);
    addPrompts(bridgeSection['general'] || [], count);
  } else if (graphId && KNOWN_GRAPH_IDS.has(graphId) && bank[graphId]) {
    const graphSection = bank[graphId];
    const buyerKey = buyerType && graphSection[buyerType] ? buyerType : null;

    // 2-3 buyer-type specific prompts first
    if (buyerKey) {
      addPrompts((graphSection[buyerKey] || []).slice(0, 3), count);
    }
    // Fill remaining with graph-general prompts
    addPrompts(graphSection['general'] || [], count);
    // More buyer-type prompts if we still need them
    if (buyerKey) {
      addPrompts(graphSection[buyerKey] || [], count);
    }
  } else {
    // Unknown graph — use default cross-graph prompts
    addPrompts((bank['default']?.['general']) || [], count);
    addPrompts((bank['cross-graph']?.['general']) || [], count);
  }

  // Absolute fallback
  if (prompts.length === 0) {
    return [
      "Where are retailers removing friction from the buying journey, and how are they actually doing it?",
      "How is beauty personalization moving beyond skin tone matching into something more meaningful?",
      "How are sports brands turning one-off experiences into repeatable formats, and where is that showing up?",
      "Which consumer electronics products are genuinely blurring the line between technology and furniture?",
      "Show me examples of brands doing something new in any sector that customer experience teams should know about."
    ];
  }

  return prompts;
}
