# Brief: Fix New-User Sign-In Dead End + Connector Resume in AuthGate

**Date**: 2026-08-14
**From**: Piers (via Claude Code, Fodda Website session)
**To**: Fodda App Agent
**Priority**: Urgent — live bug blocking every new user who signs up via email, surfaced by real Quick Link onboarding feedback (Lourenço Bustani, 2026-08-14)

---

## Context

The Claude MCP Quick Link flow (`claude.ai/new?modal=add-custom-connector&connectorName=Fodda&...`) sends prospects through Clerk OAuth against `clerk.fodda.ai`, whose sign-in UI is `frontend/components/AuthGate.tsx` on app.fodda.ai. A real prospect hit this today and dead-ended.

Three findings, verified against both source and the deployed bundle (`app.fodda.ai/assets/index-DrFiQsMI.js`):

1. **New-user email flip is dead code (the bug).** `handleSubmit`'s sign-in branch checks `createError.code === 'form_identifier_not_found'` to silently switch unknown emails into the sign-up form (AuthGate.tsx ~line 381). Clerk Core 3's `signIn.create` returns a `ClerkAPIResponseError` whose top-level `.code` is **always the literal `"api_response_error"`** (set in the constructor — see `@clerk/shared` `ClerkAPIResponseError`, which passes `code: "api_response_error"` to the base class). The per-error code lives at `error.errors[0].code`. The check never matches, so every new user who types their email sees **"Errata · Couldn't find your account."** and stops.

2. **Email magic-link path drops the connector redirect.** Both `sendEmailLink` / `emailLink.sendLink` calls hardcode `verificationUrl: ${window.location.origin}/`, discarding the `redirect_url` query param that carries the OAuth-authorize resume back to Claude's connector consent. Email-path users who do sign in land in the app and never return to Claude. (The OAuth path handles this correctly via `fodda.pendingOAuthResume` sessionStorage + the `SsoCallbackPage` fast-path.)

3. **OAuth is the good path but not the prominent one.** OAuth (Google/GitHub/LinkedIn) requires no email verification and resumes the connector handshake correctly — as designed. But the email field is the visually dominant element on AuthGate, which is exactly how the prospect ended up on the broken path.

## What to build

### 1. Fix the error-code check (one-liner, highest priority)

In `handleSubmit`'s sign-in branch, replace the dead check with one that reads the nested code:

```ts
const notFound = createError.code === 'form_identifier_not_found'
  || (createError as any).errors?.[0]?.code === 'form_identifier_not_found';
```

Keep the existing behavior on match: flip `setIsSignUp(true)`, `setStep(1)`, clear the error header. Audit AuthGate for any other `error.code === '...'` comparisons against Clerk per-error codes and fix them the same way (a small `clerkErrorCode(error)` helper is fine).

### 2. Carry `redirect_url` through the email magic-link flow

When AuthGate loads with a `redirect_url` query param (connector OAuth flow), both email-link sends (sign-in and sign-up) must preserve it so the verified session resumes the connector consent, e.g.:

```ts
const redirectUrl = new URLSearchParams(window.location.search).get('redirect_url');
const verificationUrl = redirectUrl
  ? `${window.location.origin}/?redirect_url=${encodeURIComponent(redirectUrl)}`
  : `${window.location.origin}/`;
```

Note the magic link often opens in a different tab/app than the waiting tab, so the resume must work from the **link-click tab** (URL param, not sessionStorage). Verify the email-link verification handler (`handleEmailLinkVerification` effect) preserves the query param through its hard reload — it currently redirects to bare `/`.

### 3. Promote OAuth in the connector context

When AuthGate is rendered with a `redirect_url` (i.e., mid connector OAuth), make the OAuth buttons the hero path and demote the email field, with copy to the effect of: "Fastest: continue with Google — no email confirmation." Exact layout is the builder's call; keep the email path available.

## Where to register

No new routes or registrations. All changes live in existing components: `frontend/components/AuthGate.tsx`, possibly `frontend/components/SsoCallbackPage.tsx` (only if the resume handoff needs it).

## Definition of Done

- [ ] Typing an email with no Fodda account on the sign-in form switches to the registration form — no "Couldn't find your account" dead end. Verify live with a throwaway address.
- [ ] Full connector round-trip via **email path**: start from the Quick Link in Claude → Fodda sign-in → email magic link → land back at Claude's connector consent, on desktop; state clearly in the changelog if the mobile app-switch case still cannot resume (expected Anthropic-side limitation).
- [ ] Full connector round-trip via **Google OAuth** as a brand-new user still works with no email verification step (regression check).
- [ ] Existing-user email sign-in (no connector context) unchanged.
- [ ] `CHANGELOG.md` updated with a real verification result per house rules.

## Do Not

- Do not touch the OAuth `pendingOAuthResume` mechanism except where the DoD requires — it works.
- Do not add an email-verification step to any OAuth path; the agreed rule is OAuth users never confirm email.
- Do not change Clerk dashboard/instance settings as part of this brief.
- Do not redesign AuthGate beyond the connector-context OAuth prominence change.

## Out of scope (noted for context)

The other half of the reported failure is Anthropic-side: a user signed out of Claude on mobile loses the `?modal=add-custom-connector` deep link across Claude's own email sign-in. That is mitigated by website copy/fallback (Fodda Website repo, separate work), not by this brief.

## Files-changed (expected)

- `frontend/components/AuthGate.tsx`
- `frontend/components/SsoCallbackPage.tsx` (only if needed for resume handoff)
- `CHANGELOG.md`
