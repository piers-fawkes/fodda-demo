
// shared/dataService.ts
import { API_ENDPOINTS } from "./apiConfig";
import {
  RetrievalResult,
  RetrievedRow,
  Trend,
  Article,
  KnowledgeGraph,
  Vertical,
  AuthResponse
} from "./types";

export interface UserLog {
  email: string;
  query: string;
  vertical: string;
  dataStatus: string;
  timestamp: string;
}

export interface TrackingInfo {
  userId?: string;
  apiKey?: string;
  userContext?: string;
  accountContext?: string;
}

type ApiMeta = {
  decision?: "ANSWER" | "ANSWER_WITH_CAVEATS" | "REFUSE";
  coverage?: {
    requiredTerms: string[];
    matchedTerms: string[];
    coverageRatio: number;
  };
  [k: string]: any;
};

type ApiQueryResponse = {
  ok: boolean;
  dataStatus: string;
  rows?: any[];
  termsUsed?: string[];
  meta?: ApiMeta;
  error?: string;
};

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try {
      const json = JSON.parse(text);
      if (json.error) throw new ApiError(json.error, json.code, res.status);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // Fall through to generic error
    }
    throw new ApiError(`API Error ${res.status}: ${text || res.statusText}`, undefined, res.status);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    // Preserve requestId for tracing if it's not already in data
    if (json.requestId && typeof json.data === 'object' && json.data !== null) {
      (json.data as any).requestId = json.requestId;
    }
    // REFINEMENT: Attach raw envelope for DevTools transparency
    if (typeof json.data === 'object' && json.data !== null) {
      Object.defineProperty(json.data, '_rawEnvelope', {
        value: json,
        enumerable: false, // Hide from standard iteration
        writable: true,
        configurable: true
      });
    }
    return json.data as T;
  }
  return json as T;
}

function normalizeBrandNames(val: any): string[] {
  if (Array.isArray(val)) {
    const cleaned = val.map((s) => String(s).trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }
  if (typeof val === "string") {
    const parts = val
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }
  return [];
}

function normalizeVertical(v: any): Vertical | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s.includes("sport")) return Vertical.Sports;
  if (s.includes("retail")) return Vertical.Retail;
  if (s.includes("beauty")) return Vertical.Beauty;
  if (s.includes("baseline")) return Vertical.Baseline;
  if (s.includes("waldo")) return Vertical.Waldo;
  if (s.includes("sic")) return Vertical.SIC;
  return null;
}

class DataService {
  getGraphs(): KnowledgeGraph[] {
    return [
      {
        id: Vertical.Retail,
        name: "Future of Retail Graph",
        headline: "Tracking the automation of physical commerce",
        description: "Store automation data.",
        owner: "PSFK",
        isCustom: false,
        verticalName: "Retail",
        pricePerQuery: "$0.50",
        updateFrequency: "Weekly",
        sourceURL: "https://psfk.com/retail"
      },
      {
        id: Vertical.Sports,
        name: "Future of Sports Graph",
        headline: "Decoding the next generation of fan engagement",
        description: "Fan engagement data.",
        owner: "PSFK",
        isCustom: false,
        verticalName: "Sports",
        pricePerQuery: "$0.50",
        updateFrequency: "Monthly",
        sourceURL: "https://psfk.com/sports"
      },
      {
        id: Vertical.Beauty,
        name: "Future of Beauty Graph",
        headline: "Exploring sensory tech and personalized aesthetics",
        description: "Sensory tech data.",
        owner: "PSFK",
        isCustom: false,
        verticalName: "Beauty",
        pricePerQuery: "$0.50",
        updateFrequency: "Bi-Weekly",
        sourceURL: "https://psfk.com/beauty"
      },
      {
        id: Vertical.SIC,
        name: "SIC Graph (Beta)",
        headline: "Strategic Independent Culture mapping",
        description: "Strategic Independent Culture Graph exploring subcultures and fringe movements.",
        owner: "Ben Dietz",
        isCustom: false,
        verticalName: "Culture",
        pricePerQuery: "$1.00",
        updateFrequency: "Daily",
        sourceURL: "https://bendietz.com"
      },
      {
        id: Vertical.Waldo,
        name: "Waldo Trends Graph",
        headline: "Multi-industry innovation intelligence",
        description: "A multi-industry trends knowledge graph built from Waldo’s ongoing signal and analysis work.",
        owner: "Waldo",
        isCustom: false,
        verticalName: "General",
        pricePerQuery: "$0.75",
        updateFrequency: "Real-time",
        sourceURL: "https://waldo.fyi"
      },
      {
        id: Vertical.Baseline,
        name: "Pew Public Beliefs Graph",
        headline: "US public sentiment and demographic trends",
        description: "Built from Pew NPORS 2025. Measure public sentiment distribution.",
        owner: "PSFK",
        isCustom: false,
        verticalName: "Public Policy",
        pricePerQuery: "$0.25",
        updateFrequency: "Quarterly",
        sourceURL: "https://pewresearch.org"
      },
    ];
  }

  async updateGraph(id: string, updates: Partial<KnowledgeGraph>): Promise<{ ok: boolean; error?: string }> {
    try {
      // For now, we only log to server which is mocked.
      // In future, this would call the API.
      /*
      const res = await postJson(`/api/admin/graphs/${id}`, updates);
      return res as any; 
      */
      // We are calling the endpoint we just created in server/index.ts
      await postJson(`/api/admin/graphs/${id}`, updates);
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update graph", e);
      return { ok: false, error: e.message };
    }
  }

  async login(email: string): Promise<AuthResponse> {
    console.log("[DataService] login initiated for:", email);
    try {
      const res = await postJson<AuthResponse>("/api/auth/login", { email });
      console.log("[DataService] login response success:", { ok: res.ok, message: res.message });
      return res;
    } catch (e: any) {
      console.error("[DataService] login failed", e);
      return { ok: false, error: e.message };
    }
  }

  async verifyLogin(token: string): Promise<AuthResponse> {
    console.log("[DataService] verifyLogin initiated with token");
    try {
      const res = await postJson<AuthResponse>("/api/auth/verify", { token });
      console.log("[DataService] verifyLogin success:", { ok: res.ok, hasUser: !!res.user });
      return res;
    } catch (e: any) {
      console.error("[DataService] verifyLogin failed", e);
      return { ok: false, error: e.message };
    }
  }

  async validateSession(sessionToken: string): Promise<AuthResponse> {
    try {
      const res = await postJson<AuthResponse>("/api/auth/validate-session", { sessionToken });
      return res;
    } catch (e: any) {
      console.error("[DataService] Session validation failed", e);
      return { ok: false, error: e.message };
    }
  }

  async register(email: string, firstName: string, lastName: string, company: string, jobTitle: string, companyContextRaw?: string, userContextRaw?: string, apiUse?: string): Promise<AuthResponse> {
    console.log("[DataService] register initiated for:", email);
    try {
      const res = await postJson<AuthResponse>("/api/auth/register", {
        email,
        firstName,
        lastName,
        company,
        jobTitle,
        companyContext: companyContextRaw,
        userContext: userContextRaw,
        apiUse
      });
      console.log("[DataService] register response success:", { ok: res.ok });
      return res;
    } catch (e: any) {
      console.error("[DataService] Registration failed", e);
      return { ok: false, error: e.message };
    }
  }

  async joinTeam(email: string, firstName: string, lastName: string, signupCode: string, jobTitle: string, userContext?: string) {
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, signupCode, jobTitle, userContext })
      });
      return await res.json();
    } catch (e: any) {
      console.error("Join failed", e);
      return { ok: false, error: e.message };
    }
  }

  async updateUserProfile(email: string, updates: { firstName?: string; lastName?: string; jobTitle?: string; company?: string; email?: string }) {
    try {
      await postJson("/api/user/update", { email, updates });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update user profile", e);
      return { ok: false, error: e.message };
    }
  }

  async updateUserContext(email: string, context: string) {
    try {
      await postJson("/api/user/context", { email, context });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update user context", e);
      return { ok: false, error: e.message };
    }
  }

  async updateAccountContext(accountId: string, context: string) {
    try {
      await postJson("/api/account/context", { accountId, context });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update account context", e);
      return { ok: false, error: e.message };
    }
  }

  async updateAccount(accountId: string, updates: any, role: string = 'Owner') {
    try {
      await postJson("/api/account/update", { accountId, updates, role });
      return { ok: true };
    } catch (e: any) {
      console.error("Failed to update account", e);
      return { ok: false, error: e.message };
    }
  }

  async logPrompt(email: string, query: string, vertical: string, dataStatus: string) {
    try {
      return await postJson("/api/log", { email, query, vertical, dataStatus, context: { source: 'logPrompt' } });
    } catch (err) {
      console.warn("[DataService] Logging to internal system failed:", err);
    }
  }

  async logToAirtable(userId: string, email: string, query: string, vertical: string, accessKey: string, context?: any): Promise<{ ok: boolean; error?: string }> {
    // Derive graphId
    const v = vertical.toLowerCase();
    let graphId = "psfk";
    if (v.includes("waldo")) graphId = "waldo";
    else if (v.includes("sic")) graphId = "sic";
    else if (v.includes("baseline")) graphId = "pew";

    try {
      const _res = await postJson("/api/log", {
        userId,
        email,
        query,
        vertical,
        graphId,
        accessKey,
        context
      });
      return { ok: true };
    } catch (err: any) {
      console.error("[DataService] Server log failed:", err);
      return { ok: false, error: err.message };
    }
  }

  async getUserStats(email: string) {
    try {
      const res = await fetch(`/api/user/stats?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    } catch (e: any) {
      console.error("Failed to get user stats", e);
      return { ok: false, error: e.message };
    }
  }

  async getPlans() {
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return await res.json();
    } catch (e: any) {
      console.error("Failed to get plans", e);
      return { ok: false, error: e.message, plans: [] };
    }
  }

  async getLogs(): Promise<UserLog[]> {
    try {
      const res = await fetch(API_ENDPOINTS.GET_LOGS);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.error("[DataService] Failed to retrieve logs:", err);
      return [];
    }
  }

  async getDiscoveryValues(graphId: string, label: string): Promise<string[]> {
    try {
      const res = await fetch(API_ENDPOINTS.V1_DISCOVERY(graphId, label));
      if (!res.ok) throw new Error(`Discovery failed: ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.values || []);
    } catch (err) {
      console.error(`[DataService] Discovery failed for ${label}:`, err);
      return [];
    }
  }

  async semanticSearch(query: string, graphId: string, limit = 10, headers: Record<string, string> = {}): Promise<ApiQueryResponse> {
    const url = API_ENDPOINTS.V1_SEARCH(graphId);
    return postJson<ApiQueryResponse>(url, { query, limit }, headers);
  }

  async retrieve(
    q: string,
    vertical: string | null = null,
    limit = 50,
    options: {
      trendId?: string;
      manualTerms?: string[];
      questionId?: string;
      segmentType?: string;
      excludeBlank?: boolean;
    } = {},
    tracking?: TrackingInfo,
    executionMode: 'direct' | 'mcp' = 'direct'
  ): Promise<RetrievalResult> {
    const activeVertical = vertical ? String(vertical).toLowerCase() : null;
    const isBaseline = activeVertical === "baseline";
    const isWaldo = activeVertical === "waldo";
    const isSIC = activeVertical === "sic";

    let graphId = "psfk";
    let apiVertical = activeVertical;

    if (isWaldo) {
      graphId = "waldo";
      apiVertical = "general";
    } else if (isSIC) {
      graphId = "sic";
      apiVertical = "general";
    } else if (isBaseline) {
      graphId = "pew";
      apiVertical = "baseline";
    }

    const payload = {
      q,
      terms: options.manualTerms,
      vertical: apiVertical,
      graphId,
      limit: isBaseline ? 200 : limit,
      trendId: options.trendId,
      // Task 7: Include tracking fields in body
      userId: tracking?.userId || '',
      accountContext: tracking?.accountContext || '',
      userContext: tracking?.userContext || '',
      // Combined sessionContext
      sessionContext: [tracking?.accountContext, tracking?.userContext].filter(Boolean).join('\n'),
      ...(isBaseline
        ? {
          questionId: options.questionId || "BBHOME",
          segmentType: options.segmentType || "AGEGRP",
          excludeBlank: options.excludeBlank ?? true
        }
        : {}),
    };

    // Task 12: Include headers
    const headers: Record<string, string> = {
      'X-User-Id': tracking?.userId || '',
      'X-Fodda-Execution-Mode': executionMode, // NEW: Support Dual-Mode Testing
      'X-Fodda-Mode': 'deterministic' // Force deterministic for UI queries generally, or make param? 
      // Brief says "App can transparently test", usually implies same behavior.
      // We'll leave X-Fodda-Mode default (server defaults to true) or explicit here.
      // Let's rely on server default or App.tsx controlling it via another param if needed.
      // But for MCP mode, we likely want deterministic.
    };
    if (tracking?.apiKey) {
      headers['X-API-Key'] = tracking.apiKey;
    }

    const startTime = Date.now();
    let response: ApiQueryResponse;

    // Task: Use Semantic Search for trends/concepts unless it's a specific baseline question OR a graph with incompatible vectors (Waldo/SIC)
    // Waldo and SIC currently have 3072-dim vectors which break the 768-dim model on the V1 endpoint.
    const forceLegacy = (isBaseline && options.questionId) || isWaldo || isSIC;

    if (forceLegacy) {
      // Ensure vertical is "general" for Waldo/SIC (handled above in apiVertical logic)
      response = await postJson<ApiQueryResponse>(API_ENDPOINTS.QUERY, payload, headers);
    } else {
      try {
        response = await this.semanticSearch(q, graphId, isBaseline ? 200 : limit, headers);
      } catch (err) {
        console.warn("[DataService] Semantic search failed, falling back to legacy query:", err);
        // Fallback uses payload which already has the corrected apiVertical ("general") for Waldo/SIC
        response = await postJson<ApiQueryResponse>(API_ENDPOINTS.QUERY, payload, headers);
      }
    }
    const durationMs = Date.now() - startTime;

    if (!response.ok || !response.rows) {
      throw new Error(response.error || "Graph Index Unresponsive.");
    }

    const rows: RetrievedRow[] = response.rows.map((r) => {
      const rowId = String(r.trendId || r.articleId || r.rowId || r.id || "").replace(/^(trend-|article-)/, '');
      const name = String(r.rowName || r.name || "");
      const summary = String(r.rowSummary || r.summary || "");
      const rawEvidence = r.evidence || r.processedEvidence || r.evidenceList || [];

      const mappedEvidence: Article[] = (Array.isArray(rawEvidence) ? rawEvidence : []).map((e: any) => ({
        id: String(e?.articleId || e?.id || e?.article_id || e?.recordId || "").replace(/^(trend-|article-)/, ''),
        articleId: e?.articleId,
        title: String(e?.title || e?.articleTitle || "Source Signal"),
        sourceUrl: String(e?.sourceUrl || e?.url || e?.link || e?.source_url || e?.article_url || e?.external_url || e?.original_url || "#"),
        snippet: String(e?.snippet || e?.summary || e?.excerpt || e?.articleSnippet || ""),
        brandNames: normalizeBrandNames(e?.brandNames),
        vertical: (normalizeVertical(e?.vertical) || normalizeVertical(activeVertical)) as any,
        publishedAt: e?.publishedAt ?? null,
        trendIds: Array.isArray(e?.trendIds) ? e.trendIds : [],
      }));

      return {
        id: rowId,
        trendId: r.trendId,
        articleId: r.articleId,
        name,
        summary,
        isDiscovery: Boolean(r.isDiscovery),
        nodeType: r.nodeType,
        evidence: mappedEvidence,
        evidence_counts: r.evidence_counts,
      };
    });

    const trends: Trend[] = rows
      .filter((r: any) => r.nodeType === "TREND" && !r.isDiscovery)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        summary: r.summary,
        evidence: r.evidence,
        evidence_counts: r.evidence_counts,
      })) as any;

    const articlesMap = new Map<string, Article>();
    rows.forEach((r: any) =>
      (r.evidence || []).forEach((a: any) => {
        if (a?.id) articlesMap.set(a.id, a);
      })
    );

    return {
      ok: true,
      rows,
      trends,
      articles: Array.from(articlesMap.values()),
      dataStatus: response.dataStatus || "UNKNOWN",
      termsUsed: response.termsUsed || [],
      meta: response.meta,
      debug: {
        request: payload,
        headers, // REFINEMENT: Expose headers for DevTools transparency
        response: (response as any)._rawEnvelope || response,
        durationMs
      }
    } as RetrievalResult;
  }

  async importTrends(vertical: string, trends: Trend[]) {
    return postJson(API_ENDPOINTS.IMPORT_TRENDS, { vertical, trends });
  }

  async importArticles(vertical: string, articles: Article[]) {
    return postJson(API_ENDPOINTS.IMPORT_ARTICLES, { vertical, articles });
  }

  async getAccountUsers(accountId: string) {
    try {
      const res = await fetch(`/api/account/${accountId}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    } catch (e: any) {
      console.error("Failed to get account users", e);
      return { ok: false, error: e.message };
    }
  }

  async deleteUser(userId: string, requesterEmail: string) {
    try {
      const res = await fetch(`/api/user/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterEmail })
      });
      return await res.json();
    } catch (e: any) {
      console.error("Failed to delete user", e);
      return { ok: false, error: e.message };
    }
  }

  async getMacroOverview(params: {
    industry?: string;
    sector?: string;
    region?: string;
    timeframe?: string;
  }, apiKey: string): Promise<{ ok: boolean, data?: any, error?: string }> {
    try {
      if (!apiKey) throw new Error("API Key required");

      const res = await fetch(API_ENDPOINTS.V1_OVERVIEW, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify(params)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Overview API Error ${res.status}: ${text}`);
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (e: any) {
      console.error("Failed to get macro overview", e);
      return { ok: false, error: e.message };
    }
  }

  async checkHealth(): Promise<{ ok: boolean;[key: string]: any }> {
    try {
      const r = await fetch(API_ENDPOINTS.HEALTH);
      if (!r.ok) return { ok: false };
      return await r.json();
    } catch {
      return { ok: false };
    }
  }
}

export const dataService = new DataService();
export default dataService;
