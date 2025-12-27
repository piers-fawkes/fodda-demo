export enum Vertical {
  Beauty = 'Beauty',
  Retail = 'Retail',
  Sports = 'Sports',
}

export interface KnowledgeGraph {
  id: string; 
  name: string;
  description: string;
  owner: string;
  isCustom: boolean;
}

export interface Article {
  articleId: string;
  title: string;
  sourceUrl: string;
  publishedAt?: string;
  summary?: string;
  snippet?: string; // Alias for summary used in UI
  publication?: string;
  trendIds?: string[];
  // Added vertical to fix shared/constants.ts errors
  vertical?: Vertical;
}

export interface Trend {
  trendId: string;
  trendName: string;
  trendDescription: string;
  vertical?: string;
  evidence?: Article[];
}

export interface QueryResultRow {
  trendId: string;
  trendName: string;
  trendDescription: string;
  evidence: Article[];
}

export interface RetrievalResult {
  ok: boolean;
  rows: QueryResultRow[];
  trends: Trend[];
  articles: Article[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  evidence?: Article[];
  relatedTrends?: Trend[];
}