
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
}

export interface Article {
  id: string;
  title: string;
  sourceUrl: string;
  publishedAt?: string | null;
  snippet: string;
  trendIds?: string[];
  vertical?: Vertical;
  brandNames?: string | string[];
}

export interface Trend {
  id: string;
  name: string;
  summary: string;
  vertical?: Vertical;
  evidence?: Article[];
}

export interface RetrievedRow {
  id: string;
  name: string;
  summary: string;
  evidence: Article[];
  isDiscovery?: boolean;
  nodeType?: string;
}

export interface RetrievalResult {
  ok: boolean;
  rows: RetrievedRow[];
  trends: Trend[];
  articles: Article[];
  dataStatus: 'TREND_MATCH' | 'SIGNAL_MATCH' | 'HYBRID_MATCH' | 'NO_MATCH' | 'NO_DATA' | 'BASELINE_DATA' | string;
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
}
