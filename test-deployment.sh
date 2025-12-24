#!/bin/bash

# Test deployment script
echo "🧪 Testing Docker deployment configuration..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one with:"
    echo "   GITHUB_REPO=your-username/your-repo-name"
    echo "   VITE_SUPABASE_URL=https://xyzcompany.supabase.co"
    echo "   VITE_SUPABASE_ANON_KEY=ey..."
    exit 1
fi

# Check if SSH key exists
if [ ! -f .ssh/id_ed25519 ]; then
    echo "❌ SSH key not found at .ssh/id_ed25519"
    echo "   Please ensure your SSH deploy key is in the .ssh directory"
    exit 1
fi

# Check SSH key permissions
if [ "$(stat -c %a .ssh/id_ed25519 2>/dev/null || stat -f %A .ssh/id_ed25519 2>/dev/null)" != "600" ]; then
    echo "⚠️  SSH key permissions should be 600"
    echo "   Fixing permissions..."
    chmod 600 .ssh/id_ed25519
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required variables
if [ -z "$GITHUB_REPO" ]; then
    echo "❌ GITHUB_REPO not set in .env file"
    exit 1
fi

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "❌ VITE_SUPABASE_URL not set in .env file"
    exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ VITE_SUPABASE_ANON_KEY not set in .env file"
    exit 1
fi

echo "✅ Configuration looks good!"
echo "   Repository: $GITHUB_REPO"
echo "   Supabase URL: $VITE_SUPABASE_URL"
echo "   Supabase Anon Key: [HIDDEN]"
echo "   SSH Key: $(ls -la .ssh/id_ed25519 | awk '{print $1}')"

# Test Docker Compose configuration
echo "🔍 Testing Docker Compose configuration..."
if docker-compose config > /dev/null 2>&1; then
    echo "✅ Docker Compose configuration is valid"
else
    echo "❌ Docker Compose configuration has errors"
    exit 1
fi

echo ""
echo "🚀 Ready to deploy! Run: ./start-production.sh"
