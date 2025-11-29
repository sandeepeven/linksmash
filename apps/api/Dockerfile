# Dockerfile for LinkSmash API
# 
# This Dockerfile builds and runs the Fastify backend API service.
# It handles the Nx monorepo structure and builds the TypeScript code.

# Use Node.js LTS version as base image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Dependencies stage
FROM base AS dependencies

# Copy root package files (needed for tsconfig.base.json reference)
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy API package files
COPY apps/api/package*.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/

# Install API dependencies (including devDependencies for building)
WORKDIR /app/apps/api
RUN npm ci

# Build stage
FROM dependencies AS build

# Copy API source files
WORKDIR /app
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY tsconfig.base.json ./

# Build the API
WORKDIR /app/apps/api
RUN npm run build

# Production stage
FROM base AS production

# Copy package files
WORKDIR /app/apps/api
COPY apps/api/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from build stage
COPY --from=build /app/apps/api/dist ./dist

# Copy startup script
COPY apps/api/start.sh ./start.sh

# Verify dist/main.js exists (for debugging)
RUN ls -la dist/ && test -f dist/main.js || (echo "ERROR: dist/main.js not found!" && exit 1)

# Make startup script executable
RUN chmod +x start.sh

# Expose port (App Runner will set this via PORT env var)
EXPOSE 8080

# Set default environment variables (can be overridden by App Runner)
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check (uses PORT env var, defaults to 8080)
# Increased start-period to give more time for app to start
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || '8080') + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server using wrapper script
CMD ["./start.sh"]

