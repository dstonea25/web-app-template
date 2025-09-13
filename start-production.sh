#!/bin/bash

# Production startup script for Dashboard
echo "🚀 Starting Dashboard in production mode..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Load environment variables if .env file exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if required variables are set
if [ -z "$GITHUB_REPO" ]; then
    echo "❌ Error: GITHUB_REPO environment variable is required"
    echo "   Example: GITHUB_REPO=username/repository-name"
    echo "   Set it in your .env file"
    exit 1
fi

if [ -z "$VITE_AUTH_USERNAME" ]; then
    echo "❌ Error: VITE_AUTH_USERNAME environment variable is required"
    echo "   Set it in your .env file"
    exit 1
fi

if [ -z "$VITE_AUTH_PASSWORD" ]; then
    echo "❌ Error: VITE_AUTH_PASSWORD environment variable is required"
    echo "   Set it in your .env file"
    exit 1
fi

echo "🔗 Using GitHub repository: $GITHUB_REPO"

# Build and start the application
echo "📦 Building and starting containers..."
docker-compose up --build -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
timeout=60
counter=0

while [ $counter -lt $timeout ]; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Application is healthy and running on http://localhost:3000"
        echo "📊 Health check: http://localhost:3000/health"
        exit 0
    fi
    sleep 2
    counter=$((counter + 2))
done

echo "❌ Application failed to start within $timeout seconds"
echo "📋 Check logs with: docker-compose logs"
exit 1
