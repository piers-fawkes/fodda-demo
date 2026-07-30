import { Router } from 'express';
import { mcpChat, listMcpTools } from '../services/mcpChatService.js';
import { resolveIdentity, resolveEmailFromApiKey, autoProvisionUser } from '../helpers.js';
import { createAirtableRecord, LOGS_TABLE_QUESTIONS } from '../db.js';

const router = Router();

/**
 * GET /api/mcp/tools
 * Proxies tool discovery to the MCP server.
 * Requires a valid X-API-Key.
 */
router.get("/tools", async (req, res) => {
  // Finding 6: header only — query string keys appear in Cloud Run access logs
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ ok: false, error: "X-API-Key header is required" });
  }

  try {
    const identity = await resolveIdentity(apiKey);
    if (!identity) return res.status(401).json({ ok: false, error: "Invalid API Key" });

    const userEmail = await resolveEmailFromApiKey(apiKey);
    if (userEmail && userEmail.includes('@') && identity?.tenantId && identity.tenantId !== 'unknown_tenant') {
      autoProvisionUser(userEmail, identity.tenantId).catch(err => console.error('[McpRouter] Auto-provision check failed:', err));
    }

    const tools = await listMcpTools(apiKey, userEmail);
    
    res.json({ 
      ok: true, 
      tools,
      count: tools.length,
      version: process.env.npm_package_version || "1.0.0"
    });
  } catch (err: any) {
    console.error("[McpRouter] Tools Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Per-key rate limiter: 30 req/min ---
const chatRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW = 60_000;

function isChatRateLimited(apiKey: string): boolean {
  const now = Date.now();
  const entry = chatRateLimitMap.get(apiKey);
  if (!entry || now > entry.resetAt) {
    chatRateLimitMap.set(apiKey, { count: 1, resetAt: now + CHAT_RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > CHAT_RATE_LIMIT;
}

// Trim the map periodically to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of chatRateLimitMap) {
    if (now > entry.resetAt) chatRateLimitMap.delete(key);
  }
}, 5 * 60_000).unref();

router.post("/chat", async (req, res) => {
  const { query, vertical, userContext, firstName, personaContext } = req.body;
  const apiKey = req.headers['x-api-key'] as string;

  if (!query || !apiKey) {
    return res.status(400).json({ ok: false, error: "query and X-API-Key are required" });
  }

  // Per-key rate limit
  if (isChatRateLimited(apiKey)) {
    return res.status(429).json({ ok: false, error: "Too many requests" });
  }

  try {
    const identity = await resolveIdentity(apiKey);
    if (!identity) return res.status(401).json({ ok: false, error: "Invalid API Key" });

    // Security: derive userId from API key, not from the untrusted request body
    const resolvedEmail = await resolveEmailFromApiKey(apiKey);
    const userId = resolvedEmail || 'anonymous';

    // Security: scope accountContext to the key's tenant instead of trusting body
    const accountContext = identity.tenantId || undefined;

    console.log(`[McpRouter] Starting chat for ${userId} (tenant: ${accountContext || 'none'}) on vertical ${vertical || 'all'}`);
    
    const result = await mcpChat(
      query,
      vertical || 'all',
      apiKey,
      userId,
      userContext,
      accountContext,
      firstName,
      personaContext
    );

    // Fire-and-forget query log write with true MCP step count
    createAirtableRecord(LOGS_TABLE_QUESTIONS, {
      "question": query,
      "userEmail": userId,
      "graphId": vertical || 'all',
      "Date": new Date().toISOString(),
      "stepCount": Math.max(1, result.toolCalls?.length || 0),
      "responseTimeMs": result.totalDurationMs || 0,
      "source": 'mcp',
      "accountId": accountContext || '',
      "taxonomy_node": (vertical || 'all').substring(0, 100),
    }).catch(err => console.error('[McpRouter] Log write failed:', err?.message));

    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[McpRouter] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
