import { randomBytes } from 'crypto';
import { queryAirtable, updateAirtableRecord, createAirtableRecord, escapeAirtableString } from '../db.js';
import { USERS_TABLE, ACCOUNTS_TABLE, API_KEYS_TABLE } from '../constants.js';

export interface McpConnection {
  ok: boolean;
  hasActiveKey: boolean;
  alreadyExists: boolean;
  mcpUrl: string | null;        // streamable HTTP, token scheme: https://mcp.fodda.ai/c/<token>
  sseUrl: string | null;        // SSE, LEGACY scheme (no token route exists): .../sse?api_key=&user_id=
  claudeConnectorUrl: string | null;
  token: string | null;
  message?: string;
}

/**
 * Helper to fetch active API keys for a given account ID.
 * Since the Account field in the API Keys table is a linked record,
 * comparing {Account} = 'rec...' in Airtable formulas evaluates by Account Name rather than record ID.
 * We resolve this by first retrieving the Account Name and then querying by that name.
 */
export async function getActiveKeysForAccount(accountId: string) {
  const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
  const accountName = accountQuery.records?.[0]?.fields?.['Account Name'];
  if (!accountName) return { records: [] };

  return await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountName)}', {API Key Status} = 'Active')`);
}

/**
 * The ONLY place in the codebase that constructs an MCP connection URL for a user.
 */
export async function buildMcpConnection(email: string): Promise<McpConnection> {
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  if (!normalizedEmail) {
    return {
      ok: false,
      hasActiveKey: false,
      alreadyExists: false,
      mcpUrl: null,
      sseUrl: null,
      claudeConnectorUrl: null,
      token: null,
      message: 'Email is required'
    };
  }

  // 1. Look up user record in BASE_ID / USERS_TABLE by lowercased email.
  const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
  const userRec = userQuery.records?.[0];

  if (!userRec) {
    return {
      ok: true,
      hasActiveKey: false,
      alreadyExists: false,
      mcpUrl: null,
      sseUrl: null,
      claudeConnectorUrl: null,
      token: null,
      message: `No user found for email ${normalizedEmail}`
    };
  }

  const accountId = userRec.fields.Account?.[0];
  if (!accountId) {
    return {
      ok: true,
      hasActiveKey: false,
      alreadyExists: false,
      mcpUrl: null,
      sseUrl: null,
      claudeConnectorUrl: null,
      token: null,
      message: `No account linked to user ${normalizedEmail}`
    };
  }

  // 2. Resolve or auto-provision active sk_live_ API key
  const keysQuery = await getActiveKeysForAccount(accountId);
  let activeKeyRec = keysQuery.records?.find((r: any) => {
    const k = r.fields?.['API Key'];
    return typeof k === 'string' && k.startsWith('sk_live_');
  }) || keysQuery.records?.[0];

  let apiKey = activeKeyRec?.fields?.['API Key'];

  if (!apiKey) {
    // Check if Account record directly has an API Key
    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
    const accountRec = accountQuery.records?.[0];
    apiKey = accountRec?.fields?.['API Key'] || accountRec?.fields?.apiKey;

    // If still missing, auto-create an active sk_live_ API key
    if (!apiKey) {
      apiKey = `sk_live_${randomBytes(24).toString('hex')}`;
      const accountName = accountRec?.fields?.['Account Name'] || 'Account';
      try {
        await createAirtableRecord(API_KEYS_TABLE, {
          'API Key': apiKey,
          'Account': [accountId],
          'API Key Status': 'Active'
        });
        await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { 'API Key': apiKey });
      } catch (err) {
        console.error('[buildMcpConnection] Error auto-provisioning API key:', err);
      }
    }
  }

  // 3. Mint-once: read mcpConnectionToken; if absent, token = randomBytes(24).toString('base64url')
  //    and PATCH it back onto THIS record (same base/table). If present, REUSE it.
  let token = userRec.fields.mcpConnectionToken;
  let alreadyExists = true;

  if (!token || typeof token !== 'string' || !token.trim()) {
    alreadyExists = false;
    token = randomBytes(24).toString('base64url');
    try {
      await updateAirtableRecord(USERS_TABLE, userRec.id, { mcpConnectionToken: token });
    } catch (err) {
      console.error('[buildMcpConnection] Error saving mcpConnectionToken to user record:', err);
    }
  }

  // 4. Build URLs
  const mcpUrl = `https://mcp.fodda.ai/c/${token}`;
  const sseUrl = `https://mcp.fodda.ai/sse?api_key=${apiKey}&user_id=${encodeURIComponent(normalizedEmail)}`;
  const claudeConnectorUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(mcpUrl)}`;

  return {
    ok: true,
    hasActiveKey: true,
    alreadyExists,
    mcpUrl,
    sseUrl,
    claudeConnectorUrl,
    token
  };
}

/**
 * Revokes a user's mcpConnectionToken by clearing it in Airtable.
 * Connector URL (mcp.fodda.ai/c/<token>) terminates instantly; org key is unaffected.
 */
export async function revokeMcpConnection(email: string): Promise<{ ok: boolean; message: string }> {
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  if (!normalizedEmail) return { ok: false, message: 'Email is required' };

  const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
  const userRec = userQuery.records?.[0];

  if (!userRec) return { ok: false, message: `No user found for email ${normalizedEmail}` };

  await updateAirtableRecord(USERS_TABLE, userRec.id, { mcpConnectionToken: '' });
  return { ok: true, message: `MCP connection token for ${normalizedEmail} revoked successfully.` };
}

/**
 * Regenerates a user's mcpConnectionToken (revokes old token and mints a new 24-byte token).
 */
export async function regenerateMcpConnection(email: string): Promise<McpConnection> {
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  if (!normalizedEmail) {
    return { ok: false, hasActiveKey: false, alreadyExists: false, mcpUrl: null, sseUrl: null, claudeConnectorUrl: null, token: null, message: 'Email is required' };
  }

  const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(normalizedEmail)}'`);
  const userRec = userQuery.records?.[0];

  if (!userRec) {
    return { ok: false, hasActiveKey: false, alreadyExists: false, mcpUrl: null, sseUrl: null, claudeConnectorUrl: null, token: null, message: `No user found for email ${normalizedEmail}` };
  }

  const newToken = randomBytes(24).toString('base64url');
  await updateAirtableRecord(USERS_TABLE, userRec.id, { mcpConnectionToken: newToken });

  return await buildMcpConnection(normalizedEmail);
}
