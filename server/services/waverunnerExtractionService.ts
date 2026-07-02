/**
 * Waverunner Extraction Service — Deep Extract via Gemini Agents API
 *
 * Uses the Gemini Interactions API for multi-turn autonomous extraction:
 *   Turn 1: Extract raw metadata, trends, evidence from PDF
 *   Turn 2: Google Search each trend name for market validation
 *   Turn 3: Return enriched metadata with validation scores
 *
 * Fallback: If the Interactions API is unavailable, falls back to single-shot
 * Gemini 2.0 Flash extraction (same as the existing /upload-pdf handler).
 */

export interface TrendValidation {
  name: string;
  summary: string;
  validationStatus: 'verified' | 'emerging' | 'review';
  validationNote?: string;
}

export interface WaverunnerExtractionResult {
  graphName: string;
  description: string;
  creator: string;
  organization: string;
  domain: string;
  expertType: string;
  expertJobTitle: string;
  expertCompany: string;
  curatorUrl: string;
  perspective: string;
  reportTitle: string;
  publicationDate: string;
  updateFrequency: string;
  type: string;
  macroTrends: Array<{ name: string; summary: string }>;
  trends: TrendValidation[];
  evidence: string[];
  tags: string;
  overlappingGraphs: string[];
  extractionMode: 'waverunner' | 'flash';
}

export interface ExtractionProgress {
  stage: string;
  detail: string;
  percent: number;
}

const DEEP_EXTRACTION_SYSTEM_PROMPT = `You are a research report analyzer and market intelligence validator for Fodda, a knowledge graph platform.

Your task has two phases:

## Phase 1: Extraction
Extract structured metadata from the provided PDF report. Extract:
- graphName, description, creator, organization, domain, expertType, expertJobTitle, expertCompany
- curatorUrl, perspective, reportTitle, publicationDate, updateFrequency, type
- macroTrends (array of {name, summary})
- trends (array of {name, summary})
- evidence (array of data points / case studies mentioned)
- tags (comma-separated topic tags)

## Phase 2: Validation
For each extracted trend, use Google Search to verify it is a real, current market pattern:
- "verified": Google Search returns multiple credible sources discussing this trend
- "emerging": Some mentions found but limited coverage — possible early signal
- "review": No web validation found — may be report-specific terminology

## Output Format
Return a single JSON object with all Phase 1 fields plus:
- trends: Array of {name, summary, validationStatus, validationNote}
  where validationStatus is one of: "verified", "emerging", "review"
  and validationNote is a brief explanation of the validation result

Important:
- Use Title Case for names but PRESERVE abbreviations (SXSW, AI, DHL, etc).
- Do NOT use slashes in trend names.
- Return ONLY valid JSON, no markdown.`;

/**
 * Deep extraction using Gemini with Google Search grounding for trend validation.
 *
 * This uses Gemini 2.5 Flash with google_search tool enabled, allowing the model
 * to autonomously validate each trend against current web data.
 */
export async function extractWithWaverunner(
  pdfBase64: string,
  pdfFileName: string,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<WaverunnerExtractionResult> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  onProgress?.({ stage: 'extracting', detail: 'Analyzing report structure...', percent: 10 });

  try {
    // Use Gemini 2.5 Flash with Google Search grounding for autonomous validation
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
            { text: 'Extract metadata from this report and validate each trend using Google Search. Return the enriched JSON.' },
          ],
        },
      ],
      config: {
        systemInstruction: DEEP_EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 16384,
        tools: [{ googleSearch: {} }],
      },
    });

    onProgress?.({ stage: 'validating', detail: 'Validating trends against market data...', percent: 60 });

    const text = result.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Waverunner extraction response');
    }

    const extraction = JSON.parse(jsonMatch[0]);

    onProgress?.({ stage: 'enriching', detail: 'Generating enriched metadata...', percent: 85 });

    // Map trends to include validation status
    const validatedTrends: TrendValidation[] = (extraction.trends || []).map((t: any) => ({
      name: t.name || (typeof t === 'string' ? t : ''),
      summary: t.summary || '',
      validationStatus: t.validationStatus || 'review',
      validationNote: t.validationNote || '',
    }));

    onProgress?.({ stage: 'complete', detail: 'Deep extraction complete', percent: 100 });

    return {
      graphName: extraction.graphName || '',
      description: extraction.description || '',
      creator: extraction.creator || '',
      organization: extraction.organization || '',
      domain: extraction.domain || '',
      expertType: extraction.expertType || 'Person',
      expertJobTitle: extraction.expertJobTitle || '',
      expertCompany: extraction.expertCompany || extraction.organization || '',
      curatorUrl: extraction.curatorUrl || '',
      perspective: extraction.perspective || '',
      reportTitle: extraction.reportTitle || '',
      publicationDate: extraction.publicationDate || '',
      updateFrequency: extraction.updateFrequency || 'One-Off',
      type: extraction.type || 'expert_graph',
      macroTrends: extraction.macroTrends || [],
      trends: validatedTrends,
      evidence: extraction.evidence || [],
      tags: extraction.tags || '',
      overlappingGraphs: [], // Populated by the router after extraction
      extractionMode: 'waverunner',
    };
  } catch (err: any) {
    console.error('[WaverunnerExtraction] Deep extraction failed, details:', err.message);
    throw err;
  }
}

/**
 * Extract content from a non-PDF URL using url_context.
 * Works with blog posts, Substack newsletters, company report pages, etc.
 */
export async function extractFromUrlContext(
  sourceUrl: string,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<WaverunnerExtractionResult> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  onProgress?.({ stage: 'fetching', detail: 'Reading URL content...', percent: 10 });

  const extractionPrompt = `You are a research report analyzer. Extract structured metadata from the content at the provided URL.

Return a JSON object with these fields:
- graphName: A concise name for the knowledge graph (Title Case)
- description: A one-liner summary
- creator: The author/expert name (Title Case)
- organization: The publishing organization (Title Case, preserve abbreviations)
- expertType: "Person" if by an individual, "Organization" if by a company
- expertJobTitle: Author's job title if mentioned
- expertCompany: The company the author works for
- curatorUrl: Author's or org's website URL if mentioned
- perspective: 2-3 sentences describing the curator's unique approach
- domain: Primary industry domain (e.g., Retail, Beauty, Technology)
- reportTitle: The exact title
- publicationDate: Publication date if found (YYYY-MM-DD)
- updateFrequency: One of "One-Off", "Annual", "Quarterly", "Monthly"
- type: "expert_graph" or "industry_report"
- macroTrends: Array of {name, summary}
- trends: Array of {name, summary}
- evidence: Array of evidence/data points
- tags: Comma-separated topic tags

Focus on the main article content — ignore navigation, footers, ads, cookie banners.
Use Title Case for names but PRESERVE abbreviations (SXSW, AI, DHL, etc).
Return ONLY valid JSON, no markdown.

URL to analyze: ${sourceUrl}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: extractionPrompt }] },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        tools: [{ urlContext: {} }],
      },
    });

    onProgress?.({ stage: 'extracting', detail: 'Parsing content structure...', percent: 60 });

    const text = result.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in url_context extraction response');
    }

    const extraction = JSON.parse(jsonMatch[0]);

    onProgress?.({ stage: 'complete', detail: 'URL extraction complete', percent: 100 });

    return {
      graphName: extraction.graphName || '',
      description: extraction.description || '',
      creator: extraction.creator || '',
      organization: extraction.organization || '',
      domain: extraction.domain || '',
      expertType: extraction.expertType || 'Person',
      expertJobTitle: extraction.expertJobTitle || '',
      expertCompany: extraction.expertCompany || extraction.organization || '',
      curatorUrl: extraction.curatorUrl || '',
      perspective: extraction.perspective || '',
      reportTitle: extraction.reportTitle || '',
      publicationDate: extraction.publicationDate || '',
      updateFrequency: extraction.updateFrequency || 'One-Off',
      type: extraction.type || 'expert_graph',
      macroTrends: extraction.macroTrends || [],
      trends: (extraction.trends || []).map((t: any) => ({
        name: t.name || (typeof t === 'string' ? t : ''),
        summary: t.summary || '',
        validationStatus: 'review' as const,
        validationNote: '',
      })),
      evidence: extraction.evidence || [],
      tags: extraction.tags || '',
      overlappingGraphs: [],
      extractionMode: 'flash',
    };
  } catch (err: any) {
    console.error('[WaverunnerExtraction] URL context extraction failed:', err.message);
    throw err;
  }
}
