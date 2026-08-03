import { BASE_ID, CE_BASE_ID } from './constants.js';
export { USERS_TABLE, ACCOUNTS_TABLE, API_KEYS_TABLE, PLANS_TABLE, GRAPH_REGISTRY_TABLE, GRAPH_LIST_TABLE, LOGS_TABLE_USAGE, LOGS_TABLE_QUESTIONS, CE_BASE_ID, CE_GRAPHS_TABLE, TRIALS_TABLE, TOKEN_PURCHASES_TABLE, PROMPT_AUDIT_TABLE, CONTENT_SUGGESTIONS_TABLE, NOTIFICATION_REQUESTS_TABLE } from './constants.js';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_CE_PAT = process.env.AIRTABLE_CE_PAT || process.env.AIRTABLE_REPORTS_PAT || AIRTABLE_PAT;

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

// Airtable Task Queue for Rate Limiting (5 req/sec max)
type AirtableTask = () => Promise<any>;
const airtableQueue: AirtableTask[] = [];
let airtableProcessing = false;
const MAX_AIRTABLE_TPS = 5;
const airtableInterval = 1000 / MAX_AIRTABLE_TPS;

async function processAirtableQueue() {
  if (airtableProcessing || airtableQueue.length === 0) return;
  airtableProcessing = true;
  while (airtableQueue.length > 0) {
    const task = airtableQueue.shift();
    if (task) {
      task();
      await new Promise(resolve => setTimeout(resolve, airtableInterval));
    }
  }
  airtableProcessing = false;
}

export function enqueueAirtable(task: AirtableTask): Promise<any> {
  return new Promise((resolve, reject) => {
    airtableQueue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    processAirtableQueue();
  });
}

// Request Deduplicator
const inflightRequests = new Map<string, Promise<any>>();

export async function dedupFetch(url: string, options: any): Promise<any> {
    console.log(`[db] dedupFetch URL: ${url}`);
    const cacheKey = `${options.method || 'GET'}:${url}:${options.body || ''}`;
    if (inflightRequests.has(cacheKey)) {
        return inflightRequests.get(cacheKey);
    }

    const requestPromise = enqueueAirtable(async () => {
        const res = await fetch(url, options);
        if (!res.ok) {
            if (res.status >= 500) {
                console.error(`[Airtable] 5xx Error on ${options.method || 'GET'} to ${url}`);
                throw new DatabaseUnavailableError("Our database is temporarily unavailable. Please try again in a few minutes.");
            }
            const errorBody = await res.text();
            throw new Error(`Airtable Error (${res.status} ${res.statusText}): ${errorBody}`);
        }
        return await res.json();
    });

    inflightRequests.set(cacheKey, requestPromise);
    try {
        return await requestPromise;
    } finally {
        inflightRequests.delete(cacheKey);
    }
}

export async function queryAirtable(tableId: string, filterByFormula: string = "", extraParams: string = "") {
  let url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
  if (extraParams) url += `&${extraParams}`;
  return dedupFetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
  });
}

export async function queryAirtableAll(tableId: string, filterByFormula: string = "", extraParams: string = "") {
  let allRecords: any[] = [];
  let offset: string | null = null;
  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
    if (offset) url += `&offset=${offset}`;
    if (extraParams) url += `&${extraParams}`;
    const res = await dedupFetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    if (res.records) {
      allRecords.push(...res.records);
    }
    offset = res.offset || null;
  } while (offset);
  return { records: allRecords };
}

export async function queryAirtableCE(tableId: string, filterByFormula: string = "", extraParams: string = "") {
  let url = `https://api.airtable.com/v0/${CE_BASE_ID}/${tableId}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
  if (extraParams) url += `&${extraParams}`;
  return dedupFetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_CE_PAT}` }
  });
}

export async function createAirtableRecord(tableId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
  return enqueueAirtable(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Airtable Write Error: ${errorText}`);
    }
    return await res.json();
  });
}

export async function createAirtableCERecord(tableId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${CE_BASE_ID}/${tableId}`;
  return enqueueAirtable(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_CE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Airtable CE Write Error: ${errorText}`);
    }
    return await res.json();
  });
}

export async function updateAirtableRecord(tableId: string, recordId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
  return enqueueAirtable(async () => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields, typecast: true })
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Airtable Update Error: ${errorText}`);
    }
    return await res.json();
  });
}

export async function updateAirtableCERecord(tableId: string, recordId: string, fields: any) {
  const url = `https://api.airtable.com/v0/${CE_BASE_ID}/${tableId}/${recordId}`;
  return enqueueAirtable(async () => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_CE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields, typecast: true })
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Airtable CE Update Error: ${errorText}`);
    }
    return await res.json();
  });
}

export async function deleteAirtableRecord(tableId: string, recordId: string) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
  return enqueueAirtable(async () => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`
      }
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Airtable Delete Error: ${errorText}`);
    }
    return await res.json();
  });
}

/**
 * Escapes characters in a string to make it safe for inclusion inside an Airtable formula
 * e.g., escaping single quotes (') and backslashes (\).
 */
export function escapeAirtableString(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

