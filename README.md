<div align="center">

# EIDOS v3.4

**Self-hosted hybrid search** for e-commerce: HNSW (384-d) + BM25 + RRF, explainable ranking, connectors for **1C-Bitrix** and **WooCommerce**.

[![CI](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[**Landing**](https://eidos-landing.vercel.app) ·
[**Studio**](https://eidos-demo.vercel.app) ·
[API host](https://eidos-semantic-ideation-platform.ai.studio/) ·
[Pilot](./docs/PILOT.md) ·
[API docs](./docs/API.md)

</div>

---

## Live demos

| Surface | URL | What it is |
|---------|-----|------------|
| **Landing** | [eidos-landing.vercel.app](https://eidos-landing.vercel.app) | Product page + live demo search + pilot CTA |
| **Studio (UI)** | [eidos-demo.vercel.app](https://eidos-demo.vercel.app) | Full React Studio + Admin; `/v1/*` → API host |
| **API host** | [ai.studio demo](https://eidos-semantic-ideation-platform.ai.studio/) | Long-running search API + persistence |

**One-liner demo search:**

```bash
curl -s -X POST https://eidos-demo.vercel.app/v1/demo/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"наушники для бега","topK":5}'
```

### Deploy the landing yourself

- **Vercel:** project `eidos-landing` (static `landing/index.html`)
- **Netlify:** `netlify.toml` → `publish = "landing"`  
  [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/ppiiyo/EIDOS)

```bash
npx netlify deploy --dir=landing --prod
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

### Connect a store

1. **Catalog** — CSV/JSON (`docs/CSV_CONTRACT.md`), YML, or CMS sync  
2. **Bitrix** — `pnpm pack:bitrix`  
3. **WooCommerce** — `pnpm pack:woo`  
4. **Widget** — `<script src="https://YOUR_HOST/widget.js" data-api="..." data-key="SEARCH_KEY" defer></script>`

Details: [docs/PILOT.md](./docs/PILOT.md).

---

## Architecture (short)

```
apps/api          Fastify API, VectorStore, auth, demo sandbox
apps/workspace    React Studio + Admin UI
packages/core     HNSW / BM25 / ranking
packages/sdk      TypeScript client
packages/connectors/bitrix | woocommerce
public/widget.js  Storefront embed
landing/          Product marketing site (static)
```

**Persistence:** snapshot + WAL (snapshot before WAL). Demo tenant is ephemeral.

**Security:** API keys / roles, JWT revocation, rate limits, CORS, CSP, XXE-safe YML, SSRF guards.

---

## Development

```bash
corepack enable && pnpm install
pnpm --filter @eidos/core build && pnpm --filter @eidos/sdk build
pnpm dev && pnpm lint && pnpm test
```

CI uses **`pnpm install --frozen-lockfile`** (Fastify 4 / `@fastify/swagger@8` locked).

---

## Docs map

| Doc | Content |
|-----|---------|
| [PILOT.md](./docs/PILOT.md) | 15–30 min onboarding |
| [PRODUCTION.md](./docs/PRODUCTION.md) | Ops / keys / snapshots |
| [MONITORING.md](./docs/MONITORING.md) | Prometheus + Grafana |
| [VERCEL_DEMO.md](./docs/VERCEL_DEMO.md) | Studio on Vercel |
| [API.md](./docs/API.md) | Endpoint reference |
| [landing/](./landing/) | Product landing source |

---

## License

MIT — see [LICENSE](./LICENSE).
