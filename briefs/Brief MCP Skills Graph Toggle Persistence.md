# Brief: Graph & Skill Toggle Persistence

> **For**: App Agent + API Agent  
> **From**: MCP Agent  
> **Priority**: Required before Skills Integration Phase 2  
> **Complexity**: Small-medium (~4-6 hours across both agents)

---

## Context

The My Graphs / Team Graphs page in the Fodda App has full UI for toggling graphs and skills on/off. The frontend logic is **complete**:

- `MyGraphsPage.tsx` manages a `disabledSet` (Set of graph IDs the user has turned off)
- When a user toggles, it calls `dataService.updateDisabledGraphs(email, csv)` which POSTs to `/api/user/disabled-graphs`
- The page initializes from `currentUser.disabledGraphs` (comma-separated string from the user record)
- Graphs outside the user's vertical are shown as inaccessible (grayed out, untoggleable) via `isGraphAccessibleForVertical()`

**The problem**: The backend endpoint `/api/user/disabled-graphs` **does not exist**. There is no server route that handles this POST. The frontend persists silently fail — toggles work in-session (local state) but are lost on reload.

Additionally, the Fodda MCP Server has **no awareness** of disabled graphs — it searches all graphs regardless. The external Fodda API (`api.fodda.ai`) also has no disabled-graph filtering.

---

## What Exists Today (You Don't Need To Build)

| Component | Status | Location |
|-----------|--------|----------|
| Toggle UI (switches, category toggles, "Zap Stale") | ✅ Complete | `MyGraphsPage.tsx` lines 100-146 |
| Debounced persistence call | ✅ Complete | `MyGraphsPage.tsx` lines 88-98 |
| Vertical-based access control (grayed out) | ✅ Complete | `MyGraphsPage.tsx` lines 49-55, 245-251 |
| `disabledGraphs` field on User type | ✅ Complete | `shared/types.ts` line 219 |
| `dataService.updateDisabledGraphs()` | ✅ Complete | `shared/dataService.ts` lines 401-411 |
| Save feedback ("Saving...", "✓ Saved", "Save failed") | ✅ Complete | `MyGraphsPage.tsx` line 270-272 |
| Passing `disabledGraphs` from App.tsx to MyGraphsPage | ✅ Complete | `App.tsx` lines 852, 884 |

---

## What Needs To Be Built

### Task 1: Backend endpoint — `POST /api/user/disabled-graphs` (App Agent)

**File**: Create in `/server/routers/accountRouter.ts` or a new `userRouter.ts`

The frontend already calls `POST /api/user/disabled-graphs` with body:
```json
{
  "email": "user@example.com",
  "disabledGraphs": "fashion,waldo,havas-media-trends"
}
```

Implementation:
1. Look up the user record in Airtable Users table by email
2. Update the `disabledGraphs` field (text field, comma-separated IDs)
3. Return `{ ok: true }`

> [!NOTE]
> The Airtable Users table likely already has a `disabledGraphs` column (it's referenced in `shared/types.ts`). If not, add a "Long text" field called `disabledGraphs` to the Users table.

**Estimated effort**: 30-60 min. This is a simple Airtable read-update operation.

### Task 2: Read `disabledGraphs` on login (App Agent)

**File**: `/server/routers/authRouter.ts`

When the auth flow returns the user object (login, verify, validate-session), include the `disabledGraphs` field from Airtable in the response. The frontend already expects it via `currentUser.disabledGraphs`.

Check: the `verify` and `validate-session` endpoints may already read user fields — just ensure `disabledGraphs` is included in the mapped response.

**Estimated effort**: 15-30 min.

### Task 3: MCP Server — Respect disabled graphs during search (MCP Agent — Phase 2)

This is **not needed** for this brief — the MCP Agent will handle it during Skills Integration Phase 2. But for awareness:

- When the MCP Server initializes a session, it should fetch the user's disabled graphs
- `search_graph` (all-graph fan-out mode) should skip disabled graphs
- Skills with `graph_type === 'skill'` that are in the disabled set should not be called

### Task 4: External API — Expose disabled graphs (API Agent — optional)

**File**: Fodda API `/v1/graphs` endpoint

When the external API returns graphs for a user, include `disabled_graphs` in the response so the MCP Server can consume it. This is an alternative to having the MCP Server call the App's `/api/user/disabled-graphs` endpoint directly.

Two options:
- **Option A**: MCP Server calls the App's API to get disabled graphs (adds latency, couples MCP → App)
- **Option B**: External API reads disabled graphs from Airtable when returning `/v1/graphs` (cleaner, MCP already calls this)

Recommend **Option B** — the `/v1/graphs` endpoint already reads user data for `_account` profile. Add `disabled_graphs: ["fashion", "waldo"]` to the response.

**Estimated effort**: 30-60 min.

---

## Vertical Access Control (Already Built — Just Documenting)

The frontend already handles this correctly. When `userVertical` is not `'all'`:

```typescript
// MyGraphsPage.tsx line 49-55
function isGraphAccessibleForVertical(g: KnowledgeGraph, userVertical: string): boolean {
  if (!userVertical || userVertical.toLowerCase() === 'all') return true;
  const topics = (g.topics || []).map(t => t.toLowerCase());
  if (topics.includes('all')) return true;  // Universal graphs always accessible
  return topics.includes(userVertical.toLowerCase());
}
```

- Graphs outside the vertical have `isAccessible = false`
- Their toggle is effectively disabled (`isEnabled = !disabledSet.has(g.id) && isAccessible`)
- The UI shows them with reduced opacity and a "Locked" or plan-upgrade message (line 274-278)

**For skills**: Skills in the current Airtable data have `topics: []` (empty). This means they'll be treated as inaccessible unless `userVertical === 'all'`.

> [!IMPORTANT]
> **Decision needed**: Should skills be universally accessible regardless of vertical, or should they follow the same topic-matching rule? If universal, either:
> - Add `'all'` to each skill's topics array in Airtable, or
> - Add a special case in `isGraphAccessibleForVertical` for `graph_type === 'skill'`

---

## Summary: What Each Agent Does

| Agent | Tasks | Effort |
|-------|-------|--------|
| **App Agent** | Task 1: Build `POST /api/user/disabled-graphs` endpoint | ~1 hr |
| **App Agent** | Task 2: Include `disabledGraphs` in auth response | ~30 min |
| **API Agent** | Task 4: Add `disabled_graphs` to `/v1/graphs` response | ~1 hr |
| **MCP Agent** | Task 3: Filter disabled graphs in search (Phase 2) | Deferred |

**Total blocking work**: ~2.5 hours across App + API agents. This unblocks Skills Phase 2.

---

## Airtable Schema Verification

Please verify these fields exist in the Airtable Users table:

| Field | Type | Purpose |
|-------|------|---------|
| `disabledGraphs` | Long text | Comma-separated graph IDs the user has toggled off. Example: `"fashion,waldo,havas-media-trends"` |

If the field doesn't exist, create it. No migration needed — new users start with empty (all enabled).
