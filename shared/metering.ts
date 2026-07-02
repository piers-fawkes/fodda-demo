export const TOKEN_COST_CONFIG = {
    // Base multipliers per token
    GRAPHS: {
        PSFK: 1.0,      // Primary Industry Guidance
        WALDO: 1.5,     // Multi-industry Intelligence
        SIC: 2.0,       // Strategic Independent Culture (Premium)
        PEW: 0.5,       // Public Baseline (Higher volume, lower token cost)
        DEFAULT: 1.0
    },

    // Weights (Reserved for future granularity)
    WEIGHTS: {
        SEMANTIC_SEARCH: 1.0,
        TRAVERSAL_HOP: 0.1
    }
};

// ---------------------------------------------------------------------------
// Interaction Types — fixed token costs for Waverunner agent features.
// Mirrors API metering.ts TOKEN_COSTS for App-side parity.
// ---------------------------------------------------------------------------

export type InteractionType =
    | 'search'                // Standard graph search (uses graph-weight pricing below)
    | 'url_context'           // URL content extraction via Waverunner
    | 'deep_dive_fast'        // Deep Dive — Fast tier
    | 'deep_dive_comprehensive' // Deep Dive — Comprehensive tier
    | 'expert_agent'          // Named Expert Agent chat turn
    | 'scheduled_analyst'     // Scheduled autonomous research run
    | 'research_stream'       // Glass Brain streaming research
    | 'research_chat';        // Multi-turn stateful chat

export const INTERACTION_COSTS: Record<InteractionType, number> = {
    search: 1,
    url_context: 1,
    deep_dive_fast: 10,
    deep_dive_comprehensive: 25,
    expert_agent: 5,
    scheduled_analyst: 5,
    research_stream: 3,
    research_chat: 3,
};

/**
 * Returns the fixed token cost for an interaction type.
 * Use for Waverunner agent features where cost is fixed
 * regardless of graph or result volume.
 */
export function calculateInteractionCost(type: InteractionType): number {
    return INTERACTION_COSTS[type] ?? 1;
}

/**
 * Calculates the token cost for a given interaction.
 * FROZEN RULE: Deterministic mapping based on graphId.
 * 1 API call = 1 token × graph multiplier.
 */
export function calculateTokenCost(graphId: string | undefined): number {
    if (!graphId) return TOKEN_COST_CONFIG.GRAPHS.DEFAULT;

    const id = graphId.toLowerCase();

    if (id.includes('waldo')) return TOKEN_COST_CONFIG.GRAPHS.WALDO;
    if (id.includes('sic')) return TOKEN_COST_CONFIG.GRAPHS.SIC;
    if (id.includes('pew') || id.includes('baseline')) return TOKEN_COST_CONFIG.GRAPHS.PEW;
    if (id.includes('psfk')) return TOKEN_COST_CONFIG.GRAPHS.PSFK;

    return TOKEN_COST_CONFIG.GRAPHS.DEFAULT;
}

// Backward-compatible alias
export const calculateQueryUnits = calculateTokenCost;

