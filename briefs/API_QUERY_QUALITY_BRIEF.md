# Fodda API — Query Quality Brief

**Date**: 2026-03-07  
**From**: App Layer Audit  
**Priority**: Medium-High

## Summary

Testing 7 real Free-user queries against the V1 `/search` endpoint revealed several API-side issues that degrade result quality. The app layer has been updated with confidence filtering and intent classification, but the root causes are on the API side.

---

## Issues

### 1. Confidence Score Inflation

**Problem**: Many trends return `confidenceScore: 100` despite having `evidence: []` (zero linked articles). A trend with no supporting evidence should not score 100.

**Test case**: `POST /v1/graphs/retail/search` with query "What are trends in coffee?" returns:
- Row 1: "The Beta Retail Space" — confidence 100, evidence 0 (NOT about coffee)
- Row 2: "Coffee menus standardize non-coffee bases..." — confidence 48, evidence 3 (IS about coffee)

The only relevant result scores lower than 8 irrelevant fillers.

**Suggested fix**: Factor evidence count into `confidenceScore`, or add a separate `semantic_score` from the vector search that reflects how well the row actually matches the query.

---

### 2. Result Padding with Low-Relevance Filler

**Problem**: When a query like "coffee" has only 1–2 good semantic matches in the graph, the API fills the remaining slots (up to `limit`) with high-confidence but unrelated trends. This misleads the presentation layer.

**Test case**: "influencers" returns only 2 results (scores 16, 47) — which is actually correct behavior. But "coffee" returns 9 rows where 8 are irrelevant filler.

**Suggested fix**: Either:
- (a) Return fewer rows when the semantic distance drops below a threshold, OR
- (b) Include a `vector_similarity` score alongside `confidenceScore` so the app can distinguish between "editorially strong trend" and "actually matches this query"

---

### 3. Missing `dataStatus` in V1 Search Response

**Problem**: The V1 `/v1/graphs/{graphId}/search` endpoint does not return a `dataStatus` field (e.g., `TREND_MATCH`, `NO_MATCH`, `HYBRID_MATCH`). The legacy `/api/query` endpoint did. Without this, the app cannot know if results are strong matches, partial matches, or padding.

**Suggested fix**: Include `dataStatus` in V1 search responses. Possible values:
- `TREND_MATCH` — high-confidence semantic matches found
- `PARTIAL_MATCH` — some matches but coverage is incomplete
- `NO_MATCH` — no relevant results, returning nearest neighbors
- `PADDED` — real matches supplemented with generic high-confidence trends

---

### 4. Evidence Not Populated for `include_evidence: true`

**Problem**: Many rows return with `evidence: []` even when `include_evidence: true` is set. The trend data exists (confidenceScore, brands, whyNow are populated), but the evidence articles array is empty.

The app has to make secondary V1 evidence calls to hydrate these, adding latency. Even then, some trends never get evidence populated.

**Test case**: "What new status signals are replacing traditional luxury?" — of 5 top results, 3 have evidence=0 and 2 have evidence populated.

**Suggested fix**: Ensure `include_evidence: true` reliably populates the evidence array for all returned trends.

---

## App-Side Mitigations Already Applied

The app layer now:
1. **Filters out rows with `confidenceScore < 25`** before sending to Gemini
2. **Sorts by evidence availability** — rows with real evidence rank above empty stubs
3. **Signals data quality to Gemini** — adds `DATA_QUALITY: SPARSE/LOW_CONFIDENCE/LIMITED_EVIDENCE` prefix
4. **Extracts better search terms** — "trends in coffee" → searches for "coffee" instead of full phrase
5. **Classifies query intent** — advisory, visualization, comparative queries get tailored system prompts

These are defensive measures. The ideal fix is at the API level.
