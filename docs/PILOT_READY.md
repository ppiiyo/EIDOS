# EIDOS — Pilot Readiness (core)

Last verified locally: 2026-11-12

## Green suites (local)

- phase1-api-hardening (12)
- p0-registry-restart (tenant restart AC)
- v35-production-gate (10)
- production-hardening
- integration/* (critical-routes, prometheus, route-registration, …)
- multi-tenancy/tenant-isolation (RBAC demotion via `x-eidos-role`)
- connectors/bitrix-and-all-in-one-docker
- security/p0-regression
- unit/store-registry

Batch result: **99/99** on core API + security + connectors + multi-tenancy.

## Product invariants fixed

1. Snapshot → WAL ordering + `whenReady` / `setReadyPromise`
2. Demo tenant **ephemeral** (no disk) — no false `DEMO_DISABLED` 409
3. `/metrics` public for Prometheus scrapers
4. `StoreError.toJSON` uses real HTTP error names (`Not Found`, …)
5. RBAC: admin/master can demote via `x-eidos-role` (never escalate); roles `viewer`/`editor`
6. Health/ready: Redis optional
7. Security plugin: `skip-override` + rate-limit `keyGenerator`
8. `setDefaultStore` does not clobber non-empty catalog with empty store

## Pilot recipe (no engineer on client box beyond keys)

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
docker compose up --build -d
# Import catalog (CSV/JSON/YML) via /v1/catalog/upsert or admin console
# Point Bitrix/Woo connector or widget.js at API URL + search key
```

## Still open (non-blocking for pilot)

- Full CI unit suite 100% (admin-console UI acceptance, SLA benches, epic-retrieval at scale)
- De-demo category families out of core (EIDOS-104)
- Honest deep pagination totals (EIDOS-105)

## Do not claim

- Sub-15ms p95 at 100k SKU without a measured bench report on that hardware
- Cross-encoder / ONNX quality without the flag enabled and evaluated
