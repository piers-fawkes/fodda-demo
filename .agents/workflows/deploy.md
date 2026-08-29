---
description: How to deploy the Fodda App to Google Cloud Run
---

# Deploy Fodda App to Cloud Run

## Service Details

- **Project**: `gen-lang-client-0472572023`
- **Service**: `fodda-sandbox`
- **Region**: `us-central1`
- **URL**: `https://fodda-sandbox-1095548227950.us-central1.run.app`
- **Custom Domain**: `app.fodda.ai`
- **Console**: https://console.cloud.google.com/run/detail/us-central1/fodda-sandbox/observability/metrics?project=gen-lang-client-0472572023

> [!CAUTION]
> Do NOT deploy to `fodda-the-ai-context-layer-website` in `gen-lang-client-0216676356` — that is the **marketing website** (`fodda.ai`), not the app (`app.fodda.ai`).

## Prerequisites

- **Deploy ONLY from clean `main` branch**:
  - `git checkout main`
  - `git pull origin main`
  - Ensure `git status --porcelain` is completely clean (no uncommitted or untracked changes).
  - Record `git rev-parse HEAD` and the resulting Cloud Run revision in `CHANGELOG.md`.
- `gcloud` CLI installed (located at `/opt/homebrew/bin/gcloud`)
- `.env` file in the project root with all required environment variables
- Authenticated with `gcloud auth login`

## Deploy Steps

// turbo-all

1. Pre-deploy validation (must be clean `main`):

```bash
# Verify branch and clean working tree
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "❌ Deploy must be run from 'main' branch"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "❌ Working directory must be clean before deploying"; exit 1; }
echo "✅ Deploying from commit $(git rev-parse HEAD)"
```

2. Run OAuth-flow preflight test suite gate:

```bash
npm run preflight
```

3. Deploy the source code (rebuilds the Docker image):

```bash
/opt/homebrew/bin/gcloud run deploy fodda-sandbox \
  --source . \
  --platform managed \
  --region us-central1 \
  --project gen-lang-client-0472572023 \
  --allow-unauthenticated
```

4. Set all environment variables (using separate flags to avoid shell parsing issues with special characters):

```bash
/opt/homebrew/bin/gcloud run services update fodda-sandbox \
  --region us-central1 \
  --project gen-lang-client-0472572023 \
  --update-env-vars "NODE_ENV=production" \
  --update-env-vars "GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "EMAIL_HOST=$(grep '^EMAIL_HOST=' .env | cut -d= -f2-)" \
  --update-env-vars "EMAIL_PORT=$(grep '^EMAIL_PORT=' .env | cut -d= -f2-)" \
  --update-env-vars "EMAIL_USER=$(grep '^EMAIL_USER=' .env | cut -d= -f2-)" \
  --update-env-vars "EMAIL_PASS=$(grep '^EMAIL_PASS=' .env | cut -d= -f2-)" \
  --update-env-vars "AIRTABLE_PAT=$(grep '^AIRTABLE_PAT=' .env | cut -d= -f2-)" \
  --update-env-vars "FODDA_API_URL=$(grep '^FODDA_API_URL=' .env | cut -d= -f2-)" \
  --update-env-vars "FODDA_INTERNAL_API_KEY=$(grep '^FODDA_INTERNAL_API_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "STRIPE_SECRET_KEY=$(grep '^STRIPE_SECRET_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "STRIPE_WEBHOOK_SECRET=$(grep '^STRIPE_WEBHOOK_SECRET=' .env | cut -d= -f2-)" \
  --update-env-vars "CRON_SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2-)" \
  --update-env-vars "STREAK_API_KEY=$(grep '^STREAK_API_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "RESEND_API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "SLACK_BOT_TOKEN=$(grep '^SLACK_BOT_TOKEN=' .env | cut -d= -f2-)" \
  --update-env-vars "SLACK_SIGNING_SECRET=$(grep '^SLACK_SIGNING_SECRET=' .env | cut -d= -f2-)" \
  --update-env-vars "SLACK_RESEARCH_CHANNEL_ID=$(grep '^SLACK_RESEARCH_CHANNEL_ID=' .env | cut -d= -f2-)" \
  --update-env-vars "COVERAGE_REQUESTS_TABLE_ID=$(grep '^COVERAGE_REQUESTS_TABLE_ID=' .env | cut -d= -f2-)" \
  --update-env-vars "VITE_CLERK_PUBLISHABLE_KEY=$(grep '^VITE_CLERK_PUBLISHABLE_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "CLERK_PUBLISHABLE_KEY=$(grep '^CLERK_PUBLISHABLE_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "CLERK_SECRET_KEY=$(grep '^CLERK_SECRET_KEY=' .env | cut -d= -f2-)" \
  --update-env-vars "CLERK_WEBHOOK_SECRET=$(grep '^CLERK_WEBHOOK_SECRET=' .env | cut -d= -f2-)"
```

5. Verify the deployment URL & run post-deploy smoke checks:

```bash
/opt/homebrew/bin/gcloud run services describe fodda-sandbox \
  --platform managed \
  --region us-central1 \
  --project gen-lang-client-0472572023 \
  --format='value(status.url)'

# Run post-deploy smoke suite
npm run smoke:oauth
```

6. Health check — confirm the app is responding:

```bash
curl -s -o /dev/null -w "%{http_code}" https://fodda-sandbox-1095548227950.us-central1.run.app/health
```

> [!NOTE]
> Expect a `200` response. If you get a `503` or no response, check the Cloud Run logs in the console link above.

## Rollback

If a deploy causes issues, revert traffic to the previous stable revision:

```bash
/opt/homebrew/bin/gcloud run services update-traffic fodda-sandbox \
  --to-revisions=PREVIOUS=100 \
  --region us-central1 \
  --project gen-lang-client-0472572023
```

To list recent revisions and pick a specific one:

```bash
/opt/homebrew/bin/gcloud run revisions list \
  --service fodda-sandbox \
  --region us-central1 \
  --project gen-lang-client-0472572023
```

## Required Environment Variables

These must be set in `.env`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `AIRTABLE_PAT` | Airtable Personal Access Token |
| `EMAIL_HOST` | SMTP host for system emails |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `FODDA_API_URL` | Upstream Fodda API URL |
| `FODDA_INTERNAL_API_KEY` | Internal service key for API bypass |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `CRON_SECRET` | Secret for monthly reset cron endpoint |
| `STREAK_API_KEY` | Streak CRM API key for pipeline sync |
| `RESEND_API_KEY` | Resend API key for transactional emails (formal Fodda emails) |
| `SLACK_BOT_TOKEN` | Slack bot token for content gap reports to #fodda-research |
| `SLACK_SIGNING_SECRET` | Slack signing secret for webhook request verification |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key (frontend) |
| `CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key (backend) |
| `CLERK_SECRET_KEY` | Clerk Secret Key (backend) |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook secret for SVIX signature verification |

## Notes

- Deploy is from source (uses the `Dockerfile` in the project root)
- Build + deploy typically takes 3-5 minutes
- The marketing website (`fodda.ai`) is a separate service: `fodda-the-ai-context-layer-website` in project `gen-lang-client-0216676356`
