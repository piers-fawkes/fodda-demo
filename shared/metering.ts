export const QUERY_UNIT_CONFIG = {
    // Base multipliers
    GRAPHS: {
        PSFK: 1.0,      // Primary Industry Guidance
        WALDO: 1.5,     // Multi-industry Intelligence
        SIC: 2.0,       // Strategic Independent Culture (Premium)
        PEW: 0.5,       // Public Baseline (Higher volume, lower unit cost)
        DEFAULT: 1.0
    },

    // Weights (Reserved for future granularity)
    WEIGHTS: {
        SEMANTIC_SEARCH: 1.0,
        TRAVERSAL_HOP: 0.1
    }
};

/**
 * Calculates the query units for a given interaction.
 * FROZEN RULE: Deterministic mapping based on graphId.
 */
export function calculateQueryUnits(graphId: string | undefined): number {
    if (!graphId) return QUERY_UNIT_CONFIG.GRAPHS.DEFAULT;

    const id = graphId.toLowerCase();

    if (id.includes('waldo')) return QUERY_UNIT_CONFIG.GRAPHS.WALDO;
    if (id.includes('sic')) return QUERY_UNIT_CONFIG.GRAPHS.SIC;
    if (id.includes('pew') || id.includes('baseline')) return QUERY_UNIT_CONFIG.GRAPHS.PEW;
    if (id.includes('psfk')) return QUERY_UNIT_CONFIG.GRAPHS.PSFK;

    return QUERY_UNIT_CONFIG.GRAPHS.DEFAULT;
}
