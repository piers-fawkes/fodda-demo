import { Trend, Article, Vertical, RetrievalResult } from '../types';
import { MOCK_TRENDS, MOCK_ARTICLES } from '../constants';

class DataService {
  private trends: Trend[] = [];
  private articles: Article[] = [];

  constructor() {
    // Initialize with mock data for the demo
    this.trends = [...MOCK_TRENDS];
    this.articles = [...MOCK_ARTICLES];
  }

  // Retrieve relevant context based on query and vertical
  public retrieve(query: string, vertical: Vertical): RetrievalResult {
    const lowerQuery = query.toLowerCase();
    
    // 1. Filter by vertical
    const verticalTrends = this.trends.filter(t => t.vertical === vertical);
    const verticalArticles = this.articles.filter(a => a.vertical === vertical);

    // 2. Tokenize Query
    // Remove common stop words and normalize ID references like "trend-5573" to "5573"
    const rawTokens = lowerQuery.split(/[\s,.?!/()#]+/);
    const tokens = rawTokens
      .map(t => t.replace(/^(trend-|article-)/, '')) // Strip "trend-" or "article-" prefixes
      .filter(w => w.length >= 3 && !['how', 'are', 'the', 'and', 'for', 'what', 'give', 'examples', 'used', 'this', 'that', 'with'].includes(w));

    // 3. Scoring System
    const scoredTrends = verticalTrends.map(trend => {
      let score = 0;
      const trendText = `${trend.id} ${trend.name} ${trend.summary}`.toLowerCase();
      
      // Check for exact ID match (Massive priority)
      if (tokens.some(token => token === trend.id.toLowerCase())) {
        score += 500;
      }

      // Check for exact phrase match in name/summary (high value)
      if (trendText.includes(lowerQuery)) score += 50;

      // Check token matches
      tokens.forEach(token => {
        if (trendText.includes(token)) score += 20; // Increased token weight
      });
      
      // Bonus if query matches related articles
      const relatedArticles = verticalArticles.filter(a => a.trendIds.includes(trend.id));
      relatedArticles.forEach(art => {
        const artText = `${art.id} ${art.title} ${art.snippet}`.toLowerCase();
        
        // Direct article ID match adds weight to the parent trend
        if (tokens.some(token => token === art.id.toLowerCase())) {
          score += 100;
        }

        if (artText.includes(lowerQuery)) score += 15;
        tokens.forEach(token => {
            if (artText.includes(token)) score += 10; // Increased token weight
        });
      });

      return { trend, score, relatedArticles };
    });

    const scoredArticles = verticalArticles.map(article => {
      let score = 0;
      const artText = `${article.id} ${article.title} ${article.snippet}`.toLowerCase();
      
      // Check for exact ID match (Massive priority)
      if (tokens.some(token => token === article.id.toLowerCase())) {
        score += 500;
      }

      if (artText.includes(lowerQuery)) score += 50;

      tokens.forEach(token => {
        if (artText.includes(token)) score += 20; // Increased token weight
      });

      return { article, score };
    });

    // 4. Select Top Candidates
    const sortedTrends = scoredTrends
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const highestTrendScore = sortedTrends[0]?.score || 0;
    
    // Lower the threshold slightly for ID matches or high-value keywords
    const trendScoreThreshold = highestTrendScore > 100 ? 40 : (highestTrendScore * 0.3); 

    let matchedTrends = sortedTrends.filter(t => t.score >= trendScoreThreshold);

    // FALLBACK: If no matches found via tokens but query exists, return top trends for horizontal exploration
    if (matchedTrends.length === 0 && tokens.length > 0) {
        // Find top 3 by score regardless of threshold
        matchedTrends = sortedTrends.slice(0, 3).map(t => ({ ...t, score: 1 }));
    }

    // Limit to top 3 trends to keep Evidence Drawer clean
    const topTrends = matchedTrends
      .slice(0, 3) 
      .map(item => item.trend);

    // Get articles directly associated with top trends
    let topArticles = matchedTrends
      .slice(0, 3)
      .flatMap(item => item.relatedArticles);
    
    // Also include articles that matched directly
    const directMatchedArticles = scoredArticles
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.article);

    // Merge and dedupe
    const uniqueArticlesMap = new Map<string, Article>();
    [...topArticles, ...directMatchedArticles].forEach(a => {
        uniqueArticlesMap.set(a.id, a);
    });
    
    const finalArticles = Array.from(uniqueArticlesMap.values()).slice(0, 10);

    return {
      trends: topTrends,
      articles: finalArticles
    };
  }

  public getAllTrends(vertical: Vertical): Trend[] {
    return this.trends.filter(t => t.vertical === vertical);
  }
}

export const dataService = new DataService();