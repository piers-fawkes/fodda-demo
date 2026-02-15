# Fodda Security & Architecture Pack (Draft v3.0)
*Enterprise Readiness, Architecture & Security Reference*

This document outlines the security posture, architectural design, and governance controls of the Fodda Discovery Engine. It is intended for enterprise security reviews, procurement, and technical due diligence.

---

## 1. Executive Summary

Fodda is a **Privacy-First Intelligence Layer** that provides deterministic access to proprietary Knowledge Graphs. Our architecture is fundamentally designed to eliminate common enterprise AI risks such as hallucinations, data leakage, and unauthorized model training.

- **Read-Only by Design**: The core engine has no write access to underlying Knowledge Graphs.
- **Deterministic Grounding**: All responses are strictly sourced from verified graph evidence.
- **Identity Isolation**: System identities (API Keys) are cryptographically separated from human users in all logs.
- **Transparent Metering**: Usage tracking is isolated from business logic, ensuring billing integrity without data pollution.

---

## 2. High-Level Architecture

The Fodda platform follows a **Hub-and-Spoke** architecture designed for security and scalability.

### A. Component Separation
1.  **Orchestration Layer (MCP / Frontend)**: Handles user interaction, context management, and prompt engineering. It *cannot* directly access the database.
2.  **API Gateway (The "Air Gap")**: A hardened proxy that authenticates requests, enforces scope, and applies traversal limits before passing queries to the engine.
3.  **Discovery Engine (Read-Only)**: The core logic that traverses the Neo4j Knowledge Graph. It runs in a strict "Read-Only" mode.
4.  **Data Layer (Neo4j)**: The source of truth. Isolated per tenant/graph.

### B. Traffic Flow
`User Request -> Orchestration (MCP) -> API Gateway [Auth & Scope Check] -> Discovery Engine [Deterministic Traversal] -> Data Layer`

---

## 3. Security Controls & Hardening

### A. Authentication & Identity
-   **API Key Enforcement**: All access requires a valid `X-API-Key`. Keys are tenant-scoped and rotatable via the Admin Portal.
-   **Identity Separation**: Audit logs strictly distinguish between:
    -   `apiKeyId`: The System/Service Account identity.
    -   `userId`: The downstream Human User identity (passed via headers).
    -   *Result*: A compromise of a user account does not compromise the system key, and vice versa.

### B. Scope Enforcement & Isolation
-   **Graph Scoping**: API Keys are cryptographically bound to specific Knowledge Graph scopes (e.g., `Retail_Innovation`). Requests for unauthorized graphs are rejected at the Gateway level (403 Forbidden).
-   **Tenant Isolation**: Data retrieval logic enforces a strict `TenantID` filter on every database query, ensuring no cross-tenant data leakage.

### C. Server-Side Traversal Limits (Hard Caps)
To prevent resource exhaustion (DoS) and excessive data exposure, the engine enforces strict, non-negotiable limits on every query:
-   **Max Depth**: 2 hops (prevents runaway traversals).
-   **Max Evidence**: 15 nodes per response (prevents data dumps).
-   **Max Top_K**: 10 most relevant vectors.
-   **Max Nodes**: 50 total nodes scanned per execution.

---

## 4. Deterministic Engine & Reliability

Fodda prioritizes **Accuracy over Creativity**. The engine is built to be deterministic.

### A. Deterministic Mode (Default)
-   **Grounded Retrieval**: The engine only returns data that explicitly exists in the graph.
-   **NO_MATCH Protocols**: If insufficient evidence is found, the API returns a structured `NO_MATCH` signal (`decision: REFUSE`) instead of hallucinating a plausible answer.
-   **Provenance**: Every claim in a response is linked to a permanent `ArticleID` or `TrendID`.

### B. API Stability & Versioning
-   **Locked Schema**: Responses follow a strict versioned envelope (`schema_version: 1.0`).
-   **Immutable Rules**: Core logic for ranking and retrieval is version-controlled to ensure that the same query yields the same result over time (assuming underlying data hasn't changed).

---

## 5. Data Privacy & Governance

### A. Data Retention Policy
-   **Zero Retention of Content**: Fodda **does not store** client query text or the returned evidence by default.
-   **Metadata Logging**: We retain only operational metadata (`requestId`, `latency`, `usage_units`) for billing and monitoring.
-   **No Training**: Client data and interaction logs are **never** used to train Fodda's internal models.

### B. In-Transit Security
-   **TLS 1.3**: Enforced for all internal and external communication.
-   **HTTPS**: Strict HTTPS for all public endpoints.

---

## 6. Commercial & Operational Transparency

### A. Transparent Metering
Fodda employs a "Glass Box" metering system:
-   **Isolated Usage Object**: Billing metadata is returned in a separate `usage` object (e.g., `{ "units": 5, "type": "complex_traversal" }`), keeping the `data` payload clean.
-   **Frozen Calculation Rules**: The multipliers for query complexity are hard-coded and versioned. Changes to billing logic require a formal API version bump.

### B. Admin Observability
-   **Audit Logs**: Comprehensive logs available via the Admin Agent, detailing who accessed what data and when.
-   **Health Dashboards**: Real-time visibility into graph connectivity and API latency.

---

*For detailed technical specifications, CAIQ-Lite responses, or SOC2 artifacts, please contact security@fodda.ai.*
