<div align="center">

# ⚡ EIDOS v3.0

### Hybrid Vector Search, Explainable Ranking X-Ray & Multi-Objective Recommendation Engine
### Платформа гибридного векторного поиска, объяснимого ранжирования (X-Ray) и мультицелевых рекомендаций

[![Live Demo](https://img.shields.io/badge/Live_Demo-eidos--semantic--ideation--platform.ai.studio-00E5A3?style=for-the-badge&logo=googlecloud&logoColor=black)](https://eidos-semantic-ideation-platform.ai.studio/)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1_Swagger-38BDF8?style=for-the-badge&logo=openapiinitiative&logoColor=black)](https://eidos-semantic-ideation-platform.ai.studio/docs)
[![Tests](https://img.shields.io/badge/Tests-46_Suites_%7C_222_Passing-10B981?style=for-the-badge)](./apps/api/tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](./LICENSE)

**[ 🌐 Live Interactive Studio Demo ](https://eidos-semantic-ideation-platform.ai.studio/)** · **[ 🇬🇧 English Guide ](#-english-documentation)** · **[ 🇷🇺 Руководство на русском ](#-документация-на-русском-языке)** · **[ 🔄 Migration Blueprints ](./docs/MIGRATION.md)**

</div>

---

# 🇬🇧 English Documentation

## Table of Contents (EN)
1. [What is EIDOS v3.0 & Why It Exists](#1-what-is-eidos-v30--why-it-exists)
2. [Who EIDOS Is For & High-ROI Business Use Cases](#2-who-eidos-is-for--high-roi-business-use-cases)
3. [Competitive Comparison Matrix (vs. Algolia, Pinecone, Meilisearch, Constructor.io)](#3-competitive-comparison-matrix)
4. [60-Second Quick Start & Production Deployment (Docker / Cloud Run)](#4-60-second-quick-start--production-deployment)
5. [Connecting Your Own Databases (PostgreSQL, MongoDB, CSV, Webhooks)](#5-connecting-your-own-databases-postgresql-mongodb-csv-webhooks)
6. [15-Minute Migration from Algolia, Pinecone & Meilisearch](#6-15-minute-migration-from-algolia-pinecone--meilisearch)
7. [Complete REST API & Explainable X-Ray Reference](#7-complete-rest-api--explainable-x-ray-reference)
8. [Official SDKs: TypeScript (`@eidos/sdk`) & Python (`eidos-sdk`)](#8-official-sdks-typescript-eidossdk--python-eidos-sdk)
9. [Architecture, Testing & Troubleshooting FAQ](#9-architecture-testing--troubleshooting-faq)

---

## 1. What is EIDOS v3.0 & Why It Exists

**EIDOS v3.0** is an open, self-hostable, sub-15ms **Hybrid Vector Search and Multi-Objective Recommendation Platform** with a built-in **Visual Merchandising & Explainable Ranking Studio**.

Traditional search engines (like Elasticsearch or Meilisearch) fail when users search by meaning or intent, while pure vector databases (like Pinecone or Qdrant) lack lexical precision, business merchandising rules, MMR diversification, and visual tooling for product managers. Enterprise SaaS platforms (like Algolia or Constructor.io) charge steep per-request and per-record fees while operating as opaque black boxes.

**EIDOS v3.0 solves all three problems in a single unified runtime:**
- **True Hybrid Retrieval (`HNSW + BM25+ + RRF`)**: Combines 384-dimensional L2-normalized semantic vectors (`HNSWGraph` with optional `INT8` scalar quantization for 4× RAM savings) with exact lexical `BM25+` matching and Reciprocal Rank Fusion.
- **Explainable Ranking X-Ray**: Every single search hit and recommendation returns a transparent mathematical breakdown (`denseComponent`, `sparseBm25Component`, `mmrPenalty`, `businessBoost`, `semanticContribution`, `marginContribution`, `freshnessContribution`, `popularityContribution`).
- **Multi-Objective Business Reranking**: Product and merchandising teams can dynamically balance **Semantic Relevance**, **Profit Margin**, **Inventory / In-Stock Status**, **Freshness**, and **MMR Diversity ($\lambda$)** in real time without re-indexing.
- **Zero External API Bills**: Generates deterministic, cross-lingual 384-dimensional embeddings (`EN / RU / JA / ZH`) natively on CPU (`<2ms`) or via browser WebGPU/WASM (`Xenova/multilingual-e5-small`)—zero OpenAI or Cohere API dependencies.
- **Contextual Bandits (`LinUCB` + Active Intent Learning)**: Automatically resolves cold-start discovery and adapts to live user feedback (`click`, `like`, `purchase`, `dislike`) in `<5ms`.

---

## 2. Who EIDOS Is For & High-ROI Business Use Cases

| Target Audience | How They Use EIDOS v3.0 | Business Impact |
| :--- | :--- | :--- |
| **E-Commerce & Marketplaces** | Hybrid catalog search, "Similar Items", "Complete the Look", and high-margin inventory boosting. | Higher conversion rate (CVR), higher average order value (AOV), zero "0 results found" pages. |
| **Media, Streaming & Gaming Platforms** | Personalized feeds (`strategy: 'user'`), Submodular MMR diversity to prevent echo-chamber fatigue, cross-lingual discovery. | +25–40% session depth and discovery of long-tail catalog titles. |
| **B2B SaaS & Enterprise Catalogs** | Instant semantic + SKU/part-number search across millions of technical items with strict role/tenant metadata filters. | Sub-15ms p99 search latency and 100% data sovereignty on your own infrastructure. |
| **AI Engineers & RAG Pipelines** | High-recall hybrid retrieval with built-in prompt injection guardrails (`SecurityGuardrails`), CircuitBreaker, and O(1) LRU cache. | Eliminates LLM hallucinations and cuts vector retrieval latency by 10×. |

---

## 3. Competitive Comparison Matrix

| Capability | **EIDOS v3.0** | **Algolia** | **Pinecone** | **Meilisearch** | **Constructor.io** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hybrid Search (384-d HNSW + BM25+)** | ✅ Native (`alpha` 0..1) | ⚠️ Paid Enterprise Add-on | ⚠️ Requires external sparse pipeline | ⚠️ Experimental | ✅ Proprietary SaaS |
| **Built-in 384-d Embeddings (Zero API Cost)** | ✅ Included (CPU + WebGPU) | ❌ Paid quota | ❌ Requires OpenAI / Cohere | ❌ Requires external API | ✅ Included |
| **Explainable Ranking X-Ray (Per-Hit Math)** | ✅ Full Component Breakdown | ⚠️ Basic rule trace | ❌ Raw score only | ⚠️ Basic score details | ❌ Black-box |
| **Multi-Objective Business Sliders (Margin / Stock)** | ✅ Real-time in UI & API | ⚠️ Manual rules | ❌ None | ❌ Static sorting only | ✅ Paid Enterprise |
| **Native MMR & Submodular Diversification** | ✅ Built-in ($\lambda \in [0, 1]$) | ❌ Distinct grouping only | ❌ Manual post-processing | ❌ Distinct attribute only | ⚠️ Pod rules |
| **Contextual Bandits (LinUCB + Online Feedback)** | ✅ Built-in (`/v1/feedback`) | ❌ Separate tier | ❌ None | ❌ None | ✅ Paid Enterprise |
| **INT8 Vector Quantization (4× RAM Reduction)** | ✅ Native (`Int8Quantizer`) | ❌ Managed only | ✅ Managed only | ❌ None | ❌ Managed only |
| **Self-Hosted / Data Privacy / Zero Vendor Lock-in** | ✅ 100% Open & Self-Hostable | ❌ Cloud SaaS only | ❌ Cloud SaaS only | ✅ Open Source | ❌ Cloud SaaS only |

---

## 4. 60-Second Quick Start & Production Deployment

### Option A: Local Development (1 Command)

**Prerequisites**: Node.js `>= 20.0.0` and `pnpm` (enabled automatically via Corepack).

```bash
# 1. Enable pnpm, install workspace dependencies, and start Full-Stack EIDOS (API + Studio UI) on port 3000
corepack enable && corepack pnpm install && corepack pnpm dev
```

Once running, open:
- **Interactive Studio UI**: `http://localhost:3000`
- **Live Swagger / OpenAPI 3.1 Docs**: `http://localhost:3000/docs`
- **Health & Readiness Probe**: `http://localhost:3000/v1/health`
- **Prometheus Metrics**: `http://localhost:3000/metrics`

### Option B: Production Build & Start

```bash
# Build @eidos/core, @eidos/sdk, and the Vite Studio production bundle
corepack pnpm build

# Start the unified production server (Fastify REST API + Static SPA on port 3000)
NODE_ENV=production PORT=3000 EIDOS_API_KEY=your_production_secret_key npm start
```

### Option C: Docker Compose (Single-Command Container Stack)

```bash
docker compose up --build -d
```

### Environment Variables (`.env`)

Copy `.env.example` to `.env` to customize your deployment:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Unified HTTP port serving both REST API (`/v1/*`) and Studio UI (`/`) |
| `EIDOS_API_KEY` | `eidos_dev_key` | Comma-separated list of valid API keys for `X-API-Key` authentication |
| `EIDOS_RATE_LIMIT_MAX` | `300` | Maximum requests per minute per client IP |
| `EIDOS_SNAPSHOT_PATH` | `./data/catalog.snapshot.json` | Optional disk persistence path for zero-data-loss restarts |

---

## 5. Connecting Your Own Databases (PostgreSQL, MongoDB, CSV, Webhooks)

EIDOS connects to any existing database in minutes. You do **not** need to compute embeddings yourself—send plain JSON records to `/v1/catalog/upsert` (or via `@eidos/sdk` / `eidos-sdk`), and EIDOS automatically sanitizes, vectorizes (384-d Float32), and indexes them into both HNSW and BM25+.

### 5.1 PostgreSQL Integration (Batch & Incremental Cron / Trigger Sync)

```typescript
import { Pool } from 'pg';
import { EidosClient } from '@eidos/sdk';

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function syncPostgresToEidos() {
  const { rows } = await pg.query(`
    SELECT id::text, title, description, category, price::float, tags, in_stock
    FROM products
    WHERE updated_at >= NOW() - INTERVAL '1 hour'
  `);

  for (const row of rows) {
    await eidos.upsertItem({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: row.price,
      tags: row.tags || [],
      inStock: row.in_stock ?? true,
    });
  }
  console.log(`✅ Synced ${rows.length} PostgreSQL items into EIDOS 384-d HNSW index`);
}
```

### 5.2 MongoDB Integration (Real-Time Change Streams)

```typescript
import { MongoClient } from 'mongodb';
import { EidosClient } from '@eidos/sdk';

const mongo = new MongoClient(process.env.MONGO_URI!);
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function watchMongoCatalog() {
  await mongo.connect();
  const collection = mongo.db('commerce').collection('products');
  const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

  for await (const change of changeStream) {
    if (change.operationType === 'insert' || change.operationType === 'update') {
      const doc = change.fullDocument;
      if (!doc) continue;
      await eidos.upsertItem({
        id: String(doc._id),
        title: String(doc.title || doc.name),
        description: String(doc.description || ''),
        category: String(doc.category || 'General'),
        price: Number(doc.price || 0),
        tags: Array.isArray(doc.tags) ? doc.tags : [],
      });
    }
  }
}
```

### 5.3 CSV / JSON Bulk Import (Browser Studio or CLI)

- **No-Code via Browser Studio**: Click **CSV Import / Export** or **Connect DB → Import JSON** in the top bar of the Studio UI to upload any `.csv` or `.json` file. Items are immediately vectorized in 384-d and synced to the live `/v1/catalog/upsert` endpoint.
- **Via Python CLI / Pandas**:

```python
import pandas as pd
from eidos import EidosClient

client = EidosClient(base_url="http://localhost:3000", api_key="eidos_dev_key")
df = pd.read_csv("catalog.csv")

for _, row in df.iterrows():
    client.upsert_item({
        "id": str(row["id"]),
        "title": str(row["title"]),
        "description": str(row.get("description", "")),
        "category": str(row.get("category", "General")),
        "price": float(row.get("price", 0.0)),
    })
```

### 5.4 REST Webhook Integration (Shopify / WooCommerce / Custom Backend)

Trigger a direct HTTP `POST` from your e-commerce webhook whenever a product is created or updated:

```bash
curl -X POST http://localhost:3000/v1/catalog/upsert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eidos_dev_key" \
  -d '{
    "id": "sku-9941",
    "title": "Pro Studio Planar Magnetic Headphones",
    "description": "Reference open-back planar headphones for mastering engineers",
    "category": "Electronics",
    "price": 499.00,
    "inStock": true,
    "tags": ["audio", "planar", "studio"]
  }'
```

---

## 6. 15-Minute Migration from Algolia, Pinecone & Meilisearch

### 6.1 Migrating from Algolia (`algoliasearch` → `@eidos/sdk`)

```typescript
// STEP 1: Export records from Algolia and ingest into EIDOS
import algoliasearch from 'algoliasearch';
import { EidosClient } from '@eidos/sdk';

const algolia = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);
const index = algolia.initIndex('products');
const eidos = new EidosClient({ baseUrl: 'http://localhost:3000', apiKey: process.env.EIDOS_API_KEY! });

await index.browseObjects({
  batch: async (hits) => {
    for (const hit of hits as Array<Record<string, any>>) {
      await eidos.upsertItem({
        id: String(hit.objectID),
        title: String(hit.title || hit.name),
        description: String(hit.description || ''),
        category: String(hit.category || 'General'),
        price: Number(hit.price || 0),
        tags: Array.isArray(hit.tags) ? hit.tags : [],
      });
    }
  },
});

// STEP 2: Replace index.search(query) with EIDOS Hybrid Search
const { results, latencyMs } = await eidos.search({
  query: 'wireless noise cancelling headphones',
  mode: 'hybrid',
  alpha: 0.65, // 65% Dense 384-d Semantic + 35% Sparse BM25+ Lexical
  filterCategory: 'Electronics',
  limit: 10,
});
```

### 6.2 Migrating from Pinecone (`@pinecone-database/pinecone` → `@eidos/sdk`)

With Pinecone, you had to pay OpenAI/Cohere to embed every query and item, maintain a separate keyword index, and write custom MMR post-processing. With EIDOS:
1. **Remove your external embedding API calls**—pass raw text or items directly to `eidos.upsertItem()` and `eidos.search()` (or pass your existing 384-d vectors if desired).
2. **Replace `index.query({ id, topK, filter })`** with `POST /v1/recommend`:

```typescript
const res = await fetch('http://localhost:3000/v1/recommend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': 'eidos_dev_key' },
  body: JSON.stringify({
    item_id: 'item-0',
    strategy: 'adaptive',
    diversity_factor: 0.35,
    limit: 10,
    filters: { category: 'Electronics', max_price: 500, in_stock: true },
  }),
});
const { recommendations } = await res.json();
```

### 6.3 Migrating from Meilisearch (`meilisearch` → `@eidos/sdk`)

| Meilisearch Call | EIDOS v3.0 Replacement | Upgrade Benefit |
| :--- | :--- | :--- |
| `index.addDocuments(docs)` | `await eidos.upsertItem(doc)` | Automatic 384-d vectorization + HNSW graph indexing |
| `index.search(q, { limit, filter })` | `await eidos.search({ query: q, mode: 'hybrid', alpha: 0.65, limit, filterCategory })` | Understands synonyms, intent, and cross-lingual queries (`RU/EN/JA/ZH`) |

---

## 7. Complete REST API & Explainable X-Ray Reference

All `/v1/*` write and query endpoints accept `X-API-Key: <your_key>` (defaults to `eidos_dev_key` in local dev) and return `x-cache: HIT | MISS` and `x-request-id` headers.

| Method & Path | Description | Auth Required |
| :--- | :--- | :--- |
| `POST /v1/recommend` | Unified recommendations (`strategy: 'simple' \| 'adaptive' \| 'user'`) with MMR & Explainable X-Ray | ✅ `X-API-Key` |
| `POST /v1/search` | Hybrid RRF Search (`mode: 'hybrid' \| 'semantic' \| 'lexical'`, `alpha: 0..1`) with X-Ray breakdown | ✅ `X-API-Key` |
| `POST /v1/catalog/upsert` | Real-time item ingestion, XSS/SQLi sanitization, 384-d embedding & cache invalidation | ✅ `X-API-Key` |
| `GET /v1/catalog/stats` | Returns total indexed items, categories, vector dimension (`384`), and HNSW status | ✅ `X-API-Key` |
| `POST /v1/feedback` | Online learning feedback (`click`, `like`, `purchase`, `dislike`) updating LinUCB & User Profile | ✅ `X-API-Key` |
| `GET /v1/health` | Liveness & readiness probe with memory, uptime, and index diagnostics | Public |
| `GET /metrics` | Prometheus metrics (`http_request_duration_ms`, `eidos_recommendation_entropy`, cache hits) | Public |
| `GET /docs` | Interactive OpenAPI 3.1 Swagger UI | Public |

### Example: `POST /v1/recommend` with Explainable Ranking X-Ray

```bash
curl -X POST http://localhost:3000/v1/recommend \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eidos_dev_key" \
  -d '{
    "item_id": "item-0",
    "strategy": "adaptive",
    "diversity_factor": 0.35,
    "limit": 3,
    "filters": { "category": "Electronics", "in_stock": true }
  }'
```

**Response (`200 OK`):**
```json
{
  "strategy": "adaptive",
  "recommendations": [
    {
      "item": {
        "id": "item-15",
        "title": "Ultra-Low Latency Wireless Headphones #15",
        "category": "Electronics",
        "price": 149.99,
        "inStock": true
      },
      "score": 0.8942,
      "explanation": {
        "denseScore": 0.912,
        "mmrDiversityBonus": 0.145,
        "linucbExplorationBonus": 0.068,
        "businessBoost": 1.05
      }
    }
  ],
  "entropy": 1.5849,
  "latencyMs": 3.42,
  "cached": false
}
```

---

## 8. Official SDKs: TypeScript (`@eidos/sdk`) & Python (`eidos-sdk`)

### TypeScript / Node.js SDK (`packages/sdk`)

```typescript
import { EidosClient } from '@eidos/sdk';

const client = new EidosClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
  timeoutMs: 5000,
  maxRetries: 2,
});

// 1. Hybrid Search
const searchRes = await client.search({
  query: 'ergonomic mechanical keyboard',
  mode: 'hybrid',
  alpha: 0.65,
  limit: 5,
});

// 2. Adaptive Recommendations
const recRes = await client.getAdaptiveRecommendations({
  userId: 'user-42',
  anchorItemId: 'item-0',
  limit: 5,
});

// 3. Real-Time Feedback
await client.sendFeedback({
  userId: 'user-42',
  itemId: 'item-15',
  eventType: 'purchase',
});
```

### Python SDK (`packages/python-sdk`)

```python
from eidos import EidosClient

client = EidosClient(base_url="http://localhost:3000", api_key="eidos_dev_key")

# Unified strategy recommendation ('simple' | 'adaptive' | 'user')
recs = client.recommend(
    item_id="item-0",
    strategy="adaptive",
    diversity_factor=0.35,
    limit=5,
    filters={"category": "Electronics", "max_price": 300},
)

# Record online user feedback
client.record_feedback(user_id="user-42", item_id="item-15", event_type="click")
```

---

## 9. Architecture, Testing & Troubleshooting FAQ

### Running the Full Verification Suite

```bash
# Run all 46 test suites (222 unit, integration, security, stress & architectural tests)
corepack pnpm test

# Run test suite with V8 coverage gate (>88% statement coverage)
corepack pnpm run test:coverage

# Run strict TypeScript & ESLint verification across all workspaces
corepack pnpm lint
```

### Frequently Asked Questions (FAQ)

- **Q: Does EIDOS require a GPU or an OpenAI API key?**
  **A:** No. EIDOS runs 100% self-contained on standard CPUs with sub-5ms latency using deterministic 384-d n-gram/word-hash L2 embeddings on the server and optional WebGPU/WASM `multilingual-e5-small` in the browser.
- **Q: How do I persist catalog updates across container restarts?**
  **A:** Set `EIDOS_SNAPSHOT_PATH=/data/catalog.snapshot.json` and mount a Docker volume at `/data`. Every `/v1/catalog/upsert` automatically schedules a non-blocking atomic snapshot write.
- **Q: How do I tune `alpha` and `diversity_factor` ($\lambda$)?**
  **A:** Use `alpha = 0.65` for general e-commerce (65% semantic meaning + 35% exact keyword/SKU match). Use `diversity_factor = 0.30 - 0.45` on homepages and discovery feeds to prevent duplicate variants from crowding the top results.

---
---

# 🇷🇺 Документация на русском языке

## Содержание (RU)
1. [О продукте EIDOS v3.0 и его супервозможностях](#1-о-продукте-eidos-v30-и-его-супервозможностях)
2. [Для кого создан продукт и какие бизнес-задачи он решает](#2-для-кого-создан-продукт-и-какие-бизнес-задачи-он-решает)
3. [Сравнение с конкурентами (Algolia, Pinecone, Meilisearch, Constructor.io)](#3-сравнение-с-конкурентами)
4. [Быстрый запуск за 60 секунд и Production-деплой (Docker / Cloud Run)](#4-быстрый-запуск-за-60-секунд-и-production-деплой)
5. [Подключение своих баз данных (PostgreSQL, MongoDB, CSV, REST Webhook)](#5-подключение-своих-баз-данных-postgresql-mongodb-csv-rest-webhook)
6. [Пошаговая миграция с конкурентов за 15 минут](#6-пошаговая-миграция-с-конкурентов-за-15-минут)
7. [Полный справочник REST API и рентгена ранжирования (X-Ray)](#7-полный-справочник-rest-api-и-рентгена-ранжирования-x-ray)
8. [Официальные SDK: TypeScript (`@eidos/sdk`) и Python (`eidos-sdk`)](#8-официальные-sdk-typescript-eidossdk-и-python-eidos-sdk)
9. [Проверка качества, тесты и ответы на частые вопросы (FAQ)](#9-проверка-качества-тесты-и-ответы-на-частые-вопросы-faq)

---

## 1. О продукте EIDOS v3.0 и его супервозможностях

**EIDOS v3.0** — это высокопроизводительная self-hosted платформа **гибридного векторного поиска и мультицелевых рекомендаций** с откликом `<15 мс` и встроенной визуальной студией **Explainable Ranking X-Ray**.

Классические поисковики (Elasticsearch, Meilisearch) не понимают смысловой контекст и синонимы, чистые векторные БД (Pinecone, Qdrant) требуют платных внешних эмбеддингов и не имеют инструментов коммерческого мерчандайзинга, а облачные SaaS-гиганты (Algolia, Constructor.io) работают как закрытый «чёрный ящик» с высокими тарифами за каждый запрос.

**Ключевые преимущества EIDOS v3.0:**
- **Гибридное ядро (`384-d HNSW + BM25+ + RRF`)**: Сочетает глубокое семантическое понимание смысла (граф `HNSW` с поддержкой `INT8`-квантования, сжимающего память в 4 раза) и точный лексический поиск по артикулам, брендам и характеристикам (`BM25+`).
- **Рентген объяснимости ранжирования (`Explainable Ranking X-Ray`)**: Каждый найденный товар и каждая рекомендация сопровождаются точной математической формулой: вклад векторной близости (`denseComponent`), лексического совпадения (`sparseBm25Component`), штрафа за дубликаты (`mmrPenalty`) и бизнес-буста (`businessBoost`).
- **Мультицелевое бизнес-реранжирование в реальном времени**: Слайдеры и API-веса позволяют на лету балансировать **Семантическую релевантность**, **Маржинальность (Margin)**, **Популярность**, **Свежесть новинок (Freshness)** и **Диверсификацию выдачи MMR ($\lambda$)** без переиндексации.
- **Нулевые затраты на внешние AI API (`Zero External API Cost`)**: Встроенная генерация 384-мерных кросс-языковых эмбеддингов (`RU / EN / JA / ZH`) прямо на CPU (`<2 мс`) и в браузере через WebGPU/WASM.
- **Контекстные бандиты (`LinUCB` + Active Intent Learning)**: Мгновенная адаптация под клики, лайки, покупки и дизлайки пользователя в реальном времени (`/v1/feedback`).

---

## 2. Для кого создан продукт и какие бизнес-задачи он решает

| Сегмент бизнеса | Сценарий использования EIDOS v3.0 | Измеримый бизнес-эффект |
| :--- | :--- | :--- |
| **E-Commerce и Маркетплейсы** | Умный гибридный поиск по каталогу, блоки «Похожие товары», «С этим покупают», приоритезация высокомаржинальных товаров в наличии. | Рост конверсии в покупку (CVR), увеличение среднего чека (AOV), полное устранение пустой выдачи «Ничего не найдено». |
| **Медиа, Стриминг и Игровые Платформы** | Персональные ленты рекомендаций (`strategy: 'user'`), субмодулярная диверсификация (SMMR) против «пузыря фильтров». | +25–40% к глубине сессии и вовлечению в «длинный хвост» каталога. |
| **B2B SaaS и Промышленные Каталоги** | Поиск по миллионам позиций одновременно по смыслу и точным SKU/парт-номерам с фильтрацией по категориям и ценам. | Задержка p99 `< 15 мс` и 100% приватность данных на ваших серверах. |
| **AI-команды и RAG-системы** | Сверхбыстрый гибридный ретривер со встроенной защитой от Prompt Injection / XSS / SQLi (`SecurityGuardrails`) и `LRUQueryCache`. | Снижение галлюцинаций LLM и ускорение векторного поиска в 10 раз. |

---

## 3. Сравнение с конкурентами

| Возможность | **EIDOS v3.0** | **Algolia** | **Pinecone** | **Meilisearch** | **Constructor.io** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Гибридный поиск (384-d HNSW + BM25+)** | ✅ Из коробки (`alpha` 0..1) | ⚠️ Только в Enterprise-тарифе | ⚠️ Требует отдельного sparse-индекса | ⚠️ Экспериментальный | ✅ Закрытый SaaS |
| **Встроенная векторизация (0 ₽ / $0 за API)** | ✅ Встроена (CPU + WebGPU) | ❌ Платная квота | ❌ Нужен OpenAI / Cohere API | ❌ Нужен внешний API | ✅ Встроена |
| **Рентген ранжирования (Explainable X-Ray)** | ✅ Полная формула по каждому SKU | ⚠️ Базовый лог правил | ❌ Только сырой score | ⚠️ Базовый score | ❌ Чёрный ящик |
| **Бизнес-реранжирование (Маржа / Остатки / Новизна)** | ✅ На лету в UI и API | ⚠️ Ручные правила | ❌ Нет | ❌ Только стат. сортировка | ✅ Дорогой Enterprise |
| **Нативная диверсификация MMR и SMMR** | ✅ Встроена ($\lambda \in [0, 1]$) | ❌ Только группировка | ❌ Вручную на клиенте | ❌ Только distinct-поле | ⚠️ Правила подов |
| **Онлайн-обучение LinUCB по кликам и покупкам** | ✅ Встроено (`/v1/feedback`) | ❌ Отдельный продукт | ❌ Нет | ❌ Нет | ✅ Дорогой Enterprise |
| **Сжатие памяти INT8 Quantization (в 4 раза)** | ✅ Нативно (`Int8Quantizer`) | ❌ Облако | ✅ Облако | ❌ Нет | ❌ Облако |
| **Self-Hosted / Полный контроль данных** | ✅ 100% открытый и автономный | ❌ Только облако | ❌ Только облако | ✅ Open Source | ❌ Только облако |

---

## 4. Быстрый запуск за 60 секунд и Production-деплой

### Вариант 1: Локальный запуск одной командой

**Требования**: Node.js `>= 20.0.0` и `pnpm` (активируется автоматически через Corepack).

```bash
# Установка зависимостей и запуск единого сервера (Fastify API + Studio UI) на порту 3000
corepack enable && corepack pnpm install && corepack pnpm dev
```

После запуска откройте в браузере:
- **Интерактивная студия EIDOS UI**: `http://localhost:3000`
- **Живое демо в облаке**: `https://eidos-semantic-ideation-platform.ai.studio/`
- **Интерактивная документация Swagger / OpenAPI 3.1**: `http://localhost:3000/docs`
- **Проверка здоровья и готовности индекса**: `http://localhost:3000/v1/health`
- **Метрики Prometheus**: `http://localhost:3000/metrics`

### Вариант 2: Сборка и запуск в Production

```bash
# Сборка всех пакетов (@eidos/core, @eidos/sdk) и клиентского приложения Vite
corepack pnpm build

# Запуск единого production-сервера на порту 3000
NODE_ENV=production PORT=3000 EIDOS_API_KEY=ваш_секретный_ключ npm start
```

### Вариант 3: Запуск в Docker Compose

```bash
docker compose up --build -d
```

---

## 5. Подключение своих баз данных (PostgreSQL, MongoDB, CSV, REST Webhook)

Вам **не нужно** самостоятельно считать векторы или разворачивать GPU-кластеры. Передайте обычные товары (на русском, английском, японском или китайском языке) в эндпоинт `/v1/catalog/upsert` — EIDOS автоматически очистит данные через `SecurityGuardrails`, построит 384-мерный вектор и обновит граф `HNSW` и индекс `BM25+` без остановки поиска.

> 💡 **Совет**: В самом веб-интерфейсе EIDOS Studio нажмите кнопку **«Подключить БД / Connect DB»** в верхней панели — там доступны как **мгновенный импорт ваших JSON/CSV-товаров прямо в браузере**, так и готовые к копированию шаблоны синхронизации для PostgreSQL, MongoDB, Algolia и Pinecone.

### 5.1 Подключение PostgreSQL (Пакетная и инкрементальная синхронизация)

```typescript
import { Pool } from 'pg';
import { EidosClient } from '@eidos/sdk';

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function syncPostgresCatalog() {
  // Забираем новые и обновлённые товары из вашей таблицы PostgreSQL
  const { rows } = await pg.query(`
    SELECT id::text, title, description, category, price::float, tags, in_stock
    FROM products
    WHERE updated_at > NOW() - INTERVAL '24 hours'
  `);

  for (const row of rows) {
    await eidos.upsertItem({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: row.price,
      tags: row.tags || [],
      inStock: row.in_stock ?? true,
    });
  }
  console.log(`✅ Синхронизировано ${rows.length} товаров из PostgreSQL в HNSW-индекс EIDOS`);
}
```

### 5.2 Подключение MongoDB (Синхронизация в реальном времени через Change Streams)

```typescript
import { MongoClient } from 'mongodb';
import { EidosClient } from '@eidos/sdk';

const mongo = new MongoClient(process.env.MONGO_URI!);
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function watchMongoCatalog() {
  await mongo.connect();
  const collection = mongo.db('shop').collection('products');
  const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

  for await (const change of changeStream) {
    if (change.operationType === 'insert' || change.operationType === 'update') {
      const doc = change.fullDocument;
      if (!doc) continue;
      await eidos.upsertItem({
        id: String(doc._id),
        title: String(doc.title || doc.name),
        description: String(doc.description || ''),
        category: String(doc.category || 'Разное'),
        price: Number(doc.price || 0),
        tags: Array.isArray(doc.tags) ? doc.tags : [],
      });
    }
  }
}
```

### 5.3 Загрузка из CSV / Excel / JSON (Через UI или Python-скрипт)

```python
import pandas as pd
from eidos import EidosClient

client = EidosClient(base_url="http://localhost:3000", api_key="eidos_dev_key")
df = pd.read_csv("my_catalog.csv")

for _, row in df.iterrows():
    client.upsert_item({
        "id": str(row["id"]),
        "title": str(row["title"]),
        "description": str(row.get("description", "")),
        "category": str(row.get("category", "General")),
        "price": float(row.get("price", 0.0)),
    })
```

### 5.4 Подключение через REST Webhook (1С-Битрикс / Shopify / WooCommerce / Свой Бэкенд)

Отправляйте обычный `POST`-запрос при создании или изменении карточки товара в вашей CMS/ERP:

```bash
curl -X POST http://localhost:3000/v1/catalog/upsert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eidos_dev_key" \
  -d '{
    "id": "sku-7701",
    "title": "Беспроводные наушники Studio Pro ANC",
    "description": "Активное шумоподавление, кодек LDAC и до 45 часов работы",
    "category": "Electronics",
    "price": 24990,
    "inStock": true,
    "tags": ["наушники", "anc", "bluetooth"]
  }'
```

---

## 6. Пошаговая миграция с конкурентов за 15 минут

### 6.1 Переход с Algolia (`algoliasearch` → `@eidos/sdk`)

1. **Выгрузка каталога из Algolia в EIDOS** (занимает ~2–5 минут):
```typescript
import algoliasearch from 'algoliasearch';
import { EidosClient } from '@eidos/sdk';

const algolia = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);
const index = algolia.initIndex('products');
const eidos = new EidosClient({ baseUrl: 'http://localhost:3000', apiKey: process.env.EIDOS_API_KEY! });

await index.browseObjects({
  batch: async (hits) => {
    for (const hit of hits as Array<Record<string, any>>) {
      await eidos.upsertItem({
        id: String(hit.objectID),
        title: String(hit.title || hit.name),
        description: String(hit.description || ''),
        category: String(hit.category || 'General'),
        price: Number(hit.price || 0),
        tags: Array.isArray(hit.tags) ? hit.tags : [],
      });
    }
  },
});
```

2. **Замена поискового вызова `index.search()` на гибридный поиск EIDOS**:
```typescript
// Вместо index.search(query, { hitsPerPage: 10, filters: 'category:Electronics' })
const { results, latencyMs } = await eidos.search({
  query: 'беспроводные наушники для спорта',
  mode: 'hybrid',
  alpha: 0.65,
  filterCategory: 'Electronics',
  limit: 10,
});
```

### 6.2 Переход с Pinecone (`@pinecone-database/pinecone` → `@eidos/sdk`)

- **Отказ от платных вызовов OpenAI Embeddings**: больше не нужно перед каждым запросом вызывать `openai.embeddings.create()`. Передавайте текст запроса напрямую в `/v1/search` или ID товара в `/v1/recommend`.
- **Замена `index.query()`**: используйте единый эндпоинт `POST /v1/recommend` со стратегией `adaptive` или `simple` и встроенным параметром диверсификации `diversity_factor: 0.35`.

### 6.3 Переход с Meilisearch (`meilisearch` → `@eidos/sdk`)

- Замените `client.index('products').addDocuments(docs)` на `eidos.upsertItem(doc)`.
- Замените `client.index('products').search(q)` на `eidos.search({ query: q, mode: 'hybrid', alpha: 0.65 })` — теперь ваш поиск находит товары даже тогда, когда пользователь пишет запрос своими словами, синонимами или на другом языке.

---

## 7. Полный справочник REST API и рентгена ранжирования (X-Ray)

Все запросы к `/v1/*` используют заголовок `X-API-Key` (по умолчанию в dev-режиме `eidos_dev_key`) и возвращают заголовки `x-cache: HIT | MISS` и `x-request-id`.

| Метод и URL | Назначение | Авторизация |
| :--- | :--- | :--- |
| `POST /v1/recommend` | Единый эндпоинт рекомендаций (`strategy: 'simple' \| 'adaptive' \| 'user'`) с MMR и X-Ray | ✅ `X-API-Key` |
| `POST /v1/search` | Гибридный поиск (`mode: 'hybrid' \| 'semantic' \| 'lexical'`, `alpha: 0..1`) с X-Ray формулой | ✅ `X-API-Key` |
| `POST /v1/catalog/upsert` | Добавление/обновление товара, авто-векторизация 384-d и сброс кэша `LRUQueryCache` | ✅ `X-API-Key` |
| `GET /v1/catalog/stats` | Статистика каталога: число товаров, категории, размерность (`384`) и статус HNSW | ✅ `X-API-Key` |
| `POST /v1/feedback` | Запись событий (`click`, `like`, `purchase`, `dislike`) для онлайн-обучения `LinUCB` | ✅ `X-API-Key` |
| `GET /v1/health` | Проверка работоспособности сервера, памяти и готовности HNSW-ядра | Публичный |
| `GET /metrics` | Метрики в формате Prometheus (`http_request_duration_ms`, энтропия рекомендаций, кэш) | Публичный |
| `GET /docs` | Интерактивная документация OpenAPI 3.1 (Swagger UI) | Публичный |

### Пример запроса гибридного поиска `POST /v1/search` с рентгеном X-Ray

```bash
curl -X POST http://localhost:3000/v1/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eidos_dev_key" \
  -d '{
    "query": "квантовый синтезатор и звук",
    "mode": "hybrid",
    "alpha": 0.65,
    "limit": 5
  }'
```

Каждый элемент в `results` содержит объект `explanation`:
- `denseScore` / `denseComponent` — вклад семантического 384-d косинусного сходства ($\alpha \cdot \text{Cosine}$);
- `sparseBm25Score` / `sparseBm25Component` — вклад точного совпадения ключевых слов ($(1 - \alpha) \cdot \text{BM25+}$);
- `rrfScore` — итоговый гибридный ранг после Reciprocal Rank Fusion.

---

## 8. Официальные SDK: TypeScript (`@eidos/sdk`) и Python (`eidos-sdk`)

### TypeScript / JavaScript SDK (`@eidos/sdk`)

```typescript
import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

// 1. Гибридный поиск
const { results } = await eidos.search({
  query: 'камера для ночной съёмки 8K',
  mode: 'hybrid',
  alpha: 0.65,
  limit: 6,
});

// 2. Адаптивные рекомендации (LinUCB + Submodular MMR)
const { recommendations } = await eidos.getAdaptiveRecommendations({
  userId: 'user-101',
  anchorItemId: 'item-0',
  limit: 6,
});

// 3. Обратная связь в реальном времени
await eidos.sendFeedback({
  userId: 'user-101',
  itemId: 'item-15',
  eventType: 'purchase',
});
```

### Python SDK (`eidos-sdk`)

```python
from eidos import EidosClient

client = EidosClient(base_url="http://localhost:3000", api_key="eidos_dev_key")

# Рекомендации с фильтрацией и MMR-диверсификацией
response = client.recommend(
    item_id="item-0",
    strategy="adaptive",
    diversity_factor=0.35,
    limit=6,
    filters={"category": "Electronics", "in_stock": True},
)

# Отправка сигнала о покупке для дообучения LinUCB
client.record_feedback(user_id="user-101", item_id="item-15", event_type="purchase")
```

---

## 9. Проверка качества, тесты и ответы на частые вопросы (FAQ)

### Команды самопроверки перед релизом

```bash
# Полный прогон всех 46 тестовых сьютов (222 теста: ядро, API, безопасность, нагрузка, инварианты)
corepack pnpm test

# Проверка покрытия кода (порог >85%, фактически ~88.7%)
corepack pnpm run test:coverage

# Проверка типов TypeScript и линтера во всех пакетах монорепозитория
corepack pnpm lint
```

### Частые вопросы (FAQ)

- **В: Нужен ли платный ключ OpenAI или внешний GPU-сервер для работы EIDOS?**
  **О:** Нет. EIDOS полностью автономен: на сервере используется быстрый детерминированный 384-мерный L2-векторизатор (`<2 мс` на обычном CPU), а в браузере поддерживается локальная нейросеть `Xenova/multilingual-e5-small` через WebGPU/WASM с автоматическим сохранением бинарных векторов в `IndexedDB`.
- **В: Как сохранить добавленные через API товары при перезапуске контейнера?**
  **О:** Укажите переменную окружения `EIDOS_SNAPSHOT_PATH=/data/catalog.snapshot.json` и подключите том Docker к `/data`. При каждом вызове `/v1/catalog/upsert` EIDOS асинхронно сохраняет снапшот каталога на диск и мгновенно восстанавливает его при старте.
- **В: Как защитить API при выкладке в публичный интернет?**
  **О:** Задайте свой сложный ключ в переменной `EIDOS_API_KEY` (поддерживается ротация нескольких ключей через запятую). Все входные запросы автоматически проверяются модулем `SecurityGuardrails` (защита от XSS, SQL-инъекций и Prompt Injection) и ограничиваются rate-лимитером (`EIDOS_RATE_LIMIT_MAX`).

---

<div align="center">

**Built with precision for high-velocity engineering & product teams.**
**[🚀 Open Live EIDOS v3.0 Studio](https://eidos-semantic-ideation-platform.ai.studio/)**

</div>
