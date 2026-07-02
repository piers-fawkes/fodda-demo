
export const API_BASE_URL = "";

export const API_ENDPOINTS = {
  QUERY: `${API_BASE_URL}/api/query`,
  LOG: `${API_BASE_URL}/api/log`,
  GET_LOGS: `${API_BASE_URL}/api/logs`,
  HEALTH: `${API_BASE_URL}/api/neo4j/health`,
  DEPLOY_CHECK: `${API_BASE_URL}/__deploy_check`,
  IMPORT_TRENDS: `${API_BASE_URL}/api/import/trends`,
  IMPORT_ARTICLES: `${API_BASE_URL}/api/import/articles`,
  // V1 Architecture
  V1_SEARCH: (graphId: string) => `https://api.fodda.ai/v1/graphs/${graphId}/search`,
  V1_DISCOVERY: (graphId: string, label: string) => `https://api.fodda.ai/v1/graphs/${graphId}/labels/${label}/values`,
  V1_OVERVIEW: `https://api.fodda.ai/v1/psfk/overview`,
  V1_EVIDENCE: (graphId: string) => `https://api.fodda.ai/v1/graphs/${graphId}/evidence`,
  V1_ADJACENT: (graphId: string) => `https://api.fodda.ai/v1/graphs/${graphId}/adjacent`,
  V1_STATISTICS: (graphId: string) => `https://api.fodda.ai/v1/graphs/${graphId}/statistics`,
  V1_GRAPHS: 'https://api.fodda.ai/v1/graphs',
  // Supplemental data endpoints
  SUPPLEMENTAL_FRED: `https://api.fodda.ai/v1/supplemental/fred/economic-snapshot`,
  SUPPLEMENTAL_CENSUS_RETAIL: `https://api.fodda.ai/v1/supplemental/census/retail-snapshot`,
  SUPPLEMENTAL_BEA: `https://api.fodda.ai/v1/supplemental/bea/spending-snapshot`,
  SUPPLEMENTAL_BLS: `https://api.fodda.ai/v1/supplemental/bls/economic-snapshot`,
  SUPPLEMENTAL_CENSUS_DEMOGRAPHICS: `https://api.fodda.ai/v1/supplemental/census/demographics-snapshot`,
  SUPPLEMENTAL_WIKIPEDIA: (articles: string) => `https://api.fodda.ai/v1/supplemental/wikipedia/pageviews?articles=${encodeURIComponent(articles)}`,
  SUPPLEMENTAL_FDA_SAFETY: (ingredients: string) => `https://api.fodda.ai/v1/supplemental/fda/ingredient-safety?ingredients=${encodeURIComponent(ingredients)}`,
  SUPPLEMENTAL_PUBMED: (term: string) => `https://api.fodda.ai/v1/supplemental/pubmed/research-trends?term=${encodeURIComponent(term)}`,
  SUPPLEMENTAL_OPENALEX: (term: string) => `https://api.fodda.ai/v1/supplemental/openalex/research-trends?term=${encodeURIComponent(term)}`,
  SUPPLEMENTAL_WTO_TRADE: `https://api.fodda.ai/v1/supplemental/wto/trade-snapshot`,
};
