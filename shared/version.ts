import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// --- Central Version Registry ---
// All version identifiers in one place. No other file should hardcode these.

/** Response envelope schema format version */
export const SCHEMA_VERSION = "2026-02-14";

/** Knowledge graph data vintage */
export const GRAPH_VERSION = "2024-Q1-PROD";

/** MCP tool definition version (semver) */
export const MCP_TOOL_VERSION = "1.0.0";

/** API proxy version (semver) */
export const API_VERSION = "1.0.0";

/** App version — pulled from package.json at startup */
export function getAppVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/** All version fields as a flat object */
export function getAllVersions() {
    return {
        app_version: getAppVersion(),
        api_version: API_VERSION,
        schema_version: SCHEMA_VERSION,
        graph_version: GRAPH_VERSION,
        mcp_tool_version: MCP_TOOL_VERSION,
    };
}

/**
 * Deterministic fingerprint of every version field.
 * If any version drifts, this hash changes — useful for quick equality checks.
 */
export function buildFingerprint(): string {
    const versions = getAllVersions();
    const input = Object.entries(versions).sort().map(([k, v]) => `${k}=${v}`).join('|');
    return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
