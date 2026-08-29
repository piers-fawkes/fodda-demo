#!/bin/bash

# Deployment Script for Fodda Sandbox to Google Cloud Run
# This script properly loads environment variables from .env file

echo "🚀 Starting Deployment to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null
then
    echo "❌ gcloud CLI could not be found. Please install the Google Cloud SDK."
    echo "   Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
AUTH_CHECK=$(gcloud auth list --format="value(account)" 2>/dev/null)
if [ -z "$AUTH_CHECK" ]; then
    echo "⚠️  You are not logged in. Opening login..."
    gcloud auth login
fi

# Get Project ID
TARGET_PROJECT="gen-lang-client-0472572023"
echo "🎯 Targeting Project: $TARGET_PROJECT"
gcloud config set project $TARGET_PROJECT
PROJECT_ID=$TARGET_PROJECT

echo "✅ Deploying to Project: $PROJECT_ID"

# Load environment variables from .env file
if [ -f .env ]; then
    echo "📋 Loading environment variables from .env file..."
    # Exclude GOOGLE_SERVICE_ACCOUNT_KEY and CLERK_JWT_KEY (breaks xargs parsing due to spaces/newlines)
    export $(cat .env | grep -v '^#' | grep -v 'GOOGLE_SERVICE_ACCOUNT_KEY' | grep -v 'CLERK_JWT_KEY' | xargs)
    export CLERK_JWT_KEY=$(grep '^CLERK_JWT_KEY=' .env | cut -d'=' -f2- | tr -d '"')
    echo "   ✅ Environment variables loaded"
else
    echo "⚠️  Warning: .env file not found. Using existing environment variables."
fi

# Load Google Sheets service account key directly from file (JSON can't go through xargs)
SA_KEY_FILE="$HOME/Downloads/fodda-graphs-264ac0c280ca.json"
if [ -f "$SA_KEY_FILE" ]; then
    export GOOGLE_SERVICE_ACCOUNT_KEY=$(cat "$SA_KEY_FILE" | tr -d '\n')
    echo "   ✅ Service account key loaded from $SA_KEY_FILE"
else
    echo "⚠️  Warning: Service account key file not found at $SA_KEY_FILE"
fi

# Verify critical variables are set
if [ -z "$AIRTABLE_PAT" ]; then
    echo "❌ Error: AIRTABLE_PAT is not set!"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ Error: GEMINI_API_KEY is not set!"
    exit 1
fi

echo "   AIRTABLE_PAT: ${AIRTABLE_PAT:0:8}..."
echo "   GEMINI_API_KEY: ${GEMINI_API_KEY:0:8}..."

# Run OAuth-flow Preflight Suite
echo "🛡️  Running Preflight Deploy Gate..."
npm run preflight
if [ $? -ne 0 ]; then
    echo "🛑 Preflight checks FAILED. Aborting deployment."
    exit 1
fi
echo "✅ Preflight checks passed."

# Deploy to Cloud Run
echo "📦 Building and Deploying..."

gcloud run deploy fodda-sandbox \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GEMINI_API_KEY=${GEMINI_API_KEY},EMAIL_HOST=${EMAIL_HOST},EMAIL_PORT=${EMAIL_PORT},EMAIL_USER=${EMAIL_USER},EMAIL_PASS=${EMAIL_PASS},AIRTABLE_PAT=${AIRTABLE_PAT},FODDA_API_URL=${FODDA_API_URL:-https://fodda-api-v4-rglj7xzxsa-uk.a.run.app},FODDA_INTERNAL_API_KEY=${FODDA_INTERNAL_API_KEY:-fodda-internal-service-key},STREAK_API_KEY=${STREAK_API_KEY},SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN},SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET},SLACK_RESEARCH_CHANNEL_ID=${SLACK_RESEARCH_CHANNEL_ID:-C0AU0403M3M},COVERAGE_REQUESTS_TABLE_ID=${COVERAGE_REQUESTS_TABLE_ID},SKILL_TOKEN_PARALOGY=${SKILL_TOKEN_PARALOGY},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET},CRON_SECRET=${CRON_SECRET},RESEND_API_KEY=${RESEND_API_KEY},VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY},CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY},CLERK_SECRET_KEY=${CLERK_SECRET_KEY},CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET},CLERK_JWT_KEY=${CLERK_JWT_KEY},VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY},DISABLE_AGENT_PAYMENT_NUDGE=true" \
    --set-env-vars "^||^GOOGLE_SERVICE_ACCOUNT_KEY=${GOOGLE_SERVICE_ACCOUNT_KEY}"

if [ $? -eq 0 ]; then
    echo "🎉 Deployment Successful!"
    # Get the URL
    SERVICE_URL=$(gcloud run services describe fodda-sandbox --platform managed --region us-central1 --format 'value(status.url)')
    echo "   URL: $SERVICE_URL"

    # Post-deploy smoke check
    echo "💨 Running Post-Deploy Smoke Checks..."
    npm run smoke:oauth
    if [ $? -ne 0 ]; then
        echo "🛑 Post-deploy smoke checks FAILED."
        exit 1
    fi
    echo "✅ Post-deploy smoke checks passed cleanly."
else
    echo "❌ Deployment Failed."
    exit 1
fi
