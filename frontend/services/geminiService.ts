import { RetrievalResult, Vertical } from "../../shared/types";
import { cleanSearchQuery } from "../../shared/dataService";
import { API_ENDPOINTS } from "../../shared/apiConfig";

// ── Query Intent Classification ──────────────────────────────────────
export type QueryIntent = 'trend_list' | 'advisory' | 'single_concept' | 'visualization' | 'comparative' | 'standard';

/**
 * Classifies the user's query intent to determine the best system prompt
 * and data handling strategy.
 */
export const classifyQueryIntent = (query: string): QueryIntent => {
  const q = query.toLowerCase().trim();
  const wordCount = q.split(/\s+/).length;

  // Visualization: user wants a chart / graph / visual
  const vizPatterns = ['show me a trend graph', 'show me a graph', 'trend graph', 'chart of', 'plot of', 'visualize', 'visualise', 'graph of'];
  if (vizPatterns.some(p => q.includes(p))) return 'visualization';

  // Comparative: "X vs Y", "compared to", "difference between"
  if (/\bvs\.?\b|\bversus\b|compared to|difference between|\bvs\b/.test(q)) return 'comparative';

  // Advisory: long strategic question, opinion-seeking
  const advisoryPatterns = ['good idea', 'bad idea', 'should i', 'should we', 'considering', 'would you recommend', 'feasibility', 'viable', 'worth it', 'pros and cons'];
  if (wordCount > 20 || advisoryPatterns.some(p => q.includes(p))) return 'advisory';

  // Trend list: existing detection (enhanced)
  if (isTrendListIntent(query)) return 'trend_list';

  // Single concept: very short, broad queries
  if (wordCount <= 2) return 'single_concept';

  return 'standard';
};

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

/**
 * Extracts the core topic from a "trends in..." query
 */
const extractTopic = (query: string): string => {
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
  ];

  let topic = q;
  for (const p of patterns) {
    if (topic.includes(p)) {
      topic = topic.replace(p, "").trim();
      break;
    }
  }
  return topic;
};

/**
 * Detects if the user query is focused on a specific brand/company.
 * Returns the extracted brand name if detected, or null otherwise.
 */
const detectBrandIntent = (query: string, vertical?: string): string | null => {
  // Use cleanSearchQuery to strip preamble, then check if what remains
  // looks like a brand name (short, no question-style keywords)
  const cleaned = cleanSearchQuery(query);
  const lower = query.toLowerCase().trim();

  // Strip trend keywords to extract the brand portion
  // e.g., "nike trends" → "nike", "retail innovation" → "retail"
  const trendKeywords = ['trends', 'trend', 'innovation', 'signals', 'insights', 'strategies', 'sector', 'industry', 'market'];
  // Also strip the current vertical name (it matches everything in its own graph)
  const verticalStopWords: Record<string, string[]> = {
    retail: ['retail', 'retailer', 'retailers', 'store', 'stores', 'shopping'],
    beauty: ['beauty', 'cosmetics', 'skincare'],
    sport: ['sport', 'sports', 'athletic', 'athletics'],
  };
  const allStopWords = [...trendKeywords, ...(vertical ? (verticalStopWords[vertical] || [vertical]) : [])];
  const brandPortion = cleaned.split(/\s+/).filter(w => !allStopWords.includes(w.toLowerCase())).join(' ');

  // If nothing substantive remains after stripping trend keywords, it's a pure trend query
  if (brandPortion.length < 2) return null;

  // Patterns that signal a brand-specific inquiry
  const brandPatterns = [
    /^tell me (?:more )?about\b/i,
    /^what (?:is|are) (.+?) doing/i,
    /^how is (.+?) innovating/i,
    /^what do you know about\b/i,
    /^what can you tell me about\b/i,
    /^deep dive (?:into|on)\b/i,
    /^show me (?:more )?about\b/i,
    /^i want to (?:know|learn) (?:more )?about\b/i,
  ];

  const hasBrandPattern = brandPatterns.some(p => p.test(lower));

  // Explicit brand question pattern (e.g., "tell me about Nike")
  if (hasBrandPattern && brandPortion.length >= 2 && cleaned.split(/\s+/).length <= 6) {
    return brandPortion;
  }

  // Short, plain-noun queries (e.g., "Nike", "Nike London", "Nike trends")
  // Treat as brand intent if ≤4 words total and brand portion has substance
  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount <= 4 && brandPortion.length >= 2) {
    return brandPortion;
  }

  // Long-query fallback: extract proper nouns as brand names
  // e.g., "How is Nike using data analytics to personalize..." → "Nike"
  if (wordCount > 4) {
    const commonWords = new Set([
      'how', 'what', 'where', 'when', 'why', 'which', 'who', 'whom',
      'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'its', 'their', 'this', 'that',
      'has', 'have', 'had', 'do', 'does', 'did', 'can', 'could', 'will',
      'would', 'should', 'shall', 'may', 'might', 'must',
      'using', 'about', 'into', 'through', 'between', 'after', 'before',
    ]);
    const words = query.split(/\s+/);
    const properNouns = words.filter((w, i) => {
      if (i === 0) return /^[A-Z][a-z]+/.test(w) && !commonWords.has(w.toLowerCase());
      return /^[A-Z]/.test(w) && w.length >= 2 && !commonWords.has(w.toLowerCase())
        && !allStopWords.includes(w.toLowerCase());
    });
    if (properNouns.length > 0) {
      return properNouns.join(' ');
    }
  }

  return null;
};

/**
 * Generates a brand-focus instruction to prepend to the system prompt.
 * When brandDataFound is false, instructs Gemini to be transparent that
 * no brand-specific data was found and to contextualize general trends.
 */
const getBrandFocusInstruction = (brandName: string, brandDataFound: boolean): string => {
  if (brandDataFound) {
    return `
⚡ BRAND FOCUS MODE — ACTIVE
The user is asking specifically about "${brandName}". You MUST:
1. **LEAD** with what "${brandName}" is doing — its specific activities, initiatives, and innovations.
2. **PRIORITIZE** trends where "${brandName}" is mentioned as a brand or example.
3. **CONNECT** broader trends back to "${brandName}" — explain how each trend relates to or is exemplified by "${brandName}".
4. **HIGHLIGHT** evidence/articles that specifically feature "${brandName}" using ### sub-headers.
5. **FRAME** the narrative around "${brandName}" — the user wants a brand portrait, not a generic trend list.
6. If "${brandName}" appears in the trend data, that trend MUST be included.
7. If a trend does not mention "${brandName}" at all, only include it if it directly relates to the brand's industry context.

The opening paragraph MUST name "${brandName}" and summarize its strategic positioning.
`;
  }
  // No brand-specific data found — be transparent
  return `
⚡ BRAND CONTEXT MODE — NO DIRECT DATA
The user asked about "${brandName}", but NONE of the retrieved trends explicitly mention this brand.
You MUST:
1. **ACKNOWLEDGE** upfront that the graph does not contain data specifically about "${brandName}".
2. **FRAME** the response as: "While our graph doesn't have specific data on ${brandName}, here are the industry trends most relevant to their market positioning:"
3. **EXPLAIN** for each trend WHY it's relevant to "${brandName}" — what strategic connection exists.
4. **DO NOT** claim these trends are about "${brandName}" or pretend the brand was found in the data.
5. Keep the tone helpful — the contextual trends ARE useful, just be honest about the source.

The opening paragraph should name "${brandName}" and explain that the response shows relevant industry context rather than brand-specific intelligence.
`;
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

  const intent = classifyQueryIntent(query);

  // ── Advisory Mode ─────────────────────────────────────────────
  if (intent === 'advisory') {
    return `
ROLE: You are the Fodda Strategic Advisor (Vertical: ${vertical}).
MODE: STRATEGIC ADVISORY

TASK: The user has asked a strategic/advisory question. Provide balanced analysis.

APPROACH:
1. **STRATEGIC ASSESSMENT**: Open with a 2-3 sentence direct answer to their question — give a clear recommendation or perspective.
2. **SUPPORTING TRENDS**: Cite graph data as supporting evidence where relevant using \`## [Trend Name](#trend-ID)\` headers. For each trend, explain WHY it supports (or challenges) the user's idea.
3. **CONSIDERATIONS**: Add a section with practical considerations, risks, or opportunities the user should evaluate.
4. **HONESTY ABOUT SCOPE**: If the graph data doesn't directly address their specific question (e.g., a specific neighborhood), acknowledge this and explain what the data CAN tell them about the broader category.

METADATA USAGE:
- **WHY NOW:** and **ADJACENT POSSIBILITIES:** labels are REQUIRED under each trend.
- Use \`### [Article Title](#article-ID)\` for supporting signals.

⚠️ CRITICAL: Do NOT pretend the graph has location-specific or hyper-local data if it doesn't. Be transparent about what the data covers.

STYLE:
- Consultative, direct, and helpful — like a knowledgeable industry advisor.
- Balance optimism with pragmatism.
- End with 2-3 specific follow-up questions the user should explore.
`;
  }

  // ── Visualization Redirect ────────────────────────────────────
  if (intent === 'visualization') {
    return `
ROLE: You are the Fodda Insight Analyst (Vertical: ${vertical}).
MODE: DATA ANALYSIS (Visualization Requested)

TASK: The user asked for a visual/graphical representation. Provide the best text-based analysis you can.

APPROACH:
1. **ACKNOWLEDGE**: Note that you're providing a trend analysis rather than a visual chart. Mention they can click the Graph icon on any response to explore an interactive trend map.
2. **TRENDS**: Present the most relevant trends using \`## [Trend Name](#trend-ID)\` headers with **WHY NOW:** and **ADJACENT POSSIBILITIES:** labels.
3. **SIGNALS**: Use \`### [Article Title](#article-ID)\` for supporting evidence.

STYLE: Insightful and structured. Use comparative language where possible to address the user's implicit comparison intent.
`;
  }

  // ── Single Concept Enrichment ─────────────────────────────────
  if (intent === 'single_concept') {
    return `
ROLE: You are the Fodda Insight Analyst (Vertical: ${vertical}).
MODE: CONCEPT EXPLORATION

TASK: The user typed a broad concept ("${query}"). Organize your response around the most relevant trends.

APPROACH:
1. **OVERVIEW**: Open with what the graph knows about "${query}" — frame the topic in 2-3 sentences.
2. **TRENDS**: Present the most relevant trends using \`## [Trend Name](#trend-ID)\` headers with **WHY NOW:** and **ADJACENT POSSIBILITIES:** labels.
3. **SIGNALS**: Use \`### [Article Title](#article-ID)\` for supporting evidence.
4. **GUIDE**: End with specific follow-up questions to help the user narrow their exploration.

⚠️ If the data is sparse (few results or low confidence), be transparent: "The graph has limited data specifically about '${query}', but here are the most relevant signals..." and suggest the user try more specific queries.

STYLE: Helpful, educational, and encouraging of deeper exploration.
`;
  }

  // ── Comparative ───────────────────────────────────────────────
  if (intent === 'comparative') {
    return `
ROLE: You are the Fodda Insight Analyst (Vertical: ${vertical}).
MODE: COMPARATIVE ANALYSIS

TASK: The user has asked for a comparison. Present the data in a way that highlights contrasts and parallels.

APPROACH:
1. **COMPARISON SUMMARY**: Open with a 2-3 sentence overview of how the two sides compare.
2. **TRENDS**: Present relevant trends using \`## [Trend Name](#trend-ID)\` headers, grouping or annotating by which side of the comparison they relate to. Include **WHY NOW:** and **ADJACENT POSSIBILITIES:** for each.
3. **SIGNALS**: Use \`### [Article Title](#article-ID)\` for supporting evidence.
4. **SYNTHESIS**: End with a paragraph synthesizing the overall direction.

⚠️ If the graph data doesn't have quantitative comparison data (e.g., market share numbers), be transparent about this and focus on qualitative trend analysis.

STYLE: Analytical, balanced, and structured.
`;
  }

  // ── Trend List (enhanced from original) ───────────────────────
  if (intent === 'trend_list') {
    return `
ROLE: You are the Fodda Insight Analyst (Vertical: ${vertical}).
MODE: TOPIC SYNTHESIS

TASK: Synthesize trends and innovation signals related to: "${extractTopic(query)}".

MANDATORY OUTPUT FORMAT:
1. **SUMMARY**: A 2-3 sentence overview of findings.
2. **TRENDS**: Present at least 3 relevant Trends as ## [Name](#id) headers.
3. **INSIGHTS**: Each trend MUST include these bold labels:
   - **WHY NOW:** [Explanation of timing/drivers]
   - **ADJACENT POSSIBILITIES:** [Explanation of future opportunities]
4. **SIGNALS**: List 1-3 supporting signals using the article's TITLE field (NOT the brand name) as ### [Article Title](#article-ID) sub-headers.

STYLE:
- **PREMIUM FORMATTING**: Use ## [Name](#id) for trend headers and ### [Name](#id) for signal headers.
- **HASH PREFIX**: Always include the '#' character in anchors (e.g. #trend-abc).
- **Tone**: Insightful, professional, and helpful.
- End with: "Click a name to view supporting evidence in the panel, or ask a follow-up about any specific area above."
`;
  }

  if (vertical === Vertical.SIC) {
    return `
ROLE: You are the SIC (Strategic Independent Culture) Analyst.
OBJECTIVE: You track subcultures, fringe movements, and aesthetic shifts before they hit the mainstream.

CONTEXT: You are looking at data from the "Strategic Independent Culture" (SIC) Graph—signals from the edge of culture.

MANDATORY STRUCTURE:
1. TRENDS: Use ## [Trend Name](#trend-ID).
2. INSIGHTS: Under each trend header, you MUST include:
   - **WHY NOW:** [Explanation of current timing]
   - **ADJACENT POSSIBILITIES:** [Explanation of potential impact]
3. SIGNALS: Use ### [Article Title](#article-ID) — use the article's TITLE field, not the brand name.

TRACEABILITY:
- Use Markdown Anchors for ALL names/titles.
- NO VISIBLE IDs: [Name](#id) only.
- **HASH PREFIX**: You MUST include the '#' character in all internal links (e.g. #trend-abc).

STYLE:
- Observant, culturally literate, and forward-looking.
- Write in concise, premium editorial paragraphs.
`;
  }

  if (vertical === Vertical.CEDesign) {
    return `
ROLE: You are the Fodda Consumer Electronics & Industrial Design Analyst.
OBJECTIVE: You track the intersection of technology, human-centric design, and hardware innovation.

CONTEXT: You are looking at data from the "Consumer Electronics & Design" Graph — signals from the leading edge of hardware and software design.

MANDATORY STRUCTURE:
1. TRENDS: Use ## [Trend Name](#trend-ID).
2. INSIGHTS: Under each trend header, you MUST include:
   - **WHY NOW:** [Explanation of current timing]
   - **ADJACENT POSSIBILITIES:** [Explanation of potential impact]
3. SIGNALS: Use ### [Article Title](#article-ID) — use the article's TITLE field, not the brand name.

TRACEABILITY:
- Use Markdown Anchors for ALL names/titles.
- NO VISIBLE IDs: [Name](#id) only.
- **HASH PREFIX**: You MUST include the '#' character in all internal links (e.g. #trend-abc).

STYLE:
- Technical yet accessible, design-obsessed, and future-ready.
- Write in concise, premium editorial paragraphs focusing on form, function, and technological shifts.
`;
  }

  if (vertical === Vertical.MLBSponsorship) {
    return `
ROLE: You are the Fodda MLB Sponsorship & Technology Intelligence Analyst.
OBJECTIVE: You map the convergence of technology and sponsorship in Major League Baseball — from AI-powered fan engagement and facial authentication to prediction markets and digital collectibles.

CONTEXT: You are looking at data from the "MLB Sponsorship & Technology" Graph — curated by Comunicano, tracking how technology activation creates new sponsorship categories and transforms the fan experience across MLB's 30-team, 120-affiliate ecosystem.

MANDATORY STRUCTURE:
1. TRENDS: Use ## [Trend Name](#trend-ID).
2. INSIGHTS: Under each trend header, you MUST include:
   - **WHY NOW:** [Explanation of current timing]
   - **ADJACENT POSSIBILITIES:** [Explanation of potential impact]
3. SIGNALS: Use ### [Article Title](#article-ID) — use the article's TITLE field, not the brand name.

TRACEABILITY:
- Use Markdown Anchors for ALL names/titles.
- NO VISIBLE IDs: [Name](#id) only.
- **HASH PREFIX**: You MUST include the '#' character in all internal links (e.g. #trend-abc).

STYLE:
- Authoritative on sports business, technology-savvy, and commercially aware.
- Write in concise, premium editorial paragraphs emphasizing sponsorship ROI, fan experience innovation, and technology deployment.
`;
  }

  if ((vertical as string) === 'generative-realities') {
    return `
ROLE: You are the Fodda Generative Realities Analyst.
OBJECTIVE: You map the intersection of generative AI, emerging technology, and culture — tracking how synthetic media, spatial computing, digital identity and creative tools reshape society.

CONTEXT: You are looking at data from "Pat McDonald's Generative Realities" Graph — curated signals on how technology and culture are converging to create new forms of expression, commerce, and experience.

MANDATORY STRUCTURE:
1. TRENDS: Use ## [Trend Name](#trend-ID).
2. INSIGHTS: Under each trend header, you MUST include:
   - **WHY NOW:** [Explanation of current timing]
   - **ADJACENT POSSIBILITIES:** [Explanation of potential impact]
3. SIGNALS: Use ### [Article Title](#article-ID) — use the article's TITLE field, not the brand name.

TRACEABILITY:
- Use Markdown Anchors for ALL names/titles.
- NO VISIBLE IDs: [Name](#id) only.
- **HASH PREFIX**: You MUST include the '#' character in all internal links (e.g. #trend-abc).

STYLE:
- Culturally fluent, technologically informed, and forward-looking.
- Write in concise, premium editorial paragraphs exploring the collision of technology and culture.
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

⚠️ CRITICAL ANTI-PATTERN — DO NOT DO THIS:
A summary-only response like "Retailers are focused on removing friction by integrating AI-powered shopping assistants and streamlining checkout processes..." is UNACCEPTABLE. You MUST structure your response with individual ## trend headers.

MANDATORY RESPONSE STRUCTURE:
1. **SUMMARY**: Open with a 2-3 sentence high-level summary paragraph.
2. **TRENDS**: Present at least 3 relevant Trends, each using the format: \`## [Trend Name](#trend-ID)\`.
3. **INSIGHTS**: Under each ## header, write a concise paragraph. YOU MUST USE THESE EXACT BOLD LABELS to introduce strategic context:
   - **WHY NOW:** [Explanation of timing/drivers]
   - **ADJACENT POSSIBILITIES:** [Explanation of future opportunities]
4. **SIGNALS**: ONLY for trends that have SUB-SIGNAL entries in the context data, list 1-3 supporting signals using the article's TITLE field (NOT the brand name) as: \`### [Article Title](#article-ID)\` with a one-sentence description. The TITLE comes from the context data after "TITLE:". Example: use \`### [Lowe's launches Milo chatbot](#article-456)\` NOT \`### [Lowe's](#article-456)\`. ⚠️ If a trend has [NO SUB-SIGNALS] in the context, do NOT fabricate a ### signal header — just discuss the trend with its WHY NOW and ADJACENT POSSIBILITIES.
5. **LINKING**: Ensure brand names are also linked inline within paragraphs (e.g. "The [Brand](#article-123) platform...") for maximum interactivity.

METADATA USAGE:
- **WHY NOW**: Essential for timing and market drivers.
- **ADJACENT POSSIBILITIES**: Essential for showing trajectory and opportunity.
- **BRANDS**: Use as concrete proof points.

CLEAN HIERARCHY RULES:
1. TRENDS: Use \`## [Trend Name](#trend-ID)\`.
2. SIGNALS: Use \`### [Signal Title](#article-ID)\`.
3. NO BULLETS FOR TITLES: Never put ## or ### headers inside bullet points.
4. SPACING: Paragraphs must follow headers immediately.

STYLE:
- **PREMIUM EDITORIAL TONE**: High-end strategy report style.
- **CONCISE**: Dense, informative, and structurally rigorous.

FORMAT EXAMPLE:
Beauty retailers are reimagining in-store experiences...

## [Trend Name](#trend-123)
**WHY NOW:** Strategic insight about current timing... **ADJACENT POSSIBILITIES:** Where this is heading... [Include mentions of [Brand](#article-456)].

### [Lowe's launches Milo chatbot for product discovery](#article-456)
[Lowe's](#article-456) implemented an internal AI platform and chatbot called Milo that integrates e-commerce logs, inventory data, and customer-service transcripts to power product discovery and personalization.
`;


};

// Maximum number of trend rows to include in context to prevent Gemini from
// collapsing into a summary paragraph under context-size pressure.
const MAX_CONTEXT_ROWS = 10;

// Minimum relevance score (from vector search) to include in context.
const MIN_RELEVANCE_SCORE = 0.3;

const formatContext = (data: RetrievalResult, vertical: Vertical): string => {
  if (!data.rows || data.rows.length === 0) return "CONTEXT: [EMPTY — No matching trends found in the knowledge graph for this query.]";

  if (vertical === Vertical.Baseline) {
    let ctx = "NPORS 2025 SURVEY DATA DISTRIBUTIONS:\n";
    data.rows.forEach(row => {
      ctx += `Segment: ${row.name} | Distribution: ${row.summary}\n`;
    });
    return ctx;
  }

  // ── Relevance-based filtering ─────────────────────────────────
  // Drop rows with low vector relevance scores. API now returns
  // relevance_score from semantic search. Keep at least 1 row.
  const totalRows = data.rows.length;
  let qualifiedRows = data.rows.filter(r => {
    const relevance = (r as any).relevance_score ?? (r as any)._score ?? 1.0;
    return relevance >= MIN_RELEVANCE_SCORE;
  });
  if (qualifiedRows.length === 0 && totalRows > 0) {
    qualifiedRows = [data.rows[0]];
  }
  const filteredOutCount = totalRows - qualifiedRows.length;

  // API pre-sorts by relevance_score — no additional sorting needed.

  // Cap rows to prevent context overload
  let contextRows = qualifiedRows;
  let omittedCount = 0;
  if (contextRows.length > MAX_CONTEXT_ROWS) {
    contextRows = contextRows.slice(0, MAX_CONTEXT_ROWS);
    omittedCount = qualifiedRows.length - MAX_CONTEXT_ROWS;
  }

  // Use dataStatus from API directly for Gemini context
  const status = data.dataStatus || 'UNKNOWN';

  let ctx = `DATA_STATUS: ${status}\nSEARCH_QUERY: ${data.termsUsed?.join(', ')}\n\nRETRIEVED KNOWLEDGE GRAPH NODES (${contextRows.length} shown${omittedCount > 0 ? `, ${omittedCount} additional nodes omitted` : ''}${filteredOutCount > 0 ? `, ${filteredOutCount} low-relevance results excluded` : ''}):\n`;
  contextRows.forEach(row => {
    const nodeLabel = row.nodeType === "TREND" ? "TREND" : "SIGNAL";
    // Pre-calculate ID with prefix to ensure model uses it correctly in anchors
    const cleanId = row.id.replace(/^(trend-|article-)/, '');
    const prefixedId = row.nodeType === "TREND" ? `trend-${cleanId}` : `article-${cleanId}`;

    ctx += `[TYPE: ${nodeLabel}] [ID: ${prefixedId}] NAME: ${row.name}\n`;
    ctx += `SUMMARY: ${row.summary}\n`;

    // ENHANCEMENT: Include rich metadata in context
    if (row.metadata) {
      const m = row.metadata;
      if (m.whyNow) ctx += `WHY NOW: ${m.whyNow}\n`;
      if (m.adjacentPossibilities) ctx += `ADJACENT POSSIBILITIES: ${m.adjacentPossibilities}\n`;
      if (m.confidenceScore !== undefined) ctx += `CONFIDENCE: ${m.confidenceScore}\n`;
      if (m.evidenceCount !== undefined) ctx += `EVIDENCE COUNT: ${m.evidenceCount}\n`;
      if (m.brands && m.brands.length > 0) ctx += `BRANDS: ${m.brands.join(', ')}\n`;
      if (m.place) ctx += `LOCATION: ${m.place}\n`;
      if (m.freshnessDays !== undefined) ctx += `FRESHNESS: ${m.freshnessDays} days\n`;
    }

    if (row.evidence.length > 0) {
      row.evidence.forEach(e => {
        const brandsStr = Array.isArray(e.brandNames) ? e.brandNames.join(', ') : e.brandNames;
        const cleanEvId = e.id.replace(/^(trend-|article-)/, '');
        const prefixedEvId = `article-${cleanEvId}`;
        ctx += `- [SUB-SIGNAL ID: ${prefixedEvId}] TITLE: ${e.title} | SNIPPET: ${e.snippet} | BRANDS: ${brandsStr}\n`;
      });
    } else {
      ctx += `[NO SUB-SIGNALS]\n`;
    }

    ctx += "---\n";
  });
  return ctx;
};

/**
 * Fetch relevant supplemental institutional data based on vertical.
 * All fetches run in parallel; failures are silently ignored.
 */
const fetchSupplementalData = async (vertical: Vertical, query: string): Promise<string> => {
  const v = String(vertical).toLowerCase();
  const fetches: Promise<{ label: string; data: any }>[] = [];

  const safeFetch = async (url: string, label: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return { label, data: null };
      return { label, data: await res.json() };
    } catch {
      return { label, data: null };
    }
  };

  // FRED economic snapshot — macro context is always useful
  fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_FRED, 'FRED Economic Indicators'));

  // Vertical-specific
  if (['retail', 'fashion'].includes(v)) {
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_CENSUS_RETAIL, 'US Census Retail Sales'));
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_BEA, 'BEA Consumer Spending'));
  }
  if (['beauty', 'health'].includes(v)) {
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_FDA_SAFETY(query.substring(0, 50)), 'FDA Ingredient Safety'));
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_PUBMED(query.substring(0, 50)), 'PubMed Research'));
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_OPENALEX(query.substring(0, 50)), 'Academic Research Tracker'));
  }
  if (['sport', 'sports'].includes(v)) {
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_BLS, 'BLS Economic Data'));
  }
  if (['sic', 'culture', 'baseline', 'ce-design'].includes(v)) {
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_CENSUS_DEMOGRAPHICS, 'US Census Demographics'));
  }
  // OpenAlex academic research — broad coverage for non-biomedical verticals
  // PubMed is specialized for beauty/health (added above); OpenAlex covers retail, fashion, sports, culture, tech, etc.
  if (!['beauty', 'health'].includes(v)) {
    fetches.push(safeFetch(API_ENDPOINTS.SUPPLEMENTAL_OPENALEX(query.substring(0, 50)), 'Academic Research Tracker'));
  }

  try {
    const results = await Promise.all(fetches);
    const blocks = results
      .filter(r => r.data !== null)
      .map(r => `\n--- ${r.label} ---\n${JSON.stringify(r.data, null, 0).substring(0, 2000)}`)
      .join('\n');
    if (!blocks) return '';
    return `\n\nSUPPLEMENTAL INSTITUTIONAL DATA (use to validate and contextualize graph trends):\n${blocks}`;
  } catch {
    return '';
  }
};


export interface GenerationResponse {
  answer: string;
  suggestedQuestions: string[];
}

const repairMarkdownLinks = (text: string): string => {
  // Fix header links where the opening bracket is missing: ## Title](#id) -> ## [Title](#id)
  return text.replace(/(^|\n)(#{2,3})\s+([^[\n]+)(?=\]\(#)/g, '$1$2 [$3');
};

/**
 * Validates that a Gemini response contains structured trend headers
 * rather than being a collapsed summary paragraph.
 */
const isStructuredResponse = (answer: string): boolean => {
  // Count trend-level headers (## [...](#...))
  const headerMatches = answer.match(/^##\s+/gm);
  return (headerMatches?.length ?? 0) >= 2;
};

export const generateResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult,
  userContext?: string,
  accountContext?: string,
  firstName?: string,
  personaContext?: string
): Promise<GenerationResponse> => {
  const brandName = detectBrandIntent(query, vertical);
  const brandMatchCount = (retrievedData as any)?._brandMatchCount ?? -1;
  const brandDataFound = brandMatchCount > 0;
  const baseInstruction = getSystemInstruction(vertical, retrievedData.dataStatus, query);
  const systemInstruction = brandName
    ? getBrandFocusInstruction(brandName, brandDataFound) + '\n' + baseInstruction
    : baseInstruction;

  if (brandName) {
    console.log(`[Gemini] Brand intent detected: "${brandName}", matches in data: ${brandMatchCount}`);
  }

  const callGemini = async (prompt: string, isRetry = false): Promise<{ answer: string; next_questions: string[] }> => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          temperature: isRetry ? 0.3 : 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              answer: {
                type: "STRING",
                description: "A comprehensive, structured markdown analysis. MUST include: 1) A 2-3 sentence summary paragraph, 2) Multiple ## [Trend Name](#trend-ID) headers with detailed paragraphs incorporating WHY NOW context and ADJACENT POSSIBILITIES, 3) ### [Brand Name](#article-ID) sub-headers with descriptions under each trend. Aim for 3-7 trends with 1-3 examples each. Use the FULL markdown structure specified in the system instruction. Do NOT return just a summary paragraph — this is a HARD REQUIREMENT."
              },
              next_questions: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "3-5 short follow-up queries (MAX 6-8 words each, like search terms, NOT full sentences). RULES: 1) Prioritize trends, signals, or themes from the retrieved data that you DID NOT discuss — guide the user to explore what else is available. 2) Include ONE query that explores adjacent territory to the main trends you discussed (e.g., if you discussed checkout automation, suggest 'In-store AI product advisors' or 'Autonomous delivery models'). 3) Do NOT suggest deep-dives into a specific brand's internal strategy (the graph tracks industry trends, not company plans). Good: 'Refillable packaging in retail', 'DTC flagship expansion strategies'. Bad: 'What are Nike's plans for expanding its retail footprint?'"
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
    if (!rawText) throw new Error("No content returned");

    try {
      return JSON.parse(rawText);
    } catch {
      return { answer: rawText, next_questions: [] };
    }
  };

  try {
    const contextStr = formatContext(retrievedData, vertical);

    // Fetch supplemental institutional data in parallel
    const supplementalStr = await fetchSupplementalData(vertical, query);
    if (supplementalStr) {
      console.log(`[Gemini] Supplemental data enrichment: ${supplementalStr.length} chars`);
    }

    let fullPrompt = `${contextStr}${supplementalStr}\n\nUSER QUERY: ${query}`;

    // Inject Contexts if present
    if (accountContext?.trim()) {
      fullPrompt += `\n\nACCOUNT CONTEXT (Your Perspective/Goal): ${accountContext}`;
    }
    if (userContext?.trim()) {
      const userName = firstName || 'the user';
      fullPrompt += `\n\nUSER CONTEXT (About ${userName}): ${userContext}`;
    }
    if (personaContext?.trim()) {
      fullPrompt += `\n\nRESEARCH PERSONA (confirmed by user — use to tailor depth and framing): ${personaContext}`;
    }

    let parsed = await callGemini(fullPrompt);
    let cleanAnswer = repairMarkdownLinks(parsed.answer || "No answer generated.");

    // Validate response structure — retry once if Gemini collapsed to a summary
    const hasTrendData = retrievedData.rows?.length > 0 && vertical !== Vertical.Baseline;
    if (hasTrendData && !isStructuredResponse(cleanAnswer)) {
      console.warn("[Gemini] Response lacked structured trend headers — retrying with reinforcement");
      const retryPrompt = `${fullPrompt}\n\nIMPORTANT: Your response MUST contain multiple ## [Trend Name](#trend-ID) headers. Structure your analysis around the individual trends provided in the context above. Do NOT write a single summary paragraph.`;

      try {
        const retryParsed = await callGemini(retryPrompt, true);
        const retryAnswer = repairMarkdownLinks(retryParsed.answer || "");
        if (isStructuredResponse(retryAnswer)) {
          console.log("[Gemini] Retry produced structured response");
          cleanAnswer = retryAnswer;
          parsed = retryParsed;
        } else {
          console.warn("[Gemini] Retry also lacked structure — using best available response");
        }
      } catch (retryErr) {
        console.error("[Gemini] Retry failed, using original response:", retryErr);
      }
    }

    return {
      answer: cleanAnswer,
      suggestedQuestions: parsed.next_questions || []
    };

  } catch (error: any) {
    console.error("Gemini Failure:", error);
    return { answer: `Intelligence Engine Error: ${error.message}`, suggestedQuestions: [] };
  }
};

/**
 * Gemini Search mode — calls Gemini with Google Search grounding (no graph data).
 */
export const generateGeminiSearchResponse = async (
  query: string,
  vertical: Vertical
): Promise<GenerationResponse> => {
  try {
    const response = await fetch("/api/gemini-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, vertical })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    return {
      answer: data.answer || "No response generated.",
      suggestedQuestions: data.suggestedQuestions || []
    };
  } catch (error: any) {
    console.error("Gemini Search Failure:", error);
    return { answer: `Gemini Search Error: ${error.message}`, suggestedQuestions: [] };
  }
};

/**
 * Blended mode — retrieves graph signals first, then sends them as context
 * to Gemini with Google Search grounding for enriched synthesis.
 */
export const generateBlendedResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult
): Promise<GenerationResponse> => {
  try {
    // Build a compact context string from graph data
    const graphContext = formatContext(retrievedData, vertical);

    const response = await fetch("/api/gemini-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, vertical, graphContext })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    return {
      answer: data.answer || "No response generated.",
      suggestedQuestions: data.suggestedQuestions || []
    };
  } catch (error: any) {
    console.error("Blended Response Failure:", error);
    return { answer: `Blended Mode Error: ${error.message}`, suggestedQuestions: [] };
  }
};

