# EIDOS 5-Minute Quickstart Guide

Get EIDOS hybrid semantic search, adaptive recommendations, and Redis O(1) caching running in under 5 minutes.

---

## 1. Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0` (`corepack enable`)
- **Docker** (optional, for Redis 7 cache container)

---

## 2. Clone & Install

```bash
git clone https://github.com/your-org/eidos.git
cd eidos
pnpm install
cp .env.example .env
```

---

## 3. Start Redis Cache (Optional — Automatic Memory Fallback Included)

```bash
docker run -d --name eidos-redis -p 6379:6379 redis:7-alpine
docker exec -it eidos-redis redis-cli ping
# Expected output: PONG
```

---

## 4. Launch the Server

```bash
pnpm run dev
```

Your server is now live:
- **Interactive Studio UI**: `http://localhost:3000`
- **OpenAPI 3.0.3 Swagger Docs**: `http://localhost:3000/docs`
- **Health & Redis Diagnostics**: `http://localhost:3000/v1/health`

---

## 5. Run Your First Hybrid Search & Recommendation

### Hybrid Search (`POST /v1/search`)
```bash
curl -X POST http://localhost:3000/v1/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "query": "wireless noise cancelling headphones",
    "filters": { "category": "Electronics" },
    "limit": 5
  }'
```

### Adaptive Recommendations (`POST /v1/recommend`)
```bash
curl -X POST http://localhost:3000/v1/recommend \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "item_id": "item-1",
    "strategy": "adaptive",
    "limit": 5
  }'
```

---

## 6. Run the Redis Cache Benchmark

```bash
pnpm run benchmark:cache
```

Expected benchmark output:
- **Cache Hit Rate**: `80%+`
- **P95 Latency**: `< 10ms`
