# Deployment Guide

## Environment Variables Required

Create a `.env` file in your deployment directory with the following variables:

```bash
# GitHub Repository Configuration
GITHUB_REPO=dstonea25/Dashboard

# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# N8N Webhook Configuration (Optional)
VITE_N8N_WEBHOOK_TOKEN=your_n8n_webhook_token_here
```

## Authentication

This app uses **Supabase Authentication**. User credentials are stored in Supabase, not in environment variables.

To create/manage users:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Users**
3. Add or manage users there

See [AUTHENTICATION.md](./AUTHENTICATION.md) for more details.

## Docker Deployment

1. Create your `.env` file with the variables above
2. Run: `docker-compose up -d --build`

## Quick Start

```bash
# 1. Create .env file
cat > .env << EOF
GITHUB_REPO=your-username/Dashboard
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
EOF

# 2. Test configuration
./test-deployment.sh

# 3. Deploy
./start-production.sh
```

## Ports

- **3000** - Dashboard web interface (maps to container port 8080)

## Health Check

The application includes a health check endpoint. After deployment, verify:

```bash
curl http://localhost:3000/health
```

## Updating

To update to the latest version:

```bash
docker-compose down
docker-compose up -d --build
```

## Logs

View application logs:

```bash
docker-compose logs -f
```
