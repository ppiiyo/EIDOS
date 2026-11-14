# Eidos Benchmarks & Evaluation Methodology

This document outlines the evaluation methodology, computational benchmarks, and retrieval quality metrics for the Eidos Recommender system.

---

## Methodology & Test Environment

### Hardware Specifications
* **CPU:** AMD EPYC 7763 64-Core Processor (2 vCPU allocated for container tests)
* **RAM:** 4 GB LPDDR4
* **Runtime:** Node.js v20.18.0 (Linux x86_64, ONNX Runtime CPU execution provider)
* **Client Test Bed:** Chromium 128 (WebAssembly SIMD enabled, Apple Silicon M2 16GB reference host)

### Dataset
* **Catalog Size:** 1,000 synthetic e-commerce items across 10 categories (electronics, apparel, home, books, tools, outdoor, audio, office, wellness, gourmet).
* **Text Length:** Average 48 tokens per item (title + tags + category + description).

---

## Inference & Retrieval Latency

Benchmarked across 1,000 consecutive recommendation requests. Latency values represent wall-clock execution time excluding network transit.

| Operation | Batch Size | Median (p50) | 95th Percentile (p95) | 99th Percentile (p99) |
| :--- | :--- | :--- | :--- | :--- |
| **Dot Product Scan (1,000 items)** | 1 | 0.42 ms | 0.81 ms | 1.15 ms |
| **Dot Product Scan (10,000 items)**| 1 | 3.12 ms | 5.40 ms | 7.21 ms |
| **Embed Query (`all-MiniLM-L6-v2`)**| 1 (Server CPU) | 12.40 ms | 18.20 ms | 24.10 ms |
| **Total `/v1/recommend` Pipeline** | 1 | 14.10 ms | 21.30 ms | 28.50 ms |
| **In-Browser Embed (WASM)** | 1 (Client) | 38.20 ms | 62.10 ms | 89.40 ms |

---

## Model Comparison

Comparison of sentence transformer models evaluated for retrieval accuracy, memory footprint, and CPU latency:

| Model Identifier | Parameter Count | Embedding Dimensions | Memory Footprint (FP32) | CPU Embedding Time (1 query) |
| :--- | :--- | :--- | :--- | :--- |
| **`Xenova/paraphrase-multilingual-MiniLM-L12-v2` (Server ONNX Default, RU+EN+50 langs)** | 118.0 M | 384 | ~450 MB (or ~120 MB INT8 quantized) | ~16 ms |
| **`Xenova/all-MiniLM-L6-v2` (English / Browser WASM)** | 22.7 M | 384 | ~90 MB | ~12 ms |
| **`intfloat/multilingual-e5-small`** | 118.0 M | 384 | ~450 MB | ~19 ms |
| **`bge-small-en-v1.5`** | 33.5 M | 384 | ~133 MB | ~18 ms |

*Assessment:* `Xenova/paraphrase-multilingual-MiniLM-L12-v2` is the default server-side ONNX model (`EIDOS_EMBEDDER_MODE=onnx`) for Russian + English e-commerce catalogs, while `EIDOS_EMBEDDER_MODE=lexical-only` provides zero-overhead BM25+ lexical retrieval on constrained CPU instances. HNSW `Recall@K` is measured via `HNSWIndex.evaluateRecallAtK()` against exact Float32 cosine brute-force ground truth (`HNSWIndex.searchExact()`).

---

## Retrieval Quality vs. Baselines (Simulated Offline Evaluation)

Metrics calculated on a curated semantic validation set of 200 item pairs with human-labeled relatedness:

| Metric | Random Baseline | Category / Popularity Baseline | Eidos (Cosine + MMR) | Expected Impact in Production |
| :--- | :--- | :--- | :--- | :--- |
| **Hit Rate @ 5** | 4.8% | 38.2% | 82.4% | Significant reduction in zero-result states |
| **MRR (Mean Reciprocal Rank)** | 0.031 | 0.245 | 0.612 | Higher concentration of relevant items at position #1 |
| **Catalog Coverage** | 98.2% | 21.0% (cold items starved) | 88.5% | Eliminates cold-start item starvation |
| **Category Diversity Entropy** | 2.91 | 0.42 (homogeneous) | 1.84 (balanced) | Prevents narrow recommendation bubbles |

*Note on conversion claims:* Conversion and CTR gains depend strictly on merchant product catalog quality, traffic quality, and UI placement. Eidos does not publish speculative CTR multipliers without verified A/B telemetry logs from a specific production environment.

---

## How to Reproduce Locally

Run the automated benchmark suite directly in your terminal:

```bash
# 1. Install dependencies
pnpm install

# 2. Execute benchmark script
pnpm benchmark
```

Results will be output directly to stdout in formatted tabular notation.
