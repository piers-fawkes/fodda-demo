# Brief: Handle Legacy Trial Key Retirement in MCP

**Date**: 2026-06-03  
**From**: Fodda App API  
**To**: Fodda MCP Agent  
**Priority**: High — this is live in production now

---

## Context

Old-style `sk_trial_*` keys (e.g. `sk_trial_retail`, `sk_trial_all`) are now **blocked globally** by the Fodda App API middleware. The API returns a 403 with a new error code `LEGACY_TRIAL_RETIRED` instead of processing the request.

## What the API returns

All three scenarios return `403` with `code: "LEGACY_TRIAL_RETIRED"`:

### 1. Legacy key + email (new user → auto-provisioned)
```json
{
  "ok": false,
  "error": "Legacy trial keys have been retired. We've set up a free Base account for you with 100 API calls/month. Check your email to confirm your account and get your new API key.",
  "code": "LEGACY_TRIAL_RETIRED",
  "signupUrl": "https://app.fodda.ai"
}
```
An onboarding email with confirmation link + new MCP URLs has been sent automatically.

### 2. Legacy key + email (existing user)
```json
{
  "ok": false,
  "error": "Legacy trial keys have been retired. You already have a Fodda account — log in at app.fodda.ai to find your API key.",
  "code": "LEGACY_TRIAL_RETIRED",
  "signupUrl": "https://app.fodda.ai"
}
```

### 3. Legacy key + no email
```json
{
  "ok": false,
  "error": "Legacy trial keys are no longer supported. Sign up for a free Base account at app.fodda.ai to get 100 API calls/month.",
  "code": "LEGACY_TRIAL_RETIRED",
  "signupUrl": "https://app.fodda.ai"
}
```

## What the MCP should do

1. **Catch `LEGACY_TRIAL_RETIRED`** in error handling (likely in `errorHandling.ts`)
2. **Surface the `error` message directly** to the user as a human-readable MCP response — do NOT show a generic "tool failed" or "invalid API key" message
3. If `signupUrl` is present, include it in the response so the user can click through
4. **Do NOT** attempt the old `/api/account/trial-convert` flow for `sk_trial_` keys — the API middleware now handles provisioning automatically when an email is present
5. If the MCP has the user's email (via `user_id` query param), make sure it's being passed to the API as `X-User-Id` header or in the request body so the auto-provisioning can kick in

## Key detail

The email/userId is extracted from these sources (checked in order):
- `X-User-Id` header
- `userId` in request body
- `user_id` in request body
- `user_id` query parameter
- `userId` query parameter

The MCP already passes `user_id` as a query param to the Fodda API in MCP URLs (`https://mcp.fodda.ai/mcp?api_key=...&user_id=...`). Ensure this is also forwarded as a header or body param when calling Fodda App API endpoints.
