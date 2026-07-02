# Brief: Promote Claude Connector in the Fodda App

**Date:** March 12, 2026
**For:** App Agent (Fodda App codebase at `/Users/piersfawkes/Documents/Fodda`)
**Priority:** High

---

## Context

Anthropic now positions **custom connectors (remote MCP)** as the primary Claude integration for all tiers — Pro, Max, Team, and Enterprise. Connectors are not just consumer — enterprise admins govern them through the Admin Console.

**Our goal:** Make sure the app surfaces the **Connector** prominently and uses the right language, especially for enterprise users.

> [!NOTE]
> Good news: there are **zero Plugin references** in the frontend today. The work here is about strengthening the Connector identity and adding enterprise-specific messaging — not removing anything.

**Reference:** [Anthropic's Custom Connectors Guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

---

## Files to Update

### 1. `Dashboard.tsx` — "Fodda on Claude" section (lines 419–465)

This is the **User Profile** page's connector card in the left column.

**Current state (line 421–422):**
```tsx
<h3>Fodda on Claude</h3>
<p>Add Fodda as Customer Connector at Claude</p>
```

**Recommended changes:**
- Rename header to **"Claude Connector"** (matches the term users see in Claude's UI)
- Update subtitle to: *"Connect Fodda to Claude — works with Pro, Max, Team, and Enterprise"*
- The label "Remote MCP Server URL" (line 435) → rename to **"Connector URL"** in user-facing copy
- Consider adding a one-liner below the "Set Up Now" link for enterprise: *"Enterprise? Ask your workspace admin to add this in Organization Settings → Connectors."*
- The "Set Up Now" link (line 456) currently points to `https://claude.ai/customize/connectors` — update to `https://claude.ai/settings/connectors` (the current Anthropic URL)

---

### 2. `AccountPortal.tsx` — MCP Integration tab (lines 538–841)

This is the full integration hub inside the Account Admin modal.

#### a) Sidebar tab label (line 325)
**Current:** `MCP Integration`
**Recommended:** **`Claude Connector`** — users don't think in "MCP" terms; "Connector" is what they see in Claude.

#### b) Tab header (lines 542–543)
**Current:**
```tsx
<h2>MCP Integration</h2>
<p>Connect Fodda knowledge graphs to Claude, Gemini, OpenAI, and other AI platforms via MCP</p>
```
**Recommended:**
```tsx
<h2>Claude Connector</h2>
<p>Connect Fodda to Claude and other AI platforms — one URL, every tier</p>
```

#### c) Quick Connect sub-tabs (lines 556–560)
Currently: `Claude` | `Enterprise` | `Code (CLI)` | `◆ Gemini`

These are good but consider:
- Rename `Enterprise` → **`Enterprise (Admin)`** to make it clear this is a different setup flow for admins
- The `Claude` tab (lines 579–610) is well done — clear steps, connector URL with copy button, helpful note about key-in-URL. **No changes needed here.**

#### d) Enterprise sub-tab (lines 613–643)
**Current messaging (line 617):** `Claude Enterprise — Admin-Managed Connectors`
**Current subtitle (line 619):** `Your workspace admin registers the Fodda MCP connector via the Admin Console.`

**Recommended additions:**
- Add key enterprise selling points below the config grid:
  - ✅ **Admin governance** — Owners control which connectors and tools are available
  - ✅ **Works with Claude Research** — Claude invokes Fodda tools automatically during deep analysis
  - ✅ **Zero-install** — No CLI, no local setup, no code changes
- Consider linking to [Anthropic's official connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) alongside the existing Fodda setup guide link (line 642)

#### e) "Endpoints & Auth" section label (line 739)
**Current:** `Endpoints & Auth`
This is fine as-is — it's a technical reference section appropriate for the Account Admin context.

#### f) Help links at bottom (line 839)
Currently links to platform-specific setup guides on `fodda.ai`. Consider adding a link to the Anthropic Connectors guide here too.

---

## Terminology Guide

| Context | Use | Don't Use |
|---|---|---|
| User-facing labels | "Connector", "Claude Connector" | "MCP server", "MCP Integration" |
| Setup instructions | "Connector URL" | "Remote MCP Server URL" |
| Enterprise messaging | "Admin-managed Connector" | "Enterprise Plugin" |
| Technical/developer docs | "MCP" is fine | — |

---

## Success Criteria

- Dashboard profile page says **"Claude Connector"** not "Fodda on Claude" / "Customer Connector"
- AccountPortal sidebar tab says **"Claude Connector"** not "MCP Integration"
- Enterprise sub-tab highlights governance, Research integration, and zero-install
- "Set Up Now" link points to the current `claude.ai/settings/connectors` URL
- User-facing copy uses "Connector" terminology consistently
