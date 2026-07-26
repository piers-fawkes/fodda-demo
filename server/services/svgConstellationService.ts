/**
 * SVG Constellation Service — Generates Trend Constellation SVGs via the MCP engine
 *
 * Calls the Fodda MCP server's `generate_visual` tool to render a branded
 * watercolor-style Trend Constellation SVG for the extraction preview.
 *
 * Fallback: If the MCP is unreachable, generates a lightweight client-side SVG.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://mcp.fodda.ai';
const MCP_INTERNAL_KEY = process.env.FODDA_INTERNAL_API_KEY || process.env.MCP_INTERNAL_KEY || '';

interface ConstellationInput {
  graphName: string;
  trends: Array<{ name: string; summary?: string; validationStatus?: string }>;
  macroTrends?: Array<{ name: string; summary?: string }>;
  domain?: string;
}

/**
 * Generate a Trend Constellation SVG via the MCP's generate_visual tool.
 *
 * The MCP tool accepts a visualization type and data payload, returning
 * a branded SVG string with the Fodda watercolor aesthetic.
 */
export async function generateConstellationSVG(input: ConstellationInput): Promise<string> {
  // Try MCP engine first
  if (MCP_INTERNAL_KEY) {
    try {
      const svg = await callMcpVisualTool(input);
      if (svg) return svg;
    } catch (err: any) {
      console.warn('[SVG] MCP visual tool failed, using fallback:', err.message);
    }
  }

  // Fallback: generate lightweight SVG locally
  return generateFallbackSVG(input);
}

/**
 * Call the MCP server's generate_visual tool via the MCP SDK client.
 */
async function callMcpVisualTool(input: ConstellationInput): Promise<string | null> {
  let mcpClient: Client | null = null;

  try {
    // Internal service-to-service call for SVG generation; intentionally legacy URL format
    const mcpUrl = `${MCP_BASE_URL}/mcp?api_key=${encodeURIComponent(MCP_INTERNAL_KEY)}&user_id=system-svg-gen`;

    mcpClient = new Client({
      name: 'fodda-svg-generator',
      version: '1.0.0',
    });

    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    await mcpClient.connect(transport);

    // Call the generate_visual tool with constellation data
    const result = await mcpClient.callTool({
      name: 'generate_visual',
      arguments: {
        visualization_type: 'trend_constellation',
        title: input.graphName,
        data: JSON.stringify({
          centerLabel: input.graphName,
          domain: input.domain || '',
          macroTrends: (input.macroTrends || []).map(t => t.name),
          trends: input.trends.map(t => ({
            name: t.name,
            status: t.validationStatus || 'review',
          })),
        }),
      },
    });

    await mcpClient.close();

    // Extract SVG from the tool response
    const contentArr = Array.isArray(result.content) ? result.content : [];
    const svgContent = contentArr
      .map((c: any) => (c.type === 'text' ? c.text : ''))
      .join('');

    // Find the SVG tag in the response
    const svgMatch = svgContent.match(/<svg[\s\S]*?<\/svg>/i);
    return svgMatch ? svgMatch[0] : null;
  } catch (err: any) {
    if (mcpClient) {
      try { await mcpClient.close(); } catch { /* ignore */ }
    }
    throw err;
  }
}

/**
 * Fallback SVG generator — produces a lightweight constellation visualization
 * when the MCP engine is unavailable. Uses the Fodda brand palette.
 */
function generateFallbackSVG(input: ConstellationInput): string {
  const width = 640;
  const height = 420;
  const cx = width / 2;
  const cy = height / 2;

  const macros = (input.macroTrends || []).slice(0, 6);
  const trends = input.trends.slice(0, 14);

  // Position macro trends in inner ring
  const macroNodes = macros.map((t, i) => {
    const angle = (2 * Math.PI * i) / (macros.length || 1) - Math.PI / 2;
    const r = 75;
    return {
      ...t,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  });

  // Position trends in outer ring
  const trendNodes = trends.map((t, i) => {
    const angle = (2 * Math.PI * i) / (trends.length || 1) - Math.PI / 2;
    const r = 165;
    return {
      ...t,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  });

  // Validation status to color
  const statusColor = (status?: string) => {
    switch (status) {
      case 'verified': return '#16a34a';
      case 'emerging': return '#d97706';
      case 'review': return '#9ca3af';
      default: return '#6C3CE1';
    }
  };

  // Build SVG
  const lines: string[] = [];

  // Connection lines from trends to nearest macro
  trendNodes.forEach((t, i) => {
    if (macroNodes.length > 0) {
      const nearest = macroNodes[i % macroNodes.length];
      lines.push(
        `<line x1="${t.x.toFixed(1)}" y1="${t.y.toFixed(1)}" x2="${nearest.x.toFixed(1)}" y2="${nearest.y.toFixed(1)}" stroke="#e5e5e5" stroke-width="0.8" opacity="0.5"/>`
      );
    }
  });

  // Macro nodes
  const macroSvg = macroNodes.map((t, i) => {
    const label = t.name.length > 22 ? t.name.slice(0, 20) + '…' : t.name;
    return `<g>
      <circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="7" fill="#6C3CE1" opacity="0.9"/>
      <text x="${t.x.toFixed(1)}" y="${(t.y + 20).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#1a1a1a" font-family="system-ui, sans-serif">${escapeXml(label)}</text>
    </g>`;
  }).join('\n');

  // Trend nodes with validation colors
  const trendSvg = trendNodes.map((t, i) => {
    const label = t.name.length > 20 ? t.name.slice(0, 18) + '…' : t.name;
    const color = statusColor(t.validationStatus);
    return `<g>
      <circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="4.5" fill="${color}" opacity="0.65"/>
      <text x="${t.x.toFixed(1)}" y="${(t.y + 15).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#666" font-family="system-ui, sans-serif">${escapeXml(label)}</text>
    </g>`;
  }).join('\n');

  // Graph name label
  const graphLabel = input.graphName.length > 30
    ? input.graphName.slice(0, 28) + '…'
    : input.graphName;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f0ebff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="white" rx="16"/>
  <circle cx="${cx}" cy="${cy}" r="190" fill="url(#bg-grad)"/>
  
  <!-- Connection lines -->
  ${lines.join('\n  ')}
  
  <!-- Macro trend nodes -->
  ${macroSvg}
  
  <!-- Trend nodes -->
  ${trendSvg}
  
  <!-- Center label -->
  <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#1a1a1a" font-family="Georgia, serif" font-style="italic">${escapeXml(graphLabel)}</text>
  <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="6.5" fill="#aaa" letter-spacing="0.15em" font-family="system-ui, sans-serif">TREND CONSTELLATION</text>
  
  <!-- Watermark -->
  <text x="${width - 14}" y="${height - 10}" text-anchor="end" font-size="5.5" fill="#ccc" letter-spacing="0.15em" font-family="system-ui, sans-serif">✦ FODDA</text>
  
  <!-- Legend (only if deep extract with validation) -->
  ${input.trends.some(t => t.validationStatus) ? `
  <g transform="translate(14, ${height - 36})">
    <circle cx="0" cy="0" r="3" fill="#16a34a" opacity="0.65"/><text x="8" y="3" font-size="6" fill="#888" font-family="system-ui, sans-serif">Verified</text>
    <circle cx="52" cy="0" r="3" fill="#d97706" opacity="0.65"/><text x="60" y="3" font-size="6" fill="#888" font-family="system-ui, sans-serif">Emerging</text>
    <circle cx="110" cy="0" r="3" fill="#9ca3af" opacity="0.65"/><text x="118" y="3" font-size="6" fill="#888" font-family="system-ui, sans-serif">Review</text>
  </g>` : ''}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
