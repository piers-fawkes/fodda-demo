
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
  id?: string; // Alias for articleId used in some components
  title: string;
  sourceUrl: string;
  publishedAt?: string;
  summary?: string;
  snippet?: string; // Used in UI components
  publication?: string;
  vertical?: Vertical; // Used in constants and admin portal
  trendIds: string[]; // Used for linking
}

export interface Trend {
  trendId: string;
  id?: string; // Alias for trendId used in some components
  trendName: string;
  name?: string; // Alias for trendName used in constants
  trendDescription: string;
  summary?: string; // Alias for trendDescription used in constants
  vertical?: Vertical; // Used in constants and admin portal
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
  // Legacy compatibility helpers
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
