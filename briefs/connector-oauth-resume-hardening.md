# Brief: Make the Claude-connector OAuth resume storage-independent and drift-proof

**Date:** 2026-09-02
**From:** MCP Agent (Claude Code analysis, Piers-requested)
**To:** App Agent (`Fodda` repo)
**Priority:** P0 follow-up — the flow is live-fixed as of rev `fodda-sandbox-00541-n4s`; this brief removes the reasons it keeps regressing.
**Execution handle:** `/build-from-brief briefs/connector-oauth-resume-hardening.md`

---

## 1. Context — why this flow has broken five times since 2026-08-10

Three separate failures were found and fixed today (revs 00539, 00540, 00541). Each one was a
different link in the chain, and each was caused by something *outside the app's git history*
changing under us. Verified against live systems on 2026-09-02:

1. **Clerk handed out the wrong consent host.** On 2026-08-27 the dashboard path was set to
   `https://app.fodda.ai/oauth-consent`, yet on 09-02 the signed-out handoff again carried
   `redirect_url=https://accounts.fodda.ai/oauth-consent?...`. After the dashboard was re-saved the
   handoff is correct again (probed hop-by-hop: `/oauth/authorize` → `/oauth/authorize/continue` →
   `app.fodda.ai?redirect_url=https://app.fodda.ai/oauth-consent?...`). Rev 00539 added
   `normalizeOAuthRedirectUrl()` so the app survives either host. Nothing in the repo detects this
   drift: `scripts/oauth-smoke.mjs` checks Clerk's email config but not `display_config.oauth_consent_url`,
   and the API repo's weekly probe accepts *any* URL containing `oauth-consent`.
2. **Clerk-js navigated to `/` and won the race.** `@clerk/react` loads clerk-js from Clerk's CDN
   at `@6` (today: 6.30.1) and `@clerk/ui` at `@1` (today: 1.30.8) — the app pins neither. In
   6.30.1, `handleRedirectCallback` resolves the after-sign-in URL as
   `signInForceRedirectUrl → redirect_url search param on the callback page → signInFallbackRedirectUrl → "/"`.
   `/sso-callback` had no props and no `redirect_url` param, so Clerk navigated to `/`. If
   `SsoCallbackPage`'s watcher fired first it deleted the storage keys and *then* Clerk's
   navigation cancelled ours — leaving the user on the bare dashboard with nothing left to resume
   (Piers's screenshot). Rev 00540 passes `signInForceRedirectUrl`/`signUpForceRedirectUrl`.
   The localStorage mirror added in the same commit is not what fixed it (sessionStorage survives
   same-tab cross-origin round trips, incognito included) and it introduces a stale-state hazard
   (see §2B).
3. **CSP blocked the Allow button.** The live `@clerk/ui` consent component submits Allow/Deny as a
   real HTML `<form method="POST" action="https://clerk.fodda.ai/v1/me/oauth/consent/<client_id>">`.
   Helmet's default `form-action 'self'` blocks that cross-origin submission, and Helmet's default
   `Referrer-Policy: no-referrer` header fights the `strict-origin-when-cross-origin` meta that
   Clerk requires for its CSRF check. Rev 00541 sets `formAction` and `referrerPolicy` explicitly.
   The 08-27 e2e passed with the old headers, so either the consent step was skipped for an
   already-consented account or Clerk's UI changed mechanism — either way, a silent CDN change.

Two repo-level facts make every regression worse:

- **`main` is two months stale.** `main`/`origin/main` = `e62f1df` (2026-07-13). All work since July, including every OAuth fix
  (70 commits) lives only on `fix/graph-trials-canonical-mcp-url`. `.agents/workflows/deploy.md`
  instructs "deploy ONLY from clean `main`"; `deploy_gcp.sh` deploys whatever tree it runs in with
  no branch check; three detached `.claude/worktrees/*` sit at `e62f1df`. Any agent that follows
  the workflow, or deploys from a worktree, ships July code with none of the OAuth fixes and no
  preflight (the scripts do not exist on `main`).
- **Storage juggling instead of Clerk-native threading.** Three components read/write four
  keys in two storages and each clears them at different moments. Every fix so far added another
  reader. The robust design is to let Clerk carry the destination.

## 2. What to build

### A. Thread the consent URL through Clerk, not storage (SSO path)

In `frontend/components/AuthGate.tsx` `handleOAuth`:

```ts
const resumeTarget = normalizeOAuthRedirectUrl(
  new URLSearchParams(window.location.search).get('redirect_url')
  || sessionStorage.getItem('fodda.pendingOAuthRedirect')
);
const callback = resumeTarget
  ? `${window.location.origin}/sso-callback?redirect_url=${encodeURIComponent(resumeTarget)}`
  : `${window.location.origin}/sso-callback`;
await signIn.sso({ strategy: provider, redirectUrl: resumeTarget ?? '/', redirectCallbackUrl: callback });
// same for signUp.sso
```

Why: in clerk-js 6.30.1 `sso()` maps `redirectUrl` → `actionCompleteRedirectUrl` (Clerk's own
"where to land when the attempt completes") and `redirectCallbackUrl` → the callback page. Today
both are `/sso-callback`, so Clerk has no idea where the user was going. Putting the target in
the callback URL's own query means `/sso-callback` can recover it from `location.search` with no
storage at all, in any browser mode, and Clerk's `RedirectUrls` also reads `redirect_url` from
that page's query as its second-priority source.

In `frontend/components/SsoCallbackPage.tsx`:
- `resumeTarget = normalizeOAuthRedirectUrl(params.get('redirect_url')) ?? storage fallback`.
- Keep `signInForceRedirectUrl` / `signUpForceRedirectUrl` = `resumeTarget`. Drop
  `continueSignUpUrl={resumeTarget}` — a `missing_requirements` sign-up sent to `/oauth-consent`
  renders the signed-out gate with a half-created sign-up behind it; leave Clerk's default.
- **Never clear the pending keys on this page.** Clerk navigates; the consent page clears.

### B. Storage hygiene (both storages)

- Write a companion timestamp `fodda.pendingOAuthRedirectAt`; treat any key older than 15 minutes
  as absent (readers: `App.tsx` resume effect, `AuthGate` `hasRedirectUrl` + OTP handlers,
  `SsoCallbackPage`, `OAuthConsentPage`). Today an abandoned connector attempt leaves a
  localStorage key forever: the next ordinary sign-in on that browser shows the "Claude is
  requesting access" screen and then bounces to a consent page whose `state`/PKCE Claude will
  reject.
- Clear every pending key (both storages) in `OAuthConsentPage` once `clerkUserId` is present —
  that is the only place that knows the resume succeeded.
- Put the four key names in one `shared/oauthResumeStorage.ts` helper (`read`, `write`, `clear`)
  and make all components use it; no component may name the keys inline.

### C. Guard app effects that run on `/oauth-consent`

`App.tsx` renders `<OAuthConsentPage />` at the bottom, but every hook above it still runs:
- Billing deep-link effect (~line 528, `view/action/tab/plan` from URL *or stale localStorage*)
  ends with `history.replaceState(pathname)` — on `/oauth-consent` that strips `client_id`,
  `scope`, `redirect_uri` and the consent component has nothing to render.
- Auto-checkout (~line 708) redirects to Stripe when `fodda.pendingPlanCode` is set and the URL
  has no `redirect_url` — the consent URL never has one.
Both must early-return when `pathname` is `/oauth-consent` or `/sso-callback`.

### D. Pin the Clerk runtime the app is actually tested against

`<ClerkProvider clerkJSVersion="6.30.1">` (verify the exact prop name in `@clerk/react` 6.7.2).
Bump deliberately, with the live e2e, never implicitly. Record the pinned version in
`.agents/rules/connector-oauth-flow.md`.

### E. Detect drift before users do

`scripts/oauth-smoke.mjs` additions (fail closed, Slack alert as today):
1. `display_config.oauth_consent_url === 'https://app.fodda.ai/oauth-consent'` and
   `sign_in_url === 'https://app.fodda.ai'` from `GET https://clerk.fodda.ai/v1/environment`.
2. `GET https://app.fodda.ai/oauth-consent` → `referrer-policy: strict-origin-when-cross-origin`
   and CSP `form-action` containing `https://clerk.fodda.ai`.
3. Signed-out authorize chain: register a throwaway DCR client (or reuse `9RijQGa1nndtlWlV`),
   follow `/oauth/authorize` → `/oauth/authorize/continue` → assert the final `Location` is
   `app.fodda.ai` with a `redirect_url` whose host is `app.fodda.ai` and path `/oauth-consent`.
   Never sign in, never exchange a code.
`scripts/oauth-preflight.mjs` additions: `SsoCallbackPage.tsx` must contain
`signInForceRedirectUrl`; `server/index.ts` must contain `formAction` with `clerk.fodda.ai` and
`referrerPolicy`; `App.tsx` billing/auto-checkout effects must contain the `/oauth-consent` guard.

### F. Branch and deploy hygiene

1. Fast-forward `main` to `fix/graph-trials-canonical-mcp-url` (no divergent commits exist on
   `main`; verified `git log HEAD..main` is empty) and push `origin main`. Piers's call — flag,
   do not do it silently.
2. `deploy_gcp.sh`: refuse to deploy unless `git merge-base --is-ancestor 3c176c1 HEAD` succeeds
   and the working tree is clean; print the commit being deployed. Remove or mark the three
   detached `.claude/worktrees/*` so nobody deploys from them.
3. Update `.agents/workflows/deploy.md` to match reality (deploy from the branch that carries
   the OAuth commits until `main` is fast-forwarded).

### G. Rule file

Append to `.agents/rules/connector-oauth-flow.md`: links 7–10 (normalization; Clerk-native
threading + never clear keys before Clerk navigates; CSP `form-action` + `Referrer-Policy`
header; pinned clerk-js version and the fact that Clerk's CDN otherwise auto-updates), and a
line under verification: **test as a brand-new user in a fresh browser profile — a reconnect by
an already-authorized account can skip the consent step and proves nothing.**

## 3. Where to register

- `CHANGELOG.md` entry with the rev and the live e2e result (LinkedIn *and* email code, fresh user).
- `.agents/rules/connector-oauth-flow.md` per §2G.
- `.agents/workflows/deploy.md` per §2F.

## 4. Definition of Done

1. Fresh browser profile, brand-new email: Claude connector → LinkedIn → `/oauth-consent` Allow →
   Claude shows Connected. Network tab shows `POST clerk.fodda.ai/v1/me/oauth/consent/…` → 302
   to `claude.ai/api/mcp/auth_callback`.
2. Same with email code.
3. With DevTools → Application → Storage cleared *after* step 1 of the flow (simulating an
   abandoned attempt older than 15 min), an ordinary sign-in lands on the dashboard, not the
   connector screen.
4. `npm run preflight` and `npm run smoke:oauth` green with the new checks; deliberately
   breaking each new check (e.g. `override_consent_url`) turns it red.
5. `deploy_gcp.sh` refuses to run from a detached worktree at `e62f1df`.

## 5. Do Not

- Do not add another storage key or another reader outside `shared/oauthResumeStorage.ts`.
- Do not reintroduce navigation to `accounts.fodda.ai/*` anywhere.
- Do not claim the flow works from a build or a reconnect by Piers's own account.
- Do not touch Clerk dashboard settings from code; dashboard changes stay Piers's manual step and
  are *detected* by the smoke check, not made by it.

## 6. Files changed (expected)

`frontend/components/AuthGate.tsx`, `frontend/components/SsoCallbackPage.tsx`,
`frontend/components/OAuthConsentPage.tsx`, `frontend/App.tsx`, `shared/oauthResumeStorage.ts` (new),
`shared/redirectAllowlist.ts`, `scripts/oauth-smoke.mjs`, `scripts/oauth-preflight.mjs`,
`deploy_gcp.sh`, `.agents/workflows/deploy.md`, `.agents/rules/connector-oauth-flow.md`,
`CHANGELOG.md`.
