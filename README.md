<div align="center">

# EIDOS v3.4

**Self-hosted hybrid search** for e-commerce: HNSW (384-d) + BM25 + RRF, explainable ranking, connectors for **1C-Bitrix** and **WooCommerce**.

[![CI](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[**Studio demo**](https://eidos-demo.vercel.app) ·
[API host](https://eidos-semantic-ideation-platform.ai.studio/) ·
[Pilot guide](./docs/PILOT.md) ·
[API docs](./docs/API.md) ·
[Monitoring](./docs/MONITORING.md) ·
[Vercel deploy](./docs/VERCEL_DEMO.md)

</div>

---

## Live demos

| Surface | URL | What it is |
|---------|-----|------------|
| **Studio (UI)** | [eidos-demo.vercel.app](https://eidos-demo.vercel.app) | Full React Studio + Admin; `/v1/*` proxied to the API host |
| **API / classic demo** | [eidos-semantic-ideation-platform.ai.studio](https://eidos-semantic-ideation-platform.ai.studio/) | Long-running search API + persistence |
| **Landing** | Deploy `landing/` (Netlify or any static host) | Product page + one-command pilot CTA |

**Demo search (no key):** `POST /v1/demo/search` on the API host (also via Studio proxy).

```bash
curl -s -X POST https://eidos-demo.vercel.app/v1/demo/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"наушники для бега","topK":5}'
```

---

## What it is

EIDOS is an open-source search engine you run yourself (Docker or Node). It combines:

| Layer | Role |
|-------|------|
| **Lexical (BM25+)** | Exact SKU, brand, title matches |
| **Dense (HNSW, 384-d)** | Semantic / natural-language queries |
| **Fusion (RRF or linear)** | Merges channels with tunable weights |
| **X-Ray** | Per-hit breakdown of why an item ranked |

Embeddings run **on CPU by default** (no required OpenAI/GPU bill). Optional browser-side Xenova/WebGPU path exists for demos.

**Status:** pilot-ready core (API, persistence, auth/RBAC, Bitrix/Woo packaging, widget). Not a claim of Algolia parity on every enterprise feature.

---

## Quick start (pilot)

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
chmod +x deploy/pilot/install.sh
./deploy/pilot/install.sh
# Keys → .env.pilot ; API default http://localhost:3001
curl -s http://localhost:3001/v1/ready
```

Or full stack:

```bash
# Required in .env (≥24 chars each):
#   EIDOS_MASTER_KEY=...
#   JWT_SECRET=...
corepack enable && pnpm install
docker compose up --build -d
```

Optional metrics UI:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Prometheus :9090  Grafana :3001
```

### Connect a store

1. **Catalog** — CSV/JSON (`docs/CSV_CONTRACT.md`), YML (`POST /v1/catalog/import-yml`), or CMS sync  
2. **Bitrix** — `pnpm pack:bitrix` / `packages/connectors/bitrix`  
3. **WooCommerce** — `pnpm pack:woo` / `connectors/woocommerce`  
4. **Widget** — `<script src="https://YOUR_HOST/widget.js" data-api="..." data-key="SEARCH_KEY" defer></script>`

Details: [docs/PILOT.md](./docs/PILOT.md), [docs/PILOT_READY.md](./docs/PILOT_READY.md).

### Landing + Netlify

Product landing lives in [`landing/`](./landing/). Deploy in one click:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/ppiiyo/EIDOS&base=landing)

Or CLI:

```bash
# from repo root
npx netlify deploy --dir=landing --prod
```

`netlify.toml` points publish to `landing/` and leaves the search API on your Docker/VPS host (same model as Vercel Studio).

---

## Architecture (short)

```
apps/api          Fastify API, VectorStore, auth, demo sandbox
apps/workspace    React Studio + Admin UI
packages/core     HNSW / BM25 / ranking
packages/sdk      TypeScript client
packages/connectors/bitrix | woocommerce
public/widget.js  Storefront embed (kept in sync with workspace copy)
landing/          Marketing site (static)
```

**Persistence:** snapshot + WAL (snapshot applied before WAL replay). Demo tenant is **ephemeral** (does not touch production `default:default`).

**Security:** API keys / roles (`master`, `admin`, `merchandiser`, `search`), JWT revocation (`POST /v1/admin/jwt/revoke`), per-IP rate limits, strict CORS with `Vary: Origin`, CSP, XXE-safe linear YML parser, and SSRF guards on URL imports. `/metrics` requires `admin` or `master` authentication in production (`EIDOS_REQUIRE_METRICS_AUTH=true`).

---

## Development

```bash
corepack enable && pnpm install
pnpm --filter @eidos/core build && pnpm --filter @eidos/sdk build
pnpm dev                    # unified server
pnpm lint                   # typecheck all workspaces
pnpm test                   # full test suite (zero CI patches)
bash scripts/smoke.sh       # live HTTP smoke verification
```

### CI

| Job | Required |
|-----|----------|
| Lint, typecheck & build | yes |
| Full `pnpm test` (Node 20 & 22) | yes |
| `@eidos/core` coverage (Node 20) | yes |
| PHP connectors (lint, autoload, PHPUnit, pack) | yes |
| Python SDK pytest | yes |
| Production gate (`v35-production-gate` + `p0-p1-final-audit`) | yes |

Workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Install uses **`pnpm install --frozen-lockfile`** (lock pinned for Fastify 4 / `@fastify/swagger@8`).

---

## API surface (common)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/v1/search` | Hybrid search + X-Ray |
| `POST` | `/v1/recommend` | Item / adaptive strategies |
| `POST` | `/v1/catalog/upsert` | Admin key |
| `POST` | `/v1/demo/load` | Isolated demo catalog |
| `GET` | `/v1/health`, `/v1/ready` | Health / readiness |
| `GET` | `/metrics` | Prometheus |

OpenAPI: `/docs` when the API is running.

---

## What we do **not** claim without a bench on your hardware

- Fixed **sub-15 ms p95** at 50k–100k SKU on arbitrary VPS sizes  
- Parity with Algolia/Constructor **hosted** merchandising suites  
- Cross-encoder quality unless that path is explicitly enabled and measured  

Measured latency depends on CPU, catalog size, `efSearch`, and cache hit rate. Use `pnpm benchmark` / `load-testing/` and `/metrics` on your pilot box.

---

## Docs map

| Doc | Content |
|-----|---------|
| [PILOT.md](./docs/PILOT.md) | 15–30 min onboarding |
| [PRODUCTION.md](./docs/PRODUCTION.md) | Ops / keys / snapshots |
| [MONITORING.md](./docs/MONITORING.md) | Prometheus + Grafana |
| [CSV_CONTRACT.md](./docs/CSV_CONTRACT.md) | Import validation |
| [MIGRATION.md](./docs/MIGRATION.md) | From Algolia / others |
| [API.md](./docs/API.md) | Endpoint reference |
| [VERCEL_DEMO.md](./docs/VERCEL_DEMO.md) | Studio on Vercel |

---

## License

MIT — see [LICENSE](./LICENSE).
