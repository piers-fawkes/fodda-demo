import { readPendingOAuthRedirect } from './oauthResumeStorage.ts';

export interface PlatformAttribution {
  apiUse: string;
  intent: string;
  source: string;
}

/**
 * Derives the platform attribution from a URL string, query string, or current window location.
 * Accurately detects:
 * - Grok Bot / xAI connector (grok-brand-context, earnings-intelligence, x.ai, grok.com, :8787 localhost bridge, known client IDs)
 * - Claude connector (claude.ai, claude platform)
 * - ChatGPT app (chatgpt.com, chatgpt platform)
 * - Generic MCP client (/mcp, mcp.fodda.ai, mcp platform)
 * - Perplexity, Notion, Copilot, Gemini, API
 * - Fallback to standard webapp defaults
 */
export const derivePlatformFromUrl = (urlOrQuery?: string | null): PlatformAttribution => {
  let params: URLSearchParams | null = null;

  if (urlOrQuery) {
    if (urlOrQuery.includes('?')) {
      params = new URLSearchParams(urlOrQuery.substring(urlOrQuery.indexOf('?') + 1));
    } else {
      params = new URLSearchParams(urlOrQuery);
    }
  } else if (typeof window !== 'undefined') {
    params = new URLSearchParams(window.location.search);
  }

  if (!params) {
    return { apiUse: 'Mainly Claude', intent: 'account', source: 'webapp' };
  }

  let resource = (params.get('resource') || '').toLowerCase();
  let redirectUri = (params.get('redirect_uri') || '').toLowerCase();
  let onboard = (params.get('platform') || params.get('onboarding') || '').toLowerCase();
  let clientId = params.get('client_id') || '';
  const hasGrokFlag = params.has('grok');

  // If resource and redirect_uri are not present directly, check if they are nested
  // inside ?redirect_url= or stashed in pending OAuth redirect storage
  if (!resource && !redirectUri) {
    const nested = params.get('redirect_url') || (typeof window !== 'undefined' ? readPendingOAuthRedirect() : null);
    if (nested && nested.includes('?')) {
      try {
        const nestedParams = new URLSearchParams(nested.substring(nested.indexOf('?') + 1));
        if (!resource) resource = (nestedParams.get('resource') || '').toLowerCase();
        if (!redirectUri) redirectUri = (nestedParams.get('redirect_uri') || '').toLowerCase();
        if (!onboard) onboard = (nestedParams.get('platform') || nestedParams.get('onboarding') || '').toLowerCase();
        if (!clientId) clientId = nestedParams.get('client_id') || '';
      } catch {}
    }
  }

  // 1. Grok Bot / xAI detection
  const isGrok =
    resource.includes('grok-brand-context') ||
    resource.includes('earnings-intelligence') ||
    redirectUri.includes('x.ai') ||
    redirectUri.includes('grok.com') ||
    redirectUri.includes(':8787') ||
    clientId === 'MuPhVBpeyvvMn6re' ||
    clientId === 'DOHTQ0pmgSKoD705' ||
    hasGrokFlag ||
    onboard.includes('grok');

  if (isGrok) {
    const isEarnings = resource.includes('earnings-intelligence') || resource.includes('earnings');
    return {
      apiUse: isEarnings ? 'Grok Bot (Earnings)' : 'Grok Bot',
      intent: 'grok',
      source: isEarnings ? 'grok_earnings' : 'grok_brand_context'
    };
  }

  // 2. Claude detection
  if (redirectUri.includes('claude.ai') || onboard.includes('claude')) {
    return {
      apiUse: 'Mainly Claude',
      intent: 'claude',
      source: 'claude_connector'
    };
  }

  // 3. ChatGPT detection
  if (redirectUri.includes('chatgpt.com') || onboard.includes('chatgpt') || onboard.includes('openai')) {
    return {
      apiUse: 'Mainly ChatGPT',
      intent: 'chatgpt',
      source: 'chatgpt_app'
    };
  }

  // 4. Generic MCP
  if (resource.includes('/mcp') || resource.includes('mcp.fodda.ai') || onboard.includes('mcp')) {
    return {
      apiUse: 'Mainly MCP Use',
      intent: 'mcp',
      source: 'mcp_server'
    };
  }

  // 5. Explicit onboarding platform mappings
  if (onboard.includes('perplexity')) {
    return { apiUse: 'Mainly Perplexity', intent: 'account', source: 'perplexity' };
  }
  if (onboard.includes('notion')) {
    return { apiUse: 'Mainly Notion', intent: 'account', source: 'notion' };
  }
  if (onboard.includes('copilot') || onboard.includes('co-pilot')) {
    return { apiUse: 'Mainly MSFT Co-pilot', intent: 'account', source: 'copilot' };
  }
  if (onboard.includes('gemini')) {
    return { apiUse: 'Mainly Gemini', intent: 'account', source: 'gemini' };
  }
  if (onboard.includes('vertex') || onboard.includes('api')) {
    return { apiUse: 'Mainly API Access', intent: 'api', source: 'api' };
  }

  // 6. Default fallback
  return {
    apiUse: 'Mainly Claude',
    intent: 'account',
    source: 'webapp'
  };
};

/**
 * Derives the legacy signupIntent value from the user's apiUse selection
 */
export const deriveIntentFromApiUse = (apiUse: string): string => {
  if (apiUse.startsWith('Grok Bot')) return 'grok';
  if (apiUse === 'Mainly Claude') return 'claude';
  if (apiUse === 'Mainly ChatGPT') return 'chatgpt';
  if (apiUse === 'Mainly MCP Use') return 'mcp';
  if (apiUse === 'Self-Demo') return 'demo';
  if (apiUse === 'Graph Seller') return 'sell';
  if (apiUse === 'Mainly API Access') return 'api';
  return 'account';
};
