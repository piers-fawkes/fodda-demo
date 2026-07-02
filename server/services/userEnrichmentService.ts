/**
 * User Enrichment Service
 * 
 * Fires immediately on email confirmation. Performs a web search
 * (via Gemini's built-in Google Search grounding) on the user's name
 * and company, then classifies them into a buyer type and infers their
 * industry. Writes both to the user's Airtable record so the 5-minute
 * onboarding email can use them.
 * 
 * Total budget: < 30 seconds.
 */

// Free-email domains — no web search signal available for these
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'me.com', 'icloud.com',
  'mac.com', 'hotmail.com', 'outlook.com', 'live.com',
  'yahoo.com', 'yahoo.co.uk', 'protonmail.com', 'proton.me',
  'aol.com', 'msn.com', 'hey.com'
]);

const BUYER_TYPES = [
  'Agency Strategist',
  'Enterprise Research/AI',
  'AI Startup/Developer',
  'Publisher/Thought Leader',
  'Unknown'
] as const;

export type BuyerType = typeof BUYER_TYPES[number];

export interface EnrichmentResult {
  buyerType: BuyerType;
  buyerIndustry: string;
}

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Main enrichment function. Safe to call fire-and-forget.
 * Returns the buyer type and industry for use in prompt selection.
 */
export async function enrichUserBuyerType(
  email: string,
  firstName: string,
  lastName: string,
  company: string,
  updateAirtableFn: (tableId: string, recordId: string, fields: any) => Promise<any>,
  usersTableId: string,
  userRecordId: string
): Promise<EnrichmentResult> {

  const fallback: EnrichmentResult = { buyerType: 'Unknown', buyerIndustry: '' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Enrichment] GEMINI_API_KEY is not set. Cannot enrich user. Please configure this env var.');
    return fallback;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    let searchContext = '';

    // Only run web search if we have a company name and a non-personal email
    const hasSearchSignal = company && company.trim().length > 2 && !isPersonalEmail(email);

    if (hasSearchSignal) {
      const fullName = `${firstName} ${lastName}`.trim();
      const searchQuery = [fullName, company].filter(Boolean).join(' ');

      console.log(`[Enrichment] Running Google Search grounding for: "${searchQuery}"`);

      try {
        // Use Gemini with built-in Google Search grounding (same GEMINI_API_KEY, no extra keys)
        const searchResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Search for professional information about "${searchQuery}". 
                     Summarise their role, company type, industry, and any public professional background in 3-4 sentences.
                     Focus on their professional context, not personal information.`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
          }
        });
        searchContext = searchResponse.text || '';
        console.log(`[Enrichment] Search context retrieved (${searchContext.length} chars)`);
      } catch (searchErr) {
        console.warn('[Enrichment] Web search grounding failed, proceeding with name/company/title only:', searchErr);
        // Fall through — we'll classify from the available signal
        searchContext = `Name: ${firstName} ${lastName}. Company: ${company}.`;
      }
    } else {
      console.log(`[Enrichment] Skipping web search for ${email} (personal email or no company). Using available fields.`);
      searchContext = company ? `Company: ${company}.` : '';
    }

    // Classification prompt — single call, structured output
    const classificationPrompt = `You are classifying a new user who just signed up for Fodda, an AI knowledge graph platform for market intelligence and trend research.

Available information:
- Name: ${firstName} ${lastName}
- Email: ${email}
- Company: ${company || 'unknown'}
- Professional context: ${searchContext || 'No web search context available'}

Classify this person into EXACTLY ONE of these buyer types:
- "Agency Strategist": Works at a creative, media, strategy, or advertising agency. Briefs clients, builds campaigns, tracks cultural trends.
- "Enterprise Research/AI": Works in a large corporation in a research, insights, data, or AI/ML role. Focused on evidence-based decision making.
- "AI Startup/Developer": Works at or is building an AI startup or developer tool. Likely to use APIs and technical interfaces.
- "Publisher/Thought Leader": Writer, journalist, analyst, consultant, or speaker who creates public content about trends.
- "Unknown": Not enough information to classify confidently.

Also identify their INDUSTRY in 2-4 words (e.g. "retail banking", "healthcare technology", "media agency", "consumer goods").

Respond ONLY with valid JSON in this exact format:
{"buyerType": "...", "industry": "..."}`;

    const classificationResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: classificationPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const raw = classificationResponse.text || '';
    let parsed: { buyerType: string; industry: string };

    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the text if it's wrapped in markdown
      const match = raw.match(/\{[^}]+\}/);
      parsed = match ? JSON.parse(match[0]) : { buyerType: 'Unknown', industry: '' };
    }

    // Validate buyer type
    const buyerType = (BUYER_TYPES as readonly string[]).includes(parsed.buyerType)
      ? parsed.buyerType as BuyerType
      : 'Unknown';
    const buyerIndustry = (parsed.industry || '').slice(0, 100); // Trim for safety

    console.log(`[Enrichment] Classified ${email}: buyerType="${buyerType}", industry="${buyerIndustry}"`);

    // Write to Airtable
    await updateAirtableFn(usersTableId, userRecordId, {
      buyer_type: buyerType,
      buyer_industry: buyerIndustry
    });

    return { buyerType, buyerIndustry };

  } catch (err) {
    console.error(`[Enrichment] Failed for ${email}:`, err);
    return fallback;
  }
}
