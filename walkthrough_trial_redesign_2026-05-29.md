# Walkthrough — Fodda Trial System Redesign

This document summarizes the complete implementation and verification of the transition from legacy shared trial keys (e.g. `sk_trial_retail_all`) to **individual Trial accounts** (planCode 13) with unique API keys (`sk_live_...`) and total query limits of 25.

---

## Changes Completed

### 1. Database Setup (Fodda App)
- Executed migration to create the **Trial** plan record in Airtable `PLANS_TABLE`:
  - `planCode`: `"13"`
  - `Monthly API Limit`: `25`
  - `billingMode`: `"one_time"`
  - `Target Audience`: `"New User"`

### 2. Fodda App Backend & Frontend
- **Backend Logic (`server/`)**:
  - [accountTypeService.ts](file:///Users/piersfawkes/Documents/Fodda/server/services/accountTypeService.ts): Updated `detectAccountType` to return `'trial'` for planCode 13.
  - [queryRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/queryRouter.ts): Updated query analytics logs to classify trial account requests as `'trial'` source.
  - [accountRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/accountRouter.ts):
    - Added `POST /api/account/trial-provision` to dynamically create Trial accounts with IP rate-limiting, welcome email, and duplicate-handling. **Optimized to set `emailConfirmed: false` at signup** to deliver the verification link immediately.
    - Added `POST /api/account/convert-to-base` to upgrade Trial users to Base - Free. **Optimized to bypass force-re-verification** if the user already clicked their verification link during their trial period, facilitating friction-free auto-onboarding.
- **Frontend Portal (`frontend/` & `shared/`)**:
  - [dataService.ts](file:///Users/piersfawkes/Documents/Fodda/shared/dataService.ts): Exposed `convertToBase` API method.
  - [UpgradeModal.tsx](file:///Users/piersfawkes/Documents/Fodda/frontend/components/UpgradeModal.tsx): Rendered `ACTIVATE BASE` buttons on planCode 13, permitting immediate self-service upgrades to the free 100-queries/month plan. **Updated UI alert** to dynamically check `alreadyConfirmed` and congratulate pre-verified users.

### 3. Fodda Website integration
- [GraphTemplate.tsx](file:///Users/piersfawkes/Documents/Fodda%20Website/pages/GraphTemplate.tsx): Replaced legacy static trial key setup with dynamic calls to `/api/account/trial-provision`. Developers now see their unique, permanent `sk_live_...` API key and MCP URLs instantly.

### 4. Fodda Sales Bot & Triggers
- [slack_bot.js](file:///Users/piersfawkes/Documents/Fodda%20Sales/slack_bot.js):
  - Updated button actions (`action_formal_note`) and email intent handlers (`brands`, `credentials`) to provision individual trial keys.
  - Enhanced `detectAccountType` to map `planName` to `planCode` as a robust fallback.
- [platform_utils.js](file:///Users/piersfawkes/Documents/Fodda%20Sales/lib/platform_utils.js): Enriched `getUserRecord` to dynamically fetch the linked Account record and merge planCode/subscription details.
- [triggers.js](file:///Users/piersfawkes/Documents/Fodda%20Sales/triggers.js):
  - Updated `trigger5_trialLimit()` to query both legacy `TRIALS_TABLE` and new planCode 13 users (`planName` = `"Trial"` and queries used between 15 and 24).
  - Deduplicates candidates and triggers Waverunner SDR alerts.

### 5. Developer/Agent Briefs
Created three Markdown briefs to guide future development by Website, MCP, and Sales agents:
- [brief_trial_redesign_website.md](file:///Users/piersfawkes/Documents/Fodda%20Sales/briefs/brief_trial_redesign_website.md)
- [brief_trial_redesign_mcp.md](file:///Users/piersfawkes/Documents/Fodda%20Sales/briefs/brief_trial_redesign_mcp.md)
- [brief_trial_redesign_sales.md](file:///Users/piersfawkes/Documents/Fodda%20Sales/briefs/brief_trial_redesign_sales.md)

---

## Audit & Final Verification (May 29, 2026)

Conducted a thorough audit across all four repositories to verify end-to-end integration:

1. **Fodda App (Backend & Frontend Portal)**:
   - **TypeScript Fix**: Resolved a compilation error in [UpgradeModal.tsx](file:///Users/piersfawkes/Documents/Fodda/frontend/components/UpgradeModal.tsx) by declaring the `alreadyConfirmed?: boolean` return field on the `convertToBase` method inside [dataService.ts](file:///Users/piersfawkes/Documents/Fodda/shared/dataService.ts).
   - **CORS Fix**: Added Fodda's primary domains (`https://fodda.ai`, `https://www.fodda.ai`) to `ALLOWED_ORIGINS` in [index.ts](file:///Users/piersfawkes/Documents/Fodda/server/index.ts) to permit the website trial sandbox widget to call `/api/account/trial-provision`.
   - **Deployment**: Successfully redeployed Fodda App to Cloud Run (Revision `fodda-sandbox-00332-kgd`). Health check returned `200`.

2. **Fodda Website**:
   - **Validation**: Verified the refactored self-contained `GraphTrialWidget` builds successfully. Typecheck (`npx tsc --noEmit`) returned 0 errors.
   - **Deployment**: Deployed the website successfully to Cloud Run.

3. **Fodda Sales**:
   - **Validation**: Confirmed trigger query paths are correct. Dry run passed (`node triggers.js --dry --only 5`) without schema warnings.
   - **Deployment**: Deployed Fodda Sales agent bot successfully to Cloud Run.

4. **Fodda MCP**:
   - **Optimization**: Updated [errorHandling.ts](file:///Users/piersfawkes/Documents/Fodda%20MCP/src/errorHandling.ts) to only invoke the legacy `/api/account/trial-convert` endpoint for keys starting with `sk_trial_`. Individual trials are directed straight to the portal, preventing unnecessary failing API requests on trial exhaustion.
   - **Validation**: Both MCP server and VS Code extension type-checked successfully (`npx tsc --noEmit` returned 0 errors).

---

## Bug Fixes & Optimization (May 29, 2026)

Conducted an audit and resolved bugs related to trial provisioning stability and case-sensitivity:

### 1. Welcome Email De-duplication (`suppressEmail`)
- **Backend Optimization**: Modified the `POST /api/account/trial-provision` route in [accountRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/accountRouter.ts) to accept an optional `suppressEmail` boolean in the request body. If `true`, the default system-level signup welcome email is suppressed.
- **Sales Bot Integration**: Updated the [send_friends_family_blast.js](file:///Users/piersfawkes/Documents/Fodda%20Sales/send_friends_family_blast.js) outreach script in Fodda Sales to pass `suppressEmail: true` in its trial provisioning requests, preventing duplicate emails.

### 2. Case-Insensitive Email Lookups
- **Backend Security**: Audited all user lookup operations across the backend and updated them to use case-insensitive queries via Airtable:
  - `LOWER({email}) = '${escapeAirtableString(email.toLowerCase())}'`
- **Updated Router & Helper Files**:
  - [accountRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/accountRouter.ts): Fixed lookups inside `/invite-users`, `/billing-portal`, `/provision-legacy-trial`, `/provision-b2b`, `/delete`, `/partner-invite`, `/admin/lookup`, `/admin/set-plan`, `/trial-provision`, `/convert-to-base`, and Stripe checkouts.
  - [authRouter.ts](file:///Users/piersfawkes/Documents/Fodda/server/routers/authRouter.ts): Fixed lookups inside `/register`, `/join-team`, `/confirm`, `/login`, and `/resend-confirmation`.
  - [helpers.ts](file:///Users/piersfawkes/Documents/Fodda/server/helpers.ts): Fixed lookup inside `autoProvisionUser`.

### 3. API Key Linked-Record Mismatch Fix
- **Root Cause**: Querying `API_KEYS_TABLE` by `{Account} = '${accountId}'` always returned 0 records because Airtable evaluates linked record fields in formulas using the Primary Display Text (Account Name) rather than their record IDs. This caused the endpoint to fall through and create duplicate user and account records for existing users when no active keys were present.
- **Resolution**:
  - Introduced `getActiveKeysForAccount` helper function at the top of `server/routers/accountRouter.ts` to first lookup the Account Name via its ID, and then query the keys by that name.
  - Replaced all direct `{Account} = '${accountId}'` queries in `accountRouter.ts` with calls to this helper.
- **Verification**: Verified that the live endpoint successfully matches the existing user and returns their active key with `alreadyExists: true` for both lowercase and mixed-cased requests, without spawning any duplicate records.

### 4. Verification & Deployment
- **Verification**: Created and executed [scratch/verify_case_sensitivity_fixes.js](file:///Users/piersfawkes/Documents/Fodda/scratch/verify_case_sensitivity_fixes.js) which successfully validated that lookups are case-insensitive and return the same unique user records.
- **Compilation Check**: Verified the backend server compiles cleanly without type errors.
- **Production Deploy**: Successfully built and redeployed the Fodda App to Google Cloud Run (Revision `fodda-sandbox-00338-tmd`). The health check returned `200`.
