# GitHub Publishing Rules — Fodda MCP Repository

> Workflow for any agent or human updating the `piers-fawkes/fodda-mcp` public GitHub repository.

## Rule #1: This Is a Marketing Channel, Not a Code Repo

The public GitHub repo exists for **two purposes only**:
1. Host the **README** — a polished sales page for Fodda's knowledge graph platform
2. Host **`server.json`** — the manifest file required by the [MCP Registry](https://registry.modelcontextprotocol.io)

That's it. **Two files.** Nothing else belongs here.

---

## Allowed Files (exhaustive list)

| File | Purpose |
|------|---------|
| `README.md` | Sales page: product pitch, Quick Start, graph showcase, API reference, trial connectors |
| `server.json` | MCP Registry manifest — the registry reads this to list Fodda as a discoverable MCP server |

**If a file is not in this table, it does not belong on the public repo.**

---

## Never Publish

- ❌ Source code (`.ts`, `.js`, `.tsx`, `.jsx`, `src/`, `dist/`, `lib/`)
- ❌ Build configs (`tsconfig.json`, `package-lock.json`, `package.json`)
- ❌ Infrastructure (`Dockerfile`, `docker-compose.yml`, `.env.example`, deploy scripts)
- ❌ Deployment configs (`deployment/`, Kubernetes manifests, Terraform)
- ❌ Internal docs (briefs, audits, changelogs, security reviews, backburner lists)
- ❌ Test files or scripts (`scripts/`, test utilities)
- ❌ Any file that reveals GCP project IDs, secret names, internal header names, auth bypass mechanisms, or rate limiting implementation

---

## README Sync Rules

The README must stay synchronized with:

1. **QuickStart** — `https://app.fodda.ai/Fodda_Quickstart.md`
   - Same tool names and descriptions
   - Same install/connection instructions per client
   - Same architecture explanation

2. **llms.txt** — `https://www.fodda.ai/llms.txt`
   - Same graph count and featured graph list
   - Same supplemental data source count

### Terminology (enforced)

| Use | Do NOT use |
|-----|-----------|
| API calls | tokens, credits, queries |
| `sk_live_` | `fk_live_`, `fodda_` |

### Before pushing any README change:
- [ ] Tool list matches the live QuickStart
- [ ] API key prefix is `sk_live_` everywhere
- [ ] Billing unit is "API calls" not "tokens"
- [ ] No source code, configs, or internal docs added
- [ ] Only `README.md` and `server.json` exist after the commit

---

## server.json Rules

This file follows the [MCP Server Schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json). Update it when:
- The MCP server version changes
- Tool capabilities change
- The npm package version changes

Never include internal endpoint URLs, secret names, or infrastructure details in this file.

---

## How to Update

```bash
# 1. Clone
git clone https://github.com/piers-fawkes/fodda-mcp.git /tmp/fodda-mcp
cd /tmp/fodda-mcp

# 2. Edit README.md and/or server.json ONLY

# 3. Verify — only these two files should exist
ls  # Should show: README.md  server.json

# 4. Commit & push
git add -A
git commit -m "Description of change"
git push origin main

# 5. Clean up
rm -rf /tmp/fodda-mcp
```

---

## Repo Settings (keep configured)

- **Description**: `Expert-curated knowledge graphs for AI agents — 100+ datasets across retail, beauty, sports, culture and more via MCP`
- **Website**: `https://www.fodda.ai`
- **Topics**: `mcp`, `knowledge-graph`, `ai-agents`, `claude`, `cursor`, `copilot`, `trend-intelligence`, `research`, `retail`, `agentic`, `model-context-protocol`

---

## Git History Note

The git history contains source code from previous commits. This is acceptable — GitHub only indexes and displays files on the current branch. A history purge is not required unless a security incident demands it.
