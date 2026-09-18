# EIDOS — High-Performance Semantic Vector Recommender

<div align="center">

[![CI](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/Coverage-%3E80%25-brightgreen.svg)](https://github.com/ppiiyo/EIDOS)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel&logoColor=white)](https://eidos-demo.vercel.app)

<br />

**Real-Time Semantic Affinity Engine for Marketplaces, Digital Libraries & Streaming Platforms.**  
Eliminates cold-start item starvation via 384-dimensional dense vector embeddings and Shannon entropy diversity re-ranking. Zero external cloud lock-in. 100% self-hostable.

[Live Demo](https://eidos-demo.vercel.app) • [Quickstart Guide](./docs/QUICKSTART.md) • [REST API Reference](./docs/API.md) • [Architecture](./docs/ARCHITECTURE.md) • [Benchmarks](./docs/BENCHMARKS.md)

</div>

---

## Language / Язык / 语言

<details open>
<summary><b>English (Default)</b></summary>

### Overview
EIDOS is an open-source, production-grade semantic recommendation and vector search engine. Rather than relying on historical transaction logs, user clicks, or brittle lexical keyword matching, EIDOS computes conceptual affinities in 384-dimensional vector space using transformer models (`all-MiniLM-L6-v2`).

* **Cold-Start Elimination:** New products, articles, or songs are instantly indexed and discoverable upon ingestion.
* **Dual Execution Modes:** Runs in-browser via WebAssembly (Transformers.js) or as a containerized Fastify microservice.
* **Diversity Balancing:** Employs Maximum Marginal Relevance (MMR) and Shannon entropy heuristics to prevent narrow recommendation echo-chambers.
* **Zero Cloud Lock-in:** 100% self-hostable in Docker, Kubernetes, Fly.io, or bare metal.

</details>

<details>
<summary><b>Русский</b></summary>

### Обзор
EIDOS — высокопроизводительный семантический рекомендательный движок и векторный поисковик с открытым исходным кодом для маркетплейсов, медиаплатформ и каталогов знаний. Вместо анализа истории кликов или подбора ключевых слов, EIDOS вычисляет концептуальное сходство объектов в 384-мерном векторном пространстве с помощью моделей-трансформеров (`all-MiniLM-L6-v2`).

* **Ликвидация холодного старта:** Новые товары, статьи или треки мгновенно индексируются и выдаются в рекомендациях с первой секунды.
* **Два режима работы:** Выполнение прямо в браузере через WebAssembly (Transformers.js) или на бэкенде через Fastify REST API.
* **Балансировка разнообразия:** Использование алгоритма Maximum Marginal Relevance (MMR) и энтропии Шеннона для устранения эффекта «информационного пузыря».
* **Без привязки к облакам:** Полностью автономен, разворачивается в Docker, Kubernetes или на собственных серверах.

</details>

<details>
<summary><b>中文</b></summary>

### 概述
EIDOS 是一款面向电子商务、流媒体和知识库的高性能开源语义推荐与搜索系统。与传统的协同过滤或关键字匹配不同，EIDOS 利用转换器模型（`all-MiniLM-L6-v2`）在 384 维密集向量空间中计算语义亲和力。

* **彻底解决冷启动问题：** 新上架的商品、文章或媒体资源在录入瞬间即可通过向量索引被推荐。
* **双运行模式：** 支持基于 WebAssembly（Transformers.js）的纯前端浏览器端推理，以及容器化的高性能 Fastify 后端服务。
* **多样性重排序：** 采用最大边际相关性（MMR）与香农熵算法，防止推荐内容同质化。
* **100% 自托管：** 无外部云厂商绑定，可自由部署在 Docker、Kubernetes 或本地物理服务器上。

</details>

---

## Interactive Interface Preview

```text
┌─────────────────────────────────────────────── EIDOS Semantic Workspace ───────────────────────────────────────────────┐
│                                                                                                                        │
│  Product Catalog (100+ items)                 Semantic Affinity Matches (Top 5)               Semantic Topology Graph  │
│  ┌──────────────────────────────────────┐     ┌───────────────────────────────────────┐       ┌──────────────────────┐ │
│  │ [prod-001] Mechanical Split Keyboard │ ──> │ [prod-002] Walnut Keyboard Wrist Rest │       │      (002)           │ │
│  │ Category: Electronics | Price: $189  │     │ 92.4% match | MMR Divergence: 0.81    │       │     /      \         │ │
│  ├──────────────────────────────────────┤     ├───────────────────────────────────────┤       │  (001)────(003)      │ │
│  │ [prod-003] Desk Monitor Light Bar    │     │ [prod-003] Desk Monitor Light Bar     │       │     \      /         │ │
│  │ Category: Office | Price: $79.50     │     │ 78.1% match | MMR Divergence: 0.69    │       │      (004)           │ │
│  └──────────────────────────────────────┘     └───────────────────────────────────────┘       └──────────────────────┘ │
│                                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start in 3 Commands

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS && pnpm install

# 2. Run local development environment
pnpm dev

# 3. Execute vector benchmark suite
pnpm benchmark
```

Open `http://localhost:3000` (or `http://localhost:5173` for demo app) to explore the real-time canvas and WASM pipeline.

---

## Architecture & Data Flow

```text
[ Raw Item Metadata / Query String ]
                 │
                 ▼
[ Transformer Pipeline (all-MiniLM-L6-v2) ] ──> 384-dimensional dense vector (Float32Array)
                 │
                 ▼
[ L2 Unit Normalization ] ─────────────────────> Unit hypersphere representation
                 │
                 ▼
[ Vector Store / In-Memory Index ] ────────────> SIMD Cosine dot product scan (<1ms / 1k items)
                 │
                 ▼
[ Candidate Selection ] ───────────────────────> Top-K filtered candidates above threshold
                 │
                 ▼
[ Maximum Marginal Relevance (MMR) ] ──────────> Balance relevance vs. similarity-to-selected
                 │
                 ▼
[ Shannon Category Entropy Evaluation ] ───────> Verify distribution balance across taxonomy
                 │
                 ▼
[ Output Recommendations Payload ] ────────────> p50 ~14ms / p99 ~28ms JSON response
```

---

## Performance & Verified Benchmarks

Benchmarked on **AMD EPYC 7763** (2 vCPU, 4GB RAM, Linux x86_64, Node.js 20):

| Operation | Batch / Size | Latency (p50) | Latency (p99) | Throughput |
|:----------|:-------------|:--------------|:--------------|:-----------|
| **Cosine Similarity (384-dim)** | 1 pair | 0.93 µs | 1.45 µs | 1,077,000 ops/sec |
| **Corpus Scan (1,000 items)** | 1 query | 0.91 ms | 1.48 ms | 1,098 scans/sec |
| **Corpus Scan (10,000 items)** | 1 query | 7.85 ms | 11.20 ms | 127 scans/sec |
| **Shannon Entropy Computation** | 10 classes | 1.46 µs | 1.95 µs | 684,000 ops/sec |
| **MMR Diversity Re-ranking** | 20 candidates | 0.31 µs | 0.52 µs | 3,250,000 ops/sec |
| **Total `/v1/recommend` Pipeline** | 1 request | 14.10 ms | 28.50 ms | 70 req/sec / vCPU |
| **In-Browser Client Embedding** | 1 query (WASM) | 38.20 ms | 62.10 ms | Client execution |

*Full methodology, test configurations, and reproduction commands are documented in [docs/BENCHMARKS.md](./docs/BENCHMARKS.md).*

---

## Paradigm Comparison

| Capability | Collaborative Filtering | Lexical Search (BM25 / Elasticsearch) | EIDOS Semantic Engine |
|:-----------|:------------------------|:--------------------------------------|:----------------------|
| **Cold-Start Handling** | Fails (requires click history) | Partial (matches keywords only) | Instant (embeddings at creation) |
| **Vocabulary Mismatch** | Not addressed | High failure on synonyms | Resolved in dense vector space |
| **Client-Side Execution** | No (requires server telemetry) | Inefficient inverted index | Native (WebAssembly Transformers.js) |
| **Catalog Coverage** | Low (~20% popular head items) | Medium | High (>88% long-tail coverage) |
| **Infrastructure Overhead** | High (Hadoop / Spark / Kafka) | High (JVM cluster management) | Lightweight (Node.js or Docker) |
| **Cloud Lock-in** | High | Medium | None (100% self-hostable) |

---

## Monorepo Layout

```text
.
├── apps/
│   ├── api/             # Fastify REST microservice (port 8080)
│   ├── demo/            # Vite + WebAssembly in-browser demo
│   └── landing/         # Next.js 14 documentation & showcase
├── packages/
│   ├── core/            # Vector math, Cosine, MMR, Shannon entropy
│   └── sdk/             # Isomorphic TypeScript client SDK
├── docs/                # Architecture, Benchmarks, Deployment, Quickstart
├── scripts/             # Automated benchmark & snapshot generation scripts
├── tests/               # E2E Playwright test suites
├── pnpm-lock.yaml       # Monorepo lockfile
└── turbo.json           # Turborepo build pipeline configuration
```

---

## Code Examples

### 1. TypeScript Core Library

```typescript
import { cosineSimilarity, normalizeVector, calculateMMRScore } from '@eidos/core';

// Compute affinity between two 384-dimensional embeddings
const vecA = normalizeVector(new Float32Array([0.1, 0.4, 0.85]));
const vecB = normalizeVector(new Float32Array([0.12, 0.38, 0.88]));

const similarity = cosineSimilarity(vecA, vecB);
console.log(`Semantic match: ${(similarity * 100).toFixed(1)}%`);

// MMR re-ranking to prioritize novelty
const mmr = calculateMMRScore(similarity, 0.45, 0.7);
```

### 2. Client SDK Integration

```typescript
import { EidosClient } from '@eidos/sdk';

const client = new EidosClient({
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.EIDOS_API_KEY,
  timeoutMs: 3000,
});

const recommendations = await client.recommend({
  itemId: 'prod-001',
  limit: 5,
  minSimilarity: 0.35,
  diversityFactor: 0.7,
});

console.log(recommendations);
```

### 3. REST API Endpoint

```bash
curl -X POST http://localhost:8080/v1/recommend \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "item_id": "prod-001",
    "limit": 5,
    "diversityFactor": 0.7
  }'
```

---

## Testing & Verification

```bash
# Run unit tests across all packages
pnpm test:unit

# Run unit tests with code coverage report
pnpm test:coverage

# Run Playwright E2E browser tests
pnpm test:e2e
```

---

## Docker Deployment

Deploy in production with a single command:

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e EIDOS_API_KEY=your_secret_key \
  --name eidos-service \
  ghcr.io/ppiiyo/eidos-api:latest
```

---

## Roadmap

- [x] **v1.0.0:** Monorepo architecture, WASM in-browser inference, Fastify microservice, comprehensive test suite.
- [ ] **v1.1.0:** Native Qdrant & Milvus vector store adapters for million-scale indexes.
- [ ] **v1.2.0:** Multi-modal text + image embedding support via CLIP.
- [ ] **v1.3.0:** Session-based real-time intent drift tracking.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for milestones and timelines.

---

## Contributing

We welcome contributions from the community. Please review our [Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md).

```bash
# Verify typecheck and tests before opening a pull request
pnpm lint
pnpm test
```

---

## License

EIDOS is licensed under the [MIT License](./LICENSE).
