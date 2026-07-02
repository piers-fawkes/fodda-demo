# Brief: Agent Payment Setup Nudges

## Context

Autonomous agents using API keys or MCP keys can't self-resolve when they hit the plan limit. The fix is to nudge users to set up payment **before** the agent hits the wall.

## 1. In-App Banner on Connections Pages

Add a banner to the Claude, MCP, and API Schema tabs in `AccountPortal.tsx` — shown when `!account.hasPaymentMethod`:

### Copy

> **Have you set up payment options for your agent?**
> When your agent exceeds your included API calls, it needs a payment method to keep running. Choose how to pay:

### Options (3 buttons in a row)

| Option | Label | Action | Style |
|--------|-------|--------|-------|
| Stripe | Add Credit Card | Opens `PaymentSetupModal` (SetupIntent flow) | Primary brand button, credit card icon |
| Lava | Set Up PAYG Wallet | Links to `https://lava.so` with email pre-filled | Lava orange (`#ff5a1f`) outlined button |
| SPT | Learn About SPT Auth | Links to `https://www.fodda.ai/pricing` (agent section) | Ghost/text button |

### Display Logic
- Show on `claude`, `mcp`, and `api` tabs
- Only show when `!account.hasPaymentMethod`
- Dismissible (stores dismiss in localStorage, re-shows next session)
- After card is added, banner disappears and shows a green checkmark: "✓ Payment method active — your agent won't be interrupted"

## 2. Follow-Up Email — 30 Minutes After First Sign-In

### Trigger
When `isFirstLogin === true` (already tracked in auth flow), schedule a delayed email 30 minutes later.

### Implementation Options
- **Option A**: Server-side `setTimeout(30 * 60 * 1000)` in the auth/profile endpoint — simple but lost on container restart
- **Option B**: Write a `scheduledEmailAt` timestamp to Airtable, checked by the existing cron infrastructure — reliable
- **Option C**: Use Resend's scheduled send feature (`send_at` parameter) — cleanest, no server state

### Email Copy

**Subject**: "Quick tip — set up payment so your agent never stops"
**From**: `team@fodda.ai` (Resend, formal transport)

```
Hi {name} — I'm an intelligent agent that helps Fodda users get the most out of the system.

Quick tip now that you're set up: if you're connecting Fodda to an AI agent (Claude, Cursor, or via API), your agent will stop querying when it hits your plan's included API calls.

To prevent interruptions, you can set up a payment method now. Three options:

• Credit Card — add a card and overage kicks in automatically at $0.20 per API call beyond your allocation. One click:
{setupUrl}

• Lava PAYG — give your agent a metered wallet with a fixed monthly cap:
https://lava.so

• SPT Auth — for autonomous agents that need zero-onboarding access:
https://www.fodda.ai/pricing

No action needed if you're just exploring the web app — this only matters for agent/API usage.

Team Fodda
```

## Files to Modify
- `frontend/components/AccountPortal.tsx` — add banner to claude/mcp/api tabs
- `server/routers/authRouter.ts` or `server/routers/webhookRouter.ts` — schedule the 30-min email
- `server/services/emailTemplates.ts` — new `AGENT_PAYMENT_NUDGE` template
