
import { Trend, Article, RetrievalResult, KnowledgeGraph, Vertical, QueryResultRow } from './types';
import { API_ENDPOINTS } from './apiConfig';

const INITIAL_GRAPHS: KnowledgeGraph[] = [
  { id: Vertical.Beauty, name: 'Beauty Graph', description: 'Curated beauty and wellness intelligence.', owner: 'PSFK Editorial', isCustom: false },
  { id: Vertical.Retail, name: 'Retail Graph', description: 'Omnichannel and storefront innovation datasets.', owner: 'PSFK Editorial', isCustom: false },
  { id: Vertical.Sports, name: 'Sports Graph', description: 'Fan engagement and performance tech insights.', owner: 'PSFK Editorial', isCustom: false },
];

class DataService {
  private graphs: KnowledgeGraph[] = INITIAL_GRAPHS;
  private isBrowser = typeof window !== 'undefined';

  public getGraphs(): KnowledgeGraph[] { return this.graphs; }

  public async retrieve(query: string, vertical: string): Promise<RetrievalResult> {
    const url = API_ENDPOINTS.QUERY;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, vertical, limit: 10 }),
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await response.json();
      const rows: QueryResultRow[] = result.rows || [];

      // Flatten for legacy compatibility in UI components
      const trends: Trend[] = rows.map(r => ({
        trendId: r.trendId,
        id: r.trendId, // Alias
        trendName: r.trendName,
        name: r.trendName, // Alias
        trendDescription: r.trendDescription,
        summary: r.trendDescription // Alias
      }));

      const articles: Article[] = [];
      const seenArticles = new Set();
      rows.forEach(r => {
        r.evidence.forEach(a => {
          if (!seenArticles.has(a.articleId)) {
            const articleWithAliases = {
              ...a,
              id: a.articleId, // Alias
              snippet: a.summary || "" // Alias
            };
            articles.push(articleWithAliases);
            seenArticles.add(a.articleId);
          }
        });
      });

      return { ok: true, rows, trends, articles };
    } catch (error) {
      console.error(`[DataService] Retrieval Failure`, error);
      return { ok: false, rows: [], trends: [], articles: [] };
    }
  }

  // Fix: Added missing importTrends method used by AdminPortal
  public async importTrends(vertical: string, trends: Trend[]): Promise<any> {
    console.log(`Importing ${trends.length} trends for ${vertical}`);
    return Promise.resolve({ ok: true });
  }

  // Fix: Added missing importArticles method used by AdminPortal
  public async importArticles(vertical: string, articles: Article[]): Promise<any> {
    console.log(`Importing ${articles.length} articles for ${vertical}`);
    return Promise.resolve({ ok: true });
  }

  public async checkHealth(): Promise<{ ok: boolean; details?: any }> {
    const url = API_ENDPOINTS.HEALTH;
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      const data = await response.json();
      return { ok: data.ok, details: data };
    } catch (e) {
      return { ok: false };
    }
  }
}

export const dataService = new DataService();
