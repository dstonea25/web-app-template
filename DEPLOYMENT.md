# Docker Deployment from Private GitHub Repository

This guide explains how to deploy the dashboard from a private GitHub repository using Docker.

## Prerequisites

1. **Private GitHub Repository** with your dashboard code
2. **SSH Deploy Key** at `.ssh/id_ed25519` in your deployment directory
3. **Docker** and **Docker Compose** installed

## Setup

### 1. Prepare SSH Key

Ensure your SSH deploy key is in the deployment directory:

```bash
# Your SSH key should be at:
.ssh/id_ed25519
```

### 2. Configure Environment Variables

Create a `.env` file with your repository and credentials:

```bash
# Required: Your GitHub repository
GITHUB_REPO=your-username/your-repo-name

# Required: Authentication credentials
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=your_secure_password
```

### 3. Deploy

Run the production startup script:

```bash
./start-production.sh
```

Or manually with Docker Compose:

```bash
GITHUB_REPO=your-username/your-repo-name ./start-production.sh
```

## How It Works

### Build Process

1. **Git Clone**: Docker clones your private repo using SSH
2. **Dependencies**: Installs npm dependencies with `npm ci`
3. **Build**: Runs `npm run build` to create production build
4. **Serve**: Uses `http-server` to serve the built files

### Docker Architecture

- **Builder Stage**: Clones repo, installs deps, builds app
- **Production Stage**: Serves built files with http-server
- **Port Mapping**: Host port 3000 → Container port 8080
- **Security**: Runs as non-root user

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_REPO` | ✅ Yes | - | GitHub repository (format: `username/repo`) |
| `VITE_AUTH_USERNAME` | No | `admin` | Login username |
| `VITE_AUTH_PASSWORD` | No | `password123` | Login password |

## Security Features

- ✅ **SSH Authentication** - Uses your deploy key
- ✅ **Non-root User** - Container runs as unprivileged user
- ✅ **Clean Build** - No local file overrides
- ✅ **Environment Variables** - Credentials via env vars
- ✅ **Health Checks** - Container health monitoring

## Troubleshooting

### SSH Key Issues

```bash
# Check SSH key permissions
ls -la .ssh/id_ed25519
# Should show: -rw------- (600)

# Test SSH connection
ssh -T git@github.com
```

### Build Failures

```bash
# Check build logs
docker-compose logs dashboard

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Repository Access

Ensure your SSH key has access to the private repository:
1. Go to your GitHub repo → Settings → Deploy keys
2. Add your public key (`id_ed25519.pub`)

## Commands

```bash
# Start the application
./start-production.sh

# View logs
docker-compose logs -f dashboard

# Stop the application
docker-compose down

# Rebuild and restart
docker-compose up --build -d

# Check container status
docker-compose ps
```

## Access

- **Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/ (returns 200 if healthy)

## File Structure

```
deployment-directory/
├── .ssh/
│   └── id_ed25519          # Your SSH deploy key
├── .env                    # Environment variables
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile             # Multi-stage Docker build
└── start-production.sh    # Deployment script
```

The application will be built entirely from your GitHub repository - no local files are mounted or used.
