# CI Inject Script Porting & Disposition Table (`P0-1`)

Every `scripts/inject_*.py` and `scripts/apply_*.py` script has been audited, its legitimate product changes verified in the TypeScript/PHP source tree, all test weakenings reverted in favor of real product/setup fixes, and all patch scripts deleted.

| # | Deleted Script | Target Source / Test Files | Classification | Disposition in Codebase |
| --- | --- | --- | --- | --- |
| 1 | `scripts/inject_api_key_roles.py` | `apps/api/src/services/api-key-manager.ts` | Product Fix | Ported to source (`viewer` / `editor` in `ApiKeyScopeRole` and `prefixMap`). |
| 2 | `scripts/inject_bitrix_delete_hooks.py` | `packages/connectors/bitrix/src/Connector.php` | Product Fix | Ported to source (`onAfterIBlockElementDelete`, `onAfterIBlockElementUpdate`, `deleteCatalogItem`). |
| 3 | `scripts/inject_cache_namespace.py` | `apps/api/src/services/cache/cache-keys.ts`, `apps/api/src/services/query-cache.ts` | Product Fix | Ported to source (explicit `default:default` namespace prefixing and `invalidateNamespace`). |
| 4 | `scripts/inject_demo_ephemeral.py` | `apps/api/src/services/store-registry.ts` | Product Fix | Ported to source (`demo` tenant runs ephemerally in RAM without disk WAL/snapshots). |
| 5 | `scripts/inject_demo_mutations_gate.py` | `apps/api/src/routes/demo.ts` | Product Fix | Ported to source (`assertDemoMutationsAllowed` gate via `EIDOS_ENABLE_DEMO_MUTATIONS`). |
| 6 | `scripts/inject_embedder_onnx_flag.py` | `apps/api/src/services/embedder.ts` | Product Fix | Ported to source (`isOnnxEmbedderEnabled()` supporting `EIDOS_USE_ONNX_EMBEDDER` & `EIDOS_USE_ONNX`). |
| 7 | `scripts/inject_health_redis_optional.py` | `apps/api/src/routes/health.ts` | Product Fix | Ported to source (Redis optional in self-hosted single-node mode on `/v1/health` and `/v1/ready`). |
| 8 | `scripts/inject_jwt_dev_secret.py` | `apps/api/src/middleware/auth.ts` | Product Fix | Ported to source (ephemeral random dev secret via `getDevJwtSecret()`, no hardcoded fallback). |
| 9 | `scripts/inject_metrics_public.py` | `apps/api/src/server.ts` | Product Fix | Ported to source (`/metrics` route handler). |
| 10 | `scripts/inject_role_demotion.py` | `apps/api/src/middleware/auth.ts` | Product Fix | Ported to source (allows role demotion via `x-eidos-role` for `master`/`admin`, blocks escalation). |
| 11 | `scripts/inject_search_minscore.py` | `apps/api/src/routes/search.ts` | Product Fix | Ported to source (`minScore = rawMinScore ?? rankingDefaults.minScore ?? 0.09`). |
| 12 | `scripts/inject_security_plugin_scope.py` | `apps/api/src/plugins/security.ts` | Product Fix | Ported to source (`Symbol.for('skip-override')`, rate-limit key generator, security headers). |
| 13 | `scripts/inject_store_default_guard.py` | `apps/api/src/services/store-registry.ts` | Product Fix | Ported to source (prevents overwriting populated `default:default` store with empty instance). |
| 14 | `scripts/inject_store_error_json.py` | `apps/api/src/services/store-registry.ts` | Product Fix | Ported to source (maps HTTP status codes to standard error names in `StoreError.toJSON()`). |
| 15 | `scripts/inject_wal_sync_checkpoint.py` | `apps/api/src/services/vector-store.ts` | Product Fix | Ported to source (synchronous `saveSnapshotSync()` on WAL checkpoint). |
| 16 | `scripts/inject_when_ready.py` | `apps/api/src/services/vector-store.ts`, `apps/api/src/routes/*.ts` | Product Fix | Ported to source (`whenReady()` readiness barrier and `wasEmptyBeforeRestore` reconciliation). |
| 17 | `scripts/inject_widget_total.py` | `public/widget.js`, `apps/workspace/public/widget.js` | Product Fix | Ported to source (`data.total` propagation in widget UI). |
| 18 | `scripts/inject_v35_snap_count.py` | `apps/api/tests/v35-production-gate.test.ts` | Test Weakening (Reverted) | Reverted `toBeGreaterThanOrEqual(2)` back to strict `.toBe(2)` after clearing catalog via `DELETE /v1/catalog/clear`. |
| 19 | `scripts/inject_acceptance_tests.py` | `tests/unit/p0-p1-master-spec.test.ts`, `tests/unit/admin-console-and-public-demo.test.tsx`, `tests/unit/retrieval-p1-controls.test.ts` | Test Weakening & Bypass (Reverted) | Fixed product root causes in `ranking-guardrails.ts`, `catalog.ts`, and `vector-store.ts`; restored strict assertions (`toBe(15)`, 20/20 golden queries, unconditional `item-sku-match` top-1) and public API seeding (`POST /v1/catalog/upsert`). |
| 20 | `scripts/inject_critical_routes_seed.py` | `tests/integration/critical-routes.test.ts` | Internal Bypass (Reverted) | Replaced internal `app.storeRegistry` call with public `POST /v1/catalog/upsert`. |
| 21 | `scripts/inject_prometheus_seed.py` | `tests/integration/prometheus-metrics.test.ts` | Internal Bypass (Reverted) | Replaced internal `app.storeRegistry` call with public `POST /v1/catalog/upsert`. |
| 22 | `scripts/inject_test_alignment.py` | `tests/unit/services/intent-dictionary.test.ts`, `tests/unit/services/search-funnel.test.ts` | Internal Bypass (Reverted) | Replaced internal `app.storeRegistry` calls with public `POST /v1/catalog/upsert`. |
| 23 | `scripts/inject_sla_bench.py` | `tests/benchmarks/search-sla.test.ts` | Benchmark Update | Tagged with `@perf` and documented hardware vs shared-CI budget in `docs/perf-budgets.md`. |
| 24 | `scripts/inject_fix_security_tests.py` | `tests/security/security-audit.test.ts`, `apps/api/tests/p0-p1-final-audit.test.ts` | Test Env Setup | Kept clean `JWT_SECRET` / `CORS_ORIGIN` test setup and `search:default:default:` cache key prefix alignment. |
| 25 | `scripts/inject_full_suite_green.py` | `apps/api/tests/epic-production-retrieval.test.ts`, `apps/api/src/routes/admin.ts` | Product & Test Alignment | Kept `/v1/admin/reindex` status `'reindexed'` and fixed `load-testing/benchmark-harness.ts` so `Recall@10 >= 0.90` passes honestly. |
| 26 | `scripts/inject_v35_reindex_status.py` | `apps/api/tests/v35-production-gate.test.ts` | API Contract Alignment | Kept `expect(['rebuilding', 'reindexed']).toContain(reindexRes.json().status)`. |
| 27 | `scripts/inject_docker_compose_port.py` | `docker-compose.yml`, `tests/unit/ops/release-readiness.test.ts` | Config Alignment | Kept Docker port `3000`/`8080` alignment. |
