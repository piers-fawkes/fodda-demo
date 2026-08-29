# Brief — OAuth-flow preflight tests + deploy gate with Slack fail alerts (Layers 2 & 3)

> Owning repo: Fodda App. Execute with `/build-from-brief briefs/oauth-flow-preflight-guards.md`.
> Companion: API repo `briefs/oauth-flow-weekly-probe.md` (Layer 4 weekly monitor).

## Context

The Claude-connector OAuth flow (see `.agents/rules/connector-oauth-flow.md` — read it first)
broke twice in one week from changes that a build could not catch. Decision from Piers
2026-08-27: mechanical guards that (a) block a bad deploy, and (b) notify the **#fodda-sales
Slack channel** on any failure. The app server already posts to #fodda-sales (the
"New confirmed signup" lane in `server/routers/webhookRouter.ts`) — reuse that mechanism/token.

## What to build

1. **Preflight test suite** (`scripts/oauth-preflight.mjs` or similar, runnable via
   `npm run preflight`), all failures aggregated and reported, non-zero exit on any:
   - Source guards: zero occurrences of `emailLink` / `sendEmailLink` /
     `prepareEmailAddressVerification` / `prepareFirstFactor` in `frontend/` (legacy or
     link-based Clerk calls must not return); no inline redirect host checks
     (`endsWith('fodda.ai')` etc.) outside `shared/redirectAllowlist.ts`.
   - Allowlist behavior tests: `isValidRedirectUrl` rejects `https://evilfodda.ai`,
     `https://notclerk.com`, `//evil.com`, `/\evil.com`, `javascript:alert(1)`; accepts
     `/dashboard`, `https://app.fodda.ai/x`, `https://clerk.fodda.ai/oauth/x`,
     `https://accounts.fodda.ai/oauth-consent`. `isInternalAppUrl` false for every non-app host.
   - Route wiring: the `/oauth-consent` route exists and renders `OAuthConsentPage` (static
     check on the router/App wiring is sufficient).
2. **Deploy gate:** the deploy script (however app deploys are invoked) must run `npm run
   preflight` BEFORE building/deploying and abort on failure.
3. **Post-deploy smoke** appended to the same deploy script after the revision goes live:
   - `GET https://app.fodda.ai/oauth-consent` → 200 AND the served bundle contains an
     OAuthConsent marker;
   - `GET https://app.fodda.ai/` → 200;
   - `GET https://clerk.fodda.ai/v1/environment` → email verifications AND first_factors are
     exactly `['email_code']`.
   Any smoke failure: loud non-zero exit AND a Slack message.
4. **Slack fail alert** (both gate and smoke): post to #fodda-sales via the same bot
   token/channel the webhook signup lane uses, message like
   `🛑 OAuth-flow guard FAILED (<preflight|smoke>) on deploy of <commit>: <first failing check>`.
   If the deploy environment lacks the Slack token, print an unmissable console banner instead —
   never fail silently, and never skip the deploy abort.

## Where to register

Add `preflight` to package.json scripts; wire into the existing deploy entrypoint. Nothing else.

## Definition of Done

- `npm run preflight` passes on current main; deliberately reintroducing `emailLink` in a scratch
  branch makes it fail and (with token present) posts the Slack alert — demonstrate both, then
  revert the scratch change.
- A real deploy runs gate → deploy → smoke green end-to-end; CHANGELOG.md records the actual
  verification output.

## Do Not

- Do not modify any runtime auth code — this brief adds guards only.
- Do not post test alerts repeatedly to #fodda-sales; one demonstration failure post is enough.
- Do not make the smoke step sign in or complete an OAuth grant — unauthenticated checks only.
