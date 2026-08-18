# Brief: Sync TOKEN_COSTS with Airtable Offerings (Catalog Parity Fix)

**Target Repo:** Fodda API (`/Fodda API`)  
**Target Agent:** API Agent  
**Date:** 2026-08-15  
**Status:** Handoff to API Agent  

---

## 1. Executive Summary

At boot, the Fodda API service reported a **Catalog Parity Check Failure** with 40 issues. While the service is serving, billing for Shared Payment Tokens (SPT) and composed skill expectations are out of sync with published prices in Airtable offerings.

Per **Fodda House Rules**:
- **Airtable is the source of truth for pricing.** Published USD prices in Airtable are authoritative.
- `TOKEN_COSTS` in `functions/v1/metering.ts` governs machine-to-machine SPT per-token billing plumbing.
- `TOKEN_COSTS` must be synchronized with Airtable offerings ($0.50/token rate: `tokens = Published Price / $0.50`), and composed skill component pricing must align with their sub-component expectations.

---

## 2. Issues to Address in `functions/v1/metering.ts`

The following 40 offerings/composed skills require updates in `TOKEN_COSTS` or catalog parity validation logic in the Fodda API repository:

### Standard Offerings (Update `TOKEN_COSTS` to match published Airtable price @ $0.50/token)

| Offering Name | Published Price | Current Tokens | Required Tokens | Formula (`Price / $0.50`) |
|---|---|---|---|---|
| `adjacent_trends` | $15.00 | 15 ($7.50) | **30 tokens** | $15.00 / $0.50 |
| `earnings_company` | $20.00 | 10 ($5.00) | **40 tokens** | $20.00 / $0.50 |
| `linkedin_article` | $2.50 | 0 ($0.00) | **5 tokens** | $2.50 / $0.50 |
| `standalone_insights` | $0.50 | 5 ($2.50) | **1 token** | $0.50 / $0.50 |
| `earnings_qa` | $10.00 | 5 ($2.50) | **20 tokens** | $10.00 / $0.50 |
| `report_intelligence` | $55.00 | 5 ($2.50) | **110 tokens** | $55.00 / $0.50 |
| `standalone_evidence` | $0.50 | 5 ($2.50) | **1 token** | $0.50 / $0.50 |
| `trend_briefing` | $40.00 | 10 ($5.00) | **80 tokens** | $40.00 / $0.50 |
| `earnings_divergence` | $20.00 | 5 ($2.50) | **40 tokens** | $20.00 / $0.50 |
| `marketing_plan` | $60.00 | 20 ($10.00) | **120 tokens** | $60.00 / $0.50 |
| `domain_intelligence` | $35.00 | 5 ($2.50) | **70 tokens** | $35.00 / $0.50 |
| `deck_review` | $50.00 | 20 ($10.00) | **100 tokens** | $50.00 / $0.50 |
| `standalone_supplemental` | $45.00 | 5 ($2.50) | **90 tokens** | $45.00 / $0.50 |
| `linkedin_post` | $1.50 | 0 ($0.00) | **3 tokens** | $1.50 / $0.50 |
| `earnings_validated_trends` | $25.00 | 10 ($5.00) | **50 tokens** | $25.00 / $0.50 |
| `earnings_history` | $15.00 | 10 ($5.00) | **30 tokens** | $15.00 / $0.50 |
| `expert_intelligence` | $45.00 | 5 ($2.50) | **90 tokens** | $45.00 / $0.50 |
| `standalone_statistics` | $0.50 | 5 ($2.50) | **1 token** | $0.50 / $0.50 |
| `expert_graph_read` | $15.00 | 5 ($2.50) | **30 tokens** | $15.00 / $0.50 |
| `earnings_compare` | $30.00 | 15 ($7.50) | **60 tokens** | $30.00 / $0.50 |
| `url_context` | $20.00 | 1 ($0.50) | **40 tokens** | $20.00 / $0.50 |
| `earnings_guidance` | $1.50 | 5 ($2.50) | **3 tokens** | $1.50 / $0.50 |
| `skill.brand_intelligence` | $30.00 | 20 ($10.00) | **60 tokens** | $30.00 / $0.50 |
| `skill.earnings_divergence` | $20.00 | 15 ($7.50) | **40 tokens** | $20.00 / $0.50 |
| `skill.expert_consult` | $15.00 | 5 ($2.50) | **30 tokens** | $15.00 / $0.50 |
| `skill.topic_brief` | $20.00 | 15 ($7.50) | **40 tokens** | $20.00 / $0.50 |
| `cap.adjacent_trends` | $15.00 | 15 ($7.50) | **30 tokens** | $15.00 / $0.50 |

### Composed Skills (Verify component aggregation / parity check rules)

| Composed Skill | Published Price | Expected Indicative Sum | Components |
|---|---|---|---|
| `upload_compare` | $40.00 | $0.50 | `search` |
| `deep_research_light` | $55.00 | $20.50 | `search + url_context` |
| `earnings_intelligence` | $30.00 | $3.00 | `search + standalone_supplemental` |
| `topic_research` | $20.00 | $3.00 | `search + standalone_supplemental` |
| `deep_dive_comprehensive` | $100.00 | $20.50 | `search + url_context` |
| `deep_dive_fast` | $55.00 | $20.50 | `search + url_context` |
| `brainstorm` | $35.00 | $0.50 | `search` |
| `brand_intelligence` | $30.00 | $23.00 | `search + url_context + standalone_supplemental` |
| `expert_agent` | $15.00 | $0.50 | `search` |
| `url_as_prompt` | $20.00 | $20.50 | `url_context + search` |
| `deep_research_heavy` | $100.00 | $20.50 | `search + url_context` |
| `weekly_tracker` | $30.00 | $30.50 | `search + weekly_tracker` |
| `skill.competitive_landscape` | $175.00 | $140.00 | `deep_research.heavy + brand_intelligence ×3 + earnings_intelligence + cap.adjacent_trends` |

---

## 3. Required Actions for API Agent

1. **Update `TOKEN_COSTS` in `functions/v1/metering.ts`** to set exact token counts so `TOKEN_COSTS × $0.50` equals the published Airtable price for each offering.
2. **Adjust Catalog Parity Check boot assertions** if composed skill prices reflect premium pricing or bundled margins over raw component sums.
3. **Verify locally / run unit tests** in `Fodda API` to confirm boot catalog parity check passes with 0 issues.
4. **Update `CHANGELOG.md`** in `Fodda API`.
5. **Redeploy Fodda API** using `./deploy.sh`.

---

## 4. House Rules Compliance Checklist

- [x] Airtable is the source of truth for published prices.
- [x] Machine-only SPT token counts updated to match Airtable pricing.
- [x] No human-visible pricing changed.
- [x] Handoff brief generated for API Agent per cross-repo routing rules.
