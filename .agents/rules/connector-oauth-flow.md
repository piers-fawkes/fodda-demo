# RULE — The Claude-connector OAuth flow is load-bearing. Do not break it.

The single most important user journey in this repo: **a user adds `https://mcp.fodda.ai/mcp`
as a Claude connector, signs in via OAuth, clicks Allow, and lands back in Claude.** Several
regressions have shipped by editing one link of this chain without knowing the others exist.
Read this before touching ANY file listed at the bottom.

## The chain (every link must survive every edit)

1. Claude opens `clerk.fodda.ai/oauth/authorize` (Clerk-native DCR; the MCP repo hosts no OAuth
   UX — do not add any there).
2. Signed-out users are handed to `app.fodda.ai?redirect_url=<consent URL>`. The app captures
   `redirect_url` into `sessionStorage['fodda.pendingOAuthRedirect']` at **module scope, before
   any URL-cleanup effect runs** (App.tsx top, AuthGate mount). Never add a
   `history.replaceState`/param-strip that runs before this capture or clears the stored key.
3. Sign-in is **email code (OTP) or SSO — never email magic links.** The Clerk dashboard has
   email links disabled instance-wide (sign-in AND sign-up verification); reintroducing any
   `emailLink` call will hard-fail against the live instance.
4. SSO stashes `fodda.pendingOAuthResume` before redirect (AuthGate `handleOAuth`);
   `/sso-callback` fast-path resumes it. Email-code success navigates explicitly to the pending
   redirect. The App.tsx resume effect is the shared fallback. All three read the same stored
   keys — keep them in sync.
5. Consent renders on **our** `/oauth-consent` route (prebuilt `<OAuthConsent />` from
   `@clerk/react`); the Clerk dashboard Paths setting points at
   `https://app.fodda.ai/oauth-consent`. Do not rename, remove, redirect, or add navigation/
   third-party scripts to this route; the dashboard reference breaks silently if the path moves.
   (Clerk's own `accounts.fodda.ai/oauth-consent` was broken in prod 2026-08-26 — that is why
   this route exists.)
6. All redirect validation goes through `shared/redirectAllowlist.ts`
   (`isValidRedirectUrl` / `isClerkOAuthContinueUrl` / `isInternalAppUrl`). Never write an
   inline host check (`endsWith('fodda.ai')` was an open-redirect: `evilfodda.ai` passed), and
   never attach a login token to a URL unless `isInternalAppUrl` is true.
7. Thread redirect through Clerk native SSO params (`redirectUrl` and `redirectCallbackUrl`);
   storage is a fallback, not the primary bus.
8. All pending OAuth redirect storage goes through `shared/oauthResumeStorage.ts` with 15-minute
   expiry. Never access `fodda.pendingOAuthRedirect` or related keys inline.
9. App-level effects (billing deep links, auto-checkout) must guard against running on
   `/oauth-consent` and `/sso-callback` so that OAuth query parameters are not stripped.
10. Testing must be done with a fresh, previously-unauthorized user in a clean browser profile.
    An authorized user skips consent and proves nothing.

## Paired Clerk dashboard state (code and dashboard must change together)

- Email: verification + sign-in are **code-only** (links off everywhere).
- Paths → Component paths → OAuth consent → `https://app.fodda.ai/oauth-consent`.
- sign_in / after_sign_in / home URLs = `https://app.fodda.ai`.
Changing either side alone breaks the flow. Dashboard changes are Piers's manual step — flag,
don't assume.

## Non-negotiable verification before deploying changes to these files

A build is NOT verification. Run the live end-to-end: from Claude, add/reconnect the connector →
sign in (LinkedIn one-click AND once with email code) → the Allow box renders on app.fodda.ai →
land back in Claude connected. State the result in CHANGELOG.md. If you cannot run it, say so
explicitly and do not claim the flow works.

## Files that are part of this chain

`frontend/components/AuthGate.tsx`, `frontend/App.tsx` (module top + resume effect + billing
strip), `frontend/components/SsoCallbackPage.tsx`, the `/oauth-consent` route/component,
`shared/redirectAllowlist.ts`, `shared/oauthResumeStorage.ts`, `server/routers/authRouter.ts`
(`/api/auth/confirm`), `server/routers/webhookRouter.ts` (OAUTH_WELCOME delay), `index.html`
(referrer meta).
