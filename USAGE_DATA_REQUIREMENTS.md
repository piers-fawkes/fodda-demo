# Usage Monitoring Dashboard - Data Requirements

## Overview
The Usage Monitoring Dashboard displays account-level usage statistics including calls per graph, calls per user, and monthly trends. Currently using **mock data** - this document outlines the real data needed from Airtable.

---

## Required Airtable Data

### 1. Query Logs Table
You'll need a table that tracks each API query with the following fields:

**Required Fields:**
- `Query ID` (Primary Key)
- `Account ID` (Link to Accounts table)
- `User ID` (Link to Users table)
- `Graph ID` (Text: "psfk-retail", "psfk-beauty", "waldo", "sic", etc.)
- `Timestamp` (Date/Time)
- `Status` (Text: "SUCCESS", "ERROR", "NO_MATCH", etc.)

**Optional but Recommended:**
- `Query Text` (Long text)
- `Response Time (ms)` (Number)
- `Data Status` (Text: "TREND_MATCH", "ARTICLE_MATCH", etc.)

---

### 2. Rollup/Formula Fields Needed

#### In Accounts Table:
1. **Total Queries (All Time)**
   - Type: Rollup
   - Linked Table: Query Logs
   - Field: Count
   - Filter: None

2. **Monthly Queries**
   - Type: Rollup
   - Linked Table: Query Logs
   - Field: Count
   - Filter: `IS_AFTER({Timestamp}, DATEADD(TODAY(), -30, 'days'))`

#### In Users Table:
1. **Query Count (Last 30 Days)**
   - Type: Rollup
   - Linked Table: Query Logs
   - Field: Count
   - Filter: `IS_AFTER({Timestamp}, DATEADD(TODAY(), -30, 'days'))`

---

### 3. API Endpoint Data Structure

The `/api/account/usage` endpoint needs to return:

```typescript
{
  ok: true,
  usage: {
    totalQueries: number,           // Total queries for this account (all time)
    monthlyQueries: number,          // Queries in last 30 days
    
    byGraph: [                       // Breakdown by graph
      {
        graphId: string,             // e.g., "psfk-retail"
        graphName: string,           // e.g., "PSFK Retail"
        queryCount: number,          // Queries to this graph (last 30 days)
        percentage: number           // % of total queries
      }
    ],
    
    byUser: [                        // Breakdown by user
      {
        userId: string,              // Airtable Record ID
        userEmail: string,
        userName?: string,           // Optional display name
        queryCount: number,          // Queries by this user (last 30 days)
        percentage: number           // % of total queries
      }
    ],
    
    dailyTrend: [                    // Daily query counts
      {
        date: string,                // YYYY-MM-DD format
        queryCount: number           // Queries on this day
      }
    ],
    
    periodStart: string,             // YYYY-MM-DD (30 days ago)
    periodEnd: string                // YYYY-MM-DD (today)
  }
}
```

---

## Implementation Steps

### Step 1: Create Query Logs Table (if not exists)
- Add fields listed above
- Ensure each API query creates a record in this table

### Step 2: Add Rollup Fields
- Add rollup fields to Accounts and Users tables as specified

### Step 3: Update Backend Endpoint
Replace the mock data in `/server/index.ts` (line ~458) with:

```typescript
app.get("/api/account/usage", async (req, res) => {
  try {
    const { accountId, period = '30d' } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ ok: false, error: "accountId required" });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // 1. Get total queries from Account record
    const accountRecord = await getAirtableRecord(ACCOUNTS_TABLE, accountId);
    const totalQueries = accountRecord.fields['Total Queries'] || 0;
    const monthlyQueries = accountRecord.fields['Monthly Queries'] || 0;

    // 2. Query logs for graph breakdown
    const logsQuery = await queryAirtable(
      QUERY_LOGS_TABLE,
      `AND({Account ID} = '${accountId}', IS_AFTER({Timestamp}, '${startDate.toISOString()}'))`
    );
    
    // 3. Aggregate by graph
    const graphCounts = {};
    const userCounts = {};
    const dailyCounts = {};
    
    logsQuery.records.forEach(record => {
      const graphId = record.fields['Graph ID'];
      const userId = record.fields['User ID'];
      const date = record.fields['Timestamp'].split('T')[0];
      
      graphCounts[graphId] = (graphCounts[graphId] || 0) + 1;
      userCounts[userId] = (userCounts[userId] || 0) + 1;
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // 4. Format response
    const byGraph = Object.entries(graphCounts).map(([graphId, count]) => ({
      graphId,
      graphName: getGraphName(graphId), // Helper function
      queryCount: count,
      percentage: (count / monthlyQueries) * 100
    }));

    const byUser = await Promise.all(
      Object.entries(userCounts).map(async ([userId, count]) => {
        const userRecord = await getAirtableRecord(USERS_TABLE, userId);
        return {
          userId,
          userEmail: userRecord.fields['email'],
          userName: userRecord.fields['userName'],
          queryCount: count,
          percentage: (count / monthlyQueries) * 100
        };
      })
    );

    const dailyTrend = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, queryCount: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      ok: true,
      usage: {
        totalQueries,
        monthlyQueries,
        byGraph: byGraph.sort((a, b) => b.queryCount - a.queryCount),
        byUser: byUser.sort((a, b) => b.queryCount - a.queryCount),
        dailyTrend,
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: endDate.toISOString().split('T')[0]
      }
    });
  } catch (e: any) {
    console.error("Error fetching usage data:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

---

## Current Mock Data

The current implementation returns sample data:
- **Total Queries**: 1,284
- **Monthly Queries**: 847
- **5 graphs** with varying usage
- **5 users** with varying activity
- **30 days** of random daily trends (10-50 queries/day)

This allows the UI to be tested and deployed while you set up the real Airtable infrastructure.

---

## Next Steps

1. ✅ Frontend UI complete (with "DEMO DATA" badge)
2. ✅ Mock backend endpoint working
3. ⏳ **Your task**: Set up Query Logs table and rollup fields in Airtable
4. ⏳ **After Airtable setup**: Replace mock endpoint with real queries
5. ⏳ Remove "DEMO DATA" badge once live data is connected
