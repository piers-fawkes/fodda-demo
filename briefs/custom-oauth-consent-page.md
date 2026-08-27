# Brief — Host the OAuth consent page on app.fodda.ai (P0, connector flow is down)

> Owning repo: Fodda App. Execute with `/build-from-brief briefs/custom-oauth-consent-page.md`.

## Context

The Claude connector OAuth flow is broken at its final hop. Verified live 2026-08-26/27:
Clerk's authorize handoff sends users to `app.fodda.ai?redirect_url=<accounts.fodda.ai/oauth-consent?...>`,
and the Clerk-hosted consent page at `accounts.fodda.ai/oauth-consent` is broken — it loads a
stub chunk, makes zero API calls, and renders an empty body (while `accounts.fodda.ai/sign-in`
renders fine, so it's that route specifically). Every sign-in method funnels there, so every
connector connect dead-ends and users drift to the app dashboard instead of returning to Claude.
Consent cannot be disabled (DCR clients enforce it), but Clerk officially supports hosting the
consent page on our own domain: Dashboard → Paths → Component paths → **OAuth consent** → a
custom HTTPS URL, plus the prebuilt `<OAuthConsent />` component (confirmed exported by the
installed `@clerk/react` 6.7.2, `node_modules/@clerk/react/dist/index.d.ts:163,323`).
Reference: clerk.com/docs "Set up a custom OAuth consent page" (fetched 2026-08-27; key points
mirrored below — do not fetch blindly, follow this brief).

## What to build

1. **New route `/oauth-consent` on app.fodda.ai** (wire it the same way `/sso-callback` is
   routed). The page must be minimal and consent-focused:
   - Signed-in: render `<OAuthConsent />` from `@clerk/react`. No app nav, no account menus, no
     links that leave the flow. Style with the `appearance` prop only if trivial — function first.
   - Signed-out (direct visit): send into the existing AuthGate sign-in with the FULL current
     URL (path + query) preserved as the pending OAuth redirect, so post-sign-in returns to
     `/oauth-consent` with all params intact.
   - Referrer policy `strict-origin-when-cross-origin` (meta tag or route metadata) — Clerk's
     consent form POSTs to the Frontend API and rejects `Origin: null`.
2. **Resume-path compatibility check:** after Piers flips the dashboard path, Clerk's sign-in
   handoff will carry `redirect_url=https://app.fodda.ai/oauth-consent?...` (same-origin).
   Verify the App.tsx resume effect and SsoCallbackPage fast-path treat that target correctly
   (`isClerkOAuthContinueUrl` passes it via the `pathname.includes('oauth')` branch — confirm,
   and prefer a same-origin `location.assign`/router navigation over a full external redirect
   if simple). The route must also render correctly when reached directly with OAuth params.
3. **Security requirements (from Clerk's checklist — all mandatory):** never auto-approve;
   Allow and Deny equally visible (the prebuilt component handles this — do not override it
   away); no third-party scripts on the page; do not let query params override form-controlled
   fields. The prebuilt component satisfies these — the requirement is: do not customize it in
   ways that break them.

## Where to register

Nothing to register in code. AFTER deploy + verification, hand to Piers for the manual Clerk
Dashboard step: **Paths → Component paths → OAuth consent → `https://app.fodda.ai/oauth-consent`**
(production accepts HTTPS URLs on the instance's registrable domain). The route ships dark and
harmless until that setting points at it.

## Definition of Done

- Deployed; `https://app.fodda.ai/oauth-consent?client_id=test` renders the page shell (component
  will show its own state for an invalid client — not a blank page) and the signed-out variant
  routes into sign-in preserving the URL.
- After Piers sets the dashboard path: full live e2e from Claude — add `https://mcp.fodda.ai/mcp`
  as a connector, sign in with **LinkedIn** (one click), see the Allow box ON app.fodda.ai,
  click Allow, land back in Claude connected. Repeat once already-signed-in (should go
  authorize → consent → Claude with no sign-in). Deny returns an access_denied to Claude
  without stranding the user.
- CHANGELOG.md updated with the real verification result.

## Do Not

- Do not build a custom low-level consent flow — use the prebuilt `<OAuthConsent />` only.
- Do not disable or attempt to bypass consent, auto-approve, or hide Deny.
- Do not modify the AuthGate sign-in flows, email-code logic, or redirect allowlist beyond the
  compatibility check in (2).
- Do not change any Clerk dashboard setting from code — the Paths change is Piers's manual step.

## Files-changed (expected)

- new `frontend/components/OAuthConsentPage.tsx` (or similar) + route wiring (App.tsx/index.tsx)
- possibly `frontend/App.tsx` (resume-target compatibility), `index.html` (referrer meta)
- `CHANGELOG.md`
