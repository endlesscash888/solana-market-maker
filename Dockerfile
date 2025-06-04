FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git curl

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies to reduce image size
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 -G nodejs

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R botuser:nodejs logs

# Switch to non-root user
USER botuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot health check passed') || exit 1"

# Start the application
CMD ["node", "dist/index.js"]
