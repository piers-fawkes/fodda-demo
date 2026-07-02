# Connecting Fodda to Microsoft Copilot

This guide explains how to connect your Fodda knowledge graphs to Microsoft Copilot using **Microsoft Copilot Studio**. This enables enterprise users to leverage Fodda's curated research insights directly within their Microsoft 365 environment.

## Overview

Fodda provides a specialized REST API endpoint designed for grounding Copilot queries with expert-curated trend data and supplemental institutional statistics.

**Endpoint URL:** `https://api.fodda.ai/copilot/search_insights`
**Method:** `POST`
**Authentication:** API Key (passed as `X-API-Key` header)

---

## Setup Steps

### Step 1: Get your Fodda API Key
1. Log in to your [Fodda Dashboard](https://app.fodda.ai).
2. Go to **Account Admin** → **API Access**.
3. Copy your **API Key**. If you don't have one, click **Regenerate Key**.

### Step 2: Configure Copilot Studio
1. Open [Microsoft Copilot Studio](https://copilotstudio.microsoft.com).
2. Select your Copilot and go to **Topics & Plugins**.
3. Create a new **Plugin** or **Topic** that uses a **REST API Connection**.
4. Configure the connector with the following details:
   - **Service URL**: `https://api.fodda.ai/copilot/search_insights`
   - **Authentication**: Use header `X-API-Key` with your API key as the value.

### Step 3: Define Parameters
In your Copilot Studio configuration, define the following input parameters:

| Parameter | Type | Description | Example |
|:---|:---|:---|:---|
| `graphId` | String | The slug of the knowledge graph to query. | `retail`, `sports`, `beauty`, `sic` |
| `query` | String | The user's natural language question. | "What are the latest retail trends?" |

### Step 4: Test the Connection
Use the test pane in Copilot Studio to ask a question. Copilot will invoke the Fodda API, retrieve the relevant trends, and automatically cite them as evidence in the response.

---

## Best Practices

### Search Insights vs. Statistics
- **`search_insights`**: Use this for general qualitative research and trend identification. It returns expert summaries and articles.
- **`get_statistics`**: (Coming Soon) Use this for quantitative grounding when you need specific data points from our statistical database.

### Citation & Grounding
Microsoft Copilot is highly effective at citing sources. Ensure your prompt instructions in Copilot Studio encourage the model to "use the provided Fodda research insights to ground the response and cite the source names provided in the metadata."

---

## Support
Need help setting up your enterprise integration? Contact us at support@fodda.ai or visit our [Integration Portal](https://www.fodda.ai/#/integrations).
