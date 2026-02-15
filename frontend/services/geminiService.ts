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
    "cultural signals",
    "market shifts"
  ];

  // Heuristic: If the query is long (> 10 words), it's likely a complex question, not a simple list request.
  const wordCount = q.split(/\s+/).length;
  if (wordCount > 10) return false;

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
- **PREMIUM FORMATTING**: Use \`## [Trend Name](#trend-ID)\` for every trend header.
- **Tone**: Factual, dry, and conservative.
- **Tone**: Factual, dry, and conservative.
- **Structure**: Break up text with paragraph breaks.
- **EXAMPLE**:
  ## [Trend Name](#trend-ID)
  Insight about the trend... (Do not repeat title)
- End with: "Click a trend name to view supporting evidence in the panel, or ask a follow-up about any specific area above."
`;
  }

  if (vertical === Vertical.SIC) {
    return `
ROLE: You are the SIC (Strategic Independent Culture) Analyst.
OBJECTIVE: You track subcultures, fringe movements, and aesthetic shifts before they hit the mainstream.

CONTEXT: You are looking at data from the "Strategic Independent Culture" (SIC) Graph—signals from the edge of culture.

STRICT GROUNDING RULE:
Use provided context ONLY. No external knowledge. Temperature is 0.0.

CLEAN HIERARCHY RULES:
1. TRENDS: Use \`## [Trend Name](#trend-ID)\`.
2. SIGNALS: Use \`### [Signal Title or Brand Name](#article-ID)\`.
3. FLAT STRUCTURE: DO NOT put headers (## or ###) inside bullet points or lists.
4. SPACING: Put a paragraph describing the trend/signal IMMEDIATELY after its header.

TRACEABILITY:
- Use Markdown Anchors for ALL names/titles.
- NO VISIBLE IDs: [Name](#id) only.

STYLE:
- Observant, culturally literate, and forward-looking.
- Write in concise, premium editorial paragraphs.
- **EXAMPLE**:
  ## [Trend Name](#trend-ID)
  Cultural analysis text... (Do not repeat title)
`;
  }


  // CRITICAL: ANCHOR GENERATION RULES - DO NOT MODIFY WITHOUT VERIFYING FRONTEND PARSING
  // The frontend (ChatInterface.tsx) expects markdown links in the format [Title](#article-ID) or [Title](#trend-ID).
  // These are parsed into clickable spans that open the Evidence Drawer.
  // Breaking this format (e.g. stripping prefixes, removing #) destroys the interactive graph experience.

  return `
ROLE: You are the Fodda Contextual Intelligence Engine (Vertical: ${vertical}).

STRICT GROUNDING RULE:
Use provided context ONLY. No external knowledge. Temperature is 0.0.

API STATUS: ${dataStatus}

CLEAN HIERARCHY RULES:
1. TRENDS: Use \`## [Trend Name](#trend-ID)\` for established strategic patterns.
2. SIGNALS: Use \`### [Signal Title or Brand Name](#article-ID)\` for supporting innovation examples.
3. FLAT STRUCTURE: DO NOT nest headers (## or ###) inside bullet points. This is critical for UI consistency.
4. ORDER: Group signals logically under the Trend they support.

TRACEABILITY & LINKING (CRITICAL):
- EVERY trend and signal title MUST be a header with a Markdown Anchor link: [Title](#id).
- USE THE EXACT ID PROVIDED IN THE CONTEXT (e.g. #trend-123 or #article-456). Do not strip prefixes.
- **INLINE LINKS**: You MUST also link the Signal/Brand Name within the description paragraph (e.g. "The [Brand](#article-123) platform allows...") to ensure maximum clickability.

STYLE:
- **PREMIUM EDITORIAL TONE**: High-end strategy report (e.g., McKinsey).
- **CONCISE**: Use dense, informative paragraphs.
- **BULLETS**: Use standard bullets ONLY for lists of facts *under* a paragraph, never for the titles themselves.
- **FORMAT EXAMPLE**:
  ## [Trend Name](#trend-123)
  Strategic insight about [Trend Name](#trend-123) goes here...
  
  ### [Signal Name](#article-456)
  [Signal Name](#article-456) is a platform that...
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
    // Pre-calculate ID with prefix to ensure model uses it correctly in anchors
    const cleanId = row.id.replace(/^(trend-|article-)/, '');
    const prefixedId = row.nodeType === "TREND" ? `trend-${cleanId}` : `article-${cleanId}`;

    ctx += `[TYPE: ${nodeLabel}] [ID: ${prefixedId}] NAME: ${row.name}\n`;
    ctx += `SUMMARY: ${row.summary}\n`;

    row.evidence.forEach(e => {
      const brandsStr = Array.isArray(e.brandNames) ? e.brandNames.join(', ') : e.brandNames;
      const cleanEvId = e.id.replace(/^(trend-|article-)/, '');
      const prefixedEvId = `article-${cleanEvId}`;
      ctx += `- [SUB-SIGNAL ID: ${prefixedEvId}] TITLE: ${e.title} | SNIPPET: ${e.snippet} | BRANDS: ${brandsStr}\n`;
    });

    ctx += "---\n";
  });
  return ctx;
};


export interface GenerationResponse {
  answer: string;
  suggestedQuestions: string[];
}

const repairMarkdownLinks = (text: string): string => {
  // Fix header links where the opening bracket is missing: ## Title](#id) -> ## [Title](#id)
  return text.replace(/(^|\n)(#{2,3})\s+([^[\n]+)(?=\]\(#)/g, '$1$2 [$3');
};

export const generateResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult,
  userContext?: string,
  accountContext?: string
): Promise<GenerationResponse> => {
  try {
    const contextStr = formatContext(retrievedData, vertical);

    let fullPrompt = `${contextStr}\n\nUSER QUERY: ${query}`;

    // Inject Contexts if present
    if (accountContext?.trim()) {
      fullPrompt += `\n\nACCOUNT CONTEXT (Your Perspective/Goal): ${accountContext}`;
    }
    if (userContext?.trim()) {
      fullPrompt += `\n\nUSER CONTEXT (About the User): ${userContext}`;
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: getSystemInstruction(vertical, retrievedData.dataStatus, query) }] },
          temperature: 0.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              answer: { type: "STRING" },
              next_questions: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: ["answer", "next_questions"]
          }
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return { answer: "Synthesis Failure - No Content", suggestedQuestions: [] };

    try {
      const parsed = JSON.parse(rawText);
      const cleanAnswer = repairMarkdownLinks(parsed.answer || "No answer generated.");

      return {
        answer: cleanAnswer,
        suggestedQuestions: parsed.next_questions || []
      };
    } catch (e) {
      console.error("JSON Parse Error:", e);
      // Fallback if model returns plain text despite request
      const cleanRaw = repairMarkdownLinks(rawText);
      return { answer: cleanRaw, suggestedQuestions: [] };
    }

  } catch (error: any) {
    console.error("Gemini Failure:", error);
    return { answer: `Intelligence Engine Error: ${error.message}`, suggestedQuestions: [] };
  }
};
