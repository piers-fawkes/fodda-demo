# Fodda Security & Architecture Pack (Draft)
*Enterprise Intelligence Layer: Reliability, Traceability, and Control*

## 1. Executive Overview
Fodda provides a **Privacy-First Intelligence Layer** designed for enterprise researchers and AI teams. Unlike general-purpose LLMs, Fodda leverages proprietary Knowledge Graphs (Neo4j) to deliver deterministic, grounded insights.

Our architecture is built on three core pillars:
1.  **Grounded Determinism**: Elimination of hallucinations via graph-native retrieval.
2.  **Identity Separation**: Forensic-grade audit logs that distinguish between systems and human users.
3.  **Architectural Isolation**: Strict resource caps and read-only data access.

---

## 2. System Architecture
Fodda employs a multi-tiered architecture to ensure separation of concerns and data integrity.

### A. High-Level Component View
-   **Client Layer**: Web Dashboard (React/Vite) or Model Context Protocol (MCP) clients (e.g., Claude, Claude Desktop, Vertex AI).
-   **Discovery Engine (Intelligence Gateway)**: Node.js/Express service responsible for identity resolution, usage metering, context optimization (via Google Gemini), and security enforcement.
-   **Fodda Core API**: The underlying retrieval engine that executes optimized traversals against the Knowledge Graphs.
-   **Knowledge Base**: Neo4j Graph Databases and Vector Stores containing verified research, signals, and trends.
-   **Control Plane**: Airtable-backed metadata store for managing account policies, API keys, and plan limits.

### B. Data & Request Flow
1.  **Request**: An MCP client or Web App sends a natural language query with an `X-API-Key`.
2.  **Identity Resolution**: The Discovery Engine verifies the key and resolves the **System Identity** (Tenant/Account) and **Human Identity** (UserID).
3.  **Security Enforcement**: The request is sanitized; hard traversal limits (depth, evidence caps) are applied.
4.  **Retrieved Grounding**: The Core API fetches deterministic data from the graph (no synthetic generation occurs at this layer).
5.  **Response Assembly**: The data is wrapped in a versioned envelope (v1.1) including `requestId` and `graph_version`.
6.  **Audit Logging**: A forensic log entry is generated to stdout/cloud-logs containing zero PII but full traceability metadata.

---

## 3. Security Posture & Controls

### A. Governance & Privacy
| Control | Fodda Standard |
| :--- | :--- |
| **Model Training** | Fodda **does not train** models on client interactions or queries. |
| **Data Retention** | **Privacy by Design.** We store metadata (requestId, latency) for billing. Query content is never persisted in permanent storage unless explicitly enabled for debugging. |
| **Data In-Transit** | All communications are secured via TLS 1.3 / HTTPS. |
| **Read-Only Access** | The Discovery Engine is architecturally incapable of performing write operations on the underlying Knowledge Graphs. |

### B. Identity & Access Management (IAM)
Fodda implements **Identity Separation** to prevent account sharing and provide granular audit trails:
-   **System (X-API-Key)**: Represents the service account or integration.
-   **Human (X-User-Id)**: Optional header passed by the integrator to track individual human usage against plan limits.
-   **Auth Policies**: Enterprise admins can choose between `STRICT` (forced short-lived sessions) or `RELAXED` (standard session tokens) policies for their organizational users.

### C. Resource Hardening (Hard Limits)
To protect against resource exhaustion and prompt injection/scraping attempts, Fodda enforces hard server-side caps:
-   **Max Traversal Depth**: 2 degrees (Prevents massive graph scans).
-   **Max Evidence Chunks**: 15 pieces of supporting data per query.
-   **Max Search Top_K**: 10 most relevant results.
-   **Max Nodes**: 50 nodes per traversal.

---

## 4. Deterministic Intelligence

### A. Deterministic Mode (Default-On)
By default, the `deterministic: true` flag is enforced. The engine focuses exclusively on finding existing connections between verified nodes in the Knowledge Graph. If no match is found, the system returns a structured `REFUSE` decision rather than attempting to "guess" or hallucinate an answer.

### B. Versioned Response Envelope
integrators are protected from breaking changes via a locked schema version (Current: 1.0). Every response includes:
-   `schema_version`: Ensures client compatibility.
-   `graph_version`: Identifies the exact snapshot of data (e.g., `2024-Q1-PROD`).
-   `deterministic`: Confirmation of retrieval integrity.

---

## 5. Predictable Metering & Billing
Fodda employs a "Frozen Rule" engine for metering query units, ensuring enterprise clients have predictable and auditable costs.

-   **Standardized Graph Weights**: Query units are calculated based on the complexity and value of the target graph (e.g., PSFK: 1.0, WALDO: 1.5, SIC: 2.0).
-   **No Hidden Charges**: The `usage` object returned in every API response explicitly states the `units` consumed for that specific request.
-   **Usage Warnings**: Automated alerts are dispatched at 80% usage capacity to prevent service interruption.

---

## 6. Auditability & Compliance

### Structured Foreman Logs
Fodda generates structured JSON logs designed for ingestion by SIEM tools (Splunk, Datadog, CloudWatch).

```json
{
  "requestId": "968092dd93e58b9d",
  "apiKeyId": "recDGYv8pFpNegcf",   // System Identity
  "tenantId": "rec6mh0XQOablFDX",   // Customer Identity
  "userId": "recGWh6XpdEZxw8AE",    // Human Identity
  "graphId": "CPG_Innovation",
  "latency": "1240ms",
  "deterministic": true,
  "timestamp": "2026-02-13T22:15:00Z"
}
```

---

## 7. Infrastructure & Deployment
-   **Hosting**: Google Cloud Platform (GCP).
-   **Compute**: Serverless execution via Cloud Run (Auto-scaling with isolated instances).
-   **Tenant Isolation**: While the Core API is multi-tenant, the Discovery Engine enforces strict key -> account mapping, ensuring no cross-tenant data leakage occurs at the proxy layer.
-   **SLA**: Targeted 99.9% availability for enterprise endpoints.

---
*For technical support or deep-dive architecture reviews, please contact the Fodda Engineering Team at engineering@fodda.ai.*
