# Brief: Skills UI Polish — My Graphs Dashboard

> **For**: App Agent  
> **From**: MCP Agent  
> **Priority**: Phase 4 of Skills Integration  
> **Complexity**: Medium (~2-3 hrs)

---

## Context

The Skills Integration pipeline is now fully functional end-to-end:
- Airtable has skill metadata (`mcpUrl`, `skillPhase`, `skillToolName`)
- API serves skill fields in `/v1/graphs` + handles toggle persistence
- MCP Server discovers, calls, and appends skill output automatically
- `MyGraphsPage.tsx` already renders skills as a category with toggles

The scaffolding works — now we need visual polish to make skills feel **premium and distinct** from regular graphs.

---

## What Needs To Change

### File: `frontend/components/MyGraphsPage.tsx`

#### 1. Skill Card Visual Treatment

Skills should look visually distinct from graphs. They're not content sources — they're "lenses" that adapt output.

**Design direction:**
- **Icon**: Use a ⚡ or 🔀 icon (or a small SVG) instead of the graph's standard icon
- **"Beta" badge**: Add a small pill badge (`Beta`) in a subtle color if `status === 'beta'` (both current skills are beta)
- **Background tint**: Skill cards should have a slightly different background than graph cards — a subtle gradient or accent border to distinguish the section
- **Description**: Show `description` from the catalog below the skill name. Currently skills just show name + toggle. Add 1-2 lines of description text.

#### 2. Skill Detail / Info Panel

When a user taps/clicks on a skill card (not the toggle), show an expanded info panel:

- **What this skill does**: The skill's `description` from Airtable
- **Phase**: "Applied after research" (for `skillPhase: 'output'`)
- **How to skip**: "Say 'without [skill name]' or 'skip [skill name]' in your query to suppress this skill for one search"
- **How it works**: "This skill is an external MCP server that receives your Fodda search results and transforms them. Your data is processed by [skill name]'s servers."

#### 3. Skills Section Header

Update the section header for skills to be more descriptive:

```
Skills
Plug-in capabilities that transform how Fodda presents results. 
Enabled skills are applied automatically — say "skip [name]" in any query to bypass.
```

#### 4. Empty State

If no skills are available (shouldn't happen with Igloo + Paralogy, but future-proofing):

```
No skills available yet. Skills are plug-in capabilities from third-party partners 
that transform your Fodda results. New skills will appear here as they launch.
```

---

## Catalog Router Update (if not already done)

### File: `server/routers/catalogRouter.ts`

Ensure the catalog response includes skill-specific fields. In the `map` function that transforms Airtable records:

```typescript
// Add alongside existing field mappings:
mcp_url: f.mcpUrl || null,
skill_phase: f.skillPhase || 'output',
skill_tool_name: f.skillToolName || null,
```

This ensures the frontend has the metadata needed for the detail panel.

---

## Design Inspiration

Skills should feel like **premium add-ons** — think of them like Figma plugins or VS Code extensions:
- Clean, minimal card with clear on/off toggle
- Distinct visual language from the graph cards
- "What does this do?" expandable detail
- Beta badge that signals newness without being alarming

---

## Verification

After implementation:
1. Skills section appears in My Graphs with distinct visual treatment
2. Toggle persists correctly (already working)
3. Clicking a skill card shows expanded info
4. "Beta" badge appears for beta-status skills
5. Skills section header includes the "skip" instruction
