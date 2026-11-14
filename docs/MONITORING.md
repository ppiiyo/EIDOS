# EIDOS monitoring

## Built-in endpoints (no extra stack)

| Path | Auth | Purpose |
|------|------|---------|
| `GET /v1/health` | public | Liveness + component checks |
| `GET /v1/ready` / `/ready` | public | Readiness (catalog + embedder; Redis optional) |
| `GET /metrics` | **public** | Prometheus text exposition |
| `GET /v1/metrics/prometheus` | API key | Same metrics, authenticated alias |

Scrape example:

```bash
curl -s http://127.0.0.1:8080/metrics | head
```

## Optional Prometheus + Grafana

```bash
# API already running via docker compose
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Prometheus UI
open http://localhost:9090

# Grafana (default admin / admin — change via GRAFANA_ADMIN_PASSWORD)
open http://localhost:3001
```

Configs:

- `deploy/prometheus.yml` — scrape `api:8080/metrics`
- `deploy/eidos-alerts.yml` — API down, search p95, 5xx, cache
- `deploy/grafana/provisioning/` — datasource + overview dashboard

## CI & Smoke Verification

| Workflow | Trigger | Role |
|----------|---------|------|
| `ci.yml` | push / PR to `main` | Build, lint, unit & integration tests (Node 20 & 22), PHPUnit, Python SDK |
| `php-connectors.yml` | push / PR | PHP 8.2 syntax lint & Bitrix autoload verification |

Local smoke check:

```bash
bash scripts/smoke.sh
```
