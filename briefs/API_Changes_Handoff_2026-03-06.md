# API & Data Changes — App Agent Handoff

**Date:** 2026-03-06  
**From:** API Agent  
**Status:** Live in production

---

## 1. Brand Boost Bug Fixed ✅

**File:** `frontend/App.tsx` (lines 601–649)

The `hasBrand()` function was using `searchFields.includes("nike london")` which matched the **entire phrase** — meaning multi-word queries like "Nike London" never boosted any rows.

**Fix:** Now splits the query into individual terms and matches any term ≥3 chars. Also searches `brandNames` and `Brand` fields (not just text content).

```diff
-return searchFields.includes(brandLower);
+const queryTerms = brandLower.split(/\s+/).filter(t => t.length >= 3);
+return queryTerms.some(term => searchFields.includes(term));
```

Same fix applied to `hasTrendBrand()`.

> This change is already in your codebase — no action needed unless you want to refine further.

---

## 2. API Response Changes (Live)

### Fields Stripped
The API now strips these fields from all responses:
- `brands` (Airtable record IDs — use `brandNames` or `Brand` instead)
- `industry`, `technology`, `sector`, `audience` (record IDs)
- `airtableRecordId`, `relatedTrendRecIds`, `macroRecIds`
- `Freshness Date`, `Freshness Days`, `Date Added` (duplicates of camelCase equivalents)
- `vertical - raw`, `dataset`, `articleIds_csv`

### Fields Preserved
- `brandNames` — pipe-delimited names: `"Nike|Adidas|Lotte"`
- `Brand` — comma-delimited names: `"Nike,Adidas,Lotte"`
- `_score` — relevance score
- All camelCase fields (`freshnessDate`, `freshnessDays`, `dateAdded`, etc.)

> **Action:** If the app references any stripped field, switch to its camelCase equivalent. The `brands` field (record IDs) should NOT have been used for display — `brandNames` or `Brand` are the correct fields.

---

## 3. New Data Available

### `place` Field (NEW)
Both Trend and Article nodes now have a `place` property — a comma-delimited string with location data (city, country, region).

**Examples:**
- `"Trafford Centre, Venice Beach, Los Angeles, North America, New York City"`
- `"El Salvador, South America"`
- `"London, United Kingdom, Europe"`

> **Suggestion:** Consider displaying `place` in the Evidence drawer trend cards or article cards to give geographic context. Use `normalizeBrandNames()`-style parsing (split on `,`, trim).

### Evidence `brandNames` (Partial)
The API now returns brand names per evidence article via Neo4j graph relationships. However, only ~33 articles currently have brand data — most will still return `brandNames: []`. Coverage will improve as the Airtable `brand_names_raw` field gets backfilled.

> **No app action needed** — the response shape is unchanged (`evidence[].brandNames: string[]`).

---

## Summary of App Actions

| Item | Action | Priority |
|------|--------|----------|
| Brand boost fix | Already in your code ✅ | None |
| Stripped fields (`brands`, `Freshness Date`, etc.) | Verify app doesn't reference them | Low |
| `place` field | Optional: display in Evidence drawer | Low |
| Evidence `brandNames` | No action — works automatically | None |
