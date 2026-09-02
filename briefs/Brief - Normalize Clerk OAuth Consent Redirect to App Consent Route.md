# Brief: Normalize Clerk OAuth Consent Redirect to App Consent Route (Fix Claude Connector Redirect)

**Date:** 2026-09-02  
**From:** MCP Agent (Coordinator)  
**To:** App Agent (`Fodda` repo)  
**Priority:** P0 — Critical (Blocks Claude Connectors from completing OAuth and returning to Claude)  

---

## 1. Context & Root Cause (Live-Verified)

When a user connects Fodda to Claude via:
`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=https%3A%2F%2Fmcp.fodda.ai%2Fmcp`

1. Claude performs OAuth discovery against `https://mcp.fodda.ai/mcp` and reaches `https://clerk.fodda.ai/oauth/authorize?...`.
2. Clerk checks for an active session and redirects unauthenticated users to:
   ```
   https://app.fodda.ai?redirect_url=https%3A%2F%2Faccounts.fodda.ai%2Foauth-consent%3Fclient_id%3D...%26redirect_uri%3Dhttps%253A%252F%252Fclaude.ai%252Fapi%252Foauth%252Fcallback%26response_type%3Dcode...
   ```
3. The user logs in at `app.fodda.ai` (via LinkedIn, Google, or Email OTP).
4. Upon authentication, `App.tsx`, `AuthGate.tsx`, and `SsoCallbackPage.tsx` read `redirect_url` / `sessionStorage['fodda.pendingOAuthRedirect']` and execute:
   ```typescript
   window.location.href = pendingResume; // https://accounts.fodda.ai/oauth-consent?...
   ```
5. **The Failure Point:** `accounts.fodda.ai/oauth-consent` is Clerk's hosted Account Portal stub. It fails / renders an empty chunk / triggers Cloudflare challenge and bounces the user right back to `https://app.fodda.ai` (the app dashboard).
6. **The Missing Link:** The app already has a dedicated, working consent page at `https://app.fodda.ai/oauth-consent` (rendering `@clerk/react`'s `<OAuthConsent />`), but the redirect resumption code blindly forwards users to `accounts.fodda.ai/oauth-consent` rather than translating/normalizing it to `/oauth-consent`.

---

## 2. What to Change in `Fodda` (App Repo)

### A. Helper: Normalize OAuth Consent Destination (`shared/redirectAllowlist.ts`)

Add a helper to rewrite any `accounts.fodda.ai/oauth-consent` URL to same-origin `/oauth-consent`:

```typescript
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
```

### B. Update Resume Code in `App.tsx`, `AuthGate.tsx`, and `SsoCallbackPage.tsx`

Ensure all redirect resume sites apply `normalizeOAuthRedirectUrl()` before navigating:

1. **`frontend/App.tsx` (~line 482):**
   ```typescript
   const rawRedirect = params.get('redirect_url') || sessionStorage.getItem('fodda.pendingOAuthRedirect') || sessionStorage.getItem('fodda.pendingOAuthResume');
   const targetRedirect = normalizeOAuthRedirectUrl(rawRedirect);
   if (!targetRedirect) return;

   const isClerkOAuthContinue = isClerkOAuthContinueUrl(targetRedirect);
   const canResume = isClerkOAuthContinue ? (!!clerkUserId || isUnlocked) : isUnlocked;
   if (canResume) {
     sessionStorage.removeItem('fodda.pendingOAuthRedirect');
     sessionStorage.removeItem('fodda.pendingOAuthResume');
     window.location.href = targetRedirect;
   }
   ```

2. **`frontend/components/AuthGate.tsx` (~lines 429 & 454):**
   ```typescript
   const rawResume = sessionStorage.getItem('fodda.pendingOAuthRedirect') || sessionStorage.getItem('fodda.pendingOAuthResume');
   const pendingResume = normalizeOAuthRedirectUrl(rawResume);
   if (pendingResume) {
     sessionStorage.removeItem('fodda.pendingOAuthRedirect');
     sessionStorage.removeItem('fodda.pendingOAuthResume');
     window.location.href = pendingResume;
   } else {
     window.location.href = '/';
   }
   ```

3. **`frontend/components/SsoCallbackPage.tsx` (~lines 38 & 99):**
   ```typescript
   const rawResume = sessionStorage.getItem('fodda.pendingOAuthResume') || sessionStorage.getItem('fodda.pendingOAuthRedirect');
   const pendingResume = normalizeOAuthRedirectUrl(rawResume);
   if (pendingResume) {
     sessionStorage.removeItem('fodda.pendingOAuthResume');
     sessionStorage.removeItem('fodda.pendingOAuthRedirect');
     sessionStorage.removeItem('fodda.oauthPending');
     window.location.replace(pendingResume);
     return;
   }
   ```

---

## 3. Manual Clerk Dashboard Check (Piers)

In Clerk Dashboard:
- Go to **Paths → Component paths → OAuth consent**
- Ensure it is set to: `https://app.fodda.ai/oauth-consent`
*(The code normalization above ensures the flow works seamlessly whether or not Clerk emits `accounts.fodda.ai` or `app.fodda.ai` in `redirect_url`.)*

---

## 4. Definition of Done & Verification

1. In an incognito window, open:
   `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=https%3A%2F%2Fmcp.fodda.ai%2Fmcp`
2. Click **Add** in Claude → browser redirects to `clerk.fodda.ai/oauth/authorize` → hands off to `app.fodda.ai`.
3. Sign in on `app.fodda.ai` (via LinkedIn, Google, or Email OTP).
4. The browser immediately lands on `https://app.fodda.ai/oauth-consent` showing the Allow / Deny modal.
5. Click **Allow** → Clerk issues authorization code and redirects back to `https://claude.ai/api/oauth/callback?...`.
6. Claude shows the connector as **Connected**.
7. Update `CHANGELOG.md` in `Fodda` repo.
