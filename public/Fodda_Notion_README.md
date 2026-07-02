# Using Fodda Knowledge Graphs in Notion

---

## What is Fodda?

Fodda provides expert-curated knowledge graphs covering **Retail**, **Beauty**, **Sports**, and partner datasets. These graphs map trends, innovations, signals, and strategies — powered by PSFK's 20+ years of research.

When connected to Notion, you can query these knowledge graphs directly from a **Custom Agent** to get trend analysis, discover related concepts, and find supporting evidence.

> **ℹ️ Note:** Fodda is not general web knowledge — it is a structured intelligence layer, expert-curated, sourced, and scored, that makes your Notion AI outputs more grounded and defensible.

---

## What You Can Do

Once connected, you can ask your Notion Custom Agent to:

- **List all available knowledge graphs** (Retail, Beauty, Sports, etc.)
- **Search for trends, innovations, or strategies** across any graph
- **Discover how trends connect** to each other
- **Get source evidence and articles** behind any trend or signal
- **Find semantically similar trends** to explore adjacent opportunities

---

## Setup Instructions

### Prerequisites

You need a Fodda account with an API key.

1. Sign up at **[app.fodda.ai](https://app.fodda.ai)**
2. Go to **Account → MCP Integration** to get your API key (it starts with `fk_live_...`)

> **⚠️ Important:** You must have a **Notion Business or Enterprise plan** to use Custom Agents and AI features.

---

### Steps

1. Ask your **Notion workspace admin** to enable custom MCP servers under **Settings → Notion AI → AI connectors**

2. **Create or edit a Custom Agent** in Notion

3. **Add the MCP connection:**

   - In the Custom Agent editor, scroll down to the **Tools & Access** section
   - At the **bottom** of the Tools & Access list, look for the **+ Add Connection** link (it's easy to miss — scroll all the way down)
   - A popup will appear showing available connections. Look at the **very bottom** of this modal for the **+ Add custom MCP** link
   - Click it to open the custom MCP server configuration

4. Enter the URL:

   ```
   https://mcp.fodda.ai/mcp?api_key=YOUR_API_KEY&user_id=YOUR_EMAIL
   ```

   > Replace `YOUR_API_KEY` with your `fk_live_...` key and `YOUR_EMAIL` with your Fodda account email.

5. For authentication, select **"API Key"**:
   - **Key:** `api_key`
   - **Value:** Your `fk_live_...` key

6. **Save** the connection

> **💡 Tip:** Your API key and email are embedded in the URL for compatibility. The connection is encrypted via HTTPS.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `list_graphs` | Discover available knowledge graphs and their schemas |
| `search_graph` | Hybrid keyword + semantic search on a knowledge graph |
| `get_neighbors` | Traverse from seed nodes to discover related concepts |
| `get_evidence` | Source signals, articles, and provenance for a node |
| `get_node` | Retrieve metadata for a single node by ID |
| `get_label_values` | Discover valid values for a node label/category |
| `discover_adjacent_trends` | Find semantically similar trends to a given trend |

---

## Example Prompts to Try

Here are some starter prompts to get you going with your Notion Custom Agent:

- **"List all available Fodda knowledge graphs"**
- **"Search the Retail graph for trends related to sustainability and circular economy"**
- **"What trends are connected to 'AI-Powered Personalization' in the Beauty graph?"**
- **"Get the evidence and source articles for this trend"**
- **"Find trends similar to 'Immersive Retail Experiences'"**

> **💡 Tip:** Use short, specific queries (2–5 words) for best results. Semantic search works better with precise terms than full sentences.

---

## Requirements

- **Notion Business or Enterprise plan** (for Custom Agents and AI features)
- A **Fodda account** with an active API key from [app.fodda.ai](https://app.fodda.ai)
- Workspace admin must **enable custom MCP servers**

---

## Quick Reference

| Item | Value |
|------|-------|
| **App** | [app.fodda.ai](https://app.fodda.ai) |
| **Standard MCP URL** | `https://mcp.fodda.ai/mcp?api_key=YOUR_KEY&user_id=YOUR_EMAIL` |
| **API Key Format** | `fk_live_...` |
| **Auth Method** | API key via URL parameter |
| **Support** | [fodda.ai](https://www.fodda.ai) |

---

*Powered by PSFK · [fodda.ai](https://www.fodda.ai)*
