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

## CI: auto-apply patches + verification

| Workflow | Trigger | Role |
|----------|---------|------|
| `auto-apply-p0.yml` | push to `scripts/inject_*.py` or manual | Apply injects, typecheck, core tests, commit if dirty |
| `verify-injects-daily.yml` | daily 06:00 UTC + manual | Assert inject markers still present |

Local check:

```bash
bash scripts/verify_injects.sh
for s in scripts/inject_*.py; do python3 "$s"; done
```

Loop protection: commits whose message contains `apply pending injects` do not re-trigger auto-apply.
