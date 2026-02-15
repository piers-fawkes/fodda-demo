
export enum Vertical {
  Beauty = 'Beauty',
  Retail = 'Retail',
  Sports = 'Sports',
  Baseline = 'baseline',
  Waldo = 'Waldo',
  SIC = 'SIC',
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
}

export interface Account {
  id: string; // internal DB ID or Airtable Record ID
  name: string;
  planLevel: 'Free' | 'Pro' | 'Enterprise'; // Inferred from payment package
  apiKey?: string; // The single key shared by the account
  accountContext?: string; // Persisted context
  monthlyQueryLimit?: number;
  currentQueryCount?: number;
  signupCode?: string; // Team invite code
  authPolicy?: 'STRICT' | 'RELAXED'; // STRICT = Login every time, RELAXED = 24h session
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  features: string[];
  stripeLink?: string;
  isCurrent?: boolean;
}

export interface AuthResponse {
  ok: boolean;
  user?: User;
  account?: Account;
  sessionToken?: string;
  error?: string;
  message?: string;
}
