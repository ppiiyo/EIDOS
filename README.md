# EIDOS Recommender

[![CI](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://eidos-demo.vercel.app)
[![SDK](https://img.shields.io/badge/@eidos/sdk-v1.0.0-emerald.svg)](https://www.npmjs.com/package/@eidos/sdk)

![EIDOS Live Demo Interface](./docs/demo.gif)

> **Live Demo:** [https://eidos-demo.vercel.app](https://eidos-demo.vercel.app)  
> **Documentation:** [docs/API.md](./docs/API.md) | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | [docs/BENCHMARKS.md](./docs/BENCHMARKS.md)

---

## Overview

### English
EIDOS is an open-source semantic recommendation and search engine for marketplaces, streaming platforms, and digital libraries. Rather than relying on historical click-logs or brittle keyword matching, EIDOS computes conceptual affinities across 384-dimensional dense vectors using transformer models (`all-MiniLM-L6-v2`), eliminating the cold-start problem and delivering sub-20ms inference.

### Русский
EIDOS — семантический рекомендательный движок и поисковая система с открытым исходным кодом для маркетплейсов, медиаплатформ и каталогов знаний. Вместо анализа истории кликов или подбора ключевых слов, EIDOS вычисляет концептуальное сходство объектов в 384-мерном векторном пространстве с помощью трансформеров (`all-MiniLM-L6-v2`), исключая проблему холодного старта и обеспечивая время ответа менее 20 мс.

### 中文
EIDOS 是一款面向电子商务、流媒体和知识库的开源语义推荐与搜索系统。与传统的协同过滤或关键字匹配不同，EIDOS 利用转换器模型（`all-MiniLM-L6-v2`）在 384 维密集向量空间中计算语义亲和力，彻底消除了新商品的冷启动问题，单次推理时间低于 20 毫秒。

---

## Quick Start (3 Commands)

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS && pnpm install

# 2. Run local development environment
pnpm dev

# 3. Execute vector benchmark suite
pnpm benchmark
```

Open `http://localhost:3000` to interact with the in-browser WebAssembly demo.

---

## How It Works

```text
[ Product Catalog / Query ]
             │
             ▼
[ Transformer Pipeline (all-MiniLM-L6-v2) ] ──> 384-dim L2 Vector
             │
             ▼
[ In-Memory Vector Matrix / Qdrant HNSW ] ───> Cosine Dot Product Scan (<1ms)
             │
             ▼
[ Maximum Marginal Relevance (MMR) ] ───────> Shannon Diversity Balancing
             │
             ▼
[ Filtered Recommendations (<20ms total) ]
```

---

## Interface Previews

| Interactive Catalog & Search | Semantic Graph Field |
| :---: | :---: |
| ![Catalog Preview](./docs/catalog-preview.png) | ![Graph Preview](./docs/graph-preview.png) |

---

## Performance & Verified Benchmarks

Benchmarked on AMD EPYC 7763 (2 vCPU, 4GB RAM) using Node.js 20:

| Operation | Batch Size | Latency (p50) | Latency (p99) | Throughput |
| :--- | :--- | :--- | :--- | :--- |
| **Dot Product (384-dim)** | 1 | 1.02 µs | 1.65 µs | 980,000 ops/sec |
| **Linear Scan (1,000 items)** | 1 | 0.98 ms | 1.54 ms | 1,020 scans/sec |
| **Shannon Entropy Calculation** | 1 | 1.60 µs | 2.10 µs | 624,000 ops/sec |
| **MMR Re-ranking** | 1 | 0.26 µs | 0.45 µs | 3,830,000 ops/sec |
| **Total `/v1/recommend` Pipeline** | 1 | 14.10 ms | 28.50 ms | 70 req/sec / vCPU |

*Methodology details and reproduction steps can be found in [docs/BENCHMARKS.md](./docs/BENCHMARKS.md).*

---

## Comparison with Existing Paradigms

| Feature | Legacy Collaborative Filtering | Traditional Keyword / BM25 | EIDOS Semantic Engine |
| :--- | :--- | :--- | :--- |
| **Cold-Start Handling** | Fails (requires transaction history) | Matches literal text only | Instant (embedded at creation) |
| **Conceptual Search** | Not supported | Fragile to exact wording | Supported (natural language intent) |
| **Client-Side Execution** | No (requires centralized logs) | Inefficient inverted index | Yes (Transformers.js in WASM) |
| **Catalog Coverage** | Low (~20% top head items) | Medium | High (>85% long-tail items) |
| **External Cloud Lock-in**| High | Medium | None (100% self-hostable) |

---

## Tech Stack

* **Core & Math (`packages/core`):** TypeScript, L2 Normalization, SIMD Dot Products, Shannon Entropy, MMR.
* **Client SDK (`packages/sdk`):** Native Fetch, AbortController timeout guards, strict type definitions.
* **Demo App (`apps/demo`):** Vite, Vanilla TypeScript, Transformers.js (`@xenova/transformers`), Canvas 2D.
* **REST API (`apps/api`):** Node.js 20, Fastify, Zod, Pino structured logging, Docker multi-stage build.
* **Landing Page (`apps/landing`):** Next.js 14 App Router, Tailwind CSS, Framer Motion.
* **Tooling:** pnpm workspaces, Turborepo, Vitest, Playwright.

---

## Roadmap

- [x] v1.0.0: Monorepo restructuring, in-browser WASM inference, Fastify API, complete docs.
- [ ] v1.1.0: Native Qdrant and Milvus vector index adapters for 1M+ items.
- [ ] v1.2.0: Multi-modal joint text + image embeddings (CLIP).
- [ ] v1.3.0: Dynamic intent drift tracking across active user sessions.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for detailed delivery phases.

---

## Contributing

Contributions are welcome. Please read our [Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting a Pull Request.

```bash
# Run tests prior to opening PR
pnpm test
pnpm lint
```

---

## License

EIDOS is licensed under the [MIT License](./LICENSE).

---

## Credits & Acknowledgments

* [Transformers.js](https://github.com/xenova/transformers.js) by Xenova & Hugging Face.
* Sentence Transformers team for the [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) model weights.
* The Fastify project for high-efficiency Node.js HTTP runtime performance.
