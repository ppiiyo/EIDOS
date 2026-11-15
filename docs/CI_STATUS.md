# CI status

## Required gates (`ci.yml`)

| Job | Command | Notes |
|-----|---------|--------|
| Typecheck | `npm run lint` (`tsc` workspace / core / sdk / api) | required |
| Widget sync | `bash scripts/sync_widget.sh --check` | required |
| Full suite | `npm test` (`vitest run`) | required (Node 20 + 22) |
| Coverage | `vitest run --coverage packages/core/src/tests` | core thresholds 65% |
| PHP | `php -l` + `php scripts/verify-bitrix-autoload.php` | required |
| Build | `npm run build` (core + sdk + workspace) | required |
| Smoke | `bash scripts/smoke.sh` | required |

## Local verification

- `vitest run` → **114/114 test files (515/515 tests)**
- `EIDOS_RUN_BENCH=1 npx vitest run apps/api/tests/epic-production-retrieval.test.ts` → **9/9**
- `bash scripts/smoke.sh` → **6/6 checks passed**

## Optional heavy benchmark suite

- `apps/api/tests/epic-production-retrieval.test.ts` — 1k/10k SKU benchmark harness; enable with `EIDOS_RUN_BENCH=1`

## Product invariants covered

- Streaming Snapshot (NDJSON / JSON-Lines) + `.hnsw.bin` SHA-256 verification → bounded WAL + `whenReady`
- Demo tenant ephemeral (`demo:demo`, never mutates `default`) with singleflight load deduplication
- Namespaced L1/L2 cache keys (`tenantId:indexName:catalogVersion`) + scoped invalidation
- Honest Recall@K evaluation (`HNSWIndex.searchExact` / `evaluateRecallAtK`)
- RBAC enforcement, JWT `jti` revocation (`POST /v1/admin/jwt/revoke`), authenticated `/metrics` (unless `EIDOS_METRICS_PUBLIC=1`)
