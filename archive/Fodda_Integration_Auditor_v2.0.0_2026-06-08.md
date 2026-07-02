---
id: FODDA-USECASE-ANALYSIS-001
title: Fodda Integration Use Case Analysis
version: 2.0.0
compliance: RFC-2119
owner: Fodda / PSFK
created: 2026-06-08
---

# Fodda Integration Use Case Analysis

Drop this file into your IDE agent (Cursor, Windsurf, Claude Code) and give it the prompt: **"Run the Fodda Use Case Discovery."** Your agent will autonomously analyze your codebase and identify specific areas where Fodda's expert intelligence layer can add value. The analysis stays entirely on your machine — nothing is transmitted externally. You decide what, if anything, to share with the Fodda team.

Learn more at [fodda.ai](https://www.fodda.ai).

---

## 1. Overview (Why)

Most AI applications query generic foundation models with no domain grounding. The result is plausible-sounding output that domain experts immediately distrust — hallucinated statistics, recycled conventional wisdom, no source attribution.

Fodda is a domain intelligence layer accessible via the Model Context Protocol (MCP) or REST API. It gives AI agents real-time access to 100+ expert-curated knowledge graphs, 80+ institutional data sources, and a roster of synthetic domain experts (Digital Twins).

This specification instructs an autonomous coding agent to analyze a local codebase and produce a structured report mapping out high-value use cases and integration surfaces for Fodda.

---

## 2. Constraints

### RULE: Privacy
- The agent MUST NOT transmit, log, or leak any source code, file contents, secrets, environment variables, or architectural details to any external service, endpoint, or network request.
- The agent MUST NOT embed source code snippets in any output that could be copy-pasted by third parties. Reference files by path and line range only.
- All output MUST remain local to the user's machine.
- The user has sole discretion over whether to share any findings with the Fodda team.

### RULE: Output Delivery
- The agent MUST present a concise, human-readable Executive Summary directly in the chat conversation upon completion.
- The agent SHOULD then ask the user: "Would you like me to save the full report as `Fodda_Integration_Opportunities.md` in your project root?"
- If the user agrees, the agent MUST write the full report as a Markdown file. If the user declines, the full report SHOULD be presented in the chat instead.

### RULE: Scope
- The agent MUST limit its analysis to the currently open project/workspace.
- The agent MUST NOT modify any existing source code.
- The agent MUST NOT install packages, run build commands, or execute any code.

### RULE: Architectural Boundaries (The Enrichment Firewall)
- The agent MUST NOT recommend placing Fodda tool calls directly inside core decision-making, scoring, rules evaluation, or authority validation loops (e.g., Clinical Diagnosis, Core Candidate Ranking, or Critical Logic Engines).
- Fodda's tools are designed to serve as an **enrichment, search, macro grounding, and presentation layer** (e.g., populating dashboards, providing context widgets, generating user-facing advisories/teardowns, or rendering summaries).
- The agent MUST keep Fodda integrated at the output/presentation stage, where it enriches the result presented to the user rather than steering the underlying decision flow.

### RULE: Respect Deterministic Architecture
- If the scanned codebase uses a deterministic rules engine for decision-making or recommendations, the agent MUST NOT recommend injecting LLMs or autonomous agents into that runtime path.
- Frame Fodda integration as REST API calls or static data-fetching hooks rather than dynamic LLM-driven agent orchestration loops.
- Do not propose runtime agentic prompts for the application itself if the architecture is deterministic; instead, suggest how external developer agents (e.g., desktop Claude or Cursor) might utilize the tools.

### RULE: Objective Tone & No Boilerplate
- The output report MUST be a neutral, objective engineering scoping document, not a sales pitch or vendor procurement justification.
- The agent MUST NOT use placeholder company names or boilerplate examples (e.g., "Daydream") unless they are part of the scanned codebase. Customize all examples and summaries to fit the project's actual domain.

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

| Tool | Purpose | Look for this in the codebase |
|------|---------|-------------------------------|
| `search_graph` | Semantic search across expert-curated trend graphs. Returns trends with lifecycle signals, evidence, and source attribution. | Any feature generating insights, reports, or recommendations from generic LLM output without domain grounding. |
| `consult_analyst` | Route questions to named Digital Twin experts: **Ben Dietz** (Culture & Streetwear), **Piers Fawkes** (Retail & Innovation), **Anu Lingala** (Beauty & Wellness), **Jeremy B** (Sports & Performance). More added regularly. | Chat interfaces, advisory features, or "ask an expert" flows that currently use a generic system prompt. |
| `list_analysts` | Dynamically discover the full roster of available Digital Twins and synthetic experts. | Any UI that could present a selectable roster of domain specialists. |
| `get_earnings_intelligence` | Cross-company earnings call analysis. Tracks C-suite strategic shifts, management-vs-analyst divergence, and forward guidance signals. | Competitive intelligence dashboards, investor briefing tools, or strategy planning features. |
| `deep_research_topic` | Triggers Fodda's autonomous research agent to synthesize complex, multi-graph briefings with auto-generated visual maps. | Any "deep dive," "research," or "briefing" feature that currently relies on web search or a single LLM call. |
| `brand_tracker` | Cross-graph brand footprint analysis — competitive positioning, trend associations, share-of-voice across domains. | Brand monitoring, competitive benchmarking, or market positioning features. |
| `get_supplemental_context` | Live macro-economic statistics from 80+ institutional sources (US Census, FRED, BEA, WHO, etc.). | Any feature that references market size, economic indicators, or demographic data — especially if currently hardcoded or outdated. |

---

## 4. Execution

### SEQUENCE: Use Case Discovery
1. **Reconnaissance** — Autonomously explore the project structure. Map the major components: frontend, backend, agent orchestration, data pipelines, content generation, API integrations, system prompts, and configuration files.
2. **Signal Detection** — For each component, check against the `value_signal` column in the `MCP_Tools` table above. Flag every file or feature where a Fodda capability could replace or augment an existing pattern.
3. **Opportunity Scoring** — For each detected signal, assess:
   - **Impact**: How much would Fodda improve the end-user experience here? (High / Medium / Low)
   - **Effort**: How complex is the integration? (Drop-in / Moderate / Architectural)
   - **Tool Match**: Which specific Fodda MCP tool(s) apply?
4. **Report Assembly** — Compile findings into the output structure defined below.
5. **Delivery** — Present the Executive Summary in the chat. Offer to save the full report per the Output Delivery rule.

---

## 5. Output Structure

### RECORD: IntegrationReport
- executive_summary: String — 3-5 paragraph plain-English summary written for a product lead. MUST state: how many integration opportunities were found, the highest-impact opportunity in one sentence, and a one-line explanation of what Fodda is.
- opportunity_table: Table — summary table of all opportunities with columns: Feature, Fodda Tool, Impact, Effort, one-line description.
- detailed_opportunities: List[OpportunityDetail] — one entry per opportunity, ordered by impact (high first).
- proposed_integration_paths: List[String] — developer instructions on how to integrate the opportunities: either via client-side agent prompts, backend REST API/MCP data hydration points, or static data caches, respecting target codebase architectural constraints.
- architecture_sketch: String — ASCII or Mermaid diagram showing how the Fodda MCP server or REST API would sit in the existing data flow, reflecting any firewalls between core decision logic and output enrichment.
- next_steps: String — concrete actions the team can take, including a note that they may share this report with the Fodda team at their discretion.

### RECORD: OpportunityDetail
- feature: String — name of the feature or component
- file_paths: List[String] — relevant file paths (no source code, paths only)
- current_approach: String — how the feature works today
- fodda_enhancement: String — what changes with Fodda integrated
- tools: List[String] — which MCP tools apply
- impact: Enum(High, Medium, Low)
- effort: Enum(Drop-in, Moderate, Architectural)
- integration_pattern: String — a technical pattern for integration (e.g., a sample goal-oriented agent prompt for agentic setups, OR a backend REST/MCP data hydration pattern for deterministic/firewalled setups)

---

## 6. Scenarios

### SCENARIO: Chat Interface with Generic LLM
- Given: The codebase contains a chat UI backed by a foundation model with a generic system prompt and no domain-specific data sources
- When: The agent scans the system prompt and chat orchestration layer
- Then: The agent SHOULD flag this as a High-impact opportunity for `search_graph` and `consult_analyst`, noting that Fodda could ground the chat in expert-curated intelligence instead of training data

### SCENARIO: Competitive Dashboard with Static Data
- Given: The codebase contains a competitive analysis view that displays hardcoded or periodically-scraped competitor data
- When: The agent identifies the data source as static or manually maintained
- Then: The agent SHOULD flag this as a High-impact opportunity for `brand_tracker` and `get_earnings_intelligence`, noting that Fodda provides live, cross-graph competitive positioning

### SCENARIO: Report Generator Using Web Search
- Given: The codebase contains a report or briefing feature that queries web search APIs and summarizes results
- When: The agent identifies the reliance on unstructured web results
- Then: The agent SHOULD flag this as a High-impact opportunity for `deep_research_topic`, noting that Fodda's research agent synthesizes across curated expert sources with source attribution

### SCENARIO: No Relevant Integration Points
- Given: The codebase is a utility tool, game, or system with no content generation, research, or intelligence features
- When: The agent completes its scan and finds no matching signals
- Then: The agent MUST report this honestly in the Executive Summary, stating that no high-value integration points were identified for Fodda at this time

---

## 7. Definition of Done

- [ ] The agent has scanned all major directories and components of the project
- [ ] Every detected opportunity references specific file paths (not source code)
- [ ] The Executive Summary is understandable by a non-technical reader
- [ ] The opportunity table is present and ordered by impact
- [ ] At least one proposed integration pattern (agent prompt, API endpoint, or hydration hook) is included per opportunity
- [ ] An architecture sketch is included showing Fodda's position in the data flow
- [ ] Zero source code has been transmitted externally
- [ ] Zero files in the project have been modified
- [ ] The user has been offered the choice of file vs. chat delivery
