#!/bin/bash

# Deployment Script for Fodda Sandbox to Google Cloud Run

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
# User requested specific project: gen-lang-client-0472572023
TARGET_PROJECT="gen-lang-client-0472572023"
echo "🎯 Targeting Project: $TARGET_PROJECT"
gcloud config set project $TARGET_PROJECT
PROJECT_ID=$TARGET_PROJECT

echo "✅ Deploying to Project: $PROJECT_ID"

# Deploy to Cloud Run
# Using source deploy which builds via Cloud Build automatically
echo "📦 Building and Deploying..."

gcloud run deploy fodda-sandbox \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GEMINI_API_KEY=${GEMINI_API_KEY},EMAIL_HOST=${EMAIL_HOST},EMAIL_PORT=${EMAIL_PORT},EMAIL_USER=${EMAIL_USER},EMAIL_PASS=${EMAIL_PASS},AIRTABLE_PAT=${AIRTABLE_PAT}"

if [ $? -eq 0 ]; then
    echo "🎉 Deployment Successful!"
    # Get the URL
    SERVICE_URL=$(gcloud run services describe fodda-sandbox --platform managed --region us-central1 --format 'value(status.url)')
    echo "   URL: $SERVICE_URL"
else
    echo "❌ Deployment Failed."
    exit 1
fi
