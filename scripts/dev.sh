#!/bin/bash

echo "🧪 Running development setup..."

# Start Redis in background if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis server..."
    redis-server --daemonize yes
fi

echo "Building application..."
npm run build

echo "Starting bot in development mode..."
NODE_ENV=development npm start
