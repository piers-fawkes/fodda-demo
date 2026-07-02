# Brief: Surface Agent Checkout Link on Credit Exhaustion

**Priority:** High — Part of Phase 3 Agentic Payments  
**Date:** 2026-05-03  
**Author:** App Agent (via Piers)

---

## Context

When a user exhausts their credits or trial tokens while using Fodda via the MCP server, they currently get an error message with a URL to visit. This brief adds inline Stripe Checkout support so the user can buy more tokens directly from within their IDE/chat.

The Fodda App now has a new endpoint that creates Stripe Checkout Sessions on the fly:

```
POST https://app.fodda.ai/api/account/checkout/agent-session
```

And the Core API's `CREDITS_EXHAUSTED` response will soon include an `agent_checkout` block with this URL (see the Core API brief).

---

## What Needs to Change in the MCP Server

### 1. Detect credit exhaustion in tool responses

When any Fodda API tool call returns a `403` with `error: "CREDITS_EXHAUSTED"` or `"TRIAL_LIMIT_EXCEEDED"`, the MCP server should:

1. **Extract** the `agent_checkout` block from the API response (if present)
2. **Call** `POST https://app.fodda.ai/api/account/checkout/agent-session` with the user's email (if available) and `source: 'mcp'`
3. **Return** a user-friendly message with the checkout link

### 2. Format the user-facing message

Instead of just returning the raw error, format a helpful response:

```
⚡ You've used all your Fodda credits this cycle.

🛒 **Buy 100 more tokens →** [Click here to checkout](https://checkout.stripe.com/c/pay/cs_live_...)

This opens a secure Stripe Checkout page. After payment, your credits will be available immediately.

Alternatively, you can upgrade your plan at https://app.fodda.ai
```

### 3. Handle the no-email case

The MCP server may or may not have the user's email at this point:

- **Has email** (user already authenticated via API key → account lookup): Pass it in the POST body. Stripe pre-fills the email field.
- **No email** (anonymous trial user): Pass `email: null`. Stripe will collect the email at checkout. Return the checkout link with a note: *"You'll be asked for your email during checkout."*

### 4. Handle the agent_checkout block not being present

If the Core API hasn't been updated yet (the `agent_checkout` field is missing from the response), fall back to the existing behavior:
- Return the `payg.checkoutUrl` from the response (which points to the pricing page or Lava checkout)
- Or return the `signupUrl` for trial users

---

## Email Availability Matrix

| Scenario | Has email? | Action |
|---|---|---|
| Authenticated user (API key) | ✅ Yes (from account) | Pass email to agent-session |
| Trial user (sk_trial_*) | ❌ Usually no | Pass email: null, Stripe collects |
| User who provided email during session | ✅ Yes | Pass email to agent-session |

The MCP should check these sources in order:
1. `account.accountOwner` (from the API key lookup)
2. User's email if captured during the session (e.g., from `trial-convert`)
3. `null` (let Stripe handle it)

---

## Important: Don't Block on This

The MCP should treat the checkout link as **optional enrichment**, not a required step. If the POST to `agent-session` fails (network, timeout, Stripe down), just fall back to the existing error message with the pricing page URL. Never let a checkout failure make the credit exhaustion message worse.

---

## Verification

1. Connect to MCP with a key that has 0 credits remaining
2. Run any tool (e.g., `search_trends`)
3. Should see the checkout link in the response instead of just "credits exhausted"
4. Click the link → Stripe Checkout page opens → complete payment → credits appear
