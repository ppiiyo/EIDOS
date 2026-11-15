# EIDOS — Pilot Readiness

## Green verification suites

| Suite | Result |
|-------|--------|
| Full Vitest suite (`npm test`) | 114/114 files (515/515 tests) |
| P0-1 … P0-5 & P1-1 … P1-3 hardening suites | 28/28 |
| Self-Hosted Golden Path & WooCommerce/Bitrix parity | 11/11 |
| Live HTTP Smoke (`bash scripts/smoke.sh`) | 6/6 |

## Product invariants

1. Streaming Snapshot (`.ndjson` / `.json`) + `.hnsw.bin` SHA-256 verification + bounded WAL (`maxInMemoryOperations`)
2. Demo tenant **ephemeral** (`demo:demo`, no disk persistence, singleflight load deduplication)
3. `/metrics` and `/v1/analytics/funnel-event` require authentication by default (`EIDOS_METRICS_PUBLIC=1` opt-in for internal Prometheus)
4. `StoreError.toJSON` uses standard HTTP error names (`Not Found`, `Conflict`, `Too Many Requests`, `Gateway Timeout`)
5. RBAC: admin/master demote via `x-eidos-role` (never escalate); JWT `jti` revocation via `POST /v1/admin/jwt/revoke`
6. Health/ready: `server.ts` delegates `/health` and `/v1/health` to Fastify (`buildServer()`) and returns `503 API_INIT_FAILED` on fatal init error
7. Security plugin: `CORS` with `Vary: Origin`, bounded rate-limit key rotation, and PII query redaction in request logs
8. `StoreRegistry` isolates L1/L2 caches and HNSW indexes per `tenantId:indexName`
9. Storefront widget `public/widget.js` ≡ `apps/workspace/public/widget.js` (`bash scripts/sync_widget.sh --check`) with `ru`/`en` i18n, `Intl.NumberFormat` currency support, and `urlTemplate` resolution

## Pilot in 15 minutes

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
chmod +x scripts/install-pilot.sh
./scripts/install-pilot.sh
# credentials written to .env.pilot (chmod 600); API on :3000
bash scripts/smoke.sh http://127.0.0.1:3000
```

Or full stack + monitoring:

```bash
# .env with EIDOS_MASTER_KEY + JWT_SECRET (≥24 chars)
docker compose up --build -d
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Prometheus :9090  Grafana :3001
```

Import catalog → connect Bitrix (`packages/connectors/bitrix`) or WooCommerce (`packages/connectors/woocommerce`) or embed `/widget.js`.
