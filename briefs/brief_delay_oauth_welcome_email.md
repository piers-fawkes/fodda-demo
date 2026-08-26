# Brief (App Agent) — Delay OAuth Welcome Email by 2 Hours

**Owning repo:** Fodda (App + API monorepo) · **Agent:** `api-agent` / App Agent  
**Created:** 2026-08-26 · **Priority:** P1

---

## 1. Problem & Context
When a user adds Fodda to Claude or signs up via Clerk OAuth, Clerk immediately sends a `user.created` webhook to the backend (`server/routers/webhookRouter.ts`). The webhook handler currently dispatches `sendSystemEmail('OAUTH_WELCOME', ...)` immediately.

This causes a **timing distraction**: the welcome email lands in the user's inbox while they are actively in the middle of authorizing their LLM connector, pulling them into their inbox instead of letting them test their first query in Claude.

By delaying the welcome email by 2 hours, the user can complete their initial LLM workflow uninterrupted. When the email arrives 2 hours later, introducing the web app and additional prompts serves as a natural follow-up rather than a disruption.

---

## 2. Required Changes

### 2.1 Delay `OAUTH_WELCOME` Dispatch by 2 Hours
- In `server/routers/webhookRouter.ts` (inside `provisionUserFromClerk` / `user.created` event):
  - Do not dispatch `sendSystemEmail('OAUTH_WELCOME', ...)` immediately.
  - Delay the email dispatch by **2 hours** (`2 * 60 * 60 * 1000` ms).
  - Keep the existing `OAUTH_WELCOME` template and contents (including the App access section and MCP connection details) intact as the follow-up touchpoint.

---

## 3. Files Expected to Change
- `server/routers/webhookRouter.ts`
- `CHANGELOG.md`

---

## 4. Verification Plan
1. Simulate a Clerk `user.created` webhook call.
2. Verify `OAUTH_WELCOME` is scheduled with a 2-hour delay and not sent immediately on webhook receipt.
3. Confirm template contents remain intact.
