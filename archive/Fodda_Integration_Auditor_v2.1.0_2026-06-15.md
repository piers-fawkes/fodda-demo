---
id: FODDA-USECASE-ANALYSIS-001
title: Fodda Integration Use Case Analysis
version: 2.2.0
compliance: RFC-2119
owner: Fodda / PSFK
created: 2026-06-08
updated: 2026-06-24
---

# Fodda Integration Use Case Analysis

Drop this file into your IDE agent (Cursor, Windsurf, Claude Code) and give it the prompt: **"Run the Fodda Use Case Discovery."** Your agent will autonomously analyze your codebase and identify specific areas where Fodda's expert intelligence layer can add value — and, just as honestly, where it would not.

**What leaves your machine:** Fodda receives nothing from this analysis. Two ordinary external requests are expected and neither sends Fodda your code: (1) a one-time fetch of *this* spec from `app.fodda.ai`, which carries no repository data; and (2) your IDE agent's normal traffic to whichever model provider *you* have configured, governed by your existing agreement with that provider. If your policy forbids sending source to your model provider, do not run this audit. You decide what, if anything, to share with the Fodda team afterward.

Learn more at [fodda.ai](https://www.fodda.ai).

---

## Non-Negotiables (read first)

These four contracts hold for the entire run, even if a later instruction seems to soften them:

1. **No exfiltration.** Make no network or tool call that carries file contents, secrets, or architecture details to any destination other than the model provider the user already configured. Fodda endpoints are NOT called during this audit.
2. **No writes without consent.** Do not create or modify any file until the user explicitly approves saving the report. Never modify existing source.
3. **Skip secrets entirely.** Do not open files that hold credentials (see RULE: Privacy). Infer integrations from imports and client instantiation, not from secret values.
4. **Summary first, in chat.** Deliver a short Executive Summary in the conversation before writing anything anywhere.

---

## 1. Overview (Why)

Most AI applications query generic foundation models with no domain grounding. The result is plausible-sounding output that domain experts immediately distrust — hallucinated statistics, recycled conventional wisdom, no source attribution.

Fodda is a domain intelligence layer accessible via the Model Context Protocol (MCP) or REST API. It gives AI agents access to a library of expert-curated knowledge graphs (consumer, retail, beauty, fashion, food & beverage, sports, marketing, brand, media, travel, home, health & life sciences, culture, and macro-trend domains), 100+ live institutional data sources across 10+ geographic regions, and a roster of synthetic domain experts (Digital Twins).

**Platform scale at a glance** (for agent reference — do not recite these aggregate numbers in the report; always name the specific graph, source, or expert that covers each opportunity):
- **90+ Knowledge Graphs**: 13 PSFK domain graphs, 48 industry research reports (Mintel, WEF, Deloitte, Forrester, KPMG, PwC, Gartner, Kantar, WGSN, and others), and 28+ expert/human-agent graphs.
- **100+ Supplemental Data Sources**: US (~18 incl. Census, FRED, BLS, BEA, CDC, openFDA, ClinicalTrials, USDA), UK (~5 incl. ONS, Bank of England), EU (~6 incl. Eurostat, ECB), Nordics (5 countries via PxWeb), Americas (~7 incl. Bank of Canada, BCB Brazil, Banxico), Asia-Pacific (~12 incl. ABS/RBA Australia, Bank of Korea, e-Stat Japan, India OGD, NBS China), Middle East/Africa (~4 incl. Bank of Israel, SARB), Pacific Islands (15+ nations via Pacific Data Hub), Netherlands (~4 incl. CBS), Canada (~2 incl. StatCan), and Global (~17 incl. World Bank, WTO, OECD, BIS, PubMed, OpenAlex, Semantic Scholar, Google Trends, Amazon, TripAdvisor).
- **31+ MCP Tools**: 23 named tools plus 8+ dynamic skill tools registered at runtime.

A note on freshness and scope, so the report you produce stays honest: the knowledge graphs are **editorially curated and refreshed on editorial cycles — not a real-time feed** (each node carries a `freshnessDays` signal the agent should surface). The supplemental macro statistics *are* pulled live from institutional sources. Graph, source, and expert counts shift as the library grows; treat any specific count as Fodda-supplied and to be confirmed with the Fodda team, never as independently verified inside this report. The live MCP server currently exposes 31+ tools — the catalog in §3 is the **headline set**, not the full inventory.

This specification instructs an autonomous coding agent to analyze a local codebase and produce a structured report mapping out high-value use cases and integration surfaces for Fodda.

---

## 2. Constraints

### RULE: Privacy
- The agent MUST NOT transmit, log, or leak any source code, file contents, secrets, environment variables, or architectural details to any external service, endpoint, or network request — Fodda's endpoints included.
- The agent MUST NOT open or read files whose purpose is to hold secrets. Treat as off-limits: anything matched by `.gitignore`, and any file matching `.env*`, `*.pem`, `*.key`, `*_token*`, `*credential*`, `*secret*`, `*.tfvars`, or `service-account*.json`. Identify third-party integrations from import statements and client instantiation, never from the secret values themselves. The report MUST state that secret-bearing files were deliberately skipped.
- The agent MUST NOT embed source code snippets in any output that could be copy-pasted by third parties. Reference files by path and line range only.
- Before delivering or saving the report, the agent MUST run a redaction self-check: scan the drafted report for any code, secret, or internal identifier that slipped in, strip it, and prepend a one-line attestation that the check was performed.
- All output MUST remain local to the user's machine. The user has sole discretion over whether to share any findings with the Fodda team.

### RULE: Reconnaissance Budget
- The agent MUST inventory files (paths and sizes) before reading them, and MUST NOT attempt to read the entire repository indiscriminately.
- The agent MUST skip generated, vendored, and binary artifacts: `node_modules/`, `dist/`, `build/`, `.next/`, `vendor/`, `*.min.*`, `*.map`, lockfiles, and any data asset over ~100 KB.
- The agent SHOULD prioritize the highest-signal files first: system-prompt and LLM-call sites, insight/report/recommendation generators, dashboards and data-viz, retrieval/RAG layers, and scheduled/outbound jobs.
- The agent MUST NOT claim full coverage if any major directory was only sampled. Report what was scanned, sampled, and skipped (see §7).

### RULE: Output Delivery
- The agent MUST present a concise, human-readable Executive Summary directly in the chat conversation upon completion (target ≤ 250 words).
- The agent SHOULD then ask the user: "Would you like me to save the full report as `Fodda_Integration_Opportunities.md` in your project root?"
- If the user agrees, the agent MUST write the full report as a Markdown file. If the user declines, the full report SHOULD be presented in the chat instead.

### RULE: Scope
- The agent MUST limit its analysis to the currently open project/workspace.
- The agent MUST NOT modify any existing source code.
- The agent MUST NOT install packages, run build commands, or execute any code.

### RULE: Placement, not gatekeeping (The Enrichment Firewall)
Fodda belongs at the **output / presentation layer**, where it enriches what the user sees — not inside the loop that produces a decision before it is finalized. This is a placement rule, not a reason to skip an opportunity, and it exists to protect the prospect's reproducibility, auditability, and compliance posture.
- **ALLOWED:** an advisory widget or context panel on the *screen that displays* an engine's output; enriching a user-facing explanation, summary, dashboard, or teardown; grounding generated copy in expert sources; attaching trend rationale or citations to an already-ranked list.
- **DISALLOWED:** any Fodda call whose result feeds back into a score, ranking, eligibility, clinical, or authority decision *before that decision is finalized* (e.g., Clinical Diagnosis, Core Candidate Ranking, Critical Logic Engines).
- A deterministic rules/scoring engine is therefore a **positive** signal for adjacent presentation-layer enrichment — not a no-go zone for the whole subsystem. Treat the result screen as the integration surface; leave the decision path untouched.

### RULE: Respect Deterministic Architecture
- The constraint is on the **decision runtime**, not on integration as such. If the codebase uses a deterministic rules engine for decisions or recommendations, the agent MUST NOT recommend injecting LLMs or autonomous agents into that decision path.
- It MAY still recommend a presentation-layer enrichment for a deterministic app — implemented as a plain REST API call or a static, cached data-fetch hook, not an LLM-driven agent loop. A new user-facing widget that reads Fodda data is fine; an agent that participates in the decision is not.
- Where the prospect's own product cannot host any runtime call, suggest how external developer agents (e.g., desktop Claude or Cursor) could use the tools instead.

### RULE: Objective Tone & No Boilerplate
- The output report MUST be a neutral, objective engineering scoping document, not a sales pitch or vendor procurement justification. Claims of impact MUST be tied to an observed pattern in the code, not asserted.
- The agent MUST NOT use placeholder company names or boilerplate examples (e.g., "Daydream") unless they are part of the scanned codebase. Customize all examples and summaries to fit the project's actual domain.
- The agent MUST NOT justify any single opportunity with aggregate marketing phrasing (e.g., "100+ graphs / 80+ sources"). Each opportunity names the specific covering graph or expert it would rely on, or it is downgraded.

### RULE: Tone
- All output MUST be written for a mixed audience of product managers and engineers.
- The Executive Summary MUST be understandable by a non-technical product lead.
- Technical details (file paths, architecture diagrams, tool mappings) belong in subsequent sections, not the summary.

---

## 3. Fodda Capability Catalog

### RECORD: FoddaCapability
- name: String — MCP tool name
- purpose: String — what it does
- value_signal: String — what kind of codebase pattern suggests this tool would add value

### TOKEN: MCP_Tools

This is the **headline set**. The live server exposes 31+ tools (23 named + 8+ dynamic skill tools); match against the full inventory where you recognize a fit. The catalog below is a point-in-time snapshot — Fodda's graph library and expert roster evolve, so treat specific names as examples and confirm current coverage at [app.fodda.ai](https://app.fodda.ai). This audit itself stays offline and makes no Fodda calls.

| Tool | Purpose | Look for this in the codebase |
|------|---------|-------------------------------|
| `search_graph` | Semantic search across expert-curated trend graphs. Returns trends with lifecycle signals, evidence, and source attribution. | Any feature generating insights, reports, or recommendations from generic LLM output without domain grounding. |
| `get_evidence` | Retrieve curated source articles and structured evidence (case studies, statistics, expert quotes) for a specific trend — each item carries `sourceUrl`, `publishedAt`, `brandNames`, and a `formatted_citation`. | Any feature that shows a claim/insight without sources; a "Sources" / "References" / "Citations" panel built from generic web scraping; a footnote or fact-check pass; a TODO about adding source attribution. The highest-trust drop-in — it answers the exact distrust problem in §1. |
| `search_statistics` | Search curated quantitative data points (market sizes, growth rates, brand case studies) inside Fodda's expert graphs, each with parent-trend context. Intended *before* supplemental tools for numbers experts may already cover. | Hardcoded or stale market-size, TAM, growth-rate, or KPI figures; pitch-deck or sizing tools citing a single static report. |
| `search_insights` | Search expert quotes and editorial interpretations (metric / quote / interpretation / signal) with source attribution. | "What experts say" panels, pull-quotes, qualitative analysis, or perspective/testimonial surfaces built from generic LLM text. |
| `get_supplemental_context` | Live macro-economic statistics from institutional sources (e.g., US Census, FRED, BEA, OECD) plus a growing set of national sources. | Any feature referencing market size, economic indicators, or demographic data, especially if hardcoded or outdated. **Check target geography before flagging** — coverage is strongest for the US and OECD economies and uneven by country, so confirm what's available from the tool's output rather than assuming. |
| `consult_analyst` | Route questions to a named Digital Twin expert grounded in a specific graph. Current Active Digital Twins include Ben Dietz (Strategy, Innovation & Culture — SIC), Piers Fawkes (retail strategy & consumer innovation), Anu Lingala (beauty & wellness), and Jeremy Bergstein (experiential retail & science-education commerce), alongside role-based synthetic leads (retail, marketing & media, tech, food & beverage). The roster grows — names here are the active experts; confirm the current roster at app.fodda.ai. | Chat interfaces, advisory features, or "ask an expert" flows on a generic system prompt — recommend ONLY with a specific, domain-matched expert named. |
| `list_analysts` / `list_graphs` | Discover the live roster of experts and the available knowledge graphs (IDs, authors, sectors). `list_graphs` is the canonical "what does Fodda cover" lookup once integrated. | Any UI presenting a selectable roster of specialists or knowledge domains. (These are runtime product capabilities — this offline audit does not call them; judge domain fit from §0 instead.) |
| `discover_adjacent_trends` / `get_neighbors` / `get_node` | Find semantically and editorially related trends, brands, and cross-domain links around a starting concept, using Fodda's embedding space and curated graph edges. Web search cannot replicate this. | "Related items", "you-may-also-like", "recommended for you", "explore related", "trending alongside", or discovery/landscape modules; self-maintained co-occurrence or vector-similarity engines; graph/relationship data models. |
| `generate_visual` | Branded, presentation-ready SVG visuals (From→To cultural shifts, 2-axis competitive compass, trend constellation, implication ladder, innovation pathway, 2×2 opportunity map) that render inline. | Any dashboard/chart/data-viz component (D3/Chart.js/Recharts), slide/deck/PDF export, or 2×2 matrix renderer. A firewall-safe, presentation-layer drop-in. |
| `deep_research_topic` | Fodda's autonomous research agent synthesizes complex, multi-graph briefings with auto-generated visual maps. | Any "deep dive," "research," or "briefing" feature that currently relies on web search or a single LLM call. |
| `get_earnings_intelligence` / `get_earnings_divergence` | Cross-company earnings-call analysis: C-suite strategic shifts, management-vs-analyst divergence, forward guidance. | Competitive-intelligence dashboards, investor-briefing tools, or strategy-planning features. |
| `brand_tracker` | Cross-graph brand footprint — competitive positioning, trend associations, share-of-voice. | Brand monitoring, competitive benchmarking, or market-positioning features. |
| `manage_scheduled_reports` | Schedule recurring weekly/daily intelligence briefings delivered via email or Slack. | Any cron / scheduled-digest / newsletter / recurring-report feature (node-cron, Celery beat, BullMQ, Cloud Scheduler, Airflow). |
| `read_url` | Extract clean text from any URL and cross-reference it against Fodda graphs. | Features that ingest competitor sites, pasted links, or external articles for analysis. |
| `get_domain_intelligence` | Domain-level trend intelligence summary across curated graphs, with bundled evidence. | Category-overview, market-briefing, or "state of the sector" surfaces. |
| `search_domain_graphs` / `search_expert_graphs` / `search_report_graphs` | Type-scoped semantic search — target only PSFK domain graphs, expert/human-agent graphs, or industry report graphs respectively. Use when the codebase's domain maps cleanly to one graph type. | Same as `search_graph`, but when the prospect's vertical aligns with a specific graph category (e.g., consulting firms → `search_report_graphs` for Deloitte/McKinsey/WEF reports). |
| `search_filtered` | Faceted search with filters (lifecycle stage, geography, sector, date range) across all graphs. | Any feature that already offers filter/facet controls on its own content — a natural UX extension. |
| `get_trend_details` / `get_related_concepts` / `get_label_values` | Core graph exploration — full trend detail, concept relationships, and available label/facet values for a graph. | Drill-down UIs, detail panels, or "explore more" flows; any feature that needs structured metadata about a trend beyond the search result snippet. |
| `research_chat` | Interactive, multi-turn research session with context memory across the conversation. | Multi-step research workflows, "ask follow-up" patterns, or conversational analysis features. |
| Divergent-thinking suite (router: `paralogy_divergent-thinking-tools-router`; incl. `paralogy_blind-spot-scan`, `paralogy_de-slop`, `paralogy_anti-homogeneity-check`, `paralogy_think-wrong`, `paralogy_persona-divergence-engine`, `paralogy_wrong-problem-detector`, …) + `brainstorm_topic` | Structured ideation, blind-spot mapping, and anti-homogeneity / "de-slop" protocols grounded in expert graphs. | Brainstorming, naming, campaign/concept-generation, or writing-assistant features; any "make this less generic / less AI-sounding" rewrite or "what are we missing" ideation surface. |

---

## 4. Execution

### SEQUENCE: Use Case Discovery

0. **Domain & Geography Coverage Check (do this first).** Infer the product's primary vertical and target geography from package manifests, README, route/model names, and recurring domain nouns. Compare against Fodda's covered domains (consumer/retail/CPG, beauty/wellness, fashion, food/beverage/restaurants, sports, marketing/comms, brand, media, travel/hospitality, home/living, health & life sciences, culture/streetwear, macro trends) and supplemental data regions (US, UK, EU, Nordics, Americas, Asia-Pacific, Middle East/Africa, Pacific Islands, Netherlands, Canada, plus 17 global sources). Also check the 48 industry research reports — if the prospect's vertical aligns with a published report (e.g., Mintel beauty, WEF future of retail, Deloitte consumer), that is a strong domain match. Record an overall fit verdict — **Strong / Partial / Poor** — with one line of justification. If fit is Poor, that becomes the lead finding; do not manufacture matches.

1. **Reconnaissance.** Working within the Reconnaissance Budget (§2), explore the project structure and map the major components: frontend, backend, agent orchestration, **retrieval / RAG / vector stores**, data pipelines, content generation, **recommendation / search / personalization engines**, **dashboards & data-viz**, **outbound & scheduled jobs (email, digests, cron)**, API integrations, system prompts, and configuration files.
   - **1b. Domain & End-User inference.** Before matching tools, note who the product's end users are and what domain decisions they make — so you can later name the *right* graph/expert, not the nearest of a short list.

2. **Signal Detection.** For each component, check against the `value_signal` column in §3. Flag every file or feature where a Fodda capability could replace or augment an existing pattern.
   - **2b. Latent-need & roadmap detection.** Do not limit yourself to existing AI features. Also flag: `TODO`/`FIXME`/`HACK` comments naming a missing data, insight, or research source; stubbed / "comingSoon" / feature-flagged-off components; hardcoded constants or static arrays (market sizes, competitor lists, trend lists) clearly meant to be live; and **non-AI surfaces hosting static or stale domain content** (category pages, CMS fields, hand-written "why this trend matters" blurbs) that are greenfield homes for a *new* Fodda-powered widget.
   - **2c. Freshness lens.** Note repo-committed data with old dates, stale caches with no refresh job, and model output frozen at a training cutoff — candidates for `search_graph` lifecycle signals + `manage_scheduled_reports`.

3. **Opportunity Scoring.** For each detected signal, assess:
   - **Impact** — effect on the end-user experience. *High* = removes distrust/hallucination or unlocks a capability the product cannot offer today; *Medium* = meaningful enrichment of an existing surface; *Low* = nice-to-have.
   - **Effort** — *Drop-in* = single hydration point / one tool call; *Moderate* = a new surface or a few wired calls; *Architectural* = touches data flow or infra.
   - **Confidence** — *High* = the exact construct was observed (cite `path:line`); *Medium* = strong structural signal; *Low* = naming inference only. Low-confidence items go in a separate "Speculative — needs confirmation" subsection, never the main opportunity table.
   - **Tool Match** — the specific Fodda tool(s), **and a named covering graph or expert** (or the opportunity is *downgraded* — moved to the Speculative subsection or dropped, never shown in the main opportunity table).
   - **Status-quo cost** — what the team would otherwise build and maintain in-house (data feeds, expert curation, refresh cadence) versus a metered API call. This build-vs-buy line is usually the real reason to act.

4. **Report Assembly.** Compile findings into the output structure below. Express the strongest opportunities as multi-tool *sequences* (e.g., `list_graphs` → `search_graph` → `get_evidence` → `generate_visual`), and include at least one cross-cutting "Platform Integration" opportunity where it fits.

5. **Delivery.** Run the redaction self-check, present the Executive Summary in chat, then offer to save the full report per the Output Delivery rule.

---

## 5. Output Structure

### RECORD: IntegrationReport
- top_line_recommendation: String — **One sentence, rendered first in the report as a bold callout.** States the single highest-ROI action the team should take (e.g., "Wire `get_evidence` into the Citations panel to replace web-scraped references with expert-attributed sources."). If domain fit is Poor, this becomes: "Fodda is not a strong fit for this codebase — see Limitations." This line must be actionable and specific, not a restatement of the executive summary.
- executive_summary: String — ≤ 250-word plain-English summary for a product lead. MUST state: how many opportunities were found, the inferred domain and overall fit verdict (Strong/Partial/Poor), the highest-impact opportunity in one sentence, and a one-line explanation of what Fodda is. If fit is Poor, lead with that.
- domain_fit: String — inferred vertical + geography and the Strong/Partial/Poor verdict with justification.
- opportunity_table: Table — opportunities (excluding Low-confidence), columns: Feature, Fodda Tool(s), Covering Graph/Expert, Impact, Effort, Confidence, one-line description.
- detailed_opportunities: List[OpportunityDetail] — ordered by impact (high first).
- speculative: List[OpportunityDetail] — Low-confidence items, clearly separated.
- proposed_integration_paths: List[String] — how to integrate: client-side agent prompts, backend REST API/MCP data hydration points, or static data caches, respecting architectural constraints.
- architecture_sketch: String — ASCII or Mermaid diagram showing how Fodda would sit in the existing data flow, reflecting the placement firewall between decision logic and output enrichment.
- limitations_and_non_fit: String — at least one area Fodda does not serve well for this codebase (an uncovered domain/geography, a decision path that must stay untouched, or a surface where status quo is already adequate). This section is mandatory.
- coverage: String — directories scanned / sampled / skipped, per the Reconnaissance Budget; states plainly if any major area was only sampled.
- attestations: String — confirms the redaction self-check ran and that secret-bearing files were deliberately skipped.
- next_steps: String — concrete actions (see below).

### RECORD: OpportunityDetail
- feature: String — name of the feature or component
- file_paths: List[String] — relevant file paths (no source code, paths only)
- current_approach: String — how the feature works today
- fodda_enhancement: String — what changes with Fodda integrated, and what changes *for the end user*
- tools: List[String] — which MCP tool(s) apply
- covering_graph_or_expert: String — the specific Fodda graph/expert this relies on
- impact: Enum(High, Medium, Low)
- effort: Enum(Drop-in, Moderate, Architectural)
- confidence: Enum(High, Medium, Low) — with the `path:line` evidence for High/Medium
- status_quo_cost: String — what building/maintaining this in-house would take
- integration_pattern: String — a technical pattern (a sample goal-oriented agent prompt for agentic setups, OR a backend REST/MCP data hydration pattern for deterministic/firewalled setups)

---

## 6. Scenarios

### SCENARIO: Chat Interface with Generic LLM
- Given: a chat UI backed by a foundation model with a generic system prompt and no domain-specific data sources.
- Then: flag a High-impact opportunity for `search_graph` + `consult_analyst` (with a named, domain-matched expert), grounding the chat in expert-curated intelligence instead of training data.

### SCENARIO: Citations / Source-Attribution Gap
- Given: a feature that surfaces claims or insights with a bare "Sources" section, generic web-scraped references, or a `TODO: add citations`.
- Then: flag a High-impact, low-controversy opportunity for `get_evidence` to hydrate the panel with `formatted_citation` + `sourceUrl` + `publishedAt` — the most direct answer to the distrust problem in §1.

### SCENARIO: RAG / Vector Store with Unattributed Retrieval
- Given: a LangChain/LlamaIndex pipeline or a Pinecone/Weaviate/pgvector store returning self-scraped, unattributed snippets.
- Then: flag adding Fodda graphs as a parallel, attributed retriever (`search_graph` + `get_evidence` + `get_neighbors`) so every answer carries a named expert source.

### SCENARIO: Recommendation / "Related Items" Engine
- Given: a "you-may-also-like", related-content, or discovery module backed by self-maintained similarity or co-occurrence.
- Then: keep Fodda out of the ranking loop (firewall); flag enriching the *presented* result with adjacency rationale and tags via `discover_adjacent_trends` / `get_neighbors`.

### SCENARIO: Dashboards, Charts & Scheduled Digests
- Given: hand-built D3/Chart.js dashboards, deck/PDF exports, or a cron-driven "weekly market pulse" email.
- Then: flag `generate_visual` for branded presentation-layer visuals, and `manage_scheduled_reports` + `deep_research_topic` for recurring briefings.

### SCENARIO: Deterministic / Non-AI Product
- Given: a storefront, CMS, or rules-engine app with static or stale user-facing domain content and no AI today.
- Then: do **not** default to "none found." Propose a *new* Fodda-powered enrichment widget at the presentation layer (e.g., a "what's trending in this category now" panel), respecting the firewall.

### SCENARIO: Poor Domain Fit
- Given: a vertical Fodda does not cover (e.g., payments/dev-tools/observability infra) or a geography with no institutional coverage.
- Then: state this plainly as the lead finding. List the few genuine presentation-layer enrichments if any exist, and explicitly note where Fodda is not a fit. An honest "limited fit" report is the goal, not a manufactured match.

---

## 7. Definition of Done

- [ ] §0 Domain & Geography check ran first; report states inferred domain + Strong/Partial/Poor fit verdict.
- [ ] Reconnaissance respected the budget; report lists directories scanned / sampled / skipped and does not claim full coverage if any major dir was only sampled.
- [ ] Secret-bearing files were skipped, and the report says so.
- [ ] Every opportunity references specific file paths (not source code), and every High/Medium opportunity carries a `path:line` evidence citation, a named covering graph/expert, and a status-quo-cost line — or it is downgraded.
- [ ] Low-confidence items are confined to the "Speculative" subsection.
- [ ] A mandatory "Limitations & Non-Fit" section names at least one area Fodda does not serve here.
- [ ] The Executive Summary (≤ 250 words) is understandable by a non-technical reader and states count + top opportunity + what Fodda is.
- [ ] At least one proposed integration pattern is included per opportunity; the strongest are expressed as multi-tool sequences.
- [ ] An architecture sketch shows Fodda's presentation-layer placement and the decision-path firewall.
- [ ] The redaction self-check ran; zero source code or secrets transmitted externally or embedded in output.
- [ ] Zero files in the project were modified; the user was offered file-vs-chat delivery.
- [ ] `next_steps` leads with the free self-serve path: pick the single highest-ROI pilot (one feature + one tool), validate it free at [app.fodda.ai](https://app.fodda.ai) (a free Base account — currently 100 API calls/month across all graphs), then optionally share this report with the Fodda team at [hello@fodda.ai](mailto:hello@fodda.ai).
