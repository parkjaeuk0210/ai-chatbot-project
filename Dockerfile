# Production Dockerfile for FERA AI Chatbot

# Build stage
FROM node:20-alpine AS builder

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/server.js ./
COPY --from=builder --chown=nodejs:nodejs /app/api ./api
COPY --from=builder --chown=nodejs:nodejs /app/index.html ./
COPY --from=builder --chown=nodejs:nodejs /app/index-secure.html ./
COPY --from=builder --chown=nodejs:nodejs /app/secure.html ./
COPY --from=builder --chown=nodejs:nodejs /app/sw.js ./
COPY --from=builder --chown=nodejs:nodejs /app/manifest.json ./
COPY --from=builder --chown=nodejs:nodejs /app/icons ./icons
COPY --from=builder --chown=nodejs:nodejs /app/js ./js
COPY --from=builder --chown=nodejs:nodejs /app/css ./css

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]