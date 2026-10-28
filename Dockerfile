# All-in-One Production Dockerfile for EIDOS (API /v1/* + Studio UI + Embedded Redis on port 3000)
# Usage:
#   docker build -t eidos/eidos .
#   docker run -p 3000:3000 eidos/eidos
FROM node:20-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY .npmrc* pnpm-lock.yaml* pnpm-workspace.yaml package.json tsconfig.json turbo.json server.ts ./
COPY packages/core ./packages/core
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api
COPY apps/workspace ./apps/workspace

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @eidos/core build
RUN pnpm --filter @eidos/sdk build
RUN pnpm --filter @eidos/api build
RUN pnpm run build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV EIDOS_PORT=3000
ENV HOST=0.0.0.0
ENV EIDOS_SNAPSHOT_PATH=/app/data/catalog.snapshot.json
ENV REDIS_URL=redis://127.0.0.1:6379
ENV CACHE_TTL_SECONDS=300
ENV AIL_ENABLED=true
ENV TRANSFORMERS_CACHE=/tmp/transformers-cache

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/sdk ./packages/sdk
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data /tmp/transformers-cache && chown -R node:node /app /tmp/transformers-cache

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

USER node

CMD ["npx", "tsx", "server.ts"]
