#!/bin/bash

# Robust Deployment Script (Image-Based)
# Prevents "hanging" issues seen with source-based deploy

PROJECT_ID="gen-lang-client-0472572023"
IMAGE_NAME="gcr.io/$PROJECT_ID/fodda-sandbox"
SERVICE_NAME="fodda-sandbox"
REGION="us-central1"

echo "🚀 Starting Robust Deployment..."
echo "Target Project: $PROJECT_ID"

# 1. Build the Container Image
echo "📦 Step 1: Building Container Image..."
/Users/piersfawkes/Downloads/google-cloud-sdk/bin/gcloud builds submit --tag $IMAGE_NAME .
if [ $? -ne 0 ]; then
    echo "❌ Build Failed. Aborting."
    exit 1
fi

# 2. Deploy the Image to Cloud Run
echo "🚀 Step 2: Deploying Image to Cloud Run..."
/Users/piersfawkes/Downloads/google-cloud-sdk/bin/gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production

if [ $? -eq 0 ]; then
    echo "🎉 Deployment Successful!"
else
    echo "❌ Deployment Failed."
    exit 1
fi
