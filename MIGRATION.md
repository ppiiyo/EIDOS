# EIDOS v3.x → v4.0 Migration Guide

## 1. API Key Prefix Standardization

In v4.0, generated API keys use canonical role prefixes enforced by both `apps/api` and `public/widget.js`:

| Role | v3.x prefix | v4.0 canonical prefix | Allowed in browser (`widget.js`) |
|---|---|---|---|
| `master` | `eidos_master_` | `eidos_mk_` | ❌ Forbidden |
| `admin` | `eidos_admin_` | `eidos_ak_` | ❌ Forbidden |
| `merchandiser` | `eidos_merchandiser_` | `eidos_merch_` | ❌ Forbidden |
| `search` (public) | `eidos_search_` | `eidos_pk_` | ✅ Allowed |

**Backward compatibility:** Existing keys stored in `api_keys.json` continue to work because authentication verifies the SHA-256 hash in `ApiKeyManager`, not the string prefix. However, if you embed a legacy `eidos_search_...` key in `public/widget.js`, both `eidos_pk_` and `eidos_search_` are accepted by the storefront widget.

## 2. Public Demo Key (`EIDOS_PUBLIC_DEMO_KEY`)

Hardcoded fallback demo keys (`eidos_demo_key`, `eidos_public_demo_key`, `eidos_demo_key_2026_public`) have been **removed** and added to the weak-key blacklist.

- To enable `/public-demo`, set `EIDOS_PUBLIC_DEMO_KEY` in `.env` (minimum 24 random characters in production).
- The demo key is strictly isolated to `tenantId = 'demo'` and `index = 'demo'`.

## 3. Upsert & HNSW Snapshot Upgrade

- HNSW leaf-shortcut (`fastInsertLeaf`) has been removed to guarantee full multi-layer graph connectivity.
- After upgrading to v4.0, run a one-time snapshot rebuild (`POST /v1/demo/load` for demo or re-import your YML feed via `POST /v1/admin/yml-sync/run`) so any legacy single-layer nodes are re-indexed across all HNSW layers.

## 4. Unified Server Health Delegation & Demo Lifecycle (P0-2)

- **No Fake Fast-Path `/health`**: `server.ts` no longer returns a synthetic `200 OK` (`itemsIndexed: 0`) on `/health` before Fastify has initialized. Instead, `/health` and `/ready` await Fastify initialization and delegate to `healthRoutes`. Use `/live` or `/v1/health/live` for container liveness probes during cold start.
- **Explicit HTTP 503 on API Startup Failure**: If `buildServer()` fails during startup, all `/v1/*`, `/health`, `/ready`, and `/metrics` endpoints immediately return HTTP `503` with `code: "API_INIT_FAILED"` instead of hanging client connections.
- **Demo Seed Singleflight & Status**: `POST /v1/demo/load` now deduplicates concurrent seed requests (`deduplicated: true`) and returns immediately when the requested scale is already loaded (`idempotent: true`). Use `GET /v1/demo/status` to poll `'idle' | 'seeding' | 'ready' | 'error'`.

## 5. Multilingual ONNX Embedder, Lexical-Only Mode & Snapshot Model Verification (P0-3)

- **Multilingual ONNX Model Default**: When ONNX mode is enabled (`EIDOS_EMBEDDER_MODE=onnx` or `EIDOS_USE_ONNX_EMBEDDER=true`), the default model is now `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-d, RU+EN+50 languages) instead of English-only `all-MiniLM-L6-v2`. Override via `EIDOS_ONNX_MODEL`.
- **Explicit `EIDOS_EMBEDDER_MODE=lexical-only`**: For air-gapped or CPU-constrained environments without ONNX weights, set `EIDOS_EMBEDDER_MODE=lexical-only` to run pure BM25+ lexical retrieval (`weightsEffective = { lexical: 1, semantic: 0 }`) without synthetic hash vectors.
- **Snapshot Model Verification (`.meta.json`)**: Snapshots now record `embeddingSpaceId`, `embeddingModel`, and `embeddingMode` in `<snapshot>.meta.json`. Switching models throws `EmbeddingSpaceMismatchError` (fail-closed) until `POST /v1/admin/reindex` is executed.

## 6. Streaming Snapshots, `.hnsw.bin` SHA-256 Verification & Bounded WAL (P0-4)

- **Streaming Snapshot Read/Write**: Snapshots are now written in 250-item chunks (`json-lines-array` or `.ndjson` when `EIDOS_SNAPSHOT_FORMAT=ndjson`) and read line-by-line via `readline`, eliminating V8 `RangeError: Invalid string length` on 100k+ SKU catalogs while remaining backward-compatible with legacy single-line `.json` snapshots.
- **`.hnsw.bin` SHA-256 Integrity Check**: `<snapshot>.meta.json` now records `hnswSha256` and `hnswByteLength`. If `.hnsw.bin` is corrupted or truncated, `loadSnapshotFromDisk` detects the SHA-256 mismatch and automatically rebuilds the HNSW graph from catalog items.
- **Bounded WAL & Safe Checkpoint Rollback**: `WriteAheadLog` now caps in-memory operations at `maxInMemoryOperations` to prevent OOM when disk checkpoints fail, and preserves the on-disk `.wal.jsonl` file until a snapshot write succeeds.

## 7. Security Hardening: `/metrics`, Funnel Auth, CORS & Rate Limiting (P0-5)

- **Secret File Permissions (`install-pilot.sh`)**: `scripts/install-pilot.sh` creates `.env` inside a `umask 077` subshell (`0600` permissions from creation), generates `JWT_SECRET` and `EIDOS_PUBLIC_DEMO_KEY`, defaults `CORS_ORIGIN` to explicit localhost origins instead of `*`, and never prints secret values during `--dry-run`.
- **`/metrics` Authentication**: `GET /metrics` now executes the `authenticate` preHandler. When `EIDOS_REQUIRE_METRICS_AUTH=true` or `NODE_ENV=production`, requests must provide an `admin` or `master` API key.
- **Funnel Event Authentication & Rate Limiting**: `POST /v1/analytics/funnel/event` (and `/v1/analytics/funnel-event`) now requires authentication (`search`, `merchandiser`, `admin`, `master`, or `EIDOS_PUBLIC_DEMO_KEY` on tenant `demo`) and enforces per-IP rate limiting (`EIDOS_FUNNEL_RATE_LIMIT_MAX_PER_MIN`, default `180/min`).
- **Strict CORS & `Vary: Origin`**: Untrusted `Origin` headers no longer fall back to `origins[0]` in `Access-Control-Allow-Origin`, and responses always set `Vary: Origin`.
- **Rate Limit Key Rotation Protection**: Unrecognized `x-api-key` headers no longer receive isolated rate-limit buckets; requests with unrecognized keys are rate-limited by client IP (`ip:${req.ip}`).
- **Query Log Privacy**: `summarizeQueryForLog` redacts raw search text (`queryPreview: '[REDACTED]'`) unless `EIDOS_LOG_RAW_QUERIES=true`.

## 8. Honest HNSW Recall@K Benchmark, JWT Revocation & Hardened YML Parser (P1-1)

- **Brute-Force Ground Truth & Recall@K (`HNSWIndex.searchExact` / `evaluateRecallAtK`)**: `HNSWIndex` and `scripts/benchmark.ts` (`runRecallAndLatencyBenchmark`) now measure true `recallAtK` against exact Float32 cosine brute-force ground truth alongside `p50/p95/p99` latency and memory stats.
- **JWT Revocation (`POST /v1/admin/jwt/revoke`)**: `signJwtToken` automatically embeds a unique `jti` claim. Administrators can immediately revoke active JWTs by `jti` or raw token via `POST /v1/admin/jwt/revoke`; revoked tokens return `401 Unauthorized`.
- **Streaming Admin Snapshots (`POST /v1/snapshots`)**: Admin snapshot creation now delegates to `store.saveSnapshotAsync(absPath)` (streaming chunked write + `.hnsw.bin` + `.meta.json`) and computes SHA-256 via file stream instead of single-string `JSON.stringify`.
- **XXE-Safe Linear YML Parser**: `parseYmlOrCommerceMl` and `POST /v1/catalog/import-yml` reject `<!ENTITY` / `<!DOCTYPE ... [` payloads with `400 XML_ENTITY_FORBIDDEN`, decode numeric XML character references, and index `<param name="...">` attributes.

## 9. Multi-Tenant Cache Isolation, Honest Cluster Status & Pilot Bootstrap Hardening (P1-2)

- **Tenant & Index Cache Isolation (`CacheKeys` & `recommend.ts` / `indexes.ts`)**: `CacheKeys.recommend`, `CacheKeys.userRecommend`, and `CacheKeys.catalogStats` now scope keys by `tenantId:indexName`, and `POST /v1/indexes/:name/documents` invalidates only the affected `tenantId:indexName` namespace without flushing other tenants' caches.
- **Cluster Status Truth (`GET /v1/cluster/status`)**: `ClusterStateCoordinator.getClusterStatus()` explicitly reports `deploymentMode: 'single-node'` when `CLUSTER_MODE !== 'true'` and `'clustered'` when `CLUSTER_MODE=true`.
- **Pilot Bootstrap & Smoke Script (`deploy/pilot/install.sh`, `docker-compose.pilot.yml`, `scripts/smoke.sh`)**: `deploy/pilot/install.sh` creates `.env.pilot` with `0600` permissions (`umask 077`), generates `JWT_SECRET` and `EIDOS_PUBLIC_DEMO_KEY`, enables `EIDOS_ENABLE_DEMO_MUTATIONS=true`, and replaces `CORS_ORIGIN=*` with explicit localhost origins. Added `scripts/smoke.sh` for end-to-end smoke verification.

