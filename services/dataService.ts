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

    // 2. Tokenize Query (Split by spaces, remove common stop words or very short words)
    // This allows "How are pop-up stores evolving?" to match "pop-up" inside a trend name.
    const tokens = lowerQuery
      .split(/[\s,.?!]+/)
      .filter(w => w.length > 2 && !['how', 'are', 'the', 'and', 'for', 'what', 'give', 'examples', 'used'].includes(w));

    // 3. Scoring System
    const scoredTrends = verticalTrends.map(trend => {
      let score = 0;
      const trendText = `${trend.name} ${trend.summary}`.toLowerCase();
      
      // Check for exact phrase match (high value)
      if (trendText.includes(lowerQuery)) score += 50;

      // Check token matches
      tokens.forEach(token => {
        if (trendText.includes(token)) score += 10;
      });
      
      // Bonus if query matches related articles
      const relatedArticles = verticalArticles.filter(a => a.trendIds.includes(trend.id));
      relatedArticles.forEach(art => {
        const artText = `${art.title} ${art.snippet}`.toLowerCase();
        if (artText.includes(lowerQuery)) score += 15; // Increased article relevance weight
        tokens.forEach(token => {
            if (artText.includes(token)) score += 5;
        });
      });

      return { trend, score, relatedArticles };
    });

    const scoredArticles = verticalArticles.map(article => {
      let score = 0;
      const artText = `${article.title} ${article.snippet}`.toLowerCase();
      
      if (artText.includes(lowerQuery)) score += 50;

      tokens.forEach(token => {
        if (artText.includes(token)) score += 10;
      });

      return { article, score };
    });

    // 4. Select Top Candidates with Relative Thresholding
    // Determine the highest score to set a relevance cutoff.
    // This prevents "noise" (low scoring trends) from appearing alongside high-confidence matches.
    const sortedTrends = scoredTrends
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const highestTrendScore = sortedTrends[0]?.score || 0;
    // Strict cut-off: Only keep trends that have at least 40% of the top trend's score
    const trendScoreThreshold = highestTrendScore * 0.4; 

    let matchedTrends = sortedTrends.filter(t => t.score >= trendScoreThreshold);

    // FALLBACK: If no matches found via tokens (e.g. user typed something vague or data is missing keywords),
    // but the query is clearly asking for info, return top trends by default so the LLM has *something* to work with.
    // This prevents "I have no data" errors in a demo context.
    if (matchedTrends.length === 0 && tokens.length > 0) {
        // Fallback: Just return the top 3 trends for this vertical
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
    
    // Also include articles that matched directly (even if their parent trend didn't score highest)
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
    
    // Limit articles to avoid overwhelming the user
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