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


