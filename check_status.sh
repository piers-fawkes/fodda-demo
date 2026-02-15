#!/bin/bash
echo "🔍 Checking Cloud Run Service Status..."
URL=$(gcloud run services describe fodda-sandbox --platform managed --region us-central1 --format 'value(status.url)' 2>/dev/null)

if [ -n "$URL" ]; then
    echo "✅ Service is UP!"
    echo "🔗 URL: $URL"
else
    echo "⏳ Service not found or not ready yet."
    echo "   Check the logs in your terminal for errors."
fi
