
// shared/dataService.ts
import { API_ENDPOINTS } from "./apiConfig";
import {
  RetrievalResult,
  RetrievedRow,
  Trend,
  Article,
  KnowledgeGraph,
  Vertical,
} from "./types";

export interface UserLog {
  email: string;
  query: string;
  vertical: string;
  dataStatus: string;
  timestamp: string;
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

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
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
        description: "Store automation data.",
        owner: "PSFK",
        isCustom: false,
      },
      {
        id: Vertical.Sports,
        name: "Future of Sports Graph",
        description: "Fan engagement data.",
        owner: "PSFK",
        isCustom: false,
      },
      {
        id: Vertical.Beauty,
        name: "Future of Beauty Graph",
        description: "Sensory tech data.",
        owner: "PSFK",
        isCustom: false,
      },
      {
        id: Vertical.SIC,
        name: "SIC Graph (Beta)",
        description: "Strategic Independent Culture Graph exploring subcultures and fringe movements.",
        owner: "Ben Dietz",
        isCustom: false,
      },
      {
        id: Vertical.Waldo,
        name: "Waldo Trends Graph",
        description: "A multi-industry trends knowledge graph built from Waldo’s ongoing signal and analysis work.",
        owner: "Waldo",
        isCustom: false,
      },
      {
        id: Vertical.Baseline,
        name: "Pew Public Beliefs Graph",
        description: "Built from Pew NPORS 2025. Measure public sentiment distribution.",
        owner: "PSFK",
        isCustom: false,
      },
    ];
  }

  async logPrompt(email: string, query: string, vertical: string, dataStatus: string) {
    try {
      return await postJson(API_ENDPOINTS.LOG, { email, query, vertical, dataStatus });
    } catch (err) {
      console.warn("[DataService] Logging to internal system failed:", err);
    }
  }

  async logToAirtable(email: string, query: string, vertical: string, accessKey: string) {
    // Verified constants
    const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
    const BASE_ID = 'appXUeeWN1uD9NdCW';
    // CORRECTED: Fixed typo in Table ID (changed 'tblvHx1DzwTq3TJE' to 'tblvHx1DzwuTq3TJE')
    const TABLE_ID = 'tblvHx1DzwuTq3TJE';
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

    const now = new Date();
    const isoDate = now.toISOString();

    let graphId = 'psfk';
    const cleanVertical = vertical ? String(vertical).toLowerCase() : 'unknown';
    let logVertical = cleanVertical;

    // Mapping based on provided CSV structure
    if (cleanVertical.includes('waldo') || accessKey === 'waldo') {
      graphId = 'waldo';
      logVertical = 'Waldo';
    } else if (cleanVertical.includes('sic') || accessKey === 'sic') {
      graphId = 'sic';
      logVertical = 'general'; // Based on CSV sample row 10
    } else if (cleanVertical.includes('baseline') || cleanVertical.includes('pew')) {
      graphId = 'pew';
      logVertical = 'Baseline';
    } else if (cleanVertical.includes('retail')) {
      graphId = 'psfk';
      logVertical = 'Retail';
    } else if (cleanVertical.includes('sport')) {
      graphId = 'psfk';
      logVertical = 'Sports';
    } else if (cleanVertical.includes('beauty')) {
      graphId = 'psfk';
      logVertical = 'Beauty';
    }

    // Exact matches to CSV headers provided
    const fields = {
      "question": query || "[EMPTY_QUERY]",
      "userEmail": email || "unknown@fodda.ai",
      "graphId": graphId,
      "vertical": logVertical,
      "Date": isoDate,
      "accessKey": accessKey || "psfk"
    };

    const payload = {
      records: [{ fields }],
      typecast: true // Forces Airtable to handle data even if selects or formats don't match perfectly
    };

    console.debug(`[DataService] Airtable payload:`, fields);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${AIRTABLE_PAT}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        console.error(`[DataService] Airtable error ${response.status}:`, errorMessage);

        // Detailed error for Admin UI
        let userFriendlyError = errorMessage;
        if (response.status === 403) {
          userFriendlyError = `Permissions Error (403): The Table ID '${TABLE_ID}' or API Token is invalid. Check for typos in IDs.`;
        } else if (response.status === 404) {
          userFriendlyError = `Not Found (404): The Base ID '${BASE_ID}' or Table ID '${TABLE_ID}' was not found.`;
        }

        return { ok: false, error: userFriendlyError };
      }

      const data = await response.json();
      console.log("[DataService] Airtable log success:", data);
      return { ok: true };
    } catch (err: any) {
      console.error("[DataService] Airtable fetch exception:", err);
      return { ok: false, error: err.message };
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
    } = {}
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
      ...(isBaseline
        ? {
          questionId: options.questionId || "BBHOME",
          segmentType: options.segmentType || "AGEGRP",
          excludeBlank: options.excludeBlank ?? true
        }
        : {}),
    };

    const response = await postJson<ApiQueryResponse>(API_ENDPOINTS.QUERY, payload);

    if (!response.ok || !response.rows) {
      throw new Error(response.error || "Graph Index Unresponsive.");
    }

    const rows: RetrievedRow[] = response.rows.map((r) => {
      const rowId = String(r.rowId || r.id || "");
      const name = String(r.rowName || r.name || "");
      const summary = String(r.rowSummary || r.summary || "");
      const rawEvidence = r.evidence || r.processedEvidence || r.evidenceList || [];

      const mappedEvidence: Article[] = (Array.isArray(rawEvidence) ? rawEvidence : []).map((e: any) => ({
        id: String(e?.id || e?.articleId || ""),
        title: String(e?.title || "Source Signal"),
        sourceUrl: String(e?.sourceUrl || e?.url || "#"),
        snippet: String(e?.snippet || e?.summary || e?.excerpt || ""),
        brandNames: normalizeBrandNames(e?.brandNames),
        vertical: (normalizeVertical(e?.vertical) || normalizeVertical(activeVertical)) as any,
        publishedAt: e?.publishedAt ?? null,
        trendIds: Array.isArray(e?.trendIds) ? e.trendIds : [],
      }));

      return {
        id: rowId,
        name,
        summary,
        isDiscovery: Boolean(r.isDiscovery),
        nodeType: r.nodeType,
        evidence: mappedEvidence,
      };
    });

    const trends: Trend[] = rows
      .filter((r: any) => r.nodeType === "TREND" && !r.isDiscovery)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        summary: r.summary,
        evidence: r.evidence,
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
    } as RetrievalResult;
  }

  async importTrends(vertical: string, trends: Trend[]) {
    return postJson(API_ENDPOINTS.IMPORT_TRENDS, { vertical, trends });
  }

  async importArticles(vertical: string, articles: Article[]) {
    return postJson(API_ENDPOINTS.IMPORT_ARTICLES, { vertical, articles });
  }

  async checkHealth() {
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
