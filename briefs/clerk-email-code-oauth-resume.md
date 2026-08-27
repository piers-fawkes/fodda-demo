# Brief — Clerk email-code sign-in + OAuth redirect preservation (P0)

> Owning repo: Fodda App (app.fodda.ai). Execute with `/build-from-brief briefs/clerk-email-code-oauth-resume.md`.
> Companion brief in Fodda API repo: `briefs/clerk-resolve-account-fork-fix.md`.

## Context

Confirmed 2026-08-26 (multi-agent investigation, adversarially verified against Victor Lee's
actual email thread and the live Clerk instance config): users who sign in/up by **email magic
link** during the Claude-connector OAuth flow get stranded on app.fodda.ai instead of returning
to Claude. Mechanism:

- Clerk instance: `sign_in_url` / `after_sign_in_url` / `after_sign_up_url` / `home_url` all =
  `https://app.fodda.ai`; `attack_protection.email_link.require_same_client = false`.
- The emailed link only carries the OAuth continue URL if `?redirect_url=` is still in
  `window.location.search` when the link is sent (`AuthGate.tsx:361-364`, `409-412`, `489-492`),
  and three code paths strip it first: AuthGate mount `replaceState('/')` (`AuthGate.tsx:~297`,
  fires on `?email=`/`/register`/`?signup=true`/`?plan=`), the `__clerk_ticket` cleanup
  (`AuthGate.tsx:~184`), and the App.tsx billing deep-link strip (`App.tsx:~517-576`, which stale
  localStorage keys `fodda.pendingView`/`fodda.pendingBillingAction`/etc. can trigger).
- The clicked email tab (often the OS default browser, a different context from the tab Claude
  opened) lands on bare `app.fodda.ai/` → the resume effect (`App.tsx:468-501`) has no
  `redirect_url` → user stays on the dashboard; the Claude OAuth transaction is orphaned.

**URGENT sequencing state:** on 2026-08-26 the Clerk dashboard "Sign-in with email → Email
verification link" toggle was turned OFF (live: `first_factors = ['email_code']`). AuthGate has
NO email-code path — `signIn.emailLink.sendLink` (`AuthGate.tsx:413`) is now rejected by Clerk,
so returning-user email sign-in is broken until either this brief ships or the toggle is
reverted. Sign-up verification still permits links (both checkboxes on in the dashboard), so
sign-up works but still strands.

## What to build

1. **Email-code (OTP) flows in AuthGate**, replacing magic links:
   - Sign-up: `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })` →
     6-digit code input → `signUp.attemptEmailAddressVerification({ code })`.
   - Sign-in: `signIn.create({ identifier })` → `prepareFirstFactor` with `email_code` (use the
     `emailAddressId` from `supportedFirstFactors`) → `attemptFirstFactor({ strategy: 'email_code', code })`.
   - Replace the resend handlers (`AuthGate.tsx:489-509`) with code re-send; keep copy in the
     existing voice ("We've emailed a 6-digit code to …").
   - Because the code is entered in the SAME tab, the OAuth `redirect_url` context survives by
     construction — this is the core fix.
2. **Persist the OAuth continue URL durably.** On first render, before ANY URL cleanup runs,
   capture `?redirect_url=` (same fodda.ai/clerk.com allowlist as `App.tsx:472-497`) into
   `sessionStorage` (e.g. `fodda.pendingOAuthRedirect`). The resume effect in App.tsx falls back
   to that stored value when the query param is gone. Audit the three stripping paths above so
   none of them can destroy the pending redirect before it is stored.
3. **Make `GET /api/auth/confirm` OAuth-aware** (`server/routers/authRouter.ts:~427-439`):
   accept an optional signed/allowlisted `redirect` param instead of always 302-ing to the
   hardcoded `https://app.fodda.ai/dashboard|/sandbox`. Secondary hardening — same email-out-of-
   context class, not the core mechanism.

## Where to register

Nothing new to register. Deploy the app per its normal pipeline.

## Definition of Done

- With the live Clerk config as-is (`first_factors=['email_code']`): an existing user signs in
  on app.fodda.ai with an emailed code; a new user signs up with a code. No emailLink calls remain
  reachable.
- End-to-end connector test: start OAuth from Claude → sign up/in with the code in the same tab →
  land back on Claude's consent/callback (not the dashboard). Repeat once with a URL that carried
  `?email=` params (the replaceState path) to prove `redirect_url` survives via storage.
- After deploy + verification, hand back to Piers for the manual Clerk dashboard step: Sign-in
  "Email verification link" OFF (already done) and Verify-at-sign-up "Email verification link"
  UNCHECKED (code only), then re-run the e2e test.
- CHANGELOG.md updated with the real verification result (which flows were exercised, live).

## Do Not

- Do not re-enable or reintroduce magic-link calls, even as a fallback branch.
- Do not touch the SSO (Google/GitHub/LinkedIn) flows or `SsoCallbackPage` resume logic beyond
  the storage fallback in (2).
- Do not attempt to change Clerk dashboard settings from code; dashboard toggles are Piers's
  manual step, in the order above.
- Do not remove the 2026-08-14 redirect_url threading — build on it.

## Files-changed (expected)

- `frontend/components/AuthGate.tsx` — email-code sign-in/sign-up/resend; redirect_url capture-to-storage
- `frontend/App.tsx` — resume effect storage fallback; billing-strip preservation
- `server/routers/authRouter.ts` — OAuth-aware `/api/auth/confirm`
- `CHANGELOG.md`

---

## Review addendum (2026-08-26) — FIX BEFORE COMMIT/DEPLOY

An adversarial review of the working-tree implementation found 3 blockers + 2 majors. Do not
commit or deploy until these are fixed; re-verify each with the checks noted.

**Blocker 1 — sign-in uses legacy Clerk methods that don't exist on this SDK's resource.**
`useSignIn()` in the installed `@clerk/react` 6.7.2 returns `SignInFutureResource`, which has NO
`supportedFirstFactors` / `prepareFirstFactor` / `attemptFirstFactor` (the `as any[]` cast hid
this from the build). Every email sign-in dead-ends or throws. Use the Future API:
`signIn.emailCode.sendCode()` then `signIn.emailCode.verifyCode({ code })`. `signIn.finalize()`
is valid and correctly gated — keep it. (`AuthGate.tsx:380-390, 439-441, 476-482`)

**Blocker 2 — sign-up same class of bug.** `SignUpFutureResource` has no
`prepareEmailAddressVerification` / `attemptEmailAddressVerification`; use
`signUp.verifications.sendEmailCode()` / `verifyEmailCode({ code })`. As written, every new
sign-up throws right after `signUp.create`. (`AuthGate.tsx:343, 423, 468`)

**Blocker 3 — /api/auth/confirm open redirect + login-token exfiltration.** The new redirect
branch appends the minted 15-min `loginToken` to the redirect target, and the allowlist is
`host.endsWith('fodda.ai')` (so `https://evilfodda.ai` passes) plus a bare `startsWith('/')`
(so protocol-relative `//evil.com` passes). Fix: dot-anchored host match
(`host === 'fodda.ai' || host.endsWith('.fodda.ai')`, same for clerk.com), reject paths starting
`//`, and never append `loginToken` to any target that isn't an exact-match internal path.
(`server/routers/authRouter.ts:426-445`)

**Major — the same `endsWith` flaw is copy-pasted in the client allowlists** (App.tsx module
top ~10-23, AuthGate mount ~64-79, resume effect) → durable post-auth open redirect via
`?redirect_url=https://evilfodda.ai/...` stored in sessionStorage. Extract ONE shared
dot-anchored allowlist helper and use it everywhere.

**Major — already-sent magic links dead-end silently after deploy.** The
`__clerk_db_jwt`/`__clerk_status` handler was deleted; when those params are present, show a
notice ("Email link sign-in has been replaced — request a 6-digit code") instead of a bare form.

**Minor:** clear `fodda.pendingOAuthRedirect` on abandon/resetState (stale value forces the
consent-variant login screen and a stale bounce later in the tab session); after a successful
`verifyCode` + `finalize`, navigate explicitly rather than relying on auth-state re-render.

Re-verification for DoD additionally requires: a REAL email-code sign-in and sign-up executed in
a browser (not just a build), and negative tests that `https://evilfodda.ai` and `//evil.com`
are rejected by both server and client allowlists.
