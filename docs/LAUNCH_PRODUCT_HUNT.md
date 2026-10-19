# Product Hunt Launch Kit: Eidos RecSys

**Product Name:** Eidos  
**Tagline:** Semantic recommendation & hybrid vector search engine for developers  
**Repository:** https://github.com/ppiiyo/Eidos  
**Pricing:** 100% Free & Open Source (MIT)  

---

## 🏷️ Category & Topics
- Developer Tools
- Artificial Intelligence
- Open Source
- E-commerce / Search / Recommendations

---

## 📝 Product Description

### Short Description (60 characters max)
Semantic recommender & hybrid search engine running anywhere.

### Medium Description (260 characters max)
Open-source RecSys engine combining in-browser WASM embeddings, HNSW vector search, and BM25 keyword fusion. Zero complex infrastructure: deploy with one Docker command or run client-side with 0ms server latency.

---

## ✨ Key Features Bullet Points (for PH Listing)

- ⚡ **Zero-Latency In-Browser WASM:** Generate 384-dimensional multilingual embeddings directly in client devices using WebAssembly.
- 🎯 **Hybrid Search Engine:** Combines exact keyword matching (BM25) with deep conceptual similarity (HNSW) via Reciprocal Rank Fusion.
- 📦 **HNSW Phase 2 Engine:** High-performance approximate nearest neighbor retrieval using flat `Int32Array` buffers and Binary Heap beam routing.
- 🧠 **Multi-Interest User Tower (MIND):** Dynamically partitions user history into multiple distinct personality capsules to prevent recommendation collapse.
- 🎰 **Online Contextual Bandits:** Real-time LinUCB and Thompson Sampling algorithms to automatically explore emerging trends and maximize CTR.
- 📊 **Built-In Statistical A/B Testing:** Automatic user bucketing and live two-proportion hypothesis Z-testing with conversion attribution.
- 🐳 **Turnkey Docker Compose:** Microservice, Redis cache, Prometheus metrics (`/metrics`), and pre-configured Grafana dashboards in one command.
- 🐍 **Zero-Dependency Python SDK:** Idiomatic `pip install eidos-client` for seamless integration into data science pipelines.

---

## 💬 Maker's First Comment (To post immediately upon launch)

> Hey Product Hunt! 👋
> 
> I'm excited to share **Eidos** — an open-source semantic recommendation and search platform built for engineers who want modern AI recommendations without spinning up an enterprise data science cluster.
> 
> ### The Backstory
> Building high-performing recommendations usually forces you into a dilemma:
> 1. Use simple keyword matching or SQL joins that miss semantic relationships entirely.
> 2. Or stitch together hosted vector databases, embedding APIs, caching layers, and Python workers — introducing high latency, cloud costs, and operational drag.
> 
> We wanted a third way: an engine lightweight enough to run entirely in the browser via WebAssembly (0ms roundtrips and 100% user privacy), yet powerful enough to scale as a microservice processing thousands of requests per second.
> 
> ### What's Inside v3.0:
> - **In-browser E5 Inference:** Real multilingual text embeddings using Transformers.js in WebAssembly.
> - **HNSW Phase 2:** Flat Int32Array neighbor tables and Binary Heap searchLayer for sub-millisecond ANN search.
> - **BM25 Hybrid Fusion:** Best of both worlds — exact SKU/keyword matching + semantic understanding.
> - **Explainability:** Real-time feature attribution explaining *why* an item was suggested.
> - **Ready-to-Deploy:** Python SDK (`pip install eidos-client`), npm packages (`@eidos/core`, `@eidos/sdk`), and a 1-click Docker Compose stack with Prometheus & Grafana.
> 
> We're 100% open-source under MIT! Give it a spin locally or via Docker, and let us know what features you'd like to see next.
> 
> 🔗 GitHub: https://github.com/ppiiyo/Eidos

---

## 🎨 Asset Checklist for Product Hunt Submission

- [x] **Icon / Logo:** 240x240 PNG (`public/favicon.svg` or custom mark)
- [x] **Thumbnail Gallery (1270x760):**
  1. Slide 1: Workspace Overview (Interactive 3D Vector Hypersphere & Real-time Metrics)
  2. Slide 2: Hybrid Search (Side-by-side comparison of BM25 exact vs E5 semantic search)
  3. Slide 3: Adaptive Intelligence (MIND multi-interest tower & contextual bandits)
  4. Slide 4: Real-time A/B Testing & Statistical Z-Score significance dashboard
  5. Slide 5: Grafana Observability Dashboard (QPS, p99 latency, and Shannon entropy)
- [x] **Demo Video:** 60-second video walkthrough of the in-browser WASM inference and vector space visualization.
