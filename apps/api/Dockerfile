# Multi-stage production Dockerfile for EIDOS Fastify REST API
FROM node:20-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json turbo.json ./
COPY packages/core ./packages/core
COPY packages/sdk ./packages/sdk
COPY apps/api ./apps/api

RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install --no-frozen-lockfile; fi
RUN pnpm --filter @eidos/core build || true
RUN pnpm --filter @eidos/api build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

USER node

CMD ["node", "apps/api/dist/server.js"]
