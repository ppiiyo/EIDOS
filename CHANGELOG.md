# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.2.0] - 2026-10-25

### Added
- **Zero-ETL Database Connectors** (`apps/api/src/connectors/`):
  - `PostgresCDCConnector` for logical replication (`wal2json` / `pgoutput`) `INSERT`, `UPDATE`, and `DELETE` batch ingestion with automatic 384-d vectorization and cache invalidation.
  - `MongoChangeStreamConnector` for MongoDB Change Streams (`insert`, `update`, `replace`, `delete`) with resume-token idempotency.
- **Multi-Tenancy, RBAC & Audit Logging** (`apps/api/src/services/multi-tenancy.ts`, `apps/api/src/routes/enterprise.ts`):
  - `TenantNamespaceManager` providing isolated `VectorStore` namespaces per tenant (`X-Tenant-ID` or `eidos_tenant_<id>_<key>`).
  - `RBACManager` enforcing `admin`, `editor`, and `viewer` permissions across API mutations and administrative endpoints.
  - `AuditLogger` with immutable audit trail (`GET /v1/audit/logs`, `POST /v1/merchandising/rules`, `GET /v1/tenants`).
- **Stage-2 Neural Cross-Encoder Reranker** (`apps/api/src/services/reranker.ts`):
  - `NeuralCrossEncoderReranker` performing sub-5ms CPU batched cross-attention token alignment and 384-d Hadamard/L1 interaction scoring (`rerank: true`, `rerankGamma`).

---

## [3.1.0] - 2026-10-24

### Added
- **Distributed HNSW Sharding & Query Router** (`packages/core/src/sharding/`):
  - `LSHShardRouter` with random hyperplane projections and Consistent Hashing virtual node ring.
  - `ShardCoordinator` and `DistributedResultMerger` (multi-shard RRF and MMR scatter-gather fusion).
- **Semantic Query Cache & Adaptive TTL** (`apps/api/src/services/cache/semantic-cache.ts`, `cache-keys.ts`):
  - `SemanticQueryCache` returning `x-cache: SEMANTIC_HIT` when query embedding cosine similarity `>= 0.95` (`eidos_cache_semantic_hits_total` metric).
  - `CacheKeys.getAdaptiveTTL()` dynamically scaling TTL (`3600s` hot, `300s` warm, `60s` long-tail) via sliding-window frequency tracking.
- **OpenTelemetry Tracing Spans** (`apps/api/src/tracing.ts`):
  - `traceSpan` instrumentation for `http.request`, `hnsw.search`, `bm25.lexical_search`, `rrf.fusion`, `mmr.diversification`, `redis.lookup`, and `cross_encoder.rerank`.
- Public demo API key for testing (`eidos_public_demo_key_2026`)
- Load testing infrastructure with k6, Prometheus, Grafana
- 4 test scenarios: baseline, stress, spike, soak
- Rate limiting for demo key (10 req/min per IP)
- Roadmap and Funding sections in README (EN + RU)
- Redis caching in production (replaced in-memory fallback)

### Fixed
- `/v1/health`, `/v1/health/live`, `/v1/health/ready`, and `/v1/catalog/stats` now publicly accessible (no auth required)
- Category balance: all 9 categories now have 500+ items each
- Cache stats now report `type: "redis"` when connected

### Changed
- Updated auth middleware with public endpoints whitelist
- Improved error messages for rate limit exceeded (429)

### Security
- Demo key rate limited to prevent abuse
- Public endpoints explicitly whitelisted

---

## [3.0.0] - 2026-10-24

### Added
- Redis caching layer with `SCAN + UNLINK` non-blocking invalidation
- `SingleFlight` for thundering herd prevention
- `InMemoryCache` with memory leak protection (`unref()` eviction)
- `CacheValidator` against cache poisoning (payload size & schema checks)
- Prometheus metrics for cache monitoring (`eidos_cache_*`)
- 228 tests across 47 suites

### Changed
- Dataset expanded from 18 to 5,005 items
- 9 categories fully populated and indexed in HNSW

---

## [2.0.0] - 2026-10-20

### Added
- Multi-language UI support (EN, RU, JA, ZH)
- CJK tokenization for BM25+
- Merchandising engine with real-time business boosts
- Information retrieval metrics (NDCG@10, MRR, Recall)

---

## [1.0.0] - 2026-09-18

### Added
- Complete monorepo architecture powered by pnpm workspaces.
- In-browser client-side ML embedding generation via `@xenova/transformers`.
- Production Fastify REST API (`apps/api`) with `/v1/recommend`, `/v1/search`, `/v1/catalog`, and `/v1/health`.
- Mathematical foundation package (`@eidos/core`) including SIMD-ready cosine similarity, Shannon entropy, and MMR re-ranking.
- Official client SDK (`@eidos/sdk`) for Node.js and TypeScript.
- Automated CI workflow with type checking, linting, and unit tests.
