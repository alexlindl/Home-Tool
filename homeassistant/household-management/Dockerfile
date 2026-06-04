# Household Management Add-on for Home Assistant
# Multi-stage build: backend + web → production image with PostgreSQL + nginx

# ==============================================================================
# Stage 1: Build the backend (Node.js TypeScript → dist)
# ==============================================================================
FROM node:18-alpine AS backend-builder

WORKDIR /build/backend

# Copy package files and install all dependencies (including devDependencies for build)
COPY backend/package*.json ./
RUN npm ci

# Copy source code and build
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Copy non-TypeScript assets to dist
RUN cp src/db/schema.sql dist/db/schema.sql && \
    mkdir -p dist/db/migrations && \
    cp src/db/migrations/*.sql dist/db/migrations/

# ==============================================================================
# Stage 2: Build the web app (React/Vite → static files)
# ==============================================================================
FROM node:18-alpine AS web-builder

WORKDIR /build/web

# Copy package files and install dependencies
COPY web/package*.json ./
RUN npm ci

# Copy source code and build with base path support for ingress
COPY web/ .
RUN npm run build

# ==============================================================================
# Stage 3: Production image
# ==============================================================================
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.19
FROM ${BUILD_FROM}

# Install runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    postgresql16 \
    postgresql16-client \
    nginx \
    bash \
    curl

# Create required directories
RUN mkdir -p /data/postgres \
    /run/postgresql \
    /run/nginx \
    /app/backend \
    /app/web \
    /var/log/nginx \
    /var/lib/nginx/tmp

# Set up PostgreSQL data directory ownership
RUN chown -R postgres:postgres /data/postgres /run/postgresql

# Copy built backend
COPY --from=backend-builder /build/backend/dist /app/backend/dist
COPY --from=backend-builder /build/backend/package*.json /app/backend/

# Install production dependencies for the backend
WORKDIR /app/backend
RUN npm ci --omit=dev && npm cache clean --force

# Copy built web app
COPY --from=web-builder /build/web/dist /app/web

# Copy database scripts
COPY scripts/init-db.sh /app/scripts/init-db.sh
COPY backend/src/db/schema.sql /app/backend/schema.sql
COPY backend/src/db/migrations/ /app/backend/migrations/

# Copy add-on specific files
COPY homeassistant/household-management/nginx.conf /etc/nginx/http.d/default.conf
COPY homeassistant/household-management/run.sh /app/run.sh

# Make scripts executable
RUN chmod +x /app/run.sh /app/scripts/init-db.sh

WORKDIR /app

EXPOSE 8023

ENTRYPOINT ["/app/run.sh"]
