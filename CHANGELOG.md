# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-18

### Added
- Complete monorepo architecture powered by pnpm workspaces and Turborepo.
- In-browser client-side ML embedding generation via `@xenova/transformers` (all-MiniLM-L6-v2 ONNX Web).
- Production Fastify REST API (`apps/api`) with `/v1/recommend`, `/v1/search`, `/v1/catalog`, and `/v1/health`.
- Mathematical foundation package (`@eidos/core`) including SIMD-ready cosine similarity, Shannon entropy, and MMR re-ranking.
- Official client SDK (`@eidos/sdk`) for Node.js and TypeScript.
- Comprehensive documentation suite with genuine reproducible benchmarks, RFC-standard API references, and architecture guides.
- Automated CI workflow with type checking, linting, and unit tests.

### Removed
- Deprecated unused Firebase and external telemetry dependencies in favor of clean local storage and self-hosted vector indexing.
- Removed unverified conversion marketing metrics to ensure technical transparency.
