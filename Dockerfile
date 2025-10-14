# Runtime Dockerfile for pre-built MCP server
# This Dockerfile is for the destination directory that already contains:
# - dist/ folder with compiled JavaScript and tools.json
# - package.json and package-lock.json
# - node_modules/ with production dependencies

FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the pre-built dist folder with tools.json
COPY dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# MCP servers communicate via stdio
ENTRYPOINT ["node", "dist/src/index.js"]
