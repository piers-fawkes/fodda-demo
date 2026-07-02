<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5cb63cf2-40eb-4fe1-afa6-4e7184ae00fb

## 🔌 Installing Fodda on Claude (MCP)

Fodda is designed to be installed directly into **Claude** as a custom connector via the Model Context Protocol (MCP).

1. **Get your Key**: Log in to [app.fodda.ai](https://app.fodda.ai) → **Account → MCP Integration**.
2. **Install**: In Claude, go to the **[Connectors Page](https://claude.ai/customize/connectors)** → Add custom connector.
3. **Connect**: Use your personalized Connector URL and leave OAuth fields blank.

Detailed setup instructions, tool lists, and prompting patterns are available in the [Fodda Quickstart Guide](./public/Fodda_Quickstart.md).

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## API v1 Migration

This application has been upgraded to the Fodda API v1 architecture.

### Key Features (v1.1):
- **Semantic Search**: Natural language conceptual matching via `/v1/graphs/:id/search`.
- **Dynamic Discovery**: Real-time domain value retrieval via `/v1/graphs/:id/labels/:label/values`.
- **Supplemental Data Sources**: External structured datasets (e.g., US Census retail sales) discoverable via `GET /v1/graphs` alongside knowledge graphs. Visible in Graph Admin with test capabilities.
- **Statistics Search**: Semantic search over curated data points (Metric nodes) via `GET /v1/graphs/:id/statistics`. Returns statistics with parent trend context for reverse lookup.
- **Enhanced Metadata**: Trends now include `evidence_counts` to quantify available proof (Signals, Metrics, Quotes).
- **Standardized IDs**: Explicit `trendId` and `articleId` fields for precise resource identification.
- **Top-Tier Graphs**: Full support for PSFK, Waldo, and SIC graphs.

For more details, open the **Developer API Documentation** modal within the app.
