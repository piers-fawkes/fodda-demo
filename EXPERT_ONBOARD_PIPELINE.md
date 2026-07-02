# Expert Onboard Interview Pipeline

> **Purpose:** Documents how expert onboarding interviews are captured, processed, and turned into knowledge graphs across the Fodda codebase.  
> **Last updated:** 2026-06-15

---

## Overview

The Expert Onboard pipeline takes a human expert through an interactive interview wizard, extracts structured signals from their voice/expertise data, creates their digital twin record, and provisions their account — all before downstream graph enrichment begins.

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Fodda Website     │     │   Fodda API          │     │   Fodda CE          │
│   (Interview +      │────▶│   (Account +         │     │   (Graph Build +    │
│    Processing)      │     │    Provisioning)     │     │    Enrichment)      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
       Steps 1–6              Sales Agent call            Downstream scripts
```

---

## Repo Responsibilities

### 1. Fodda Website — Interview Capture & Data Processing

**Directory:** `/Users/piersfawkes/Documents/Fodda Website`  
**Role:** Frontend wizard + server-side interview processing  

#### Frontend: `pages/JoinExperts.tsx`

A 3,400-line multi-step wizard at `https://www.fodda.ai/join-experts`:

| Step | Title | What Happens |
|------|-------|-------------|
| 1 | **Intake** | Collects name, email, role, LinkedIn, writing destinations, call pricing |
| 2 | **Focus** | Knowledge area definition + deck/document upload |
| 3 | **Data Intake** | Expert pastes Voice Study JSON + Expert Topics JSON (generated from Claude conversation analysis prompts in Fodda CE) |
| 4 | **Preparation** | Interview question setup |
| 5 | **Voice Interview** | Interactive audio interview with TTS playback and speech recognition |
| 6 | **Launch** | Preview extracted signals + deploy the digital twin |

There is also a **Facilitator Mode** (`?mode=facilitator`) with a streamlined 5-step flow for team-assisted onboarding.

#### Backend: `server.js`

Three key API endpoints handle the processing:

| Endpoint | Line | Purpose |
|----------|------|---------|
| `POST /api/deep-research` | — | Google Search–grounded research on the expert's published work (Gemini + grounding) |
| `POST /api/analyze-interview` | ~476 | Runs `extractInterviewSignals()` via Gemini to mine the interview transcript into structured signals: signature insights, coined terms, recurring tensions, blind spots, signature quotes, suggested queries |
| `POST /api/onboard-expert` | ~498 | **Main pipeline** — orchestrates the full onboarding (see below) |

#### `POST /api/onboard-expert` — Full Pipeline

1. **Parse structured data** from Voice Study JSON + Expert Topics JSON into:
   - `expertiseMap` — tiered topic coverage
   - `signatureInsights` — distinctive expert perspectives
   - `blindSpots` — areas the expert doesn't cover
   - `crossGraphConnections` — links to other Fodda graphs
   - `exampleQueries` — suggested questions to ask the twin

2. **Mine interview transcript** via `extractInterviewSignals()` (Gemini) — gap-fills any fields the prompt JSONs left empty

3. **Create/update Analyst record** in Airtable (base `appXUeeWN1uD9NdCW`, table `Analysts`) with all structured fields, transcript, documents, and headshot

4. **Upload attachments** — full transcript (`.txt`), interview extraction (`.json`), and uploaded documents via Airtable Content API

5. **Create/update Graph Registry entry** in Airtable (same base, table `tblf8OPpi0F16ofAX`) with graph metadata, type `analyst`, status `active`

6. **Provision account** via Sales Agent (`/api/provision-expert`) — creates Fodda user account + API key + MCP URL

7. **Send welcome email** with MCP connection instructions and Claude connector URL

---

### 2. Fodda API — Account & Query Infrastructure

**Directory:** `/Users/piersfawkes/Documents/Fodda`  
**Role:** Main API server at `api.fodda.ai` — handles user accounts, authentication, API keys, and the query layer that serves the expert's digital twin via `POST /v1/analysts/consult`

The API doesn't directly process the onboarding interview, but it:
- Hosts the **Sales Agent** integration that provisions expert accounts
- Serves the **query endpoint** that the expert's twin responds through
- Manages **user authentication** (Clerk) and **API key generation**
- Runs the **email service** (onboarding sequences, contextual emails)

Key services related to experts:
- `server/services/personaSynthesisService.ts` — synthesises expert persona responses
- `server/services/waverunnerExtractionService.ts` — extracts expert evidence
- `server/services/emailService.ts` + `emailTemplates.ts` — expert email flows

---

### 3. Fodda CE — Graph Building & Content Enrichment

**Directory:** `/Users/piersfawkes/Documents/Fodda CE`  
**Role:** ExpertGraph Pipeline Server at `expert.fodda.ai` — builds and enriches the knowledge graphs that power expert twins

Fodda CE takes over **after** the Website has created the Analyst + Registry records in Airtable. It:

#### Onboarding Prompts (given to experts)

These prompt templates generate the structured JSON data that experts paste into Step 3 of the wizard:

| File | Purpose |
|------|---------|
| `README_Voice_Study_Prompt.md` | Prompt for Claude to analyze expert's conversation history → `voice_study.json` |
| `README_Expertise_Brief_Prompt.md` | Prompt for Claude to extract expertise tiers → `expert_topics.json` |
| `conversation_analysis_prompts.md` | Combined v2 prompts with structured JSON output schemas |
| `onboarding_guide.md` | Full step-by-step guide: Voice Study → Expert Card → Airtable Deploy → Iterate |

#### Graph Building Scripts

| Script | Purpose |
|--------|---------|
| `scripts/ingest-expert-json.ts` | Ingests `voice_study.json` + `expert_topics.json` → generates Expert Card markdown → creates Airtable records + Neo4j graph nodes with embeddings |
| `scripts/enrich-expert-evidence.ts` | Enriches expert graph with evidence from published sources |
| `scripts/batch-neo4j-sync.ts` | Batch syncs Airtable data → Neo4j graph database |
| `scripts/backfill-expert-json-fields.ts` | Backfills structured JSON fields on existing expert records |

#### Graph Serving

| File | Purpose |
|------|---------|
| `src/new-graph/routes.ts` | Dashboard + API for creating new expert graphs from PDF reports |
| `src/shared/generic-graph/routes.ts` | Serves any graph dashboard at `/:user/:graph` |
| `src/agents/expert-scout/` | AI agent for scouting potential new experts |
| `src/agents/copy-editor/` | AI agent for editing expert content |

---

## Data Flow Summary

```
Expert fills wizard                    Server processes
─────────────────                    ─────────────────
                                     
JoinExperts.tsx ──────────────────▶  server.js
  Step 1: Profile info                 │
  Step 2: Knowledge area + deck        │
  Step 3: Voice Study JSON             │
         Expert Topics JSON            │
  Step 4: Interview prep               │
  Step 5: Voice interview              │
  Step 6: Review + launch              │
                                       ▼
                              ┌─── extractInterviewSignals()
                              │    (Gemini → structured signals)
                              │
                              ├─── Airtable: Analysts table
                              │    (Expert Card, transcript,
                              │     structured JSON fields,
                              │     document attachments)
                              │
                              ├─── Airtable: Registry table
                              │    (Graph metadata, status)
                              │
                              ├─── Sales Agent: /api/provision-expert
                              │    (Account, API key, MCP URL)
                              │
                              └─── Welcome email
                                   (MCP setup instructions)
                                       │
                                       ▼
                              Fodda CE (downstream)
                              ┌─── ingest-expert-json.ts
                              │    (Expert Card + Neo4j nodes)
                              │
                              ├─── enrich-expert-evidence.ts
                              │    (Published source enrichment)
                              │
                              └─── batch-neo4j-sync.ts
                                   (Full graph sync)
```

---

## Key Infrastructure

| Service | URL | Purpose |
|---------|-----|---------|
| Website | `www.fodda.ai` | Interview wizard + onboarding server |
| API | `api.fodda.ai` | Query layer + account management |
| ExpertGraph | `expert.fodda.ai` | Graph dashboards + enrichment pipeline |
| Airtable | Base `appXUeeWN1uD9NdCW` | Analyst records + Graph Registry |
| Neo4j | Via env vars | Knowledge graph database |
| Sales Agent | Cloud Run | Account provisioning + CRM |
