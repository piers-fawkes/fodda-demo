# Expert Graph Upload Pipeline — Ecosystem Update (2026-04-11)

## Overview

The Fodda App (`app.fodda.ai`) now supports a full **Expert Graph PDF Upload Pipeline**, allowing users to upload PDF trend reports and have them converted into queryable knowledge graphs via AI extraction. The pipeline integrates the App with the Content Engine (CE) at `expert.fodda.ai` and includes an admin review step for quality control.

## New App Routes & Pages

| Route | Component | Purpose |
|---|---|---|
| `create-graph` | `CreateGraphPage.tsx` | Standalone page for PDF upload → AI extraction → metadata review → submit |

**Entry points:**
- Sidebar: **GRAPHS → Create Graph** (3rd item after My Graphs, Team Graphs)
- My Graphs → Custom → Linked Research → **"Upload PDF"** button

## New App Server Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/expert-graph/upload-pdf` | Accepts `{pdfUrl}` or `{pdfFileBase64, pdfFileName}`. Downloads/decodes PDF, forwards raw bytes to CE's `/new/api/preview-pdf`. Falls back to Gemini 2.0 Flash if CE unavailable. |
| `POST` | `/api/expert-graph/submit` | Creates `pending_review` record in CE's Graphs table (`appnYwCT6QlDSy5i3`) + App's own Graph Registry. Sends admin notification email to `hello@psfk.com`. |
| `GET` | `/api/expert-graph/my-submissions` | Returns user's submissions from both App registry and CE Graphs table, merged with CE status taking priority. |
| `GET` | `/api/expert-graph/team-submissions` | Returns team/network-shared submissions for a given `accountId`. |

## Distribution Modes

Graphs now support 4-way distribution when submitted:

| Mode | Scope | Catalog Visibility |
|---|---|---|
| `private` | Only the submitting user | Not in catalog |
| `team` | All users on the same account | Shown in Custom → Team Reports sub-section |
| `network` | All Fodda users | Public catalog |
| `sell` | All Fodda users, paid access | Public catalog, 50% revenue share |

## Airtable Integration

### CE Graphs Table (base `appnYwCT6QlDSy5i3`)

Fields written on submit: `Graph ID`, `Graph Name`, `Expert Name`, `One Liner`, `Domain Label`, `Tags`, `Expert Headshot URL`, `Status` (`pending_review`), `PDF URL`, `User Slug`, `ownerId`, `accountId`, `Graph Type` (`Expert Graph`), `distributionMode`.

### App Graph Registry Table (App's own Airtable base)

Duplicate record for `my-submissions` reads, with fields: `graphName`, `graphSlug`, `description`, `creator`, `organization`, `status`, `sourceType`, `ownerId`, `accountId`, `distributionMode`, plus optional metadata fields.

## CE Integration

- **Extraction:** `POST https://expert.fodda.ai/new/api/preview-pdf` — App forwards raw PDF bytes, CE returns metadata, trend/evidence counts, suggested topics, and headshot URL.
- **Admin review:** CE's admin dashboard at `expert.fodda.ai` reads from the same Graphs table. Admin approves → CE runs full ingestion pipeline (PDF extraction, Airtable ingest, Neo4j sync, registry upsert, brief generation).
- **The App does NOT call** CE's `ingest-confirmed`, `graph-meta`, or `publish` endpoints.

## My Graphs / Team Graphs Updates

- **"New" section** — Shows graphs added/updated in last 14 days at top of catalog (when viewing "All" category).
- **Team Reports sub-section** — Under Custom category, shows team-shared graphs. In My Graphs mode, excludes user's own (shown in User Reports). In Team Graphs mode, shows all.
- **Category label updates:** Institutional → Supplemental, updated all category descriptions.
- **Group toggles** — Category-level toggles are now purple; individual graph toggles remain green.

## Status Flow

```
User uploads PDF → App extracts via CE → User reviews/edits → User submits
→ pending_review record in Airtable → Admin email sent
→ Admin reviews on expert.fodda.ai
  → Approves: CE runs full pipeline → Status → live → User sees 🟢
  → Requests revision: Status → needs_revision → User sees 🟠 + feedback + "Edit & Resubmit"
  → Declines: Status → declined → User sees 🔴
```
