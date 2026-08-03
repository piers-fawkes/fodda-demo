
export enum Vertical {
  Beauty = 'Beauty',
  Retail = 'Retail',
  Sports = 'Sports',
  Baseline = 'baseline',
  Waldo = 'Waldo',
  SIC = 'SIC',
  CEDesign = 'consumer-electronics',
  MLBSponsorship = 'mlb/sponsorship',
  Edelman_TippingPoints = 'edelman/tipping-points',
  PwC_SXSW2026 = 'pwc/sxsw-2026-key-insights',
  Delta_ConnectionIndex = 'delta-the-connection-index',
  Tech = 'tech',
  Food = 'food',
  Travel = 'travel',
}

export interface KnowledgeGraph {
  id: string;
  name: string;
  description: string;
  owner: string;
  isCustom: boolean;
  headline?: string;
  verticalName?: string;
  pricePerQuery?: string;
  updateFrequency?: string;
  sourceURL?: string;
  // ── Airtable-powered catalog fields ──
  curator?: string;
  curator_url?: string;
  domain?: string;
  graph_type?: 'domain' | 'expert' | 'industry_report' | 'industry report' | 'supplemental' | 'user' | 'baseline' | 'skill';
  graph_sub_type?: string;
  topics?: string[];
  status?: 'live' | 'paused' | 'coming_soon' | 'draft' | 'beta';
  last_updated?: string;
  published_date?: string;
  example_queries?: string[];
  askLine?: string;
  ask_line?: string;
  portrait_url?: string;
  quality_checker_name?: string;
  geography?: string;
  available_as?: string;
  is_playground?: boolean;
  trend_count?: number;
  evidence_count?: number;
  last_synced?: string;
  approved_date?: string;
  accessible?: boolean;
  // ── Skill-specific fields (only for graph_type='skill') ──
  mcp_url?: string | null;
  skill_phase?: 'output' | 'input' | 'routing';
  skill_tool_name?: string | null;
  skill_attribution?: string | null;
  // ── Expert deep-link fields ──
  expert_slug?: string;
  image_url?: string;
}

export interface Article {
  id: string;
  articleId?: string; // New explicit ID
  title: string;
  sourceUrl: string;
  publishedAt?: string | null;
  snippet: string;
  trendIds?: string[];
  vertical?: Vertical;
  brandNames?: string | string[];
}

export interface EvidenceCounts {
  [label: string]: number;
}

export type ReasoningMode = 'graph' | 'gemini' | 'blended';

export interface AdjacentTrend {
  id: string;
  trendId?: string;
  name: string;
  trendName: string;
  similarity: number;
  description: string;
}

export type GraphNodeType = 'TREND' | 'ARTICLE' | 'CONCEPT';

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  summary: string;
  type: GraphNodeType;
  group?: number;
  metadata?: any;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  weight?: number;
  relationship?: string;
}

export interface UsageStats {
  totalQueries?: number;
  monthlyQueries?: number;
  maxplanQueries?: number;
  byGraph?: any;
  byUser?: any;
  dailyTrend?: any;
  periodStart?: string;
  periodEnd?: string;
  monthlyTrend?: any;
}

export interface SupplementalSource {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  endpoint?: string;
  status?: string;
  source?: string;
  frequency?: string;
  categories?: string[];
}

export interface Trend {
  id: string;
  trendId?: string; // New explicit ID
  name: string;
  summary: string;
  vertical?: Vertical;
  evidence?: Article[];
  evidence_counts?: EvidenceCounts;
}

export interface RetrievedRow {
  id: string;
  trendId?: string; // New explicit ID
  articleId?: string; // New explicit ID
  name: string;
  summary: string;
  evidence: Article[];
  isDiscovery?: boolean;
  nodeType?: string;
  evidence_counts?: EvidenceCounts;
  metadata?: any;
}

export interface RetrievalResult {
  ok: boolean;
  rows: RetrievedRow[];
  trends: Trend[];
  articles: Article[];
  dataStatus: 'TREND_MATCH' | 'ARTICLE_MATCH' | 'SIGNAL_MATCH' | 'HYBRID_MATCH' | 'NO_MATCH' | 'NO_DATA' | 'BASELINE_DATA' | string;
  termsUsed?: string[];
  meta?: {
    decision?: 'ANSWER' | 'ANSWER_WITH_CAVEATS' | 'REFUSE';
    coverage?: {
      requiredTerms: string[];
      matchedTerms: string[];
      coverageRatio: number;
    };
    baselineInfo?: {
      questionId: string;
      segmentType: string;
    };
    [key: string]: any;
  };
  debug?: {
    request: any;
    headers?: Record<string, string>;
    response: any;
    durationMs: number;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  evidence?: Article[];
  relatedTrends?: Trend[];
  baselineRows?: RetrievedRow[];
  diagnostic?: {
    dataStatus: string;
    termsUsed?: string[];
  };
  actions?: {
    suggestedNext: {
      label: string;
      action: 'RUN_QUERY' | 'FILL_INPUT';
      payload: any;
    };
  };
  suggestedQuestions?: string[];
}

// --- New Types for Auth & Account ---

export interface User {
  id: string; // internal DB ID or Airtable Record ID
  email: string;
  name?: string;
  role: 'User' | 'Admin' | 'Owner';
  accountId: string; // Link to Account
  userContext?: string; // Persisted context
  // Profile Fields
  userName?: string;
  firstName?: string;
  lastName?: string;
  emailConfirmed?: boolean;
  monthlyQueries?: number;
  maxplanQueries?: number;
  jobTitle?: string;
  company?: string;
  accountName?: string;
  planName?: string;
  signupDate?: string;
  apiUse?: 'Mainly API Access' | 'Mainly Chat Access' | 'Mix of API and Chat Access' | "I Don't Know" | string;
  onboardingIntent?: 'demo' | 'api' | 'account' | string; // Intent chosen at the start of onboarding
  disabledGraphs?: string; // Comma-separated graph IDs the user has opted out of
  lastLogin?: string;
  // Persona Synthesis Fields
  currentPersonaText?: string;        // Nightly-proposed persona (display-only, not injected)
  personaLastUpdated?: string;        // Timestamp of last nightly synthesis
  confirmedPersonaText?: string;      // User-confirmed persona (feeds injection)
  personaConfirmed?: boolean;         // True once user has confirmed/edited
  interestsCurrent?: string;          // JSON array of interest nodes with recency weights
  topEngagementDomains?: string;      // JSON array of engagement depth by domain
  confirmedExpertiseDomains?: string; // JSON array of demonstrated expertise domains
  shareContextInSessions?: boolean;   // Toggle: inject persona/context into AI sessions (default true)
  // Expert Twin fields
  isExpert?: boolean;                 // True if user is a registered Fodda Expert (cached from CE Analysts)
  analystId?: string;                 // Analyst record ID slug (e.g. 'bryan-guess-project-management')
}

export interface Account {
  id: string; // internal DB ID or Airtable Record ID
  name: string;
  planLevel: 'Free' | 'Pro' | 'Enterprise'; // Inferred from payment package
  apiKey?: string; // The single key shared by the account
  accountContext?: string; // Persisted context
  monthlyQueryLimit?: number;
  currentQueryCount?: number;
  lifetimeQueries?: number;
  totalQueries?: number;
  signupCode?: string; // Team invite code
  authPolicy?: 'STRICT' | 'RELAXED'; // STRICT = Login every time, RELAXED = 24h session
  vertical?: string; // 'all', 'retail', 'beauty', 'fashion', 'design', etc.
  isProfessionalServices?: boolean; // True = agency/consultancy researching on behalf of clients
  graphIds?: string[];
  // Stripe Subscription fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'trialing' | 'cancelled' | 'past_due' | 'none';
  planName?: string;
  planCode?: number;
  // Overage billing fields
  hasPaymentMethod?: boolean;
  overageEnabled?: boolean;
  overageTokensThisCycle?: number;
  overageRate?: number;  // e.g. 0.20
  resetDate?: string;    // ISO date when the billing cycle resets (e.g. "2026-07-01")
  // Persona Synthesis Fields (Account-level)
  currentAccountPersonaText?: string;        // Proposed account persona (display-only)
  confirmedAccountPersonaText?: string;      // Owner/Admin-confirmed account persona
  accountPersonaConfirmed?: boolean;         // True once Owner/Admin has confirmed
  teamInterestsCurrent?: string;             // JSON array of aggregated team interests
  teamEngagementDomains?: string;            // JSON array of team engagement depth
  activeKnowledgeDomains?: string;           // JSON array of query distribution across graphs
  shareAccountContextInSessions?: boolean;   // Toggle: inject account context into AI sessions (default true)
  clerkOrgId?: string;                        // Clerk Organization ID for team management
  autoProvisionToggle?: boolean;              // Auto-provision new team members matching authorized domain
  autoProvisionDomain?: string;               // Authorized email domain for auto-provision
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  features: string[];
  stripeLink?: string;
  isCurrent?: boolean;
  planCode?: number;
  isRecommended?: boolean;
  description?: string;
  graphsIncluded?: string;
  monthlyQueryLimit?: number;
  billingMode?: 'subscription' | 'one_time';
  stripePriceId?: string;
  upsellsPlanCode?: number;
}

export interface AuthResponse {
  ok: boolean;
  user?: User;
  account?: Account;
  sessionToken?: string;
  error?: string;
  message?: string;
  isFirstLogin?: boolean;
}

export interface CreatorAnalytics {
  totalQueries: number;
  uniqueUsers: number;
  dailyTrend: Array<{ date: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  topUsers: Array<{ email: string; count: number }>;
  recentQueries: Array<{ date: string; query: string; quality: string }>;
}

