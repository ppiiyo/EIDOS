# EIDOS Project Roadmap & Architectural Vision

---

## Completed Milestones (v1.0 — v1.2)

### Core Semantic & Vector Engine
- [x] Monorepo architecture with pnpm workspaces and Turborepo
- [x] In-browser client-side ML embedding inference (Transformers.js / WASM)
- [x] Fastify REST API microservice with constant-time Bearer token auth, rate limiting, and Zod validation
- [x] Standalone mathematical core package (`@eidos/core`) with L2 cosine similarity & MMR
- [x] Client SDK (`@eidos/sdk`) for isomorphic TypeScript and Node.js
- [x] Comprehensive documentation suite with benchmarks and integration guides

### Adaptive Intelligence Layer (AIL)
- [x] **User Tower**: Session/interaction history personalization with exponential recency decay and category diversity penalties
- [x] **Candidate Fusion**: Reciprocal Rank Fusion (RRF) and linear weighted score blending across multiple candidate generators
- [x] **Knowledge Graph Enrichment**: Topological path-based representation learning (PTransE-inspired)
- [x] **Multi-Feature Ranker**: 7-factor composite real-time ranking scoring
- [x] **Sampled MMR (SMMR)**: Boltzmann / Softmax stochastic sampling for controlled serendipity
- [x] **Context Signals**: Device, session, and diurnal temporal signals
- [x] **Online Feedback Loop**: Online gradient-style feedback registration for click, like, purchase, ignore, and dislike events

### Next-Gen Extensions (v1.2+)
- [x] **Multi-Interest Capsules (MIND/ComiRec-DR)**: Hyperspherical dynamic routing partitioning user history into K discrete interest vectors with Maximum Inner Product Search (MIPS) routing
- [x] **Contextual Bandits (LinUCB & Thompson Sampling)**: Real-time exploration/exploitation engine with $O(d^2)$ Sherman-Morrison rank-1 updates to resolve cold-start item starvation
- [x] **Approximate Nearest Neighbors (HNSW Index)**: Multi-layer hierarchical navigable small world graph index with recall@5 > 95%
- [x] **INT8 Scalar Quantization**: 4x RAM footprint reduction with integer dot-product acceleration
- [x] **Semantic Explainability Engine**: Decomposition of ranking feature attributions and Knowledge Graph path citation in English and Russian
- [x] **Conversational Vector Steering**: Latent space delta-vector arithmetic with angular boundary guards
- [x] **Stage-2 Cross-Encoder Re-Ranking**: Non-linear cross-feature interaction $[u; v; |u-v|; u \odot v]$ with token and category/tag Jaccard alignment

---

## Future Strategic Roadmap

### Phase 1: High-Throughput Streaming & Event Ingestion (Q4 2026)
- [ ] **Event Streaming Ingestion**: Native adapter for Redis Streams, NATS JetStream, and Apache Kafka/Redpanda for continuous sub-millisecond user profile updates.
- [ ] **Distributed Sharding**: Hash ring partitioning for vector catalogs scaling to 10M+ items across multiple worker nodes.
- [ ] **Background Asynchronous Worker**: BullMQ job queue for offloading heavy embedding generation on catalog imports.

### Phase 2: Multi-Modal Vision & Embedded Transformers (Q1 2027)
- [ ] **CLIP / SigLIP Joint Embeddings**: Support for multi-modal recommendation (text + image) critical for e-commerce, fashion, and visual media platforms.
- [ ] **Rust-Compiled WebAssembly SIMD Kernels**: Native AVX-512 and WebAssembly 128-bit SIMD acceleration for sub-microsecond vector operations on client edge devices.
- [ ] **Zero-Copy Memory-Mapped Storage**: LMDB / RocksDB persistent backing for billion-vector datasets.

### Phase 3: Conversational Agents & Autonomous Exploration (Q2 2027)
- [ ] **Conversational RecSys Agent**: Native LLM function-calling interface enabling conversational catalog discovery through natural dialogue.
- [ ] **Automated Multi-Armed Bandit Tuning**: Hyperparameter auto-tuning (Bayesian optimization of exploration $\alpha$ and diversity $\lambda$).
- [ ] **Self-Hosted Kubernetes Helm Chart & Terraform Modules**: Production-ready enterprise infrastructure deployments for AWS, GCP, Azure, and on-premise bare metal.
