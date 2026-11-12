# EIDOS — Pilot Readiness (core)

Last verified locally: **2026-11-12**

## Green core suites (local, this session)

| Suite | Result |
|-------|--------|
| phase1-api-hardening | 12/12 |
| p0-registry-restart | 1/1 |
| v35-production-gate | 10/10 |
| production-hardening | 2/2 |
| critical-routes | 11/11 |
| prometheus-metrics | 3/3 |
| p0-regression (security) | 6/6 |
| store-registry | 5/5 |
| tenant-isolation (RBAC) | 2/2 |
| bitrix-and-all-in-one-docker | 8/8 |
| **Total** | **60/60** (+ v35 already counted) |

`scripts/verify_injects.sh` → **All inject markers present.**

## Product invariants (fixed)

1. Snapshot → WAL ordering + `whenReady` / `setReadyPromise`
2. Demo tenant **ephemeral** (no disk) — no false `DEMO_DISABLED` 409
3. `/metrics` public for Prometheus scrapers
4. `StoreError.toJSON` uses real HTTP error names (`Not Found`, …)
5. RBAC: admin/master demote via `x-eidos-role` (never escalate); roles `viewer`/`editor`
6. Health/ready: Redis optional
7. Security plugin: `skip-override` + rate-limit `keyGenerator`
8. `setDefaultStore` does not clobber non-empty catalog
9. Widget `public/widget.js` ≡ `apps/workspace/public/widget.js` (shows `data.total`)

## Pilot in 15 minutes

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
chmod +x deploy/pilot/install.sh
./deploy/pilot/install.sh
# keys written to .env.pilot; API on :3001
curl -s http://localhost:3001/v1/ready | jq
```

Or full stack + monitoring:

```bash
# .env with EIDOS_MASTER_KEY + JWT_SECRET (≥24 chars)
docker compose up --build -d
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Prometheus :9090  Grafana :3001
```

Import catalog → connect Bitrix (`packages/connectors/bitrix`) or Woo or embed `widget.js`.

## CI / auto-apply

| Workflow | Role |
|----------|------|
| `auto-apply-p0.yml` | Apply injects on script changes; typecheck; core tests; commit |
| `verify-injects-daily.yml` | Daily marker check |

```bash
bash scripts/verify_injects.sh
```

## Still open (non-blocking for pilot)

- Full CI 100% (admin-console UI acceptance, SLA benches at 50k/100k)
- Category families out of core (EIDOS-104)
- Deep pagination honest totals end-to-end (EIDOS-105)

## Do not claim without measurement

- Sub-15ms p95 at 100k SKU on arbitrary hardware
- Cross-encoder quality without the flag enabled and evaluated
