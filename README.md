<div align="center">

# EIDOS v3.4

**Self-hosted hybrid search** for e-commerce: HNSW (384-d) + BM25 + RRF, explainable ranking, connectors for **1C-Bitrix** and **WooCommerce**.

[![CI](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[**Landing**](https://eidos-landing-ppiiyo.vercel.app) ·
[**Studio**](https://eidos-demo.vercel.app) ·
[API host](https://eidos-semantic-ideation-platform.ai.studio/) ·
[Pilot](./docs/PILOT.md) ·
[API docs](./docs/API.md)

</div>

---

## Live demos

| Surface | URL | What it is |
|---------|-----|------------|
| **Landing** | [eidos-landing-ppiiyo.vercel.app](https://eidos-landing-ppiiyo.vercel.app) | Product page + live demo search + pilot CTA |
| **Studio (UI)** | [eidos-demo.vercel.app](https://eidos-demo.vercel.app) | Full React Studio + Admin; `/v1/*` → API host |
| **API host** | [ai.studio demo](https://eidos-semantic-ideation-platform.ai.studio/) | Long-running search API + persistence |

```bash
curl -s -X POST https://eidos-demo.vercel.app/v1/demo/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"наушники для бега","topK":5}'
```

### Deploy landing

- **Vercel:** project `eidos-landing` (static)
- **Netlify:** [Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/ppiiyo/EIDOS) · `netlify.toml` → `publish = "landing"`

```bash
npx netlify deploy --dir=landing --prod
```

---

## What it is

EIDOS is an open-source search engine you run yourself (Docker or Node).

| Layer | Role |
|-------|------|
| **Lexical (BM25+)** | Exact SKU, brand, title matches |
| **Dense (HNSW, 384-d)** | Semantic / natural-language queries |
| **Fusion (RRF or linear)** | Merges channels with tunable weights |
| **X-Ray** | Per-hit breakdown of why an item ranked |

Embeddings run **on CPU by default**. **Status:** pilot-ready core (not Algolia feature parity).

---

## Quick start (pilot)

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
chmod +x deploy/pilot/install.sh && ./deploy/pilot/install.sh
curl -s http://localhost:3001/v1/ready
```

Or: `docker compose up --build -d` with `EIDOS_MASTER_KEY` + `JWT_SECRET` (≥24 chars) in `.env`.

**Store:** CSV/JSON · Bitrix (`pnpm pack:bitrix`) · Woo (`pnpm pack:woo`) · widget.js

Details: [docs/PILOT.md](./docs/PILOT.md).

---

## Architecture

```
apps/api · apps/workspace · packages/core · packages/sdk
packages/connectors/{bitrix,woocommerce} · public/widget.js · landing/
```

Persistence: snapshot + WAL. Demo tenant ephemeral. Security: keys/roles, rate limits, CORS, CSP, SSRF guards.

---

## Development

```bash
corepack enable && pnpm install
pnpm --filter @eidos/core build && pnpm --filter @eidos/sdk build
pnpm dev && pnpm lint && pnpm test
```

CI: frozen lockfile, Node 20/22, PHP connectors, Python SDK, production gate.

---

## Docs

[PILOT](./docs/PILOT.md) · [PRODUCTION](./docs/PRODUCTION.md) · [MONITORING](./docs/MONITORING.md) · [VERCEL_DEMO](./docs/VERCEL_DEMO.md) · [API](./docs/API.md) · [landing/](./landing/)

## License

MIT — [LICENSE](./LICENSE).
