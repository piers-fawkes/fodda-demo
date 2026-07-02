# Brief: Graph Creator Analytics & Stats Dashboard

> **To:** Fodda App Agent
> **From:** Fodda Website Agent
> **Date:** 2026-06-04
> **Priority:** 🔴 High — Feature Implementation

---

## Context

Fodda operates at the retrieval layer, which gives us unique server-side visibility into queries, usage, and node fetches. Currently, graph creators and owners have no way to see how their graphs are performing, who is querying them, and what questions are being asked.

We need to add a **Graph Analytics Dashboard** for graph owners/curators. This stats interface must be integrated directly into the main `app.fodda.ai` application, under the **"Your Graphs"** section of the **My Graphs** page.

---

## Requirements

### 1. Backend Endpoint: `GET /api/creator/analytics`

Create a new endpoint that provides usage data for a specific graph, gated strictly to the graph's owner/creator.

- **Authentication & Gating**:
  - The endpoint must require a Clerk session.
  - Resolve the logged-in user's email.
  - Query the registry (or reuse the logic from `GET /api/expert-graph/my-submissions?email=...`) to ensure the user is the owner of the requested `graphId` (matching `ownerId` / `creator`). If the user does not own the graph, return a `403 Forbidden` status.
  
- **Airtable Query**:
  - Query the `LOGS_TABLE_QUESTIONS` table (`tblvHx1DzwuTq3TJE`) in the Fodda Airtable base.
  - Query range: last 30 days.
  - Filter formula:
    `AND({graphId} = '${graphId}', IS_AFTER({Date}, '${startDate.toISOString()}'))`
  
- **Aggregation Logic**:
  - **Summary**: Total queries, number of unique users (by email).
  - **Daily Trend**: Query count per day in `YYYY-MM-DD` format.
  - **Top Queries**: Group by `question` and return the top 10 most frequent queries.
  - **Top Users (Masked)**: Group by `userEmail` and return the query count. Mask the email for privacy (e.g., `piers.fawkes@psfk.com` -> `p***.f***@psfk.com` or `p***@psfk.com`).
  - **Recent Queries**: Last 10 queries, sorted by `Date` descending. Include `Date`, `question`, and `resultQuality` (STRONG/WEAK/MISS).

- **JSON Response Shape**:
  ```typescript
  {
    ok: true,
    stats: {
      totalQueries: number,
      uniqueUsers: number,
      dailyTrend: Array<{ date: string; count: number }>,
      topQueries: Array<{ query: string; count: number }>,
      topUsers: Array<{ email: string; count: number }>,
      recentQueries: Array<{ date: string; query: string; quality: string }>
    }
  }
  ```

---

### 2. Frontend: Inline Analytics on `MyGraphsPage.tsx`

Update the **Your Graphs** section in `MyGraphsPage.tsx`:

- **UI Trigger**:
  - Add a "View Stats" button next to "Copy API Key" on each owned graph card.
  
- **Expanded Panel**:
  - When clicked, expand the card or open a drawer displaying the stats.
  - Show a loading spinner during fetch.
  - Render a grid with summary stats cards: **Queries (30d)**, **Unique Users**, and **Recent Miss Rate** (percentage of queries returning `MISS`).
  
- **Visuals**:
  - Render a simple SVG-based line or bar chart for the **Daily Trend** using Fodda's premium styling (e.g., clean gray grid lines, teal/brand colored bars, no heavy chart libraries like Chart.js unless already installed).
  - Two-column detail view:
    - **Recent Queries**: A table showing the last 10 queries, styled with validation-like quality pills (green for `STRONG`, yellow for `WEAK`, red for `MISS`).
    - **Top Audience**: A table showing masked emails and their query frequency.

---

## Action Items

1. **Router Modification**:
   - Add `/api/creator/analytics` handler. You can mount this within a new router file `server/routers/creatorRouter.ts` or add it to `server/routers/accountRouter.ts`.
   - Ensure to import and use the correct `LOGS_TABLE_QUESTIONS` table constant.
   
2. **Frontend Wiring**:
   - Add `fetchCreatorAnalytics(graphId: string)` method to `shared/dataService.ts`.
   - Update `MyGraphsPage.tsx` to handle the expansion state, fetch stats on click, and render the details.
