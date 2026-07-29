// Airtable IDs & Constants
export const BASE_ID = 'appXUeeWN1uD9NdCW';
export const USERS_TABLE = 'tblGWh6XpdEZxw8AE';
export const ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX';
export const LOGS_TABLE_USAGE = 'tblOBEs9DLZBcL74O'; // API Usage / Billing
export const LOGS_TABLE_QUESTIONS = 'tblvHx1DzwuTq3TJE'; // User Sessions / Questions
export const PLANS_TABLE = 'tblq2T5OUyrDFCda9'; // Plans / Packages
export const API_KEYS_TABLE = 'tblsDGYv8pFpNegcf'; // API Keys
export const GRAPH_LIST_TABLE = 'tblf8OPpi0F16ofAX'; // Graph List (Dynamic Catalog)

export const CE_BASE_ID = 'appnYwCT6QlDSy5i3';
export const CE_GRAPHS_TABLE = 'Graphs';
export const CE_ANALYSTS_TABLE = 'Analysts';
export const GRAPH_REGISTRY_TABLE = process.env.GRAPH_REGISTRY_TABLE_ID || 'tblezSucv8qmbSSy9';
export const TRIALS_TABLE = 'tblKZ7VRjGrcZkw7B'; // Graph Owner Trials
export const TOKEN_PURCHASES_TABLE = 'tblNJdPZnVQ0jmlQh'; // Token Purchase Log (revenue attribution)
export const PROMPT_AUDIT_TABLE = 'tblvkfrBxMGiKHAtN'; // Prompt validation results (pass/fail tracking)
export const CONTENT_SUGGESTIONS_TABLE = 'tblLxGmyEZoWOQZnC'; // LinkedIn content suggestions (Sales Agent)
export const CONTEXT_CONTRIBUTIONS_TABLE = 'tblVXniVij4v9Blfs'; // User-produced content (corrections, extensions, authored)
export const NOTIFICATION_REQUESTS_TABLE = process.env.NOTIFICATION_REQUESTS_TABLE_ID || 'tblc1qEPqx27FTROZ'; // Unclaimed Expert notification queue
export const USER_OBSERVATIONS_TABLE = 'tblMyBB02cZO5ZEB5'; // Append-only persona observations (nightly synthesis)
export const COVERAGE_REQUESTS_TABLE = process.env.COVERAGE_REQUESTS_TABLE_ID || 'tblCoverageRequests'; // Requested coverage queue

export const SCHEMA_VERSION = "2024.11.20";
export const FODDA_API_URL = "https://fodda-api-cl2v4kptba-uc.a.run.app";
