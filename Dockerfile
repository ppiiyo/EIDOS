# ==============================================================================
# Stage 1: Builder (Monorepo: @eidos/core + @eidos/sdk + @eidos/api + @eidos/workspace)
# ==============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/api/package.json ./apps/api/
COPY apps/workspace/package.json ./apps/workspace/

RUN pnpm install --frozen-lockfile

# Copy full source
COPY packages ./packages
COPY apps ./apps
COPY public ./public
COPY index.html vite.config.ts ./

# Build core, sdk, api, and workspace SPA
RUN pnpm --filter @eidos/core build \
 && pnpm --filter @eidos/sdk build \
 && pnpm --filter @eidos/api build \
 && pnpm build

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init wget \
 && addgroup -g 1001 -S nodejs \
 && adduser -S eidos -u 1001 -G nodejs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV REDIS_URL=redis://127.0.0.1:6379
ENV EIDOS_DATA_DIR=/app/data/db
ENV EIDOS_SNAPSHOT_PATH=/app/data/catalog.snapshot.json
ENV EIDOS_WAL_PATH=/app/data/catalog.wal.jsonl

COPY --from=builder --chown=eidos:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=eidos:nodejs /app/package.json ./package.json
COPY --from=builder --chown=eidos:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=eidos:nodejs /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder --chown=eidos:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=eidos:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=eidos:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=eidos:nodejs /app/dist ./dist
COPY --from=builder --chown=eidos:nodejs /app/public ./public

RUN mkdir -p /app/data/db && chown -R eidos:nodejs /app/data

USER eidos

EXPOSE 3000
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/v1/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/server.js"]
