
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
  V1_SEARCH: (graphId: string) => `${API_BASE_URL}/v1/graphs/${graphId}/search`,
  V1_DISCOVERY: (graphId: string, label: string) => `${API_BASE_URL}/v1/graphs/${graphId}/labels/${label}/values`,
  V1_OVERVIEW: `${API_BASE_URL}/v1/psfk/overview`,
};
