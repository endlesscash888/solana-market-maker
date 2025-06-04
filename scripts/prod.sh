#!/bin/bash

echo "🚀 Starting production deployment..."

# Build and start with Docker Compose
docker-compose up -d --build

echo "Waiting for services to start..."
sleep 10

# Show status
docker-compose ps
docker-compose logs --tail=20 solana-bot

echo "✅ Production deployment started"
echo "View logs: docker-compose logs -f solana-bot"
echo "Stop: docker-compose down"
