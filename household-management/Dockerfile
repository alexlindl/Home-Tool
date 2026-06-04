# Household Management Add-on for Home Assistant
# Self-contained build: all source files are within this directory

ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.19
FROM node:18-alpine AS backend-builder

WORKDIR /build/backend
COPY backend-package.json ./package.json
RUN npm install
COPY backend-tsconfig.json ./tsconfig.json
COPY backend-src ./src
RUN npm run build
RUN cp src/db/schema.sql dist/db/schema.sql && \
    mkdir -p dist/db/migrations && \
    (cp src/db/migrations/*.sql dist/db/migrations/ 2>/dev/null || true)

FROM node:18-alpine AS web-builder
WORKDIR /build/web
COPY web-package.json ./package.json
RUN npm install
COPY web-tsconfig.json ./tsconfig.json
COPY web-src ./src
COPY web-src/vite-env.d.ts ./vite-env.d.ts
COPY web-index.html ./index.html
COPY web-vite.config.ts ./vite.config.ts
RUN npm run build

FROM ${BUILD_FROM}

RUN apk add --no-cache \
    nodejs \
    npm \
    postgresql16 \
    postgresql16-client \
    nginx \
    bash \
    curl

RUN mkdir -p /data/postgres /run/postgresql /run/nginx \
    /app/backend /app/web /var/log/nginx /var/lib/nginx/tmp

RUN chown -R postgres:postgres /data/postgres /run/postgresql

COPY --from=backend-builder /build/backend/dist /app/backend/dist
COPY --from=backend-builder /build/backend/package.json /app/backend/

WORKDIR /app/backend
RUN npm install --omit=dev && npm cache clean --force

COPY --from=web-builder /build/web/dist /app/web

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /app/run.sh
COPY scripts/init-db.sh /app/scripts/init-db.sh
COPY backend-src/db/schema.sql /app/backend/schema.sql
COPY backend-src/db/migrations/ /app/backend/migrations/
RUN chmod +x /app/run.sh /app/scripts/init-db.sh

WORKDIR /app
EXPOSE 8023

ENTRYPOINT ["/app/run.sh"]
