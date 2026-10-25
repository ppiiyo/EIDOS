# EIDOS v3.1 Release Notes

## 🎉 Highlights

EIDOS v3.1 brings production-ready load testing infrastructure, public demo access with IP-based rate limiting, balanced 9-category catalog seeding, and transparent roadmap and funding sections.

## ✨ New Features

### Public Demo API Key
- Use `eidos_public_demo_key_2026` (or `eidos_demo_key`) to test the API out-of-the-box
- Rate limited to 10 requests per minute per client IP
- Allows immediate evaluation on `/v1/search`, `/v1/recommend`, and `/v1/catalog/stats`

### Load Testing Infrastructure
- Complete k6 + Prometheus + Grafana load test suite
- 4 pre-configured test scenarios: `baseline`, `stress`, `spike`, `soak`
- Automated analysis script (`load-testing/scripts/analyze-results.sh`) and report generator (`load-testing/scripts/generate-report.js`)

### Redis Caching in Production
- Full Redis 7 integration (`SCAN + UNLINK`, `SingleFlight`, and L1 `LRUQueryCache` fallback)
- O(1) lookups with automatic TTL
- Eliminates thundering herds on concurrent popular queries

## 🔧 Bug Fixes

- `/v1/health`, `/v1/health/live`, `/v1/health/ready`, and `/v1/catalog/stats` are now fully public (no auth required)
- Category balance resolved: all 9 categories (including `Movies`) now have 500+ items each in the 5,005 catalog
- Improved error messages for rate limit exceeded (429)

## 📚 Documentation

- Added Roadmap section (EN + RU)
- Added Funding and Investment section (EN + RU)
- Updated CHANGELOG.md with v3.1.0 changes
- Created load testing guide in `load-testing/README.md`

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/ppiiyo/EIDOS.git
cd EIDOS

# Install dependencies and start unified dev server
corepack enable && corepack pnpm install
corepack pnpm dev

# Try the API with the public demo key
curl -X POST http://localhost:3000/v1/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eidos_public_demo_key_2026" \
  -d '{"query":"наушники","limit":5}'
```

## 🗺️ What's Next

- Distributed HNSW sharding for 100K+ items
- Enterprise connectors (PostgreSQL CDC, MongoDB Change Streams)
- Cross-encoder neural reranker on CPU (<15ms)
