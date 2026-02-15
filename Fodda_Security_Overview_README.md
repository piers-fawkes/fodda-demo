# Fodda Security & Hardening Overview

This document summarizes the security posture and technical hardening measures of the Fodda Discovery Engine.

## 1. Executive Summary
Fodda is a privacy-first intelligence layer. We provide deterministic access to proprietary Knowledge Graphs, ensuring that AI responses are grounded in verified data, not synthetic generation.

## 2. Technical Hardening
- **Hard Traversal Limits**: Server-side enforcement of max depth (2), evidence chunks (15), and nodes (50) to prevent resource exhaustion.
- **Deterministic by Default**: All queries default to grounded retrieval; heuristic summarization is strictly opt-in.
- **Strict Authentication**: All API access requires a valid `X-API-Key`.
- **Identity Separation**: Audit logs distinguish between System Identity (API Keys) and Human Identity (User interactions).
- **Versioned Schema**: Stable API structure prevents breaking changes for enterprise integrators.
- **Retention Mode**: Software-enforced logging depth toggle ("Metadata Only" default).

## 3. Data Privacy & Governance
- **Zero Retention**: Fodda does not store prompt content or client query data by default.
- **No Training**: We do not use client queries to train underlying models.
- **Traceability**: Every answer includes source provenance (Article ID / Trend ID) for auditing.

## 4. Architectural Isolation
Fodda maintains a strict separation between the deterministic data retrieval layer (API/Neo4j) and the orchestration layer (MCP/Frontend). This ensures that data access is always auditable and restricted to authorized tenants.

---
*For the full Security Pack or CAIQ-Lite responses, please contact security@fodda.ai.*
