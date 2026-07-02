# Brief: Migrate Graph Toggle to API Endpoint (Backburner)

## Priority: Low — Backburner

## Context

The API agent recently deployed `POST https://api.fodda.ai/v1/user/preferences/toggle` — a unified endpoint for enabling/disabling graphs, supplemental sources, and skills. The MCP agent and Sales agent have both migrated to use it.

The dashboard's My Graphs page currently writes directly to Airtable via `POST /api/user/disabled-graphs` in `server/routers/userRouter.ts`. This works but bypasses the API's in-memory caches (`DISABLED_GRAPHS_CACHE` and `ACCESS_DECISION_CACHE`), which can cause a ~5-minute stale window where a user toggles a graph off in the dashboard but the MCP agent still serves results from it.

## Impact

**Low**. The dashboard and API run on separate Cloud Run instances, so they don't share memory. The cache has a 5-minute TTL, so staleness resolves naturally. This is a consistency improvement, not a bug fix.

## What to Change

### `server/routers/userRouter.ts` (~line 25)

Replace the direct Airtable lookup + update in `POST /disabled-graphs` with a call to the API toggle endpoint.

**Current flow:**
```
Frontend → POST /api/user/disabled-graphs → userRouter.ts → Airtable PATCH
```

**Target flow:**
```
Frontend → POST /api/user/disabled-graphs → userRouter.ts → POST api.fodda.ai/v1/user/preferences/toggle
```

### Option A: Minimal change (swap the write only)

Keep the existing route signature and frontend contract. Just replace the Airtable write inside `userRouter.ts` with an API call. The frontend sends the full CSV string, so you'd need to diff the old vs new disabled set to determine which IDs to toggle. This is more work than it's worth.

### Option B: Recommended — per-item toggle (cleaner)

Update the frontend to call the API directly per-item, eliminating the server-side proxy entirely.

**Frontend change** in `shared/dataService.ts` → `updateDisabledGraphs()`:

```typescript
// Instead of sending the full CSV to /api/user/disabled-graphs,
// call the API toggle endpoint directly:
async toggleGraphPreference(targetId: string, enabled: boolean, userEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/user/toggle-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, enabled, user_email: userEmail }),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
```

**Server-side proxy** in `userRouter.ts`:

```typescript
router.post("/toggle-graph", async (req, res) => {
  const { target_id, enabled, user_email } = req.body;
  // Proxy to the API using the admin key (on-behalf-of mode)
  const apiKey = process.env.FODDA_API_KEY;
  const apiRes = await fetch('https://api.fodda.ai/v1/user/preferences/toggle', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id, enabled, user_email }),
  });
  const result = await apiRes.json();
  res.status(apiRes.status).json(result);
});
```

**Frontend component change** in `MyGraphsPage.tsx`:
- `toggleGraph()` currently debounces and sends the full CSV. Change it to call `toggleGraphPreference(id, !isCurrentlyDisabled, userEmail)` per item instead.
- Remove the debounce — individual toggles are cheap and the API is idempotent.
- The `toggleCategoryAll()` function would call the API once per graph in the group (or you could batch them — the API doesn't support batch yet, but N individual calls is fine for the small group sizes involved).

### API Endpoint Contract

```
POST https://api.fodda.ai/v1/user/preferences/toggle
Headers: X-API-Key: <admin_key>
Body: { "target_id": "paralogy", "enabled": true, "user_email": "user@example.com" }
Response: { "ok": true, "target_id": "paralogy", "enabled": true, "disabled_graphs": ["igloo"], "requestId": "..." }
```

The `user_email` field is the admin on-behalf-of parameter. Only admin keys can use it. The dashboard's server-side proxy uses the admin `FODDA_API_KEY` to act on behalf of the logged-in user.

## What NOT to Change

- The existing `POST /api/user/disabled-graphs` route can be kept as a deprecated fallback or removed — your call.
- The `MyGraphsPage.tsx` UI rendering, category grouping, and skill display logic are all fine as-is.
- The static fallback graph list in `dataService.ts` already includes skills (`Paralogy` as `beta`, `Igloo` as `draft`).

## Env Vars

`FODDA_API_KEY` — the dashboard server already has this (used for `/api/graph-catalog` fallback fetches). No new env vars needed.
