/**
 * Redirect Allowlist Validator
 *
 * Validates whether a redirect URL is allowlisted.
 * Ensures:
 * 1. Dot-anchored host matching (e.g. 'fodda.ai', '*.fodda.ai', 'clerk.com', '*.clerk.com')
 *    so malicious lookalikes like 'https://evilfodda.ai' or 'https://notclerk.com' fail.
 * 2. Rejection of protocol-relative URLs (e.g. '//evil.com' or '/\\evil.com').
 * 3. Relative internal paths on the same origin ('/dashboard', '/sandbox') are permitted.
 * 4. Only 'http:' and 'https:' schemes are accepted (blocking 'javascript:', 'data:', etc.).
 */

export const isValidRedirectUrl = (urlStr: string | null | undefined): boolean => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed) return false;

  // Reject protocol-relative URLs or backslash tricks
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\\\')) {
    return false;
  }

  // Relative path on same origin (e.g. /dashboard or /sandbox)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowedHost =
      host === 'fodda.ai' ||
      host.endsWith('.fodda.ai') ||
      host === 'clerk.com' ||
      host.endsWith('.clerk.com') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    return isAllowedHost;
  } catch {
    return false;
  }
};

/**
 * Identifies if a redirect URL targets Clerk OAuth continuation / connector consent.
 */
export const isClerkOAuthContinueUrl = (urlStr: string | null | undefined): boolean => {
  if (!isValidRedirectUrl(urlStr)) return false;
  try {
    const parsed = new URL(urlStr!, 'https://app.fodda.ai');
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'accounts.fodda.ai' ||
      host.endsWith('.accounts.fodda.ai') ||
      host === 'clerk.fodda.ai' ||
      host.endsWith('.clerk.fodda.ai') ||
      host === 'clerk.com' ||
      host.endsWith('.clerk.com') ||
      parsed.pathname.includes('oauth')
    );
  } catch {
    return false;
  }
};

/**
 * Checks if a URL is an internal app destination (app.fodda.ai or relative path)
 * where internal login tokens can safely be passed.
 */
export const isInternalAppUrl = (urlStr: string | null | undefined): boolean => {
  if (!isValidRedirectUrl(urlStr)) return false;
  const trimmed = urlStr!.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'app.fodda.ai' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
};

/**
 * Normalizes an OAuth redirect URL.
 * If the URL targets accounts.fodda.ai/oauth-consent, rewrites it to /oauth-consent
 * on the current origin so the app's dedicated <OAuthConsentPage /> renders the prompt.
 */
export const normalizeOAuthRedirectUrl = (urlStr: string | null | undefined): string | null => {
  if (!urlStr || !isValidRedirectUrl(urlStr)) return null;
  try {
    const parsed = new URL(urlStr, 'https://app.fodda.ai');
    if (parsed.hostname.toLowerCase() === 'accounts.fodda.ai' && parsed.pathname.includes('/oauth-consent')) {
      return `/oauth-consent${parsed.search}${parsed.hash}`;
    }
    return urlStr;
  } catch {
    return urlStr;
  }
};

