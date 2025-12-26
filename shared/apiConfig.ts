
/**
 * Detect environment and determine the correct API base URL.
 */
const CLOUD_RUN_URL = "https://fodda-contextual-demo-488635403748.us-west1.run.app";
const LOCAL_BACKEND_URL = "http://localhost:8080";

const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return CLOUD_RUN_URL;

  const { hostname, origin } = window.location;

  // 1. If we are on the exact Cloud Run origin, use relative paths.
  if (origin === CLOUD_RUN_URL) {
    return ""; 
  }

  // 2. Localhost development (explicitly checking for localhost only)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return LOCAL_BACKEND_URL;
  }

  // 3. Fallback to Cloud Run for all other environments (Previews, Sandbox, etc.)
  return CLOUD_RUN_URL;
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  QUERY: `${API_BASE_URL}/api/query`,
  HEALTH: `${API_BASE_URL}/api/neo4j/health`,
};
