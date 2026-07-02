# Workflow: Lookup User MCP URL

This workflow describes how to retrieve the MCP server URL for a specific user by their email address.

## Prerequisite
- Access to the Fodda Admin Portal secret (`psfk`).
- Ability to run `curl` or access the production API.

## Step 1: Resolve Identity via Admin API
Run the following command to get the user's account details and API key.

```bash
curl -X POST https://app.fodda.ai/api/account/admin/lookup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "USER_EMAIL",
    "adminSecret": "psfk"
  }'
```

## Step 2: Construct the MCP URL
From the JSON response, extract the `apiKey`.

The MCP URL follows this pattern:
`https://mcp.fodda.ai/mcp?api_key=THE_API_KEY`

## Step 3: Troubleshooting (API Key is null)
If the response returns `"apiKey": null`, follow these steps:

1. **Check for Trial Keys**: If the user's vertical is specific (e.g., `SIC`), they might be using a trial key like `sk_trial_sic`.
2. **Direct Airtable Lookup**: If the Admin Portal/API is failing to resolve the key, use a scratch script to query the `USERS_TABLE` directly for the `email` field and look at the `apiKey` field in the record.

```bash
# Example scratch script snippet
const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${email}'`);
const apiKey = userQuery.records[0].fields.apiKey;
```

## Step 4: Verify URL
Test the URL by calling the status endpoint:
`curl -s https://app.fodda.ai/api/account/status -H "X-API-Key: THE_API_KEY"`
