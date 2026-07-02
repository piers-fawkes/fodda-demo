#!/usr/bin/env bash
# Airtable Setup for Query Intelligence Loop
# Creates PROMPT_AUDIT_TABLE and adds new fields to LOGS_TABLE_QUESTIONS
#
# Usage: source .env && bash scripts/setup-airtable-intelligence.sh

set -e

AIRTABLE_PAT="${AIRTABLE_PAT}"
BASE_ID="appXUeeWN1uD9NdCW"
LOGS_TABLE_ID="tblvHx1DzwuTq3TJE"  # LOGS_TABLE_QUESTIONS

if [ -z "$AIRTABLE_PAT" ]; then
  echo "❌ AIRTABLE_PAT not set. Run: source .env && bash scripts/setup-airtable-intelligence.sh"
  exit 1
fi

API="https://api.airtable.com/v0"
META_API="https://api.airtable.com/v0/meta/bases/${BASE_ID}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fodda Query Intelligence — Airtable Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ──────────────────────────────────────────
# Step 1: Create PROMPT_AUDIT_TABLE
# ──────────────────────────────────────────
echo ""
echo "📋 Step 1: Creating Prompt Audit table..."

CREATE_TABLE_RESPONSE=$(curl -s -X POST "${META_API}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_PAT}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prompt Audit",
    "description": "Tracks pass/fail results for suggested prompts — onboarding, welcome screen, catalog, and sweep tests.",
    "fields": [
      {
        "name": "prompt",
        "type": "multilineText",
        "description": "The prompt text that was tested"
      },
      {
        "name": "graphId",
        "type": "singleLineText",
        "description": "Which graph the prompt was tested against"
      },
      {
        "name": "userEmail",
        "type": "singleLineText",
        "description": "User email or system/sweep for automated tests"
      },
      {
        "name": "status",
        "type": "singleSelect",
        "description": "Whether the prompt returned adequate results",
        "options": {
          "choices": [
            {"name": "PASS", "color": "greenLight2"},
            {"name": "FAIL", "color": "redLight2"}
          ]
        }
      },
      {
        "name": "source",
        "type": "singleSelect",
        "description": "Where this prompt came from",
        "options": {
          "choices": [
            {"name": "onboarding_email", "color": "blueLight2"},
            {"name": "sweep_static", "color": "purpleLight2"},
            {"name": "sweep_catalog", "color": "cyanLight2"}
          ]
        }
      },
      {
        "name": "Date",
        "type": "dateTime",
        "description": "When the test was run",
        "options": {
          "timeZone": "America/New_York",
          "dateFormat": {"name": "iso"}
        }
      }
    ]
  }')

# Extract the new table ID  
NEW_TABLE_ID=$(echo "$CREATE_TABLE_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null || echo "")

if [ -n "$NEW_TABLE_ID" ] && [ "$NEW_TABLE_ID" != "" ]; then
  echo "✅ Prompt Audit table created: ${NEW_TABLE_ID}"
  echo ""
  echo "⚠️  Update server/constants.ts:"
  echo "   export const PROMPT_AUDIT_TABLE = '${NEW_TABLE_ID}';"
else
  echo "⚠️  Table creation response:"
  echo "$CREATE_TABLE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_TABLE_RESPONSE"
  echo ""
  echo "   (Table may already exist, or the API may have returned an error)"
fi

# ──────────────────────────────────────────  
# Step 2: Add fields to LOGS_TABLE_QUESTIONS
# ──────────────────────────────────────────
echo ""
echo "📋 Step 2: Adding new fields to Questions log table (${LOGS_TABLE_ID})..."

# Helper function to add a field
add_field() {
  local FIELD_JSON="$1"
  local FIELD_NAME=$(echo "$FIELD_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('name', '?'))")
  
  RESULT=$(curl -s -X POST "${META_API}/tables/${LOGS_TABLE_ID}/fields" \
    -H "Authorization: Bearer ${AIRTABLE_PAT}" \
    -H "Content-Type: application/json" \
    -d "$FIELD_JSON")
  
  ERROR=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', {}).get('message', ''))" 2>/dev/null || echo "")
  
  if [ -z "$ERROR" ]; then
    echo "  ✅ ${FIELD_NAME}"
  else
    echo "  ⚠️  ${FIELD_NAME}: ${ERROR}"
  fi
}

# resultCount
add_field '{
  "name": "resultCount",
  "type": "number",
  "description": "Number of trend/article results returned",
  "options": {"precision": 0}
}'

# responseTimeMs
add_field '{
  "name": "responseTimeMs",
  "type": "number", 
  "description": "End-to-end response latency in milliseconds",
  "options": {"precision": 0}
}'

# resultQuality
add_field '{
  "name": "resultQuality",
  "type": "singleSelect",
  "description": "Quality classification: STRONG (≥5 results), WEAK (1-4), MISS (0)",
  "options": {
    "choices": [
      {"name": "STRONG", "color": "greenLight2"},
      {"name": "WEAK", "color": "yellowLight2"},
      {"name": "MISS", "color": "redLight2"}
    ]
  }
}'

# source
add_field '{
  "name": "source",
  "type": "singleSelect",
  "description": "Where the query originated: app, api, mcp, or trial",
  "options": {
    "choices": [
      {"name": "app", "color": "blueLight2"},
      {"name": "api", "color": "purpleLight2"},
      {"name": "mcp", "color": "cyanLight2"},
      {"name": "trial", "color": "grayLight2"}
    ]
  }
}'

# accountId
add_field '{
  "name": "accountId",
  "type": "singleLineText",
  "description": "Airtable record ID of the account"
}'

# searchSlug
add_field '{
  "name": "searchSlug",
  "type": "singleLineText",
  "description": "Resolved graph slug used for the search"
}'

# promptSource
add_field '{
  "name": "promptSource",
  "type": "singleSelect",
  "description": "If the query came from a Fodda-suggested prompt, which surface it was from",
  "options": {
    "choices": [
      {"name": "welcome_static", "color": "blueLight2"},
      {"name": "welcome_catalog", "color": "purpleLight2"},
      {"name": "followup", "color": "cyanLight2"},
      {"name": "onboarding_email", "color": "greenLight2"}
    ]
  }
}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done! Next steps:"
echo "  1. Update PROMPT_AUDIT_TABLE ID in server/constants.ts if shown above"
echo "  2. Deploy to Cloud Run"
echo "  3. Set CRON_SECRET env var"
echo "  4. Test: POST /api/cron/query-digest and /api/cron/prompt-sweep"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
