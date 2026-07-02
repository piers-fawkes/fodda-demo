# Brief: MCP UX Improvements — Tasks for the App Agent

> **From:** Fodda MCP Agent  
> **Date:** April 15, 2026  
> **Context:** UX audit of the MCP server identified gaps that require changes in the App codebase.

---

## 1. Verify `id` Parameter Tracking

**Priority:** High  
**Context:** Trial MCP links include an `id` query parameter (e.g., `?api_key=sk_trial_all&id=linkedin_buddy` or `?api_key=sk_trial_all&id=natasha@anomaly.com`). The MCP server now reads this and:
- Uses email-shaped IDs as `userId` for automatic tracking and seamless signup
- Passes non-email IDs as tracking context

**Task:** Confirm that the App or API code still uses the `id` parameter to attribute queries to their source. Specifically:
- Does the query tracking in Airtable (Trials table `tblKZ7VRjGrcZkw7B`) record the `id` or `sourceGraphId`?
- When an email-based `id` is used, does it correctly associate the session with the user's account?
- If this tracking has drifted, re-implement it so usage can be attributed by entry source.

---

## 2. Add Deep Linking Support

**Priority:** Medium  
**Context:** The MCP system prompt currently points users to generic `app.fodda.ai` for all account actions. Ideal would be deep links to specific pages:
- `app.fodda.ai/account/settings` — for account/graph management
- `app.fodda.ai/account/top-up` — for purchasing more tokens

**Task:** If these routes don't exist, add them. If they do, confirm the exact URLs so the MCP system prompt can be updated.

---

## 3. Add "Delete Account" Functionality

**Priority:** Low (backlog)  
**Context:** Currently there is no way for a user to delete their account. The MCP now has basic offboarding guidance (point to app.fodda.ai), but there's no actual deletion flow.

**Task:** Add a "Delete my account" option in the App's account settings. This should:
- Confirm with the user before proceeding
- Delete or anonymize their data in Airtable
- Revoke their API key
- Send a confirmation email

---

## 4. `get_my_account` API Endpoint

**Priority:** High  
**Context:** MCP users currently can't check their token balance, plan info, or graph access without leaving the conversation. The MCP already fetches `/v1/graphs` at session init, which returns some account data via `_account`.

**Task:** Ensure the `/v1/graphs` response includes these fields in the `_account` object (or create a dedicated `/v1/account/status` endpoint):
- `plan` (e.g., "Base", "Pro")
- `tokens_remaining` (current month)
- `tokens_total` (monthly limit)
- `graphs_enabled` (list of graph IDs)
- `graphs_disabled` (list of graph IDs)
- `profile` (name, company, job title)
- `reset_date` (when the monthly token balance resets)

Once this is available, the MCP will add a `get_my_account` tool that surfaces this data in-conversation.
