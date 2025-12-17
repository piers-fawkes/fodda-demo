export enum Vertical {
  Retail = 'Retail',
  Sports = 'Sports',
  Beauty = 'Beauty',
}

export interface Trend {
  id: string;
  name: string;
  summary: string;
  vertical: Vertical;
}

export interface Article {
  id: string;
  trendIds: string[]; // Changed to array to support multiple trends per article
  title: string;
  sourceUrl: string;
  snippet: string;
  vertical: Vertical;
}

export interface RetrievalResult {
  trends: Trend[];
  articles: Article[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  evidence?: Article[]; // Evidence used for this specific answer
  relatedTrends?: Trend[]; // Trends referenced
}
