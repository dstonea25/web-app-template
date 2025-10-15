# Deployment Guide

## Environment Variables Required

Create a `.env` file in your deployment directory with the following variables:

```bash
# GitHub Repository Configuration
GITHUB_REPO=dstonea25/Dashboard

# Authentication Credentials
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=your_secure_password

# N8N Webhook Configuration
VITE_N8N_WEBHOOK_TOKEN=your_n8n_webhook_token_here
```

## Docker Deployment

1. Create your `.env` file with the variables above
2. Run: `docker-compose up -d --build`

## Fixing the Current Issue

The error you're seeing happens because `VITE_N8N_WEBHOOK_TOKEN` is not available at build time. I've updated the Dockerfile and docker-compose.yml to fix this.

**To fix your current deployment:**

1. Set the `VITE_N8N_WEBHOOK_TOKEN` environment variable in your NAS
2. Rebuild the Docker container: `docker-compose up -d --build`

The token will now be embedded in the build and the webhook calls will work.