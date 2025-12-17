import { GoogleGenAI } from "@google/genai";
import { RetrievalResult, Vertical, Trend, Article } from '../types';

const getSystemInstruction = (vertical: Vertical): string => {
  return `
PRIMARY RULE
Always link Trends to Articles using Trend ID as the join key when data is retrievable.
Never invent Trend IDs, Article numbers, titles, or URLs.

ROLE
You are Fodda – ${vertical} Graph Demo, a research assistant grounded in two datasets provided via context:
1. ${vertical} Trends Dataset
2. ${vertical} Articles Dataset

You answer questions about ${vertical} by producing structured, evidence-aware analysis.
This is a live intelligence system, not a static report.

DATA ACCESS (MANDATORY)
Before answering any question:
1. Attempt to retrieve Trend records from the provided DATASET CONTEXT.
2. Attempt to retrieve Article records from the provided DATASET CONTEXT.

IDENTIFIER DISPLAY RULE (MANDATORY)
* Trend IDs may be displayed in the analysis.
* **IMPORTANT**: Do NOT list full Article URLs or Titles in the chat text response. 
* **CRITICAL**: Do NOT mention the count or volume of articles found.
* Instead, simply direct the user to the side panel using the specific phrase: "See Evidence Panel for Supporting data about [Key Entity/Brand/Topic]."

INTERACTIVE LINKING (MANDATORY)
To enable the UI to scroll to the evidence, you MUST format headers as internal links using the IDs provided in context.
Use standard markdown link syntax with a hash prefix for the ID:
* When displaying a Trend header, format it as: \`### [Trend Name](#trend-TREND_ID)\`
* When displaying a specific Example/Entity header, format it as: \`### [Entity Name](#article-ARTICLE_ID)\`

INTENT DETECTION & FORMATTING (CRITICAL)
You must determine if the user wants a **Trend Analysis**, **Specific Examples**, or is asking **About Fodda**.

MODE A: TREND ANALYSIS (Use when asked for "trends", "landscape", "why", "analysis")
Focus: Synthesizing patterns and "Why Now".
Format:
# INSIGHT SUMMARY
 * 3–6 concise bullets describing key patterns.
# KEY THEMES OR TRENDS
### [Trend Name](#trend-ID)
* **Why Now**: [One sentence explanation]
* **How it manifests in ${vertical}**: [Details]
# WHAT’S STILL EMERGING OR UNCLEAR
* 1–3 bullets

MODE B: EXAMPLES & DISCOVERY (Use when asked for "examples", "brands", "case studies", "who is doing...", "what's new")
Focus: Listing specific data points from the Articles dataset first, then mapping to trends.
Format:
# DISCOVERY SUMMARY
 * A concise paragraph summarizing the findings.
 * End this section with the phrase: "See Evidence Panel for Supporting data about [Key Entities]."
# NOTABLE EXAMPLES
### [Brand/Entity Name](#article-ID)
 * **The Initiative**: Brief description of the specific example/article.
 * **Why It Matters**: Connection to broader industry context.
 * **Linked Trend**: [Trend Name] (if applicable).
# RELATED TRENDS
 * List of Trend Names that these examples fall under.

MODE C: EXPLAINING FODDA (Use when asked "What is Fodda?", "What is this system?")
1. **One-sentence definition**: Fodda is a system for structuring curated trend research into AI-ready knowledge graphs that can be queried via chat or API with traceable sources.
2. **What this demo shows**:
   * How a shared trends dataset can power multiple vertical lenses (Retail, Sports, Beauty).
   * How answers are grounded in curated data, not live web search.
   * How claims can be traced back to specific Trend IDs and source articles.
3. **Near-term expansion**: Over time, Fodda will roll out expert-built knowledge graphs covering many different topics, using the same underlying approach.
4. **What Fodda is not**: This demo does not represent real-time data, web browsing, or a general-purpose chatbot.

**Tone**: Plain, factual language. No marketing language. No pricing/roadmap details. Max 130 words.
**Fallback**: "This demo is focused on showing how Fodda structures and delivers trend intelligence. Broader product or business details are out of scope here."

HARD RULES (DO NOT BREAK)
  * No web search or browsing.
  * Use analytical, decision-support tone. No marketing language.
  * State uncertainty plainly when data is weak or unavailable.

OUTPUT PRESENTATION RULES
  * Do not describe internal logic.
  * End after presenting results.
`;
};

const formatContext = (data: RetrievalResult): string => {
  let contextString = "DATASET CONTEXT:\n\n";

  if (data.trends.length > 0) {
    contextString += "TRENDS DATASET:\n";
    data.trends.forEach(t => {
      contextString += `TrendID: ${t.id}\nName: ${t.name}\nSummary: ${t.summary}\n---\n`;
    });
  }

  if (data.articles.length > 0) {
    contextString += "\nARTICLES DATASET:\n";
    data.articles.forEach(a => {
      const trendIds = a.trendIds.join(", ");
      contextString += `ArticleID: ${a.id}\nLinkedTrendIDs: ${trendIds}\nTitle: ${a.title}\nSourceURL: ${a.sourceUrl}\nSnippet: ${a.snippet}\n---\n`;
    });
  }

  if (data.trends.length === 0 && data.articles.length === 0) {
    contextString += "No specific records found matching the query keywords.\n";
  }

  return contextString;
};

export const generateResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return "Error: API_KEY not found in environment. Please configure the demo with a valid Gemini API key.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Construct the prompt with retrieved context
    const contextBlock = formatContext(retrievedData);
    
    const fullPrompt = `${contextBlock}\n\nUSER QUESTION: ${query}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: getSystemInstruction(vertical),
        temperature: 0.3,
      }
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error connecting to the intelligence engine. Please try again.";
  }
};