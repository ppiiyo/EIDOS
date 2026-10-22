<div align="center">

# 🏷️ EIDOS

**Sub-millisecond Hybrid Vector & Lexical Search and Explainable Recommendation Engine in Strict TypeScript.**

*Engineered for high-throughput retrieval, deterministic explainability, and native multilingual indexing (`EN` • `RU` • `CJK`: `日本語` / `中文` / `한국어`).*

[![Build Status](https://img.shields.io/github/actions/workflow/status/ppiiyo/EIDOS/ci.yml?branch=main&style=flat-square&label=CI%20Pipeline)](https://github.com/ppiiyo/EIDOS/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%20Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2020.0.0-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Multilingual](https://img.shields.io/badge/NLP-EN%20%7C%20RU%20%7C%20CJK%20(JA%2FZH%2FKO)-6366F1?style=flat-square)](#4-native-cjk--multilingual-tokenization)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F172A?style=flat-square)](https://opensource.org/licenses/MIT)

[**Live Demo**](#-live-demo--quick-start) • [**Architecture**](#️-architecture) • [**Core Features**](#-core-features) • [**API & SDK Examples**](#️-api-usage-examples) • [**Testing & Quality**](#-testing--quality) • [**Roadmap**](#️-roadmap)

</div>

---

## 🚀 Live Demo & Quick Start

> ### 🌐 Interactive Workbench & API Sandbox
> **[![Live Demo](https://img.shields.io/badge/%F0%9F%9A%80%20Launch%20Interactive%20Studio-eidos--semantic--ideation--platform.ai.studio-10B981?style=for-the-badge)](https://eidos-semantic-ideation-platform.ai.studio/)**
>
> **🔗 Live Demo:** [**https://eidos-semantic-ideation-platform.ai.studio/**](https://eidos-semantic-ideation-platform.ai.studio/)
> *Explore 384-dimensional HNSW vector neighborhoods in 3D, tune dense/sparse RRF $\alpha$ weights and Multi-Objective Business Reranking sliders in real time, execute live `/v1/*` API calls, and inspect per-feature X-Ray explanations across Russian, English, and Japanese catalog presets.*

### Run Locally in 3 Commands

**Prerequisites:**
- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0` (`pnpm@9.15.4` is the **sole supported package manager**, enforced via `"preinstall": "npx only-allow pnpm"`; `npm`, `yarn`, and `bun` lockfiles are disallowed).

```bash
git clone https://github.com/ppiiyo/EIDOS.git && cd EIDOS
pnpm install
pnpm dev
```

Once started, the interactive **EIDOS Studio Workbench** and unified Fastify API routes (`/v1/*`, `/docs`, `/metrics`) are available at `http://localhost:3000`.

---

## 🏛️ Architecture

EIDOS is structured as a modular TypeScript monorepo separating client SDKs, the Fastify HTTP/security layer, and the zero-dependency mathematical core (`@eidos/core`).

```text
eidos/
├── apps/api/            # Fastify REST API
├── apps/workspace/      # React 19 Studio UI
├── packages/core/       # Math Engine
├── packages/sdk/        # @eidos/sdk
├── packages/python-sdk/ # Python client
└── scripts/             # Build & benchmark
```

```mermaid
flowchart TB
    subgraph ClientLayer["Client Layer"]
        SDK["@eidos/sdk\nIsomorphic TS/JS Client"]
        React["@eidos/react\nHooks & UI Components"]
        Workbench["apps/workspace\nInteractive Studio & 3D X-Ray UI"]
    end

    subgraph APILayer["API Layer (apps/api)"]
        Fastify["Fastify HTTP Server\n(/v1/search, /v1/recommend, /v1/catalog)"]
        Guardrails["SecurityGuardrails\nXSS, Prompt Injection & IEEE 754 Vector Bounds"]
        Auth["Bearer Auth & Zod Schema Validation"]
    end

    subgraph MathStorageLayer["Storage & Math Layer (@eidos/core)"]
        direction TB
        HNSW["HNSWIndex\nO(log N) ANN • Flat Int32 Adjacency • INT8 Quantization"]
        BM25["BM25Index + tokenizeCJK\nOkapi BM25 • Native EN / RU / CJK Unigram & N-Gram"]
        RRF["HybridSearch (RRF)\nReciprocal Rank Fusion (Dense + Sparse)"]
        Scaler["StreamingQuantileScaler\nO(1) Float64 Ring Buffer • O(log W) P01/P99 Quantiles"]
        Ranker["Multi-Feature Ranker & MMR\nExplainable Linear Scoring • O(1) Swap-and-Pop MMR"]
        WAL["Persistence Layer\nSQLite + Write-Ahead Log (WAL) Snapshots"]
    end

    SDK -->|REST / JSON| Auth
    React -->|REST / JSON| Auth
    Workbench -->|Direct & HTTP| Auth
    Auth --> Fastify
    Fastify --> Guardrails

    Guardrails -->|Validated 384-d Float32Array| HNSW
    Guardrails -->|Sanitized Multilingual Query| BM25

    HNSW -->|Dense Candidates| RRF
    BM25 -->|Sparse Lexical Hits| RRF

    RRF -->|Fused Candidates| Scaler
    Scaler -->|Normalized Features [0, 1]| Ranker
    HNSW <-->|Binary Serialization| WAL
```

### Monorepo Package Layout

| Package / App | Path | Responsibility |
| :--- | :--- | :--- |
| **`@eidos/core`** | `packages/core` | Pure TypeScript math & indexing engine: `HNSWIndex`, `BM25Index`, `tokenizeCJK`, `HybridSearch`, `Ranker`, `StreamingQuantileScaler`, `SMMR`, `BanditExplorer` (LinUCB), and `SecurityGuardrails`. |
| **`@eidos/sdk`** | `packages/sdk` | Lightweight, zero-dependency TypeScript/JavaScript client with `AbortController` timeouts and strict request/response typing. |
| **`eidos-sdk` (Python)** | `packages/python-sdk` | Official Python client for batch vector indexing, hybrid search, and backend recommendation workflows. |
| **`@eidos/api`** | `apps/api` | High-throughput Fastify REST server with Zod schema validation, Prometheus metrics (`/metrics`), and in-memory + WAL-backed vector storage. |
| **`@eidos/workspace`** | `apps/workspace` | Interactive React 19 + Three.js/WebGL engineering studio (`vite.config.ts`, `index.html`) for hybrid search benchmarking, MMR diversity tuning, and A/B simulation. |

---

## ⚡ Core Features

### 1. Hybrid Search (HNSW Dense + BM25 Sparse with RRF)
Pure vector search struggles with exact SKU identifiers, model numbers (`1000XM5`), and rare proper nouns; pure lexical search fails on semantic synonyms. EIDOS executes both in parallel and merges rankings via scale-invariant **Reciprocal Rank Fusion (RRF)**:

$$\text{RRF}(d) = \frac{w_{\text{dense}}}{k + \text{rank}_{\text{HNSW}}(d)} + \frac{w_{\text{sparse}}}{k + \text{rank}_{\text{BM25}}(d)}, \quad k = 60$$

- **Memory-Compact HNSW Graph**: Stores per-layer neighbor links in contiguous `Int32Array` buffers with optional **INT8 Scalar Quantization** ($4\times$ memory reduction) and binary min/max heaps for $O(\log N)$ layer traversal.
- **Robertson-Sparck Jones BM25**: Computes length-normalized term saturation ($k_1 = 1.5, b = 0.75$) with incremental document frequency updates.

### 2. Explainable AI (`Ranker.explain`) & $O(1)$ Streaming Feature Scaling
Raw production signals (e.g., item popularity `10,000+` vs. cosine similarity `[0, 1]`) cannot be combined linearly without normalization.
- **`StreamingQuantileScaler`**: Maintains a fixed-capacity circular `Float64Array` ring buffer with strictly **$O(1)$ FIFO ingestion/eviction** (zero `Array.shift()` memory reallocations) and **$O(\log W)$ binary-search quantile normalization** with 1st/99th percentile outlier clipping.
- **Deterministic Score Decomposition**: Every ranked candidate can be inspected via `ranker.explain(features)` to retrieve the exact weighted contribution of semantic similarity ($\alpha$), popularity ($\beta$), freshness ($\gamma$), user affinity ($\delta$), contextual relevance ($\zeta$), knowledge-graph centrality ($\eta$), and category repetition penalty ($-\epsilon$).
- **Strict IEEE 754 Invariants**: Weight validation rejects `NaN` / `±Infinity` with `TypeError` and negative weights with `RangeError` before any candidate scoring occurs.

### 3. Real-Time MMR Diversity Re-Ranking
To prevent recommendation carousels from collapsing into near-duplicate items from a single category, EIDOS applies **Maximal Marginal Relevance (MMR)** coupled with Shannon category entropy monitoring:

$$\text{MMR}(d_i) = \lambda \cdot \text{sim}(d_i, q) - (1 - \lambda) \cdot \max_{d_j \in S} \text{sim}(d_i, d_j)$$

- **$O(1)$ Swap-and-Pop Candidate Removal**: During iterative greedy selection, selected candidates are removed from the active pool using `pool[bestIndex] = pool[pool.length - 1]; pool.pop()`, eliminating $O(N)$ array shifts inside the inner loop.

### 4. Native CJK & Multilingual Tokenization
Standard whitespace tokenizers fail completely on unsegmented Chinese, Japanese, and Korean text. EIDOS includes a dedicated, zero-dependency multilingual tokenizer (`packages/core/src/bm25/cjk-tokenizer.ts`):
- **Unicode Script Detection**: Automatically identifies Chinese Hanzi (`\u4e00-\u9fa5`), Japanese Hiragana (`\u3040-\u309f`) & Katakana (`\u30a0-\u30ff`), and Korean Hangul (`\uac00-\ud7af`).
- **Deterministic Unigram & Compound N-Gram Segmentation**: Applies character-level unigram segmentation (`tokenizeCJK`) as a rock-solid zero-dependency fallback and enriches `BM25Index` with overlapping CJK bigrams/trigrams while preserving contiguous Latin/Cyrillic/alphanumeric tokens in mixed-script queries (e.g., `"Sony ワイヤレス 1000XM5"` $\rightarrow$ `["sony", "ワ", "イ", "ヤ", "レ", "ス", "1000xm5"]`).

### Algorithmic Complexity & Latency Reference

| Subsystem | Underlying Data Structure | Update / Ingest | Query / Transform | p50 Latency (10k items) |
| :--- | :--- | :--- | :--- | :--- |
| **`cosineSimilarity`** | L2-Normalized `Float32Array` (384-d) | $O(D)$ | $O(D)$ | `0.0004 ms` |
| **`HNSWIndex`** | Multi-layer `Int32Array` graph + Binary Heaps | $O(\log N)$ | $O(\log N)$ | `0.42 ms` |
| **`BM25Index` + `tokenizeCJK`** | Inverted `Map<string, Map<docId, tf>>` | $O(L)$ | $O(|Q| \cdot \text{df})$ | `0.68 ms` |
| **`StreamingQuantileScaler`** | Circular `Float64Array` ring buffer + lazy sort | **$O(1)$** (ring overwrite) | **$O(\log W)$** (binary search) | `0.002 ms` |
| **MMR Re-Ranking** | In-place array pool with swap-and-pop | — | $O(K \cdot M)$ ($O(1)$ delete) | `0.18 ms` |

---

## 🛠️ API Usage Examples

### 1. Hybrid Search (`cURL` — Multilingual / CJK + Semantic RRF)

```bash
curl -X POST http://localhost:3000/v1/search \
  -H "Authorization: Bearer eidos_dev_key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "无线降噪耳机 ANC 4K",
    "mode": "hybrid",
    "alpha": 0.6,
    "limit": 5,
    "minSimilarity": 0.25
  }'
```

### 2. Unified Diversified Recommendations (`cURL` — Adaptive / Simple / User + MMR)

```bash
curl -X POST http://localhost:3000/v1/recommend \
  -H "Authorization: Bearer eidos_dev_key" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": "item-0",
    "strategy": "adaptive",
    "limit": 5,
    "diversity_factor": 0.7,
    "filters": {
      "category": "Electronics",
      "min_price": 50,
      "exclude_ids": ["item-99"]
    }
  }'
```

### 3. TypeScript SDK & Explainable Scoring (`@eidos/sdk` + `@eidos/core`)

```typescript
import { EidosClient } from '@eidos/sdk';
import { Ranker, tokenizeCJK } from '@eidos/core';

// 1. Initialize the official TypeScript client
const client = new EidosClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY ?? 'eidos_dev_key',
  timeoutMs: 5000,
});

// 2. Execute Hybrid Search (Dense HNSW + Sparse CJK/Multilingual BM25)
const searchRes = await client.search({
  query: 'Красные беговые кроссовки / 東京ランニングシューズ',
  limit: 5,
});

// 3. Fetch MMR-diversified recommendations for a seed item
const recRes = await client.recommend({
  itemId: searchRes.results[0].id,
  limit: 4,
  diversityFactor: 0.65,
});

// 4. Deterministic Explainable AI (X-Ray Feature Contribution Breakdown)
const ranker = new Ranker({
  alpha: 0.45, // Semantic similarity weight
  beta: 0.15,  // Normalized popularity weight
  gamma: 0.10, // Freshness weight
  delta: 0.20, // User affinity weight
  epsilon: 0.05, // Category repetition penalty
  zeta: 0.03,  // Contextual relevance weight
  eta: 0.02,   // Knowledge-graph centrality weight
});

// Feed streaming observations into O(1) circular quantile scalers
for (const pop of [120, 450, 980, 2400, 5600, 10200]) {
  ranker.updateStatistics({ popularity: pop });
}

const explanation = ranker.explain({
  similarity: 0.91,
  popularity: 5600, // Automatically normalized to [0, 1] quantile rank
  freshness: 0.85,
  userAffinity: 0.72,
  categoryRepetition: 0.10,
  contextualRelevance: 0.80,
  kgCentrality: 0.65,
});

console.log(explanation);
/*
{
  similarityContribution: 0.4095,
  popularityContribution: 0.12,
  freshnessContribution: 0.085,
  userAffinityContribution: 0.144,
  contextualContribution: 0.024,
  kgCentralityContribution: 0.013,
  categoryPenaltyContribution: -0.005,
  totalScore: 0.7905
}
*/

// 5. Direct CJK + Multilingual Tokenization
console.log(tokenizeCJK('Sony ワイヤレス 1000XM5!'));
// -> ['sony', 'ワ', 'イ', 'ヤ', 'レ', 'ス', '1000xm5']
```

---

## 🧪 Testing & Quality

EIDOS enforces strict engineering invariants across all packages before any merge:

- **Zero-`any` Strict TypeScript**: Compiled with `"strict": true` across `@eidos/core`, `@eidos/sdk`, `@eidos/api`, and `@eidos/workspace`.
- **Mathematical & Boundary Guardrails**: Dedicated regression suites (`packages/core/src/tests/audit-regressions.test.ts` and `strict-validation.test.ts`) verify that:
  - `Ranker` throws `TypeError` on `NaN` / `±Infinity` weights and `RangeError` on negative weights.
  - `HNSWIndex` throws `RangeError` on vector dimension mismatches, empty vectors, or non-finite coordinates.
  - `StreamingQuantileScaler` evicts the oldest observations in strict FIFO ring-buffer order without memory leaks.
  - `SecurityGuardrails` blocks XSS, SQL/template payloads, and prompt-injection patterns on `/v1/search`.
- **195+ Unit & Integration Tests (Vitest)** + **Full-Pipeline E2E Tests (Playwright)**.

```bash
# Run all unit, mathematical invariant, and API integration tests
pnpm test

# Run strict TypeScript typechecking across all monorepo packages
pnpm lint

# Run Playwright end-to-end browser pipeline tests
pnpm test:e2e

# Build all packages and production bundles
pnpm build
```

---

## 🗺️ Roadmap

- [ ] **PostgreSQL `pgvector` Native Adapter**: Hybrid two-tier storage syncing hot in-memory `HNSWIndex` shards with persistent `pgvector` tables for 10M+ vector catalogs.
- [ ] **Dictionary-Backed CJK Morphological NLP**: Optional plug-in integration with `Intl.Segmenter` and dictionary-based morphological analyzers (MeCab / Lindera / Jieba) alongside the zero-dependency unigram/n-gram tokenizer.
- [ ] **WebGPU Compute Shaders**: Hardware-accelerated batch cosine distance and matrix-vector kernels for browser and edge runtimes.
- [ ] **gRPC & Binary Wire Protocol**: Protocol Buffers transport alongside Fastify REST for sub-millisecond inter-service microservice calls.
- [ ] **Online Multi-Armed Bandit Studio Controls**: Live visualization of LinUCB exploration confidence ellipsoids in the Studio UI.

---

## 🤝 Contributing & License

Contributions, bug reports, and algorithmic optimizations are welcome!

1. Fork the repository (`https://github.com/ppiiyo/EIDOS`) and create a feature branch.
2. Ensure all changes maintain strict TypeScript typing (no `any`) and documented time complexity ($O(1)$ / $O(\log N)$).
3. Add corresponding unit tests in `packages/core/src/tests/` or `apps/api/tests/`.
4. Verify that `pnpm lint`, `pnpm test`, and `pnpm build` pass with zero errors before opening a Pull Request.

### License

Distributed under the **MIT License**. See `LICENSE` for more information.
