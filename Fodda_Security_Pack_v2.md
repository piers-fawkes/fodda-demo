# Fodda Security Pack Draft (v2.0)
*Enterprise Readiness & Procurement Reference*

This document provides a comprehensive overview of the Fodda Security Posture, following the **SIG (Standardized Information Gathering)** and **CAIQ-Lite** frameworks.

---

## 1. Executive Security Statement
Fodda is a **Privacy-First Intelligence Layer**. We provide read-only access to proprietary Knowledge Graphs. Our architecture is designed to eliminate common enterprise AI risks (hallucinations, data leakage, and unauthorized training).

- **No Data Retention**: Fodda does not store client query content by default.
- **Deterministic Data**: Results are strictly sourced from verified graph evidence.
- **Identity Separation**: System identities (API Keys) are cryptographically separated from human user identities in all audit logs.

---

## 2. Core Security Controls (Questionnaire Response)

### Governance & Data Privacy
| Control | Fodda Standard |
| :--- | :--- |
| **Direct Client Data Storage** | **NONE.** Fodda does not ingest or store client datasets. |
| **Model Training** | Fodda **does not train** models on client interactions or queries. |
| **Data Retention** | **Metadata Only.** We retain identifiers (requestId, latency) for billing. Optional **Debug Mode** exists for temporary tracing (must be admin-enabled). |
| **In-Transit Security** | Forced TLS 1.3 / HTTPS for all API and MCP communication. |

### Access & Identity
| Control | Fodda Standard |
| :--- | :--- |
| **Authentication** | API Key based (`X-API-Key`). Individual keys per system/tenant. |
| **Identity Separation** | Audit logs distinguish between `apiKeyId` (System) and `userId` (Human). |
| **Revocation** | Immediate. API keys can be revoked or rotated via the Admin Portal. |
| **SAML/SSO** | Admin Panel supports Magic Link auth; proxy layer is key-managed for ease of MCP/server integration. |

---

## 3. Technical Hardening & Determinism

### A. Deterministic Mode (Hard Default)
Fodda enforces a strict **Deterministic Mode** for all enterprise queries by default:
- **Hard Grounded Retrieval**: Every response is strictly grounded in the knowledge graph. Heuristic summarization is available only via explicit opt-in.
- **NO_MATCH Safeguard**: If no relevant data is found within the graph, the API returns a structured `NO_MATCH` code (`decision: REFUSE`) rather than generating synthetic text.
- **Auditable Provenance**: Every statement in a response is linked to a permanent `ArticleID` or `TrendID`.

### B. Hard Resource Caps (Traversal Limits)
To prevent resource exhaustion and accidental mass exposure, the proxy layer enforces **Server-Side Hard Caps**:
- **Max Depth**: 2 levels.
- **Max Evidence Chunks**: 15 pieces of supporting data per query.
- **Max Top_K**: 10 most relevant results.
- **Max Graph Nodes**: 50 nodes per traversal.

### C. Versioned Response Envelope (Locked Schema)
Fodda provides a stable API schema to prevent breaking changes for enterprise integrators. Every response includes:
- `schema_version`: Locked version of the response structure (current: 1.0).
- `graph_version`: Identifies the specific data collection and model iteration.
- `deterministic`: Explicit confirmation of the retrieval mode used.

---

## 4. Structured Audit Logging & Traceability
Every request generates a verifiable signature in our forensic logs, ensuring end-to-end traceability for compliance teams.

```json
{
  "requestId": "968092dd93e58b9d",
  "apiKeyId": "recDGYv8pFpNegcf",   // System Identity (Service Account)
  "tenantId": "rec6mh0XQOablFDX",   // Customer Identity (Organization)
  "userId": "recGWh6XpdEZxw8AE",    // Human Identity (if passed from UI)
  "graphId": "Retail_Innovation",   // Resource Scope
  "mode": "METADATA_ONLY",
  "latency": "1240ms",
  "timestamp": "2026-02-13T22:15:00Z"
}
```

---

## 5. Architectural Isolation
- **Tenant Isolation**: API proxies enforce validation (Key -> Account -> Graph Permission) before any data is accessed.
- **Read-Only Infrastructure**: The Discovery Engine is architecturally incapable of writing to or modifying the underlying Knowledge Graphs via the query interface.
- **Layer Separation**: Deterministic data retrieval (API/Neo4j) is strictly decoupled from the AI orchestration layer (MCP), preventing prompt injection from bypassing data controls.

---
*For further technical documentation, SOC2 Type II reports, or to review our full CAIQ-Lite response, please contact security@fodda.ai.*
