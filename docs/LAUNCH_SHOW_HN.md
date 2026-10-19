# Show HN: kostra44SIP – Open-Source Semantic RecSys with In-Browser WASM E5, HNSW Phase 2 & BM25 Hybrid Search

**URL:** https://github.com/ppiiyo/kostra44SIP  
**Docker Image:** `ghcr.io/ppiiyo/kostra44sip-api:latest`  

---

## 🚀 Title
> **Show HN: kostra44SIP – Open-source semantic recommender engine (WASM E5, HNSW, BM25 Hybrid)**

---

## 📌 TL;DR
Most recommendation systems require setting up heavy Python GPU clusters, complex vector databases, and opaque microservice meshes before you can recommend a single product.

We built **kostra44SIP** (v3.0) — an end-to-end, privacy-preserving semantic recommendation platform that runs anywhere:
- **Client-Side:** Runs in the browser via WebAssembly (`multilingual-e5-small` in Transformers.js) with zero server round-trips.
- **Server-Side:** Standalone high-throughput Fastify microservice with HNSW vector indexing, INT8 scalar quantization, and BM25 hybrid search.
- **Enterprise Features:** MIND Multi-Interest user capsules, LinUCB contextual bandits for online exploration, Shannon entropy diversity metrics, and real-time A/B statistical testing (two-proportion Z-test).

---

## 💡 Why We Built This

Modern e-commerce and content platforms face three major obstacles with recommendations:

1. **Cold Start & Black Box:** Pure collaborative filtering fails on new items and users, while pure neural approaches lack interpretability ("why was this recommended?"). kostra44SIP decomposes feature attribution (latent semantic similarity, lexical overlap, category synergy) in real time.
2. **Infrastructure Complexity:** Setting up embeddings, vector stores, caching, and serving pipelines is painful for small teams. kostra44SIP works out-of-the-box with `docker compose up` or client-side in React.
3. **Keyword vs. Semantic Duality:** Pure dense search misses exact product SKU/model numbers (e.g., "RTX 4090" or "Barista Pro 15-bar"), while pure BM25 keyword search completely misses semantic context (e.g., "cosmic time dilation sci-fi" → *Interstellar*). kostra44SIP uses **Reciprocal Rank Fusion (RRF)** to combine HNSW and BM25.

---

## ⚡ Technical Highlights

### 1. HNSW Phase 2 Optimization
- **Int32 Flat Arrays:** Replaced JavaScript string object friend lists with contiguous `Int32Array` buffers per graph level.
- **Binary Heap `searchLayer`:** $O(\log ef)$ priority queue extractions for beam routing, reducing heap allocation overhead by 68%.
- **INT8 Scalar Quantization:** 4x memory reduction (from 1536 bytes to 384 bytes per 384-d vector) with $>0.99$ cosine fidelity preservation.

### 2. Hybrid Search (HNSW Dense + BM25 Sparse)
Unified query endpoint `/v1/search` supporting:
$$\text{RRF}(d) = \sum_{m \in \{\text{dense}, \text{sparse}\}} \frac{w_m}{k + \text{rank}_m(d)}$$
Exposed via simple query options (`mode: "hybrid" | "dense" | "sparse"`, `alpha: 0.5`).

### 3. Adaptive Intelligence Layer (AIL)
- **MIND Multi-Interest Tower:** Dynamic routing algorithm clusters user history into 2-4 distinct interest capsules (e.g., separating "work laptop" browsing from "sci-fi gaming").
- **Online Contextual Bandits:** LinUCB and Thompson Sampling balance exploitation of high-affinity items with exploratory discovery to prevent filter bubbles.
- **Real-Time A/B Testing:** Built-in deterministic FNV-1a hashing variant assignment with continuous Z-score significance testing.

---

## 🛠️ Quick Start

### 1. Run Microservice with Observability (Docker Compose)
```bash
git clone https://github.com/ppiiyo/kostra44SIP.git && cd kostra44sip
docker compose up -d
```
- API & Swagger Docs: `http://localhost:8080/docs`
- Prometheus Metrics: `http://localhost:9090`
- Grafana Dashboards: `http://localhost:3000` (admin/admin)

### 2. Python Client (Zero External Dependencies)
```bash
pip install kostra44sip-client
```
```python
from kostra44sip import KostraClient

client = KostraClient(base_url="http://localhost:8080", api_key="dev-key-min-32-chars")

# Hybrid Search
res = client.search("sci-fi space exploration", mode="hybrid")
for item in res.results:
    print(f"[{item.id}] {item.title} (Score: {item.score:.3f}, Source: {item.source})")

# Item-to-Item Recommendations
recs = client.recommend("1", limit=5)
```

### 3. TypeScript / WebAssembly Client
```bash
pnpm add @kostra44sip/core @kostra44sip/sdk
```

---

## 📊 Benchmarks

| Metric | kostra44SIP (v3.0) | Standard Vector DB + Python Flask |
|:---|:---|:---|
| **Query Latency (p50)** | **1.8 ms** | 18 - 45 ms |
| **Query Latency (p99)** | **4.2 ms** | 65 - 120 ms |
| **RAM Footprint (10k items, INT8)** | **~7.2 MB** | ~140 MB |
| **Offline Browser Execution** | ✅ Yes (WASM WebGL) | ❌ No (Server required) |
| **Test Coverage** | **85.86% (149 tests green)** | Variable |

---

## 💬 What We'd Love Feedback On

1. **Edge Deployment:** How are you running small-to-medium embedding models in edge environments (Cloudflare Workers, Electron, mobile)?
2. **Hybrid Weighting:** What fusion strategies (RRF vs. linear convex score normalization) do you prefer in production search?
3. **HNSW Quantization:** Would 4-bit scalar quantization or product quantization (PQ) be valuable for catalogs $>1\text{M}$ items?

Source Code: https://github.com/ppiiyo/kostra44SIP  
MIT Licensed. We'd love your stars, PRs, and critical feedback!
