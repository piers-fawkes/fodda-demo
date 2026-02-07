
import { GoogleGenAI } from "@google/genai";
import { RetrievalResult, Vertical } from "../../shared/types";

/**
 * Detects if the user is asking for a general list of trends.
 * This helps prune the context to prevent timeouts for broad queries.
 */
const isTrendListIntent = (query: string): boolean => {
  const q = query.toLowerCase().trim();
  const patterns = [
    "trends in",
    "trends for",
    "list of trends",
    "top trends",
    "what are the trends",
    "emerging trends",
    "current trends",
    "show me trends",
    "show me trends",
    "coffee trends",
    "cultural signals",
    "signals"
  ];
  const isDirectTrendAsk = q.endsWith("trends") || q.endsWith("trends?");
  const hasPattern = patterns.some(p => q.includes(p));
  return isDirectTrendAsk || hasPattern;
};

const getBaselineSystemInstruction = (query: string): string => {
  const comparisonKeywords = ["compare", "highest", "lowest", "most", "least", "difference", "change", "why", "explain", "better", "worse", "rank"];
  const isComparisonRequested = comparisonKeywords.some(kw => query.toLowerCase().includes(kw));

  return `
ROLE: You are the Fodda Reference Agent for the Public Beliefs Baseline (NPORS 2025).

TASK: Respond to the user's inquiry by summarizing the retrieved weighted distributions.

STRICT GROUNDING RULES:
1. Narrative responses must be strictly grounded in the returned distribution data. No additional facts, external comparisons, or inferences may be introduced.
2. NARRATIVE MODE: ${isComparisonRequested ?
      "ANALYSIS MODE: The user has requested a comparison or ranking. You may compute contrasts and rank segments based ONLY on the provided rows." :
      "DESCRIPTION MODE: By default, describe values within each segment without ranking, comparing, or interpreting across segments. Restate what the table shows in plain language."}
3. RESTRICTIONS: Do NOT infer causality (do not say "because"). Do NOT describe trends or implications.
4. TRACEABILITY: All narrative statements must be traceable to specific rows in the displayed distribution. If it is not in the table, it cannot appear in the narrative.
5. If the data is empty or NO_MATCH, state that the baseline does not contain survey data for this inquiry.

STYLE:
- Professional, clinical, and conservative.
- Natural language paragraphs only.
- Do not use markdown headers or tables in the response body.
- End with: "Detailed distribution data is available in the Method & Source panel."
`;
};

const getSystemInstruction = (vertical: Vertical, dataStatus: string, query: string): string => {
  if (vertical === Vertical.Baseline) return getBaselineSystemInstruction(query);

  const isTrendList = isTrendListIntent(query);

  if (isTrendList) {
    return `
ROLE: You are the Fodda Skeptical Analyst (Vertical: ${vertical}).
MODE: ZERO-HALLUCINATION TREND LIST

TASK: List trends related to: "${query}".

STRICT ANALYTICAL RULES:
1. DO NOT INVENT CONNECTIONS. Your goal is accuracy, not "pleasing" the user with a matching list.
2. EVIDENCE CHECK: You may only claim a connection to "${query}" if the word "${query}" or a direct synonym appears EXPLICITLY in the [TYPE: TREND] summary or its [SUB-SIGNAL] snippets.
3. HOW TO HANDLE NON-MATCHES:
   - If the trend summary or snippets MENTION the query: Describe the specific application found in the data.
   - If the trend is loosely related (e.g. a general "Food" trend for a "Coffee" query) but DOES NOT mention the query word: Label it as "Broad Industry Context" and explain the general innovation without claiming the topic is a core part of the trend.
   - If no reasonable bridge exists in the text: EXCLUDE THE TREND.
4. OUTPUT FORMAT:
   - ## [Trend Name](#trend-ID)
   - [One sentence stating the explicit evidence found, or marking it as Broad Industry Context].
5. If no trends meet these criteria, state: "The graph has identified several broad trends in this vertical, but none explicitly mention '${query}' in their curated summaries."

STYLE:
- Factual, dry, and conservative.
- Avoid marketing fluff.
- End with: "Click a trend name to view supporting evidence in the panel, or ask a follow-up about any specific area above."
`;
  }

  if (vertical === Vertical.SIC) {
    return `
ROLE: You are the SIC (Strategic Independent Culture) Analyst.
OBJECTIVE: You track subcultures, fringe movements, and aesthetic shifts before they hit the mainstream.

CONTEXT: You are looking at data from the "Strategic Independent Culture" (SIC) Graph. 
- These are NOT generic retail trends. 
- These are signals from the edge of culture.
- Your tone should be observant, culturally literate, and forward-looking.

STRICT GROUNDING RULE:
Use the provided Knowledge Graph context ONLY. Do not use external knowledge. DO NOT hallucinate connections.

STEERING LOGIC:
- If TREND_MATCH: Explain the cultural shift described in the trend.
- If SIGNAL_MATCH: Highlight the specific edge-cases or "cool" examples found in the signals.

TRACEABILITY (CRITICAL):
1. Use Markdown Anchors for all names/titles.
2. Format: ### [Signal Title or Brand Name](#article-ID)
3. Trend Format: ## [Trend Name](#trend-ID)

STYLE:
- Culturally relevant, slightly edgy but professional.
- Temperature: 0.0 (Stick to facts).
`;
  }


  return `
ROLE: You are the Fodda Contextual Intelligence Engine (Vertical: ${vertical}).

STRICT GROUNDING RULE:
Use the provided Knowledge Graph context ONLY. Do not use external knowledge. DO NOT hallucinate connections to satisfy the user query if they are not explicitly in the data.

API STATUS: ${dataStatus}

STEERING LOGIC:
- If TREND_MATCH: Focus on established strategic patterns. Synthesize how multiple signals support these defined trends.
- If HYBRID_MATCH: Frame established Trend context first, then highlight "High-Velocity Signals" (Articles) currently expanding that trend.
- If SIGNAL_MATCH: Focus on raw discovery. Identify commonalities between disparate examples and name them as "Emerging Themes".

TRACEABILITY (CRITICAL):
1. You MUST mention brands and specific initiatives using Markdown Anchors.
2. Signal/Brand Link Format: ### [Signal Title or Brand Name](#article-ID)
3. Trend Link Format: ## [Trend Name](#trend-ID)
4. Use the exact IDs provided in the context (e.g., #article-7885 or #trend-5367).
5. EVERY title in the "SUPPORTING EVIDENCE" section MUST be a H3 header with an anchor link in the format: ### [Title](#article-ID).

STYLE:
- Professional and list-oriented.
- Temperature is 0.0: Stick only to the provided facts.
`;
};

const formatContext = (data: RetrievalResult, vertical: Vertical): string => {
  if (!data.rows || data.rows.length === 0) return "CONTEXT: [EMPTY]";

  if (vertical === Vertical.Baseline) {
    let ctx = "NPORS 2025 SURVEY DATA DISTRIBUTIONS:\n";
    data.rows.forEach(row => {
      ctx += `Segment: ${row.name} | Distribution: ${row.summary}\n`;
    });
    return ctx;
  }

  let ctx = `DATA_STATUS: ${data.dataStatus}\nSEARCH_QUERY: ${data.termsUsed?.join(', ')}\n\nRETRIEVED KNOWLEDGE GRAPH NODES:\n`;
  data.rows.forEach(row => {
    const nodeLabel = row.nodeType === "TREND" ? "TREND" : "SIGNAL";
    ctx += `[TYPE: ${nodeLabel}] [ID: ${row.id}] NAME: ${row.name}\n`;
    ctx += `SUMMARY: ${row.summary}\n`;

    row.evidence.forEach(e => {
      const brandsStr = Array.isArray(e.brandNames) ? e.brandNames.join(', ') : e.brandNames;
      ctx += `- [SUB-SIGNAL ID: ${e.id}] TITLE: ${e.title} | SNIPPET: ${e.snippet} | BRANDS: ${brandsStr}\n`;
    });

    ctx += "---\n";
  });
  return ctx;
};

export const generateResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult
): Promise<string> => {
  try {
    const contextStr = formatContext(retrievedData, vertical);
    const fullPrompt = `${contextStr}\n\nUSER QUERY: ${query}`;

    // Call backend proxy instead of direct API
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: getSystemInstruction(vertical, retrievedData.dataStatus, query) }] },
          temperature: 0.0
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Synthesis Failure.";
  } catch (error: any) {
    console.error("Gemini Failure:", error);
    return `Intelligence Engine Error: ${error.message}`;
  }
};
