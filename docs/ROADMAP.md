# EIDOS Project Roadmap

---

## Current Version: 1.0.0 (Production Rebuild)

- [x] Monorepo architecture with pnpm workspaces and Turborepo
- [x] In-browser client-side ML embedding inference (Transformers.js / WASM)
- [x] Fastify REST API with Bearer token authentication, rate limiting, and Zod validation
- [x] Standalone mathematical core package (`@eidos/core`) with L2 cosine similarity & MMR
- [x] Client SDK (`@eidos/sdk`) for Python and Node.js
- [x] Complete documentation suite with benchmarks and integration guides
- [x] Removal of deprecated Firebase dependencies in favor of lightweight local/REST architecture

---

## Planned Milestones

### Q4 2026: Vector Engine Enhancements
- [ ] Direct native Qdrant and Milvus vector index adapters for datasets > 1M objects
- [ ] Asynchronous background batch embedding generation via BullMQ / Redis
- [ ] Multi-modal support (CLIP image + text joint embeddings for fashion and apparel)

### Q1 2027: Enterprise & Analytics
- [ ] Real-time telemetry sink for click-through attribution and A/B test tracking
- [ ] Dynamic user session embedding adaptation (real-time intent drift tracking)
- [ ] Self-hosted Helm chart for Kubernetes deployment
- [ ] Zero-copy WebAssembly SIMD kernels for edge devices
