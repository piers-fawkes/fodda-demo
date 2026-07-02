# Brief: Automated Emails & Sales Notifications

## Context

The Fodda app sends automated emails to users from `team@fodda.ai` (via Resend). These emails are signed **"Team Fodda"** — not from any individual person. Sales should be aware these are going out because users may reply, and sales needs to know what was said.

The emails introduce themselves as **"an intelligent agent"** helping users — not as a human salesperson.

---

## All Automated Emails

### Onboarding Emails (signup flow)

| Email | When | Subject | Notes |
|-------|------|---------|-------|
| **Signup Confirmation** | Immediately on registration | Varies by intent (e.g. "Your Fodda API key — confirm your email to activate") | Says "I'm an intelligent agent helping our founder, Piers Fawkes, onboard new users." Includes API key, MCP URLs, Claude one-click link. |
| **Legacy Migration** | When a user with an expired trial key hits the API | "Your Fodda account has been upgraded" | Auto-provisions a free Base account. Says "Your previous trial key no longer works so I took the opportunity to set you up on a free base account." Includes new MCP URLs. |
| **Agent Payment Nudge** | 30 minutes after first login | "Quick tip — set up payment so your agent never stops" | Nudges user to add a payment method. Three options: Credit Card (one-click Stripe link), Lava PAYG wallet, subscription plans. Mentions SPT auth. |
| **Onboarding Prompts** | ~5 min after email confirmation | No fixed subject | Sends curated prompts based on the user's vertical and buyer type. |
| **Developer Onboarding** | ~5 min after email confirmation (for AI Startup/Developer type) | — | Developer-specific setup guide with API key. |

### Usage & Billing Emails

| Email | When | Subject | Notes |
|-------|------|---------|-------|
| **Plan Limit Warning** | Account hits 80% of monthly API call limit | "You're approaching your included API calls" | Tells user their plan, usage, and limit. Links to pricing page. If no card on file, includes one-click Stripe setup link. |
| **Overage Activated** | First query beyond the limit (card on file) | "Your Fodda overage billing is now active" | Tells user overage is $0.20/API call. Suggests upgrading for better per-call rate. |
| **Overage Payment Failed** | Stripe charge fails on overage invoice | "Your Fodda overage payment failed" | Warns card may be expired. Links to billing page. 7-day grace period. |

### Other Emails

| Email | When | Notes |
|-------|------|-------|
| **New User Joined** | A team member joins via signup code | Sent to account admins/owners |
| **Plan Upgraded** | Stripe checkout completes for a plan upgrade | Confirmation with new plan details |
| **Subscription Cancelled** | User cancels subscription | Confirmation with end-of-period note |
| **Top-Up Confirmed** | Agent checkout session completes ($50 for 200 API calls) | Sent to the buyer |

---

## Slack Notifications to #fodda-sales

Three events post to `#fodda-sales` so you can spot opportunities:

### 1. Usage at 80% — Upgrade Signal
```
📊 *Usage Alert*: {accountName} ({ownerEmail}) is at 80% of their monthly limit ({used}/{limit} API calls).
Plan: {planName} • Vertical: {vertical}
→ Potential upgrade candidate
```

### 2. Overage Activated — Hot Sales Signal
```
💰 *Overage Active*: {accountName} ({ownerEmail}) has exceeded their {limit} API call limit and is now being charged $0.20/API call overage.
Plan: {planName} • Current overage: {overageTokens} API calls • Est. charge: ${overageTokens * 0.20}
→ Upgrade would save them money — reach out
```

### 3. Payment Failed — Churn Risk
```
⚠️ *Payment Failed*: {accountName} ({ownerEmail}) — overage charge of {amount} failed.
→ Card may be expired. Risk of losing this account.
```

---

## How to Handle User Replies

Users may reply to any of these emails. Here's what to do:

### 1. Look Up Their Account
- **Airtable** → `Accounts` table
- Key fields: `planName`, `planCode`, `queriesUsedThisCycle`, `monthlyQueryLimit`, `overageTokensThisCycle`, `hasPaymentMethod`, `overageEnabled`

### 2. Understand Their Situation
- If they're hitting 80%+ consistently or paying overage, they'd save money upgrading
- Compare: overage cost (`overageTokensThisCycle × $0.20`) vs next plan's monthly price
- Check if they have a payment method on file (`hasPaymentMethod`)

### 3. Direct Them To
- **Pricing page**: https://www.fodda.ai/pricing
- **Add payment / billing**: https://app.fodda.ai?view=billing
- **Plans modal in-app**: Tell them to click "Plans & Pricing" in the app

### 4. "WTF" Replies
The legacy migration and signup emails tell users they can reply with **"WTF"** if they don't want to use Fodda. If you see a WTF reply:
- Remove them from automated email lists
- Optionally delete their Airtable record if they insist
- Don't take it personally — the email invited this response

### 5. Tone
Helpful, not pushy. The emails are designed to feel advisory, like an intelligent assistant — not a salesperson. Mirror that tone in any replies. The system uses "Team Fodda" sign-off, not an individual name.

---

## Key Terminology

Standardized across all emails:
- **"API call"** (not "token" or "query" in billing context)
- **"included API calls"** (not "limit" or "max")
- **"Team Fodda"** sign-off (not "Piers" — unless it's a personal email)
- Emails say they're from **"an intelligent agent"** — not a human
