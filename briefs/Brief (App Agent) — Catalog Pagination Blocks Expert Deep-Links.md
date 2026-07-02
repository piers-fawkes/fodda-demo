# Brief (App Agent) — Catalog Pagination Bug Blocks Expert Deep-Links

> **TL;DR:** The expert "Query for Free" deep-link (per the Expert CTA sub-brief) is built but **does not work live**, because the app's catalog is silently truncated to the first 100 Graph List records — and the expert graphs (incl. Jeremy) are beyond that cut, so the `expert_slug` enrichment never sees them. Fix the pagination, deploy, then verify.

## Evidence (measured against live)
| | count | expert graphs |
|---|---|---|
| App `GET /api/graph-catalog` | **100** | **0** |
| Fodda `GET https://api.fodda.ai/v1/graphs/catalog` | **224** | 2 |

- 100 is exactly Airtable's single-page limit → the Graph List fetch isn't paginating.
- Jeremy's `postpals-expert-graph` **is** in the Fodda catalog (and is `graphType='expert'`, `graphStatus='live'`) but is **absent from the app's 100** → dropped by the cap.
- Net: **0 expert graphs reach the app catalog**, so the §5 `expert_slug`/`graph_sub_type` enrichment has nothing to enrich, and `/expert/<slug>` resolves no one.

## Fix 1 — paginate the Graph List fetch (app code)
**File:** `server/routers/catalogRouter.ts` (`GET /graph-catalog`, the `queryAirtable(GRAPH_LIST_TABLE, …)` call ~line 37).
- The fetch returns only the first page (~100 records). **Paginate it** — loop on Airtable's `offset` (or use the SDK's `.all()`) so it returns **all** live/beta/coming_soon graphs (~224).
- Confirm the §5 enrichment then runs over the full set (expert graphs now included).

## Fix 2 — deploy
The §5 walkthrough only ran `npm run build` — there's no deploy noted. **Deploy the app** so the pagination fix + the §5 catalog enrichment + the auth-persistence changes all go live.

## Verify (run against the DEPLOYED app, not localhost)
1. `curl https://app.fodda.ai/api/graph-catalog | jq '.graphs[] | select(.graph_type=="expert") | {id, expert_slug, graph_sub_type}'` → Jeremy should appear with `expert_slug: "jeremy-bergstein-science-education-innovation"` and `graph_sub_type: "Digital Twin"`.
2. Logged-out deep-link: `https://app.fodda.ai/expert/jeremy-bergstein-science-education-innovation?q=...` → referral landing → signup → lands in Jeremy's chat, question auto-submitted.
3. Logged-in deep-link: same URL → bypasses auth, Jeremy pre-selected, auto-submit.

## Fix 3 — derive "is an expert" from the Analyst record, not the Graph List `graphType`

Root design issue: the app classifies a graph as an expert via the **Graph List `graphType` field**, which is a second, hand-maintained copy of something the **Analysts table** already owns (each twin's analyst is `graphSubType='Digital Twin'`). That duplication is why Ben (`sic`=`domain`) and Anu (`2026-macro-trend-graph`=`industry report`) were skipped — their Graph List typing was wrong even though their analyst records are correct.

You already cross-reference `/v1/analysts` to set `expert_slug` + backfill `graph_sub_type`. **Extend that same step to also set `graph_type='expert'`** when a graph is the dedicated graph of a Digital-Twin analyst — overriding the Graph List `graphType`. Then the **Analyst table is the single source of truth**, no Graph List typing is ever needed, and every future twin auto-resolves.

- **Match rule (important):** promote only a twin's **single dedicated graph** — i.e. an analyst with `graphSubType='Digital Twin'` whose `backingGraphs` is exactly `[thisGraph]`. Do **not** promote the shared library graphs that the multi-graph *Synthetic Expert* analysts also reference (e.g. `psfk`, `mintel-*`), and ignore the wildcard `['*']` analyst (Piers) which has no dedicated graph.
- **Stopgap already applied:** `sic` and `2026-macro-trend-graph` were manually set to `graphType='expert'` + `graphSubType='Digital Twin'` so Ben and Anu resolve *now*. The code change above makes that manual step unnecessary going forward — and it's the durable fix.

## Heads-up — slug consistency for the deep link
`expert_slug` is derived as the **Analyst ID** (e.g. Ben = `ben-dietz-sic`, Piers = `piers-fawkes-psfk`). But the marketing site's expert-page CTA may link with a **shorter** slug (the website maps `ben-dietz-sic` → `ben-dietz`). Jeremy works because his analyst id and website slug are identical; Ben/Piers may not. Confirm the website CTA slug and the app `expert_slug` agree per expert (the app matches `expert_slug` OR graph `id`, so one of those must match the link).
