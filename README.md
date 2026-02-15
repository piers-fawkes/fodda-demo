<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5cb63cf2-40eb-4fe1-afa6-4e7184ae00fb

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
- **Enhanced Metadata**: Trends now include `evidence_counts` to quantify available proof (Signals, Metrics, Quotes).
- **Standardized IDs**: Explicit `trendId` and `articleId` fields for precise resource identification.
- **Top-Tier Graphs**: Full support for PSFK, Waldo, and SIC graphs.

For more details, open the **Developer API Documentation** modal within the app.
