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

# Install API dependencies only (API is self-contained)
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
RUN npm ci --only=production --ignore-scripts

# Copy built files from build stage
COPY --from=build /app/apps/api/dist ./dist

# Expose port (App Runner will override this, but good to document)
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "dist/main.js"]

