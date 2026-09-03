import { normalizeOAuthRedirectUrl } from './redirectAllowlist.ts';

export const OAUTH_REDIRECT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

const KEY_REDIRECT = 'fodda.pendingOAuthRedirect';
const KEY_RESUME = 'fodda.pendingOAuthResume';
const KEY_REDIRECT_AT = 'fodda.pendingOAuthRedirectAt';
const KEY_OAUTH_PENDING = 'fodda.oauthPending';

/**
 * Persists an OAuth redirect destination across both sessionStorage and localStorage
 * with a 15-minute timestamp companion to prevent stale resume state.
 */
export const writePendingOAuthRedirect = (urlStr: string | null | undefined): void => {
  if (typeof window === 'undefined' || !urlStr) return;
  const normalized = normalizeOAuthRedirectUrl(urlStr);
  if (!normalized) return;

  const now = Date.now().toString();
  try {
    sessionStorage.setItem(KEY_REDIRECT, normalized);
    sessionStorage.setItem(KEY_RESUME, normalized);
    sessionStorage.setItem(KEY_REDIRECT_AT, now);
  } catch {}

  try {
    localStorage.setItem(KEY_REDIRECT, normalized);
    localStorage.setItem(KEY_RESUME, normalized);
    localStorage.setItem(KEY_REDIRECT_AT, now);
  } catch {}
};

/**
 * Reads the pending OAuth redirect destination from sessionStorage or localStorage.
 * Automatically discards and clears entries older than 15 minutes.
 */
export const readPendingOAuthRedirect = (): string | null => {
  if (typeof window === 'undefined') return null;

  // Check timestamp expiry
  try {
    const atStr = sessionStorage.getItem(KEY_REDIRECT_AT) || localStorage.getItem(KEY_REDIRECT_AT);
    if (atStr) {
      const ts = parseInt(atStr, 10);
      if (!isNaN(ts) && Date.now() - ts > OAUTH_REDIRECT_EXPIRY_MS) {
        clearPendingOAuthRedirect();
        return null;
      }
    }
  } catch {}

  // Read stored URL
  try {
    const raw =
      sessionStorage.getItem(KEY_REDIRECT) ||
      sessionStorage.getItem(KEY_RESUME) ||
      localStorage.getItem(KEY_REDIRECT) ||
      localStorage.getItem(KEY_RESUME);

    if (!raw) return null;
    const normalized = normalizeOAuthRedirectUrl(raw);
    if (!normalized) {
      clearPendingOAuthRedirect();
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
};

/**
 * Clears all OAuth redirect keys from both sessionStorage and localStorage.
 */
export const clearPendingOAuthRedirect = (): void => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(KEY_REDIRECT);
    sessionStorage.removeItem(KEY_RESUME);
    sessionStorage.removeItem(KEY_REDIRECT_AT);
    sessionStorage.removeItem(KEY_OAUTH_PENDING);
  } catch {}

  try {
    localStorage.removeItem(KEY_REDIRECT);
    localStorage.removeItem(KEY_RESUME);
    localStorage.removeItem(KEY_REDIRECT_AT);
    localStorage.removeItem(KEY_OAUTH_PENDING);
  } catch {}
};

export const setOAuthPending = (provider: string): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY_OAUTH_PENDING, provider);
  } catch {}
};

export const getOAuthPending = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(KEY_OAUTH_PENDING);
  } catch {
    return null;
  }
};

export const clearOAuthPending = (): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY_OAUTH_PENDING);
    localStorage.removeItem(KEY_OAUTH_PENDING);
  } catch {}
};
