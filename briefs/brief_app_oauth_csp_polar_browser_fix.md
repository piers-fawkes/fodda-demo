# Brief: Fix OAuth Consent Allow Button Hang in Polar Browser (CSP `form-action` Redirect Block)

> **Type:** Bug Fix · **Priority:** P0 (Blocks Polar Browser MCP Connector OAuth flow) · **Owner:** App Agent (`Fodda` repo)  
> **Repo:** `~/Documents/Fodda` · **Files:** `server/index.ts` · **Prepared:** 2026-09-14  
> **From:** MCP Agent (Polar Browser OAuth Hang Investigation)  
> **To:** App Agent (`Fodda` repo)  

---

## 1. Context & Root Cause (Diagnosed)

When adding Fodda as an MCP connector in the **Polar Browser** (`polarbrowser.com`):

1. Polar initiates OAuth 2.1 authorization with Clerk (`clerk.fodda.ai`) and redirects the user to the consent screen: `https://app.fodda.ai/oauth-consent?...`.
2. `@clerk/react`'s `<OAuthConsent />` card correctly renders:
   - Header: *"Polar wants to access Fodda on behalf of..."*
   - Workspace selection and scope list.
   - Buttons: **Deny** and **Allow**.
   - Footer: *"If you allow access, this app will redirect you to polarbrowser.com."*
3. **The Failure Point:** Clicking the **Allow** button does nothing; it hangs indefinitely.
4. **The Console Error:**
   ```
   Sending form data to '<URL>' violates the following Content Security Policy directive: "form-action 'self' <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL> <URL>". The request has been blocked.
   ```
5. **Root Cause:**
   - Under the hood, Clerk's `<OAuthConsent />` component submits consent as an HTML `<form method="POST" action="https://clerk.fodda.ai/v1/me/oauth/consent/<client_id>">`.
   - `clerk.fodda.ai` approves the consent and returns an HTTP 302/303 redirect to Polar's callback URL: `https://polarbrowser.com/...`.
   - Per the W3C Content Security Policy specification, **`form-action` governs not only the initial form submission target, but the entire subsequent redirect chain.**
   - In `server/index.ts` (lines 55–70), Helmet's CSP `formAction` currently only lists:
     - `'self'`
     - Clerk domains (`clerk.fodda.ai`, `accounts.fodda.ai`, `clerk.com`, etc.)
     - Claude domains (`claude.ai`, `*.claude.ai`)
     - OpenAI domains (`chatgpt.com`, `*.chatgpt.com`, `*.oai.com`, `openai.com`, `*.openai.com`)
   - There are exactly 13 external URLs + `'self'`, exactly matching the 13 `<URL>` tokens in the browser console error.
   - Because `https://polarbrowser.com` and `https://*.polarbrowser.com` are not in `formAction`, the browser terminates the redirect chain upon clicking **Allow**.

*(Note: This is the exact same issue that previously hit Claude on 2026-09-02 and ChatGPT on 2026-09-03, where each was added one-by-one to `server/index.ts`).*

---

## 2. What to Change in `Fodda` (App Repo)

### File: `server/index.ts`

Update Helmet's CSP `formAction` configuration around line 55:

```typescript
      formAction: [
        "'self'",
        "https://clerk.fodda.ai",
        "https://*.clerk.fodda.ai",
        "https://accounts.fodda.ai",
        "https://*.clerk.accounts.dev",
        "https://clerk.com",
        "https://*.clerk.com",
        "https://claude.ai",
        "https://*.claude.ai",
        "https://chatgpt.com",
        "https://*.chatgpt.com",
        "https://*.oai.com",
        "https://openai.com",
        "https://*.openai.com",
        "https://polarbrowser.com",
        "https://*.polarbrowser.com",
      ],
```

> **Recommendation for Dynamic Client Registration (DCR):**
> Because MCP allows arbitrary compliant clients (Polar, Cursor, Windsurf, Zed, Gemini, custom enterprise agents) to dynamically register and receive authorization codes via Clerk OAuth, maintaining a static hardcoded allowlist of every external client domain in `formAction` means **every new client or browser will hang until a code change and deploy is shipped**.
> 
> Consider adding `"https:"` to `formAction` alongside `'self'` (e.g. `formAction: ["'self'", "https:"]` or alongside the explicit domains). Since Clerk's authorization server validates that the redirect target strictly matches the registered OAuth client's allowlisted `redirect_uri`, allowing HTTPS redirects in `formAction` allows all valid OAuth client handoffs without compromising origin safety.

---

## 3. Definition of Done & Verification

1. In `server/index.ts`, `https://polarbrowser.com` and `https://*.polarbrowser.com` (and/or `"https:"`) are added to Helmet CSP `formAction`.
2. Run preflight:
   ```bash
   node scripts/oauth-preflight.mjs
   ```
   Passes cleanly.
3. Deploy the App service via `deploy_gcp.sh`.
4. Run post-deploy smoke check:
   ```bash
   npm run smoke:oauth
   ```
5. **Manual Verification:**
   - In Polar Browser, add Fodda as an MCP connector (`https://mcp.fodda.ai/mcp`).
   - Sign in if prompted, arriving at `https://app.fodda.ai/oauth-consent`.
   - Click **Allow**.
   - Verify the browser successfully redirects to Polar Browser without a CSP block and completes connector authorization.
6. Update `CHANGELOG.md` in `Fodda` repo.
