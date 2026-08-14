# Brief — Fix Claude-connector OAuth detour through app home page

**Repo:** Fodda (app.fodda.ai dashboard) · **Execution:** `/build-from-brief briefs/brief_connector_oauth_resume_fix.md`

## Context

During the Arthur Soleimanpour onboarding walkthrough (2026-08-10, Fireflies `01KZP85ZR8186BEPW6K9GCPS3E`), the Claude Web connector flow repeatedly failed with "You started connecting Fodda but didn't finish," forcing a delete-and-retry and a second sign-in.

Verified root causes:

1. **Clerk instance config** (manual, see final section): `sign_in_url`, `after_sign_in_url`, and `home_url` are all `https://app.fodda.ai` (confirmed live via `clerk.fodda.ai/v1/environment`). Any user clicking Connect in Claude without an active Clerk session in that browser is detoured to the full app home page.
2. **Code bug — the OAuth resume param is destroyed.** Clerk appends `?redirect_url=<oauth continue URL>` when redirecting to the sign-in page. `frontend/App.tsx` (~line 468) correctly resumes it after unlock. But if the user signs in via a social provider, `frontend/components/SsoCallbackPage.tsx` (lines 43 and 88) does `window.location.replace('/')`, dropping the query string. The connector consent flow dies and the user is stranded on the app home page.
3. **Resume is gated on full app unlock.** The `redirect_url` resume effect in `App.tsx` fires only when `isUnlocked` is true. `SsoCallbackPage` blocks on company + job title + apiUse before that. A connector-consent visitor only needs a Clerk session — the profile wizard should not stand between them and the Allow page.

## What to build

1. **Preserve `redirect_url` through the social-OAuth round trip.** In `AuthGate.tsx`'s `handleOAuth`, before calling Clerk's redirect, stash the current page's `redirect_url` query param (if present) in `sessionStorage` (e.g. `fodda.pendingOAuthResume`). In `SsoCallbackPage.tsx`, on completion, read the stash and `window.location.replace('/?redirect_url=' + encodeURIComponent(value))` instead of bare `/`, then clear the stash. Keep the existing hostname allowlist validation in `App.tsx` as the single validation point (`fodda.ai`, `clerk.fodda.ai`, `clerk.com` suffixes).
2. **Fast-path the resume for connector consent.** When a valid `redirect_url` is pending and the Clerk session is active, resume immediately — do not gate on the app profile being complete. Concretely: in `SsoCallbackPage`, if the stash exists, skip the company/job-title form entirely and bounce back with the param; in `App.tsx`, allow the resume effect to fire on Clerk-authenticated state rather than `isUnlocked` when the target host is `clerk.fodda.ai` (an OAuth continue URL, not an app deep link).
3. **Keep the detour visually minimal.** No new screens required — the effect of 1+2 is: sign-in screen → immediate bounce to Clerk Allow → back to Claude. The user should never see the dashboard mid-flow.

## Where to register

No new routes, tools, or schemas. Changed behavior lives entirely in the existing auth components.

## Definition of Done

- Fresh incognito browser, no Clerk session: claude.ai → Settings → Connectors → Fodda → Connect → detour to app sign-in → sign in with Google or LinkedIn → **lands on the Clerk Allow page without any manual navigation** → Allow → back in Claude with the connector Connected. One pass, no retry.
- Same E2E via the email-OTP sign-in path (no page navigation happens; confirm the existing resume path still works).
- Existing behavior preserved: `pendingPlanCode` auto-checkout still suppressed while `redirect_url` is present (`App.tsx` ~line 679); plain sign-ins with no `redirect_url` land on the dashboard as today.
- State a real verification result in `CHANGELOG.md` (which browsers/paths were actually walked).

## Do Not

- Do not attempt to change Clerk instance settings from code — the dashboard change below is Piers's manual step.
- Do not touch the Clerk webhook / user-provisioning path (`user.created` → Airtable) — out of scope.
- Do not loosen the `redirect_url` hostname allowlist; open redirect must remain impossible.
- Do not test with any real user or prospect account.

## Files-changed (expected)

- `frontend/components/SsoCallbackPage.tsx`
- `frontend/components/AuthGate.tsx`
- `frontend/App.tsx`
- `CHANGELOG.md`

---

**Manual step for Piers (flagged, not for the agent):** in the Clerk dashboard, consider pointing the instance **sign-in URL** at a lighter surface than the full app home so the detour page is a plain sign-in rather than the dashboard. The code fix above makes the detour brief either way; this config change is cosmetic polish on top.
