# EIDOS — Pilot & Production Readiness

Last verified: **2026-11-14**

## Green Test & Verification Gates

| Gate | Command | Status |
|------|---------|--------|
| Workspace Typecheck | `pnpm lint` | **PASS** |
| Full Test Suite (114+ suites) | `pnpm test` | **PASS** |
| `@eidos/core` Coverage (`≥80%` lines, `≥75%` branches) | `pnpm test:coverage` | **PASS (84.9% lines / 75.6% branches)** |
| Live HTTP Smoke Suite | `bash scripts/smoke.sh` | **PASS (6/6 checks)** |

## Product Invariants Verified

1. **Snapshot → WAL ordering + `whenReady` / `setReadyPromise`**: Streaming 64 KB chunked snapshot reader with `.hnsw.bin` SHA-256 verification and bounded WAL.
2. **Ephemeral Demo Tenant**: `demo:demo` runs in isolated storage without touching `default:default`, with singleflight seeding on `POST /v1/demo/load` and status polling on `GET /v1/demo/status`.
3. **Production Security Hardening**:
   - `/metrics` requires `admin` or `master` key when `EIDOS_REQUIRE_METRICS_AUTH=true` or `NODE_ENV=production`.
   - `POST /v1/analytics/funnel/event` requires authentication and enforces per-IP rate limiting.
   - Strict CORS with `Vary: Origin` (never falls back to `origins[0]` for untrusted origins).
   - Unrecognized API keys share an IP rate-limit bucket (`ip:${req.ip}`).
   - `install-pilot.sh` and `deploy/pilot/install.sh` create `.env` / `.env.pilot` with `0600` (`umask 077`) permissions.
4. **Honest Retrieval & Benchmarks**:
   - Multilingual ONNX default (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384-d) and explicit `EIDOS_EMBEDDER_MODE=lexical-only` mode.
   - `HNSWIndex.searchExact` & `evaluateRecallAtK` compute true Recall@K against brute-force cosine ground truth.
   - `PRODUCT_CATEGORY_FAMILIES` separated into `demo-product-category-families.ts` (`EIDOS-104`) and `totalIsApproximate` reported on `/v1/search` (`EIDOS-105`).
5. **Storefront Widget, SDK & Connectors**:
   - `public/widget.js` supports `locale` (`ru`/`en`), `currency` (`RUB`/`USD`/`EUR`), and `urlTemplate`, automatically synced with `apps/workspace/public/widget.js` via Vite build plugin and `scripts/sync_widget.sh`.
   - `@eidos/sdk` and Python SDKs support `tenantId`, `indexName`, `suggest()`, `upsertBatch()`, and `ready()`.
   - Canonical packagers `pnpm pack:bitrix` and `pnpm pack:woo`.

## Pilot in 15 Minutes

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
chmod +x deploy/pilot/install.sh
./deploy/pilot/install.sh
curl -s http://localhost:3001/v1/ready | jq
```

## Honest Performance Scope

- Latency depends on hardware CPU, catalog size, `efSearch`, and cache hit rate. Measure on your target host using `pnpm benchmark` and `docs/perf-budgets.md`.
- Do not claim fixed sub-15ms p95 at 100k SKU without running `pnpm benchmark` on the target hardware.
