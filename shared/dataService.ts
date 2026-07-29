
// shared/dataService.ts
import { API_ENDPOINTS } from "./apiConfig";
import {
  RetrievalResult,
  RetrievedRow,
  Trend,
  Article,
  KnowledgeGraph,
  Vertical,
  AuthResponse,
  AdjacentTrend,
  CreatorAnalytics
} from "./types";

export interface UserLog {
  email: string;
  query: string;
  vertical: string;
  dataStatus: string;
  timestamp: string;
}

export interface McpConnection {
  ok: boolean;
  hasActiveKey: boolean;
  alreadyExists: boolean;
  mcpUrl: string | null;
  sseUrl: string | null;
  claudeConnectorUrl: string | null;
  token: string | null;
  message?: string;
  error?: string;
}

export interface TrackingInfo {
  userId?: string;
  apiKey?: string;
  userContext?: string;
  accountContext?: string;
}

type ApiMeta = {
  decision?: "ANSWER" | "ANSWER_WITH_CAVEATS" | "REFUSE";
  coverage?: {
    requiredTerms: string[];
    matchedTerms: string[];
    coverageRatio: number;
  };
  [k: string]: any;
};

type ApiQueryResponse = {
  ok: boolean;
  dataStatus: string;
  rows?: any[];
  termsUsed?: string[];
  meta?: ApiMeta;
  error?: string;
};

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try {
      const json = JSON.parse(text);
      if (json.error) throw new ApiError(json.error, json.code, res.status);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // Fall through to generic error
    }
    throw new ApiError(`API Error ${res.status}: ${text || res.statusText}`, undefined, res.status);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    // Preserve requestId for tracing if it's not already in data
    if (json.requestId && typeof json.data === 'object' && json.data !== null) {
      (json.data as any).requestId = json.requestId;
    }
    // REFINEMENT: Attach raw envelope for DevTools transparency
    if (typeof json.data === 'object' && json.data !== null) {
      Object.defineProperty(json.data, '_rawEnvelope', {
        value: json,
        enumerable: false, // Hide from standard iteration
        writable: true,
        configurable: true
      });
    }
    return json.data as T;
  }
  return json as T;
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { ...headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try {
      const json = JSON.parse(text);
      if (json.error) throw new ApiError(json.error, json.code, res.status);
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError(`API Error ${res.status}: ${text || res.statusText}`, undefined, res.status);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    if (json.requestId && typeof json.data === 'object' && json.data !== null) {
      (json.data as any).requestId = json.requestId;
    }
    return json.data as T;
  }
  return json as T;
}

function normalizeBrandNames(val: any): string[] {
  if (Array.isArray(val)) {
    const cleaned = val.map((s) => String(s).trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }
  if (typeof val === "string") {
    const parts = val
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }
  return [];
}

function normalizeVertical(v: any): Vertical | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s.includes("sport")) return Vertical.Sports;
  if (s.includes("retail")) return Vertical.Retail;
  if (s.includes("beauty")) return Vertical.Beauty;
  if (s.includes("baseline")) return Vertical.Baseline;
  if (s.includes("waldo")) return Vertical.Waldo;
  if (s.includes("sic")) return Vertical.SIC;
  return null;
}

/**
 * Strips conversational preambles and filler from a user query,
 * returning the core search term(s) for brand/topic detection.
 */
export function cleanSearchQuery(query: string): string {
  let q = query.trim();
  // Remove common preambles
  const preambles = [
    /^(tell me|show me|what do you know|what can you tell me|i want to know|i want to learn|i'd like to know|deep dive into|deep dive on)\s+(more\s+)?(about\s+)?/i,
    /^(what are|what is|how is|how are)\s+/i,
    /^(can you|could you|please)\s+(tell|show|explain|describe)\s+(me\s+)?(about\s+)?/i,
  ];
  for (const p of preambles) {
    q = q.replace(p, '');
  }
  // Remove trailing question marks and whitespace
  q = q.replace(/\?+$/, '').trim();
  return q;
}

// ── Static fallback graph list (used when API is unreachable) ──
// IMPORTANT: graph_type values MUST match the Airtable Graph List table (source of truth).
// Mapping: domain → Domain Context, expert → Expert Graphs, industry report → Industry Papers,
//          supplemental → Institutional, user → Custom, skill → Skills
const FALLBACK_GRAPHS: KnowledgeGraph[] = [
  // ─── Domain Context ───
  { id: Vertical.Retail, name: "PSFK Retail Trends", headline: "Commerce, CX, omnichannel, and emerging retail formats", description: "Commerce, CX, omnichannel, and emerging retail formats.", owner: "PSFK Editorial", isCustom: false, verticalName: "Retail & Commerce", graph_type: 'domain', status: 'live', topics: ['retail', 'technology'] },
  { id: Vertical.Beauty, name: "PSFK Beauty Trends", headline: "Biotech, personalization, wellness, fragrance innovation", description: "Biotech, personalization, wellness, fragrance innovation.", owner: "PSFK Editorial", isCustom: false, verticalName: "Beauty & Wellness", graph_type: 'domain', status: 'live', topics: ['beauty', 'health'] },
  { id: Vertical.Sports, name: "PSFK Sports Trends", headline: "Fandom, performance tech, media rights, fitness formats", description: "Fandom, performance tech, media rights, fitness formats.", owner: "PSFK Editorial", isCustom: false, verticalName: "Sports & Fitness", graph_type: 'domain', status: 'live', topics: ['sport', 'health', 'technology'] },
  { id: "fashion", name: "PSFK Fashion Trends", headline: "Fashion design, streetwear, luxury, sustainability", description: "Fashion design, streetwear, luxury, sustainability.", owner: "PSFK Editorial", isCustom: false, verticalName: "Fashion & Apparel", graph_type: 'domain', status: 'beta', topics: ['fashion', 'culture', 'sustainability'] },
  { id: Vertical.Tech, name: "PSFK Technology", headline: "Emerging technology adoption, AI integration, and digital infrastructure innovation", description: "Emerging technology adoption, AI integration, and digital infrastructure innovation. From enterprise AI to consumer-facing tech shifts.", owner: "PSFK Editorial", isCustom: false, verticalName: "Technology", graph_type: 'domain', status: 'live', topics: ['technology', 'all'] },
  { id: Vertical.Food, name: "PSFK Food & Beverage", headline: "Innovation in food systems, functional ingredients, alternative proteins, and beverage culture", description: "Innovation in food systems, functional ingredients, alternative proteins, and beverage culture. From farm-to-fork tech to new dining formats.", owner: "PSFK Editorial", isCustom: false, verticalName: "Food & Beverage", graph_type: 'domain', status: 'live', topics: ['food', 'all'] },
  { id: Vertical.Travel, name: "PSFK Travel & Hospitality", headline: "Travel experience innovation, sustainable tourism, and hospitality tech", description: "Travel experience innovation, sustainable tourism, and hospitality tech. From regenerative travel to AI concierge and destination reimagination.", owner: "PSFK Editorial", isCustom: false, verticalName: "Travel & Hospitality", graph_type: 'domain', status: 'live', topics: ['travel', 'all'] },

  // ─── Expert Graphs ───
  { id: Vertical.SIC, name: "Ben Dietz SIC Graph", headline: "Culture, media, marketing, and platform trends", description: "Culture, media, marketing, and platform trends from Streets Is Calling.", owner: "Ben Dietz", isCustom: false, verticalName: "Culture & Media", graph_type: 'expert', status: 'live', topics: ['culture', 'advertising', 'technology'] },
  { id: "2026-macro-trend-graph", name: "Revisionary 2026 Macro Trends", headline: "About sensemaking: cutting through the noise, drawing connections, discerning meaning", description: "About sensemaking: cutting through the noise, drawing connections, discerning meaning.", owner: "Anu Lingala", isCustom: false, verticalName: "culture", graph_type: 'expert', status: 'live', topics: ['macro trends', 'sustainability', 'place', 'humanism'] },
  { id: "marieke-neleman-trends", name: "Marieke Neleman Cultural Signals", headline: "Design and lifestyle trend intelligence", description: "Design and lifestyle trend intelligence from Marieke Neleman.", owner: "Marieke Neleman", isCustom: false, verticalName: "Design & Lifestyle", graph_type: 'expert', status: 'live', topics: ['design', 'fashion', 'culture'] },
  { id: "ezra-eeman-wayfinder", name: "Ezra Eeman Future of Work", headline: "Future-of-work and digital transformation trends", description: "Future-of-work and digital transformation trends from Ezra Eeman.", owner: "Ezra Eeman", isCustom: false, verticalName: "Future of Work & Digital Transformation", graph_type: 'expert', status: 'live', topics: ['work', 'technology'] },
  { id: "florian-schleicher-friction-unloaded", name: "Florian Schleicher — Friction Unloaded", headline: "Innovation and friction trends", description: "Innovation and friction trends from Florian Schleicher.", owner: "Florian Schleicher", isCustom: false, verticalName: "Innovation & Friction Design", graph_type: 'expert', status: 'live', topics: ['design', 'technology', 'culture'] },
  { id: "common-ground-trail-trends", name: "Common-Ground Trail Trends", headline: "Outdoor recreation and trail culture trends", description: "Outdoor recreation and trail culture trends from Common-Ground.", owner: "Janice Carrie", isCustom: false, verticalName: "Outdoor Recreation & Trail Culture", graph_type: 'expert', status: 'live', topics: ['sport', 'travel', 'health'] },
  { id: "joanna-haugen-travel-trends", name: "Joanna Haugen Travel Trends 2026", headline: "Sustainable and regenerative travel trends", description: "Sustainable and regenerative travel trends from Lemongrass Travel.", owner: "JoAnna Haugen", isCustom: false, verticalName: "Sustainable Travel & Tourism", graph_type: 'expert', status: 'live', topics: ['travel', 'culture', 'sustainability'] },
  { id: "firefish-treat-culture", name: "Firefish — Treat Culture", headline: "Consumer indulgence and treat culture trends", description: "Consumer indulgence and treat culture trends from Firefish.", owner: "Susie Hogarth", isCustom: false, verticalName: "Consumer Behavior & Treat Culture", graph_type: 'expert', status: 'live', topics: ['food', 'culture', 'retail'] },
  { id: "juan-isaza-trends", name: "Consumer Trends 2026", headline: "Consumer culture and marketing trend intelligence", description: "Consumer culture and marketing trend intelligence from Juan Isaza.", owner: "Juan Isaza", isCustom: false, verticalName: "Consumer Culture & Marketing", graph_type: 'expert', status: 'live', topics: ['culture', 'advertising', 'retail'] },
  { id: "thrive-report", name: "The Craft Graph", headline: "Craft isn't just a buzzword, it is humanity in the marketing noise", description: "Craft isn't just a buzzword, it is humanity in the marketing noise.", owner: "Sean Roche", isCustom: false, verticalName: "On-Premise Beverage Marketing", graph_type: 'expert', status: 'live', topics: ['health', 'sustainability', 'culture'] },

  // ─── Industry Papers ───
  { id: "generative-realities", name: "Dentsu Creative Generative Realities", headline: "Dentsu Creative Trends 2026: Generative Realities explore technology and culture", description: "Dentsu Creative Trends 2026: Generative Realities explore technology and culture.", owner: "Dentsu Creative", isCustom: false, verticalName: "Technology & Culture", graph_type: 'industry_report', status: 'live', topics: ['technology', 'culture', 'advertising'] },
  { id: "tipping-points", name: "Edelman Tipping Points Graph", headline: "Investigating four reactions pushing settled truths towards a new tipping point", description: "Investigating four reactions pushing settled truths towards a new tipping point.", owner: "Jay Gallagher", isCustom: false, verticalName: "Edelman Tipping Points Graph", graph_type: 'industry_report', status: 'live', topics: ['culture', 'advertising'] },
  { id: "havas-media-trends", name: "2026 Trends", headline: "Media, advertising, and content trends from Havas Media Network", description: "Media, advertising, and content trends from Havas Media Network.", owner: "Havas Media Network", isCustom: false, verticalName: "Media & Advertising", graph_type: 'industry_report', status: 'live', topics: ['advertising', 'culture', 'technology'] },
  { id: "publicis-sapient-next-graph", name: "Publicis Sapient Guide To Next", headline: "Digital business transformation and technology strategy trends", description: "Digital business transformation and technology strategy trends from Publicis Sapient.", owner: "Jay Gallagher", isCustom: false, verticalName: "Digital Transformation & Enterprise Tech", graph_type: 'industry_report', status: 'live', topics: ['technology', 'advertising', 'retail'] },
  { id: "alyson-stevens-macro", name: "TBWA — Alyson Stevens Macro Trends", headline: "Macro cultural and strategic trends from TBWA", description: "Macro cultural and strategic trends from TBWA (Alyson Stevens).", owner: "Alyson Stevens", isCustom: false, verticalName: "Culture & Macro Strategy", graph_type: 'industry_report', status: 'live', topics: ['culture', 'advertising'] },
  { id: "automotive-color-trends", name: "Automotive Color Trends", headline: "Automotive color and materials trend report by BASF", description: "Automotive color and materials trend report by BASF.", owner: "Renee Rashid-Merem", isCustom: false, verticalName: "Automotive Design & Color", graph_type: 'industry_report', status: 'live', topics: ['automotive', 'design'] },
  { id: "dhl-ecommerce-trends-2026", name: "E-Commerce Trends 2026", headline: "Global logistics and e-commerce trend intelligence from DHL", description: "Global logistics and e-commerce trend intelligence from DHL.", owner: "DHL", isCustom: false, verticalName: "Logistics & E-Commerce", graph_type: 'industry_report', status: 'live', topics: ['retail', 'technology'] },
  { id: "braze-2026-trends", name: "Braze 2026 Trends", headline: "Customer engagement and martech trends from Braze", description: "Customer engagement and martech trends from Braze.", owner: "Vicki Loomes", isCustom: false, verticalName: "Customer Engagement & Martech", graph_type: 'industry_report', status: 'live', topics: ['advertising', 'technology', 'retail'] },
  { id: "mlb-sponsorship", name: "Comunicano MLB Sponsorship & Technology Graph", headline: "How technology and sponsorship are reshaping Major League Baseball", description: "Expert intelligence on how technology and sponsorship are reshaping Major League Baseball.", owner: "Andy Abramson", isCustom: false, verticalName: "Sports Sponsorship & Technology", graph_type: 'industry_report', status: 'live', topics: ['sport', 'advertising', 'technology'] },

  // ─── Institutional (Supplemental) ───
  { id: "google_trends", name: "Google Trends Demand Signals", headline: "Relative search interest data over time from Google Trends", description: "Relative search interest data over time from Google Trends.", owner: "Google", isCustom: false, verticalName: "Demand Data", graph_type: 'supplemental', status: 'live', topics: ['all'] },
  { id: "fred_economic", name: "FRED Economic Indicators", headline: "14 key economic indicators from the Federal Reserve", description: "Consumer sentiment, CPI, unemployment, retail sales, interest rates.", owner: "Federal Reserve Bank of St. Louis", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'retail', 'all'] },
  { id: "bls_economic", name: "BLS Labor & Price Statistics", headline: "CPI inflation, employment, wages, and hours data", description: "CPI inflation, employment, wages, and hours data from the Bureau of Labor Statistics.", owner: "US Bureau of Labor Statistics", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'retail', 'all'] },
  { id: "census_retail", name: "US Census Retail Sales", headline: "Monthly retail sales and economic indicators", description: "Monthly retail sales and economic indicators from the Advance Monthly Retail Trade Survey.", owner: "US Census Bureau", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['retail', 'economics'] },
  { id: "census_demographics", name: "US Census Demographics & Economics", headline: "Annual demographic, economic, education, and housing data", description: "Annual demographic, economic, education, and housing data from the American Community Survey.", owner: "US Census Bureau", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['demographics', 'economics', 'all'] },
  { id: "bea_spending", name: "BEA Consumer Spending Breakdowns", headline: "Personal Consumption Expenditure data", description: "Where Americans spend their money across food, clothing, healthcare, recreation.", owner: "US Bureau of Economic Analysis", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'retail'] },
  { id: "pubmed_research", name: "PubMed Scientific Literature Tracker", headline: "Track where scientific research is accelerating", description: "Publication counts, 10-year trends, recent articles.", owner: "National Library of Medicine / NCBI", isCustom: false, verticalName: "Health Data", graph_type: 'supplemental', status: 'live', topics: ['health', 'beauty', 'technology'] },
  { id: "clinical_trials", name: "ClinicalTrials.gov Research Tracker", headline: "Track clinical research activity for any ingredient or condition", description: "Track clinical research activity for any ingredient, intervention, or condition.", owner: "NIH / ClinicalTrials.gov", isCustom: false, verticalName: "Health Data", graph_type: 'supplemental', status: 'live', topics: ['health', 'beauty', 'sport'] },
  { id: "cdc_health", name: "CDC Health & Wellness Data", headline: "Health behavior and chronic disease surveillance data", description: "Health behavior and chronic disease surveillance data from the CDC BRFSS survey.", owner: "Centers for Disease Control and Prevention", isCustom: false, verticalName: "Health Data", graph_type: 'supplemental', status: 'live', topics: ['health', 'beauty', 'sport'] },
  { id: "openfda_safety", name: "openFDA Ingredient & Product Safety", headline: "Real-time ingredient safety data from the FDA", description: "Real-time ingredient safety data from the FDA adverse event database.", owner: "US FDA", isCustom: false, verticalName: "Health Data", graph_type: 'supplemental', status: 'live', topics: ['health', 'beauty', 'food'] },
  { id: Vertical.Baseline, name: "Pew Research Baseline Surveys", headline: "Weighted distributions of public beliefs and behaviors", description: "Weighted distributions of public beliefs and behaviors from Pew NPORS 2025 survey.", owner: "Pew Research Center", isCustom: false, verticalName: "Survey Data", graph_type: 'supplemental', status: 'live', topics: ['culture', 'technology', 'all'] },
  { id: "pew", name: "Public Beliefs Baseline", headline: "US public opinion and behavioral data from Pew NPORS 2025", description: "Social media usage, technology adoption, news consumption, trust, and AI attitudes.", owner: "Pew Research Center", isCustom: false, verticalName: "Public Opinion & Demographics", graph_type: 'supplemental', status: 'live', topics: ['culture', 'technology'] },
  { id: "wikipedia_pageviews", name: "Wikipedia Cultural Attention Tracker", headline: "Cultural attention signals — track what the world is reading about", description: "Cultural attention signals — track what the world is reading about.", owner: "Wikimedia Foundation", isCustom: false, verticalName: "Cultural Data", graph_type: 'supplemental', status: 'live', topics: ['culture', 'all'] },
  { id: "amazon_products", name: "Amazon Product & Pricing Reality", headline: "Real-time product listings, pricing, brand distribution", description: "Real-time product listings, pricing, brand distribution, and competitive landscape from Amazon.", owner: "Amazon", isCustom: false, verticalName: "Commerce Data", graph_type: 'supplemental', status: 'live', topics: ['all', 'retail'] },
  { id: "osm_locations", name: "OpenStreetMap Commerce Infrastructure", headline: "Global retail and commercial location data", description: "Global retail and commercial location data from OpenStreetMap.", owner: "OpenStreetMap / Overpass API", isCustom: false, verticalName: "Geographic Data", graph_type: 'supplemental', status: 'live', topics: ['all'] },
  { id: "ridb_recreation", name: "Recreation.gov RIDB", headline: "US federal recreation areas, facilities, and activities", description: "US federal recreation areas, facilities, and activities for outdoor recreation.", owner: "US Federal Government (Recreation.gov)", isCustom: false, verticalName: "Geographic Data", graph_type: 'supplemental', status: 'live', topics: ['sport', 'travel'] },
  { id: "openfoodfacts_products", name: "Open Food Facts Product Database", headline: "Crowdsourced global product database with ingredient composition", description: "Ingredient composition, additive prevalence, NOVA processing levels.", owner: "Open Food Facts", isCustom: false, verticalName: "Product Data", graph_type: 'supplemental', status: 'live', topics: ['food', 'beauty', 'health'] },
  { id: "oecd_economic", name: "OECD Economic Indicators", headline: "Cross-country economic intelligence across 38 developed nations", description: "Cross-country economic intelligence across 38 developed nations.", owner: "OECD", isCustom: false, verticalName: "Global Data", graph_type: 'supplemental', status: 'live', topics: ['all', 'economics'] },
  { id: "worldbank_global", name: "World Bank Global Economics", headline: "Economic indicators across 189 countries", description: "GDP, inflation, trade, population across 189 countries.", owner: "World Bank", isCustom: false, verticalName: "Global Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'all'] },
  { id: "wto_trade", name: "WTO International Trade Statistics", headline: "Merchandise trade values, services trade, and tariff rates", description: "Merchandise trade values, services trade, and tariff rates across 160+ economies.", owner: "World Trade Organization", isCustom: false, verticalName: "Global Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'retail'] },
  { id: "ons_uk", name: "UK ONS Economic Indicators", headline: "UK retail sales, GDP, and consumer card spending data", description: "UK retail sales, GDP, and consumer card spending data from the Office for National Statistics.", owner: "UK Office for National Statistics", isCustom: false, verticalName: "Economic Data", graph_type: 'supplemental', status: 'live', topics: ['economics', 'retail', 'all'] },

  // ─── Skills ───
  { id: "Igloo", name: "Igloo", headline: "A mathematical stability gate that evaluates knowledge graph output before it reaches your AI", description: "Only grounded, corroborated signals pass through.", owner: "", isCustom: false, verticalName: "Igloo", graph_type: 'skill', status: 'draft', topics: ['all', 'retail'] },
  { id: "paralogy", name: "Paralogy", headline: "Structured creative friction for strategists who don't want the same answer as everyone else", description: "Paralogy adds structured creative friction to your Fodda workflows.", owner: "", isCustom: false, verticalName: "Paralogy", graph_type: 'skill', status: 'beta', topics: ['all', 'retail'] },

  // ─── Custom (User) ───
  { id: "ce-design", name: "Consumer Electronics & Design", headline: "Materials, form factors, aesthetics, and usage contexts", description: "Consumer electronics design trends.", owner: "piers-fawkes", isCustom: false, verticalName: "Consumer Electronics", graph_type: 'user', status: 'live', topics: ['technology', 'design', 'retail'] },
];

class DataService {
  // Session-level cache for fetched graphs
  private _cachedGraphs: KnowledgeGraph[] | null = null;
  private _cachedSupplementalSources: any[] | null = null;
  private _fetchPromise: Promise<KnowledgeGraph[]> | null = null;

  /**
   * Synchronous getter — returns cached API graphs or fallback.
   * Use fetchGraphs() to populate the cache first.
   */
  getGraphs(): KnowledgeGraph[] {
    return this._cachedGraphs || FALLBACK_GRAPHS;
  }

  async getAdjacentTrends(trendId: string): Promise<AdjacentTrend[]> {
    return [];
  }

  /**
   * Get the cached supplemental sources from the API response.
   */
  getSupplementalSources(): any[] {
    return this._cachedSupplementalSources || [];
  }

  /**
   * Async fetch from GET /api/graph-catalog (server-side Airtable proxy with 5-min cache).
   * Falls back to external API, then FALLBACK_GRAPHS if both are unreachable.
   */
  async fetchGraphs(apiKey: string): Promise<KnowledgeGraph[]> {
    // Return cache if already fetched
    if (this._cachedGraphs) return this._cachedGraphs;

    // Deduplicate concurrent calls
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = (async () => {
      try {
        console.log('[DataService] Fetching graph catalog from /api/graph-catalog...');
        const res = await fetch('/api/graph-catalog');

        if (!res.ok) {
          console.warn(`[DataService] Graph catalog API returned ${res.status}, trying external API...`);
          return await this._fetchFromExternalApi(apiKey);
        }

        const data = await res.json();
        if (!data.ok || !data.graphs?.length) {
          console.warn('[DataService] Graph catalog returned empty, trying external API...');
          return await this._fetchFromExternalApi(apiKey);
        }

        const rawGraphs = data.graphs;

        // Map server response to KnowledgeGraph interface
        const graphs: KnowledgeGraph[] = rawGraphs.map((g: any) => ({
          // Core fields (backward compatible)
          id: g.id || g.graph_id || '',
          name: g.name || '',
          description: g.description || '',
          headline: g.headline || g.description || '',
          owner: g.curator || g.owner || '',
          isCustom: false,
          verticalName: g.verticalName || g.domain || g.name || '',
          updateFrequency: g.update_frequency || '',
          sourceURL: g.curator_url || '',
          // Catalog fields
          curator: g.curator || '',
          curator_url: g.curator_url || '',
          domain: g.domain || '',
          graph_type: g.graph_type || 'domain',
          graph_sub_type: g.graph_sub_type || '',
          topics: Array.isArray(g.topics) ? g.topics : [],
          status: g.status || 'live',
          last_updated: g.last_updated || '',
          published_date: g.published_date || '',
          example_queries: Array.isArray(g.example_queries) ? g.example_queries : [],
          portrait_url: g.portrait_url || '',
          quality_checker_name: g.quality_checker_name || '',
          geography: g.geography || '',
          available_as: g.available_as || '',
          is_playground: g.is_playground || false,
          trend_count: g.trend_count || 0,
          evidence_count: g.evidence_count || 0,
          last_synced: g.last_synced || '',
          approved_date: g.approved_date || '',
          expert_slug: g.expert_slug || g.expertSlug || '',
          image_url: g.image_url || g.imageUrl || '',
          accessible: true, // All graphs from our catalog are accessible
        }));

        // Fetch analysts/experts
        let analystsGraphs: KnowledgeGraph[] = [];
        const analystBackingGraphIds = new Set<string>();
        try {
          console.log('[DataService] Fetching expert roster from /api/analysts...');
          const analystsRes = await fetch('/api/analysts');
          if (analystsRes.ok) {
            const analystsData = await analystsRes.json();
            if (analystsData.ok && Array.isArray(analystsData.analysts)) {
              // Collect backing graph IDs for dedup (exclude wildcard)
              for (const a of analystsData.analysts) {
                const backing: string[] = Array.isArray(a.backingGraphs) ? a.backingGraphs : [];
                for (const bgId of backing) {
                  if (bgId !== '*') analystBackingGraphIds.add(bgId);
                }
              }

              analystsGraphs = analystsData.analysts.map((a: any) => {
                // Use graphSubType from API; rename 'Digital Twin' to 'Human Agent'
                const apiSubType = (a.graphSubType || '').trim();
                const isExec = a.id.startsWith('brand-');
                const subType = apiSubType === 'Digital Twin' ? 'Human Agent'
                  : isExec ? 'Synthetic Executive'
                  : apiSubType || 'Synthetic Expert';
                const name = a.name || '';
                // Use stable imageUrl (ucarecdn); avoid expiring Airtable attachment URLs
                const stableImage = a.imageUrl || a.image_url || '';
                const curatorUrl = a.newsletterUrl || '';
                const curatorName = a.newsletterName || 'Fodda';
                
                return {
                  id: a.id,
                  graph_id: a.id,
                  name: name,
                  description: a.description || '',
                  headline: a.description || '',
                  owner: curatorName,
                  isCustom: false,
                  verticalName: name,
                  updateFrequency: '',
                  sourceURL: curatorUrl,
                  curator: curatorName,
                  curator_url: curatorUrl,
                  domain: a.topic ? (Array.isArray(a.topic) ? a.topic.join(', ') : a.topic) : '',
                  graph_type: 'expert',
                  graph_sub_type: subType,
                  topics: Array.isArray(a.topic) ? a.topic : (a.topic ? [a.topic] : []),
                  status: 'live',
                  last_updated: '',
                  published_date: '',
                  example_queries: Array.isArray(a.example_queries)
                    ? a.example_queries
                    : typeof a.example_queries === 'string'
                      ? (() => { try { return JSON.parse(a.example_queries); } catch { return []; } })()
                      : [],
                  portrait_url: stableImage,
                  quality_checker_name: '',
                  geography: '',
                  available_as: 'MCP, API, Chat',
                  is_playground: false,
                  trend_count: 0,
                  evidence_count: 0,
                  last_synced: '',
                  approved_date: '',
                  expert_slug: a.expertSlug || a.expert_slug || '',
                  image_url: stableImage,
                  accessible: true,
                };
              });
              console.log(`[DataService] Loaded ${analystsGraphs.length} experts from roster`);
            }
          }
        } catch (err) {
          console.warn('[DataService] Failed to fetch analysts from external API:', err);
        }

        // Deduplicate: demote catalog graphs that are backing graphs of an analyst
        // so they appear in sandbox but not the expert dropdown (the analyst entry is canonical)
        for (const g of graphs) {
          if (analystBackingGraphIds.has(g.id) && g.graph_type === 'expert') {
            g.graph_type = 'domain';
            console.log(`[DataService] Demoted catalog graph "${g.id}" from expert (analyst entry is canonical)`);
          }
        }

        const combined = [...graphs, ...analystsGraphs];
        console.log(`[DataService] Loaded ${combined.length} total graphs (source: ${data.source})`);
        this._cachedGraphs = combined;
        return combined;
      } catch (err) {
        console.warn('[DataService] /api/graph-catalog failed, trying external API:', err);
        return await this._fetchFromExternalApi(apiKey);
      } finally {
        this._fetchPromise = null;
      }
    })();

    return this._fetchPromise;
  }

  /**
   * Fallback: fetch from external API (original path).
   */
  private async _fetchFromExternalApi(apiKey: string): Promise<KnowledgeGraph[]> {
    try {
      const res = await fetch('https://api.fodda.ai/v1/graphs', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!res.ok) {
        console.warn(`[DataService] External API returned ${res.status}, using fallback`);
        this._cachedGraphs = FALLBACK_GRAPHS;
        return FALLBACK_GRAPHS;
      }

      const data = await res.json();
      const rawGraphs = data.graphs || [];
      const accessibleIds = new Set<string>(data.plan_info?.accessible_graphs || []);

      this._cachedSupplementalSources = data.supplemental_sources || [];

      const graphs: KnowledgeGraph[] = rawGraphs.map((g: any) => ({
        id: g.graph_id || g.id || '',
        name: g.name || '',
        description: g.description || '',
        headline: g.description || '',
        owner: g.curator || g.owner || '',
        isCustom: false,
        verticalName: g.domain || g.name || '',
        updateFrequency: g.update_frequency || '',
        sourceURL: g.curator_url || '',
        curator: g.curator || '',
        curator_url: g.curator_url || '',
        domain: g.domain || '',
        graph_type: g.graph_type || 'domain',
        graph_sub_type: g.graph_sub_type || '',
        topics: Array.isArray(g.topics) ? g.topics : [],
        status: g.status || 'live',
        last_updated: g.last_updated || '',
        published_date: g.published_date || '',
        example_queries: Array.isArray(g.example_queries) ? g.example_queries : [],
        portrait_url: g.portrait_url || '',
        quality_checker_name: g.quality_checker_name || '',
        geography: g.geography || '',
        available_as: g.available_as || '',
        is_playground: g.is_playground || false,
        trend_count: g.trend_count || 0,
        evidence_count: g.evidence_count || 0,
        last_synced: g.last_synced || '',
        expert_slug: g.expert_slug || g.expertSlug || '',
        image_url: g.image_url || g.imageUrl || '',
        accessible: accessibleIds.has(g.graph_id || g.id || ''),
      }));

      console.log(`[DataService] Loaded ${graphs.length} graphs from external API`);
      this._cachedGraphs = graphs;
      return graphs;
    } catch (err) {
      console.warn('[DataService] External API also failed, using static fallback:', err);
      this._cachedGraphs = FALLBACK_GRAPHS;
      return FALLBACK_GRAPHS;
    }
  }

  /**
   * Clear the cached graph list (e.g., on page reload or returning from background).
   */
  clearGraphCache(): void {
    this._cachedGraphs = null;
    this._cachedSupplementalSources = null;
    this._fetchPromise = null;
  }

  async updateGraph(id: string, updates: Partial<KnowledgeGraph>): Promise<{ ok: boolean; error?: string }> {
    try {
      // For now, we only log to server which is mocked.
      // In future, this would call the API.
      /*
      const res = await postJson(`/api/admin/graphs/${id}`, updates);
      return res as any; 
      */
      // We are calling the endpoint we just created in server/index.ts
      await postJson(`/api/admin/graphs/${id}`, updates);
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update graph", e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Persist the user's disabled graphs list to Airtable.
   * @param email - User's email
   * @param disabledGraphs - Comma-separated graph IDs (e.g. "fashion,waldo")
   */
  async updateDisabledGraphs(email: string, disabledGraphs: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await postJson<{ ok: boolean; error?: string }>('/api/user/disabled-graphs', { email, disabledGraphs });
      return res;
    } catch (e: any) {
      console.error('[DataService] Failed to update disabled graphs:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Send a query through the MCP agentic pipeline.
   * Returns the synthesized answer, suggested questions, and tool call log.
   */
  async mcpChat(query: string, vertical: string, email: string, apiKey: string, firstName?: string, personaContext?: string, userContext?: string, accountContext?: string): Promise<{
    ok: boolean;
    answer?: string;
    suggestedQuestions?: string[];
    toolCalls?: Array<{ tool: string; args: any; durationMs: number; resultPreview: string }>;
    totalDurationMs?: number;
    error?: string;
  }> {
    try {
      const res = await postJson<any>('/api/mcp/chat', { query, vertical, userId: email, firstName, personaContext, userContext, accountContext }, { 'X-API-Key': apiKey });
      return res;
    } catch (e: any) {
      console.error('[DataService] MCP chat failed:', e);
      return { ok: false, error: e.message };
    }
  }

  async login(email: string): Promise<AuthResponse> {
    console.log("[DataService] login initiated for:", email);
    try {
      const res = await postJson<AuthResponse>("/api/auth/login", { email });
      console.log("[DataService] login response success:", { ok: res.ok, message: res.message });
      return res;
    } catch (e: any) {
      console.error("[DataService] login failed", e);
      return { ok: false, error: e.message };
    }
  }

  async verifyLogin(token: string): Promise<AuthResponse> {
    console.log("[DataService] verifyLogin initiated with token");
    try {
      const res = await postJson<AuthResponse>("/api/auth/verify", { token });
      console.log("[DataService] verifyLogin success:", { ok: res.ok, hasUser: !!res.user });
      return res;
    } catch (e: any) {
      console.error("[DataService] verifyLogin failed", e);
      return { ok: false, error: e.message };
    }
  }

  async validateSession(sessionToken: string): Promise<AuthResponse> {
    try {
      const res = await postJson<AuthResponse>("/api/auth/validate-session", { sessionToken });
      return res;
    } catch (e: any) {
      console.error("[DataService] Session validation failed", e);
      return { ok: false, error: e.message };
    }
  }

  async getCurrentProfile(): Promise<AuthResponse> {
    try {
      const res = await getJson<AuthResponse>("/api/auth/profile");
      return res;
    } catch (e: any) {
      console.error("[DataService] Failed to load current profile:", e);
      return { ok: false, error: e.message };
    }
  }

  async resendConfirmation(email: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await postJson<{ ok: boolean; error?: string }>("/api/auth/resend-confirmation", { email });
      return res;
    } catch (e: any) {
      console.error("[DataService] Resend confirmation failed", e);
      return { ok: false, error: e.message };
    }
  }

  async register(email: string, firstName: string, lastName: string, company: string, jobTitle: string, companyContextRaw?: string, userContextRaw?: string, apiUse?: string, intent?: string, referralGraph?: string, isProfessionalServices?: boolean, promoTag?: string): Promise<AuthResponse> {
    console.log("[DataService] register initiated for:", email);
    try {
      const res = await postJson<AuthResponse>("/api/auth/register", {
        email,
        firstName,
        lastName,
        company,
        jobTitle,
        companyContext: companyContextRaw,
        userContext: userContextRaw,
        apiUse,
        intent,
        referralGraph,
        isProfessionalServices,
        promoTag
      });
      console.log("[DataService] register response success:", { ok: res.ok });
      return res;
    } catch (e: any) {
      console.error("[DataService] Registration failed", e);
      return { ok: false, error: e.message };
    }
  }

  async joinTeam(email: string, firstName: string, lastName: string, signupCode: string, jobTitle: string, userContext?: string) {
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, signupCode, jobTitle, userContext })
      });
      return await res.json();
    } catch (e: any) {
      console.error("Join failed", e);
      return { ok: false, error: e.message };
    }
  }

  async updateUserProfile(email: string, updates: { firstName?: string; lastName?: string; jobTitle?: string; company?: string; email?: string }) {
    try {
      await postJson("/api/user/update", { email, updates });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update user profile", e);
      return { ok: false, error: e.message };
    }
  }

  async updateUserContext(email: string, context: string) {
    try {
      await postJson("/api/user/context", { email, context });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update user context", e);
      return { ok: false, error: e.message };
    }
  }

  async updateAccountContext(accountId: string, context: string) {
    try {
      return this.updateAccount(accountId, { context });
    } catch (e: any) {
      console.error("Failed to update account context", e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Submit a user contribution (correction, extension, authored content).
   * Persists to the Context Contributions table for persona synthesis.
   */
  async submitContribution(
    userEmail: string,
    content: string,
    originType: 'authored' | 'uploaded' | 'corrected' | 'extended',
    taxonomyNode: string,
    relatedQueryId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await postJson<{ ok: boolean; error?: string }>('/api/contributions', {
        userEmail,
        content,
        originType,
        taxonomyNode,
        relatedQueryId,
        source: 'app',
      });
    } catch (e: any) {
      console.error('[DataService] submitContribution failed:', e);
      return { ok: false, error: e.message };
    }
  }

  async updateAccount(accountId: string, updates: any, role: string = 'Owner') {
    try {
      await postJson("/api/account/update", { accountId, updates, role });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update account", e);
      return { ok: false, error: e.message };
    }
  }

  async logPrompt(email: string, query: string, vertical: string, dataStatus: string) {
    try {
      return await postJson("/api/log", { email, query, vertical, dataStatus, context: { source: 'logPrompt' } });
    } catch (err) {
      console.warn("[DataService] Logging to internal system failed:", err);
    }
  }

  async logToAirtable(userId: string, email: string, query: string, vertical: string, accessKey: string, context?: any, graphIdOverride?: string, promptSource?: string): Promise<{ ok: boolean; error?: string }> {
    // Derive graphId
    const v = vertical.toLowerCase();
    let graphId = graphIdOverride || "psfk";
    if (!graphIdOverride) {
      if (v.includes("waldo")) graphId = "waldo";
      else if (v.includes("sic")) graphId = "sic";
      else if (v.includes("baseline")) graphId = "pew";
    }

    try {
      const _res = await postJson("/api/log", {
        userId,
        email,
        query,
        vertical,
        graphId,
        accessKey,
        context,
        promptSource: promptSource || '',
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[DataService] Server log failed:", err);
      return { ok: false, error: err.message };
    }
  }


  async getPlans() {
    try {
      const res = await fetch("/api/account/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return await res.json();
    } catch (e: any) {
      console.error("Failed to get plans", e);
      return { ok: false, error: e.message, plans: [] };
    }
  }

  async partnerInvite(data: { email: string; firstName?: string; companyName?: string; emailBody?: string; adminSecret: string }): Promise<{ ok: boolean; accountId?: string; apiKey?: string; error?: string; alreadyExists?: boolean }> {
    try {
      const res = await fetch("/api/account/partner-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (e: any) {
      console.error("[DataService] Partner invite failed:", e);
      return { ok: false, error: e.message };
    }
  }

  async convertToBase(email: string): Promise<{ ok: boolean; error?: string; alreadyConfirmed?: boolean }> {
    try {
      const res = await postJson<{ ok: boolean; error?: string; alreadyConfirmed?: boolean }>("/api/account/convert-to-base", { email });
      return res;
    } catch (e: any) {
      console.error("[DataService] Convert to base failed:", e);
      return { ok: false, error: e.message };
    }
  }

  async getMcpConnection(email?: string, adminSecret?: string): Promise<McpConnection> {
    try {
      const res = await postJson<McpConnection>("/api/account/mcp-connection", { email, adminSecret });
      return res;
    } catch (e: any) {
      console.error("[DataService] getMcpConnection failed:", e);
      return {
        ok: false,
        hasActiveKey: false,
        alreadyExists: false,
        mcpUrl: null,
        sseUrl: null,
        claudeConnectorUrl: null,
        token: null,
        error: e.message
      };
    }
  }

  async getLogs(): Promise<UserLog[]> {
    try {
      const res = await fetch(API_ENDPOINTS.GET_LOGS);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.error("[DataService] Failed to retrieve logs:", err);
      return [];
    }
  }

  async getDiscoveryValues(graphId: string, label: string): Promise<string[]> {
    try {
      const res = await fetch(API_ENDPOINTS.V1_DISCOVERY(graphId, label));
      if (!res.ok) throw new Error(`Discovery failed: ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.values || []);
    } catch (err) {
      console.error(`[DataService] Discovery failed for ${label}:`, err);
      return [];
    }
  }

  async semanticSearch(query: string, graphId: string, limit = 10, headers: Record<string, string> = {}): Promise<ApiQueryResponse> {
    const url = API_ENDPOINTS.V1_SEARCH(graphId);
    return postJson<ApiQueryResponse>(url, { query, limit }, headers);
  }

  async retrieve(
    q: string,
    vertical: string | null = null,
    limit = 50,
    options: {
      trendId?: string;
      manualTerms?: string[];
      questionId?: string;
      segmentType?: string;
      excludeBlank?: boolean;
    } = {},
    tracking?: TrackingInfo,
    executionMode: 'direct' | 'mcp' = 'direct'
  ): Promise<RetrievalResult> {
    const activeVertical = vertical ? String(vertical).toLowerCase() : null;
    const isBaseline = activeVertical === "baseline";
    const isWaldo = activeVertical === "waldo";
    const isSIC = activeVertical === "sic";

    let graphId = vertical || "psfk";
    let apiVertical = activeVertical;
    const isGenerativeRealities = activeVertical === "generative-realities";

    if (isWaldo) {
      graphId = "waldo";
      apiVertical = "general";
    } else if (isSIC) {
      graphId = "sic";
      apiVertical = "general";
    } else if (isBaseline) {
      graphId = "pew";
      apiVertical = "baseline";
    } else if (isGenerativeRealities) {
      graphId = "generative-realities";
      apiVertical = "general";
    }

    const payload = {
      q,
      terms: options.manualTerms,
      vertical: apiVertical,
      graphId,
      limit: isBaseline ? 200 : limit,
      trendId: options.trendId,
      // Task 7: Include tracking fields in body
      userId: tracking?.userId || '',
      accountContext: tracking?.accountContext || '',
      userContext: tracking?.userContext || '',
      // Combined sessionContext
      sessionContext: [tracking?.accountContext, tracking?.userContext].filter(Boolean).join('\n'),
      ...(isBaseline
        ? {
          questionId: options.questionId || "BBHOME",
          segmentType: options.segmentType || "AGEGRP",
          excludeBlank: options.excludeBlank ?? true
        }
        : {}),
    };

    // Task 12: Include headers
    const headers: Record<string, string> = {
      'X-User-Id': tracking?.userId || '',
      'X-Fodda-Execution-Mode': executionMode, // NEW: Support Dual-Mode Testing
      'X-Fodda-Mode': 'deterministic' // Force deterministic for UI queries generally, or make param? 
      // Brief says "App can transparently test", usually implies same behavior.
      // We'll leave X-Fodda-Mode default (server defaults to true) or explicit here.
      // Let's rely on server default or App.tsx controlling it via another param if needed.
      // But for MCP mode, we likely want deterministic.
    };
    if (tracking?.apiKey) {
      headers['X-API-Key'] = tracking.apiKey;
    }

    const startTime = Date.now();
    let response: ApiQueryResponse;

    // Task: Use Semantic Search for trends/concepts unless it's a specific baseline question OR a graph with incompatible vectors (Waldo/SIC)
    // Waldo and SIC currently have 3072-dim vectors which break the 768-dim model on the V1 endpoint.
    const forceLegacy = (isBaseline && options.questionId) || isWaldo || isSIC;

    if (forceLegacy) {
      // Ensure vertical is "general" for Waldo/SIC (handled above in apiVertical logic)
      response = await postJson<ApiQueryResponse>(API_ENDPOINTS.QUERY, payload, headers);
    } else {
      try {
        response = await this.semanticSearch(q, graphId, isBaseline ? 200 : limit, headers);
      } catch (err) {
        console.warn("[DataService] Semantic search failed, falling back to legacy query:", err);
        // Fallback uses payload which already has the corrected apiVertical ("general") for Waldo/SIC
        response = await postJson<ApiQueryResponse>(API_ENDPOINTS.QUERY, payload, headers);
      }
    }
    const durationMs = Date.now() - startTime;

    if (!response.ok || !response.rows) {
      throw new Error(response.error || "Graph Index Unresponsive.");
    }

    const rows: RetrievedRow[] = response.rows.map((r) => {
      const rowId = String(r.trendId || r.articleId || r.rowId || r.id || "").replace(/^(trend-|article-)/, '');
      const name = String(r.rowName || r.name || "");
      const summary = String(r.rowSummary || r.summary || "");
      const rawEvidence = r.evidence || r.processedEvidence || r.evidenceList || [];

      const mappedEvidence: Article[] = (Array.isArray(rawEvidence) ? rawEvidence : []).map((e: any) => ({
        id: String(e?.articleId || e?.id || e?.article_id || e?.recordId || "").replace(/^(trend-|article-)/, ''),
        articleId: e?.articleId,
        title: String(e?.title || e?.articleTitle || "Source Signal"),
        sourceUrl: String(e?.sourceUrl || e?.url || e?.link || e?.source_url || e?.article_url || e?.external_url || e?.original_url || "#"),
        snippet: String(e?.snippet || e?.summary || e?.excerpt || e?.articleSnippet || ""),
        brandNames: normalizeBrandNames(e?.brandNames),
        vertical: (normalizeVertical(e?.vertical) || normalizeVertical(activeVertical)) as any,
        publishedAt: e?.publishedAt ?? null,
        trendIds: Array.isArray(e?.trendIds) ? e.trendIds : [],
      }));

      return {
        id: rowId,
        trendId: r.trendId,
        articleId: r.articleId,
        name,
        summary,
        isDiscovery: Boolean(r.isDiscovery),
        nodeType: r.nodeType,
        evidence: mappedEvidence,
        evidence_counts: r.evidence_counts,
      };
    });

    const trends: Trend[] = rows
      .filter((r: any) => r.nodeType === "TREND" && !r.isDiscovery)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        summary: r.summary,
        evidence: r.evidence,
        evidence_counts: r.evidence_counts,
      })) as any;

    const articlesMap = new Map<string, Article>();
    rows.forEach((r: any) =>
      (r.evidence || []).forEach((a: any) => {
        if (a?.id) articlesMap.set(a.id, a);
      })
    );

    return {
      ok: true,
      rows,
      trends,
      articles: Array.from(articlesMap.values()),
      dataStatus: response.dataStatus || "UNKNOWN",
      termsUsed: response.termsUsed || [],
      meta: response.meta,
      debug: {
        request: payload,
        headers, // REFINEMENT: Expose headers for DevTools transparency
        response: (response as any)._rawEnvelope || response,
        durationMs
      }
    } as RetrievalResult;
  }

  async importTrends(vertical: string, trends: Trend[]) {
    return postJson(API_ENDPOINTS.IMPORT_TRENDS, { vertical, trends });
  }

  async importArticles(vertical: string, articles: Article[]) {
    return postJson(API_ENDPOINTS.IMPORT_ARTICLES, { vertical, articles });
  }

  async getAccountUsers(accountId: string) {
    try {
      const res = await fetch(`/api/account/${accountId}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    } catch (e: any) {
      console.error("Failed to get account users", e);
      return { ok: false, error: e.message };
    }
  }

  async updateUserRole(targetUserId: string, newRole: string, requesterEmail: string) {
    try {
      const res = await fetch(`/api/user/update-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole, requesterEmail })
      });
      return await res.json();
    } catch (e: any) {
      console.error("Failed to update user role", e);
      return { ok: false, error: e.message };
    }
  }

  async deleteUser(userId: string, requesterEmail: string) {
    try {
      const res = await fetch(`/api/user/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterEmail })
      });
      return await res.json();
    } catch (e: any) {
      console.error("Failed to delete user", e);
      return { ok: false, error: e.message };
    }
  }

  async getMacroOverview(params: {
    industry?: string;
    sector?: string;
    region?: string;
    timeframe?: string;
  }, apiKey: string): Promise<{ ok: boolean, data?: any, error?: string }> {
    try {
      if (!apiKey) throw new Error("API Key required");

      const res = await fetch(API_ENDPOINTS.V1_OVERVIEW, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify(params)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Overview API Error ${res.status}: ${text}`);
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (e: any) {
      console.error("Failed to get macro overview", e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Fetch graphs owned by the authenticated user.
   * Returns owned graphs with trial access info (MCP URL, credits).
   * Uses the local my-submissions endpoint which includes Trials table data.
   * Gracefully returns empty array on failure.
   */
  async fetchOwnedGraphs(apiKey: string, email?: string): Promise<any[]> {
    try {
      if (!email) {
        // Fallback: try to get email from stored user
        try {
          const stored = localStorage.getItem('fodda_user');
          if (stored) email = JSON.parse(stored).email;
        } catch {}
      }
      if (!email) {
        console.warn('[DataService] fetchOwnedGraphs: no email available');
        return [];
      }

      console.log('[DataService] Fetching owned graphs from /api/expert-graph/my-submissions...');
      const res = await fetch(`/api/expert-graph/my-submissions?email=${encodeURIComponent(email)}`);

      if (!res.ok) {
        console.warn(`[DataService] /api/expert-graph/my-submissions returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      if (!data.ok || !Array.isArray(data.submissions)) {
        return [];
      }

      // Map submissions to the OwnedGraph shape MyGraphsPage expects
      const owned = data.submissions
        .filter((s: any) => s.status === 'active' || s.status === 'live' || s.status === 'pending_review')
        .map((s: any) => ({
          graph_id: s.graphSlug || '',
          name: s.graphName || '',
          status: s.status === 'active' ? 'live' : s.status,
          curator: s.creator || '',
          owner_email: email,
          trial: s.trial || undefined,
        }));

      console.log(`[DataService] Loaded ${owned.length} owned graphs`);
      return owned;
    } catch (err) {
      console.warn('[DataService] Failed to fetch owned graphs:', err);
      return [];
    }
  }

  /**
   * Delete the current user's account.
   * Requires the user to be the Owner and to provide the confirmation phrase "DELETE".
   * This anonymizes all users, revokes API keys, and marks the account as deleted.
   */
  async deleteAccount(email: string, confirmPhrase: string): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirmPhrase })
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Delete account failed:', e);
      return { ok: false, error: e.message };
    }
  }


  /**
   * Admin: Look up a user by email.
   * Returns user profile, account, plan, API key, and usage stats from Airtable.
   */
  async adminLookupUser(email: string, adminSecret: string): Promise<{
    ok: boolean;
    user?: any;
    account?: any;
    plan?: any;
    apiKey?: string | null;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/account/admin/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adminSecret }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Admin lookup failed:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Admin: Change a user's plan by planCode.
   * Updates the account's plan link in Airtable.
   */
  async adminChangePlan(email: string, planCode: number, adminSecret: string): Promise<{
    ok: boolean;
    message?: string;
    plan?: any;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/account/admin/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planCode, adminSecret }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Admin change plan failed:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Admin: Fetch trial API keys and MCP URLs for all graphs.
   * Returns a map of graphId → { trial_key, mcp_url, status, credits_remaining, credits_total, owner_email }
   */
  async fetchGraphTrials(adminSecret: string): Promise<Record<string, any>> {
    try {
      const res = await fetch(`/api/graph-trials`, {
        headers: { 'X-Admin-Secret': adminSecret },
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.trials || {};
    } catch (e: any) {
      console.error('[DataService] Fetch graph trials failed:', e);
      return {};
    }
  }

  /**
   * Create a Stripe Checkout Session for a subscription plan.
   * Returns a checkout URL that the frontend should redirect to.
   */
  async createSubscriptionCheckout(planCode: number, email: string, trialDays?: number): Promise<{ ok: boolean; checkout_url?: string; error?: string }> {
    try {
      const res = await fetch('/api/account/checkout/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planCode, trialDays }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Subscription checkout failed:', e);
      return { ok: false, error: e.message };
    }
  }

  async createCustomCheckout(planCode: number, email?: string, trialDays?: number): Promise<{ ok: boolean; checkout_url?: string; error?: string }> {
    try {
      const res = await fetch('/api/account/checkout/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, email, trialDays }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Custom checkout failed:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Create a Stripe Billing Portal session for subscription management.
   * Returns a portal URL that opens Stripe's hosted portal (cancel, update payment, invoices).
   */
  async createBillingPortal(email: string): Promise<{ ok: boolean; portal_url?: string; error?: string }> {
    try {
      const res = await fetch('/api/account/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Billing portal failed:', e);
      return { ok: false, error: e.message };
    }
  }

  async fetchCreatorAnalytics(graphId: string): Promise<{ ok: boolean; stats?: CreatorAnalytics; error?: string }> {
    try {
      const res = await fetch(`/api/creator/analytics?graphId=${encodeURIComponent(graphId)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        try {
          const json = JSON.parse(text);
          if (json.error) throw new Error(json.error);
        } catch {}
        throw new Error(text || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] fetchCreatorAnalytics failed:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Fetch per-query pricing from the API's single source of truth.
   * Returns an array of { queryType, apiCalls, label } entries.
   */
  async fetchQueryPricing(): Promise<{ ok: boolean; pricing?: Array<{ queryType: string; apiCalls: number; label?: string }>; error?: string }> {
    try {
      const res = await fetch('/v1/research/pricing');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] fetchQueryPricing failed:', e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Create a Stripe Checkout Session for a top-up (agent-session) purchase.
   * This is the same flow the MCP uses for CREDITS_EXHAUSTED.
   */
  async createAgentCheckout(email: string): Promise<{ ok: boolean; checkout_url?: string; error?: string }> {
    try {
      const res = await fetch('/api/account/checkout/agent-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'app_billing_page' }),
      });
      return await res.json();
    } catch (e: any) {
      console.error('[DataService] Agent checkout failed:', e);
      return { ok: false, error: e.message };
    }
  }

  async checkHealth(): Promise<{ ok: boolean;[key: string]: any }> {
    try {
      const r = await fetch(API_ENDPOINTS.HEALTH);
      if (!r.ok) return { ok: false };
      return await r.json();
    } catch {
      return { ok: false };
    }
  }

  /**
   * Self-service API Key Rotation.
   * Revokes the current API key and issues a new sk_live_... key.
   */
  async rotateApiKey(email?: string): Promise<{ ok: boolean; apiKey?: string; token?: string; mcpConn?: McpConnection; error?: string }> {
    try {
      const res = await postJson<any>('/api/user/api-key/rotate', { email });
      return res;
    } catch (e: any) {
      console.error('[DataService] rotateApiKey failed:', e);
      return { ok: false, error: e.message };
    }
  }
}

export const dataService = new DataService();
export default dataService;
