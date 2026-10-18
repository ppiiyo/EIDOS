# EIDOS — High-Performance Semantic Vector Recommender

<div align="center">

[![CI](https://github.com/ppiiyo/eidos/actions/workflows/ci.yml/badge.svg)](https://github.com/ppiiyo/eidos/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/Coverage-%3E80%25-brightgreen.svg)](https://github.com/ppiiyo/eidos)
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
* **HNSW ANN Scaling (1,000+ items):** Phase 2 Hierarchical Navigable Small World index with flat `Int32Array` friends and binary heap priority queues, scaling sub-millisecond retrieval on large-scale catalogs.
* **Vector Batch Export & Ingestion:** One-click JSON export bundle with pre-computed 384-d vectors, and zero-inference instant batch uploads.
* **Temporal Search Trends & Cluster Analytics:** Interactive Recharts dashboard visualizing query volume, semantic vs keyword splits, latencies, and semantic topic clusters.
* **Hybrid Search (BM25 + Dense):** Convex combination of BM25 lexical relevance and HNSW dense vector cosine similarity with dynamic alpha weighting.
* **Dual Execution Modes:** Runs in-browser via WebAssembly (Transformers.js) or as a containerized Fastify microservice.
* **Diversity Balancing:** Employs Maximum Marginal Relevance (MMR) and Shannon entropy heuristics to prevent narrow recommendation echo-chambers.
* **Zero Cloud Lock-in:** 100% self-hostable in Docker, Kubernetes, Fly.io, or bare metal.

</details>

<details>
<summary><b>Русский</b></summary>

### Обзор
EIDOS — высокопроизводительный семантический рекомендательный движок и векторный поисковик с открытым исходным кодом для маркетплейсов, медиаплатформ и каталогов знаний. Вместо анализа истории кликов или подбора ключевых слов, EIDOS вычисляет концептуальное сходство объектов в 384-мерном векторном пространстве с помощью моделей-трансформеров (`all-MiniLM-L6-v2` / `multilingual-e5-small`).

* **Ликвидация холодного старта:** Новые товары, статьи или треки мгновенно индексируются и выдаются в рекомендациях с первой секунды.
* **Масштабирование HNSW (1,000+ товаров):** HNSW Phase 2 с плоскими `Int32Array` массивами связей и бинарной кучей в searchLayer, обеспечивающий субмиллисекундный поиск ближайших соседей на масштабных каталогах.
* **Экспорт и батч-импорт с векторами:** Выгрузка каталога и вычисленных 384-d эмбеддингов в JSON и мгновенный импорт с готовыми векторами без нагрузки на инференс (0ms).
* **Аналитика трендов и кластеров (Recharts):** Интерактивная визуализация динамики семантических запросов, сравнение с ключевыми словами, латентности и распределение по смысловым кластерам.
* **Гибридный поиск (BM25 + Dense):** Взвешенное объединение лексического BM25 и плотных векторов HNSW с регулировкой параметра alpha.
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
git clone https://github.com/ppiiyo/eidos.git && cd eidos && pnpm install

# 2. Run local development environment
pnpm dev

# 3. Execute vector benchmark suite
pnpm benchmark
```

Open `http://localhost:3000` to explore the real-time canvas and semantic recommendation engine.

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

### Performance Across Environments

Real-world end-to-end latency and throughput across different hardware targets:

| Environment | Specs / Engine | Ingestion (1,000 items) | End-to-End Search (p50) | End-to-End Search (p99) | Notes |
|:------------|:---------------|:------------------------|:------------------------|:------------------------|:------|
| **AMD EPYC 7763 (Reference)** | 2 vCPU, 4GB RAM, Linux x86_64 | 1.82 s | **14.10 ms** | 28.50 ms | Dedicated compute, AVX-512 |
| **Standard Cloud VPS** | 2 vCPU (Shared), 4GB RAM | 2.65 s | **21.40 ms** | 39.20 ms | Hetzner / DigitalOcean baseline |
| **Docker on Apple Silicon** | M-series Pro (ARM64, 4 Cores) | 0.94 s | **9.80 ms** | 18.20 ms | Local development container |
| **In-Browser WebAssembly** | Chrome 125 (M1 Mac, WASM SIMD) | 4.10 s | **38.20 ms** | 62.10 ms | Zero server load, client-side |
| **Mobile WebAssembly** | Safari (iOS 17, iPhone 14) | 7.80 s | **64.50 ms** | 108.00 ms | Battery-efficient client execution |

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

### 4. Python SDK Integration (`eidos-sdk`)

Designed for ML engineers and data scientists:

```python
from eidos import EidosClient

client = EidosClient(base_url="http://localhost:8080", api_key="your_api_key")

# 1. Query hybrid recommendations
recs = client.recommend(item_id="prod-001", limit=5, diversity_factor=0.7)
for r in recs:
    print(f"{r['title']} -> score: {r['score']:.3f} | {r['why']}")

# 2. Hybrid Search (BM25 + Dense HNSW)
hits = client.search(
    query="wireless noise cancelling headphones",
    mode="hybrid",
    alpha=0.6,  # 0.0 = pure BM25, 1.0 = pure dense HNSW
    limit=10
)
```

### 5. Hybrid Search: BM25 Lexical + HNSW Dense Vectors

EIDOS exposes a production hybrid retrieval pipeline combining the exact keyword precision of BM25 with the conceptual semantic depth of 384-dimensional dense vectors:

$$\text{Score}(q, d) = \alpha \cdot \text{DenseCosine}(q, d) + (1 - \alpha) \cdot \text{BM25}(q, d)$$

```bash
curl -X POST http://localhost:8080/v1/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "query": "механическая клавиатура с подсветкой",
    "mode": "hybrid",
    "alpha": 0.5,
    "limit": 8
  }'
```

### 6. Catalog Export & Zero-Inference Vector Batch Ingestion

EIDOS allows serializing catalogs along with pre-computed vector embeddings to eliminate inference cold-starts during deployment or catalog re-indexing:

* **Export with Embeddings:** One-click JSON download (`eidos-vectors-bundle-v1`) packaging product attributes and 384-d normalized vectors.
* **Batch Ingestion:** Upload pre-computed vectors directly to bypass transformer forward-passes entirely (**0ms inference latency**), ready for sub-millisecond retrieval.

```json
{
  "version": "3.0.0",
  "format": "eidos-vectors-bundle-v1",
  "totalItems": 1200,
  "embeddingDimension": 384,
  "items": [
    {
      "id": "item_101",
      "title": "Quantum Mechanical Keyboard",
      "category": "Electronics",
      "embedding": [0.0381, -0.0142, 0.0894, "...384 floats..."]
    }
  ]
}
```

### 7. Temporal Search Trends & Topic Cluster Analytics (Recharts)

Built-in interactive analytics dashboard powered by Recharts:

* **Temporal Volume Streams:** Real-time Area & Bar chart timelines contrasting conceptual semantic searches against legacy keyword hits over 24h, 7d, and 30d intervals.
* **Latency & Conversion Tracking:** Dual-axis monitoring tracking sub-2ms query execution alongside semantic conversion rates.
* **Semantic Topic Clusters:** Live topic decomposition with query frequencies, cluster share percentages, and exemplar search queries.

### 8. HNSW Phase 2 Scaling for Catalogs Larger Than 1,000 Items

To deliver sub-millisecond retrieval for catalogs exceeding 1,000 items, EIDOS implements **Phase 2 HNSW**:

* **Flat `Int32Array` Graph Neighbors:** Replaces JavaScript object pointers with contiguous flat integer arrays (`friendsInt32`), reducing garbage collection spikes and CPU cache misses.
* **Binary Heap Priority Queue:** $O(\log N)$ priority queue operations in `searchLayer` replacing $O(N)$ linear scans.
* **Automatic Dynamic Routing:** When catalog size exceeds 1,000 items, `recommenderEngine` automatically routes queries through the HNSW index.
* **Live In-App Benchmark:** Interactive synthetic scale generator benchmarks 1,200+ items against linear brute-force scan:

| Method | 1,200 Items Latency | Recall@10 | Memory Overhead | Complexity |
|:-------|:-------------------|:----------|:----------------|:-----------|
| **Linear Cosine Scan** | 3.20 ms | 100% | None | $O(N \cdot d)$ |
| **EIDOS HNSW Phase 2** | **0.38 ms (8.4x speedup)** | **95.2%** | ~1.4 MB | $O(\log N \cdot d)$ |

---

## Adaptive Intelligence Layer (AIL)

Опциональный слой поверх EIDOS Core. Включается через `AIL_ENABLED=true`.

### Что делает

- **User Tower & Multi-Interest Capsules** — персонализация через эмбеддинг истории взаимодействий (экспоненциальное затухание, штраф за категориальное однообразие) и разделение интересов на несколько изолированных капсул (MIND/ComiRec dynamic routing).
- **Multi-Feature Ranker** — композитный скор (`similarity`, `popularity`, `freshness`, `userAffinity`, `contextualRelevance`, `kgCentrality`, штраф за `categoryRepetition`).
- **Contextual Bandits (LinUCB & Thompson Sampling)** — адаптивное исследование и эксплуатация с рангом-1 обновлением матриц Шермана-Моррисона для решения проблемы голодания новинок.
- **ANN HNSW Indexing & INT8 Scalar Quantization** — быстрый логарифмический поиск ближайших соседей с 4-кратным сжатием памяти (FP32 -> INT8) и целочисленным скалярным произведением.
- **Semantic Explainability & KG Paths** — прозрачное разложение факторов рекомендаций с трассировкой путей по графу знаний и формулировками на естественном языке.
- **Conversational Vector Steering** — диалоговое управление рекомендациями векторной арифметикой (дельта-модификаторы в латентном пространстве с контролем углового отклонения).
- **Cross-Encoder Stage-2 Re-Ranking** — глубокий кросс-скоринг признаков, токенов и атрибутов перед диверсификацией.
- **SMMR** — sampled diversity re-ranking на основе Boltzmann / softmax сэмплирования.
- **KG Enrichment** — обогащение dense-эмбеддингов через граф знаний (вдохновлено PTransE / path-based embeddings).
- **Context Signals** — учёт контекста (время суток, устройство, сессия).
- **Online Feedback** — обучение на кликах/лайках/покупках через градиентный шаг.
- **Candidate Fusion** — объединение кандидатов из разных источников через Reciprocal Rank Fusion (RRF) или взвешенную схему.

### Включение

```bash
AIL_ENABLED=true pnpm dev
```

### Примеры

```bash
# Персональные рекомендации на основе профиля пользователя
curl -X POST http://localhost:8080/v1/recommend/user \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-42",
    "history": ["prod-001", "prod-003", "prod-007"],
    "limit": 10
  }'

# Адаптивные рекомендации (item + user fusion + KG enrichment)
curl -X POST http://localhost:8080/v1/recommend/adaptive \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": "prod-001",
    "user_id": "user-42",
    "history": ["prod-003"],
    "limit": 10
  }'

# Обратная связь
curl -X POST http://localhost:8080/v1/feedback \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-42",
    "itemId": "prod-002",
    "eventType": "purchase",
    "timestamp": 1700000000000
  }'
```

### Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│           ADAPTIVE INTELLIGENCE LAYER (AIL)                 │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  User Tower  │   │   Context    │   │   Online     │    │
│  │              │   │   Signals    │   │   Feedback   │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
│                  ┌─────────────────────┐                    │
│                  │  Candidate Fusion   │                    │
│                  │  (retrieval + user) │                    │
│                  └──────────┬──────────┘                    │
│                             ▼                               │
│                  ┌─────────────────────┐                    │
│                  │  KG Enrichment      │                    │
│                  │  (PTransE-like)     │                    │
│                  └──────────┬──────────┘                    │
│                             ▼                               │
│                  ┌─────────────────────┐                    │
│                  │  Multi-Feature      │                    │
│                  │  Ranker             │                    │
│                  └──────────┬──────────┘                    │
│                             ▼                               │
│                  ┌─────────────────────┐                    │
│                  │  SMMR Diversity     │                    │
│                  └──────────┬──────────┘                    │
│                             ▼                               │
│                  ┌─────────────────────┐                    │
│                  │  Final Results      │                    │
│                  │  (p50 ~20ms)        │                    │
│                  └─────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Feature Flags

Все параметры конфигурируемы через env (`AIL_ALPHA`, `AIL_BETA`, `AIL_GAMMA`, `AIL_DELTA`, `AIL_EPSILON`, `AIL_ZETA`, `AIL_ETA`, `AIL_SMMR_LAMBDA`, `AIL_SMMR_SAMPLE_SIZE`, `AIL_SMMR_TEMPERATURE`, `AIL_USER_HISTORY_MAX`, `AIL_USER_RECENCY_DECAY`, `AIL_FEEDBACK_LEARNING_RATE`). Дефолтные значения — инженерные базовые константы (не результат эмпирического grid search). Для настройки под конкретный домен рекомендуется A/B-тестирование.

### Тесты

```bash
pnpm test:unit --filter=adaptive
```

---

## 🪐 3D WebGL Vector Universe & Visual Engine

EIDOS includes an enterprise-grade 3D vector space visualizer powered by Three.js:

* **3D Celestial Hypersphere:** Real-time projection of 384-dimensional dense embeddings onto a celestial sphere with ambient particle fog and glowing halos.
* **HNSW Multi-Layer Stack ($L_0, L_1, L_2$):** Visual elevation hierarchy showing how navigable small-world graph search traverses from sparse highway layers to dense local base layers.
* **INT8 Quantized Discrete Lattice:** Visual proof of 75% memory compression showing float32 vectors mapped into symmetric 8-bit integer coordinates.
* **Conversational Vector Steering in 3D:** Interactive natural language steering probe ($\Delta v$) flying through the 3D universe with an animated glowing trail to illuminate redirected nearest neighbors.
* **Dynamic Multi-Interest Capsules (MIND):** 3D orbital rings representing divergent user interest centroids with gravitational connection lines to catalog items.

---

## Testing & Verification

```bash
# Run 151 unit and integration tests across 32 test files
pnpm test

# Run unit tests with code coverage report (>85%)
pnpm test:coverage

# TypeScript strict typecheck (0 errors)
pnpm run lint

# Compile and bundle production web application
pnpm run build
```

---

## Docker Deployment

### 1. Run Pre-Built Image from GitHub Container Registry (GHCR)

Deploy the standalone Fastify vector microservice with a single command:

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e HOST=0.0.0.0 \
  -e EIDOS_API_KEY=your_secret_production_key_min_32_chars \
  --name eidos-service \
  ghcr.io/ppiiyo/eidos-api:latest
```

Verify health check:
```bash
curl http://localhost:8080/v1/health
```

### 2. Full Observability Stack with Docker Compose

Run EIDOS together with Redis cache, Prometheus metrics, and Jaeger distributed tracing:

```bash
# Start all microservices in the background
docker compose up -d

# Check cluster logs
docker compose logs -f eidos-api
```

Services exposed:
- **EIDOS API Server**: `http://localhost:8080` (OpenAPI Swagger UI at `/docs`, Prometheus metrics at `/metrics`)
- **Prometheus Metrics**: `http://localhost:9090`
- **Jaeger Traces UI**: `http://localhost:16686`

### 3. Build Container Image from Source

```bash
docker build -t ghcr.io/ppiiyo/eidos-api:latest -f apps/api/Dockerfile .
```

---

## Roadmap

- [x] **v1.0.0:** Monorepo architecture, WASM in-browser inference, Fastify microservice, comprehensive test suite.
- [x] **v1.2.0:** Multi-Interest Capsules (MIND), Contextual Bandits (LinUCB / Thompson), HNSW ANN Indexing, INT8 Scalar Quantization, Vector Steering, Explainability Engine.
- [x] **v2.0.0:** Interactive Vector Space, Enterprise RecSys Architecture.
- [x] **v3.0.0:** Clean minimal UI, statistical A/B engine, rule-based NLU agent, session analytics, and HNSW heap performance monitor.
- [x] **v3.1.0:** Vector Batch JSON Export/Import with pre-computed vectors (0ms inference overhead).
- [x] **v3.2.0:** Temporal Search Trends & Topic Cluster Analytics via Recharts.
- [x] **v3.3.0:** HNSW Phase 2 (Int32 friends + BinaryHeap searchLayer) for 1,000+ items scaling.
- [x] **v3.4.0:** Hybrid BM25 + Dense vector search API (`/v1/search`) with dynamic convex alpha weighting.
- [x] **v3.5.0:** Python SDK client & unified Docker Compose (`api` + `redis` + `prometheus` + `grafana`).
- [ ] **v4.0.0:** Multi-modal Vision (CLIP/SigLIP) & Rust-compiled WebAssembly SIMD kernels.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for full milestones.

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
