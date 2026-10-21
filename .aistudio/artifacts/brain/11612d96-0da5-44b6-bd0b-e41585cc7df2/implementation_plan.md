# EIDOS Engine — Flagship Open-Source `README.md` Specification

This plan defines the visual architecture, engineering rigor, and content hierarchy for a flagship-caliber `README.md` for **EIDOS** (`github.com/ppiiyo/EIDOS`)—designed to match the standard of top-tier 10k+ star infrastructure repositories (such as Qdrant, Meilisearch, Fastify, and Turborepo).

### User Review & Critical Decisions

> [!IMPORTANT]
> The new `README.md` eliminates generic marketing fluff in favor of verifiable algorithmic guarantees, concrete memory layouts (`Float32Array`, `Int32Array`, `Float64Array` ring buffers), copy-pasteable wire-protocol examples, and clear visual hierarchy.

- **Confirmed Repository Target**: Badges (`ci.yml`, `deploy-pages.yml`, `benchmark.yml`), links, and clone commands point directly to `https://github.com/ppiiyo/EIDOS`.
- **Confirmed Delivery Mode**: Upon approval, `/README.md` will be updated in the workspace AND the complete Markdown will be printed in the chat response.
- **Visual & Technical Standard**: Structured with a centered hero header, shield badges, a high-visibility **Live Demo** callout (`[Live Demo Placeholder - Link will be added soon]`), a multi-subgraph Mermaid data-flow diagram, LaTeX mathematical formulations, a complexity & latency benchmark matrix, and side-by-side `cURL` + TypeScript (`@eidos/sdk` & `@eidos/core`) examples.

---

### 1. Overview & Core Concept

- **What It Delivers**: An authoritative, technically complete `README.md` in English that positions **EIDOS** as a production-grade, sub-millisecond Hybrid Search (Dense HNSW + Sparse Multilingual/CJK BM25) and Explainable Adaptive Recommendation Engine written in strict TypeScript.
- **Target Audience**: Principal Engineers, Staff ML/Search Engineers, and CTOs evaluating low-latency retrieval and ranking engines with native support for **English (EN)**, **Russian (RU)**, and **CJK (Chinese `中文`, Japanese `日本語`, Korean `한국어`)** scripts.
- **Key Value**: Demonstrates within 30 seconds *why* EIDOS is fast ($O(\log N)$ Int32 HNSW graph, $O(1)$ circular quantile feature scaling, $O(1)$ swap-and-pop MMR re-ranking), *how* every recommendation score is explained via deterministic feature weights, and *how* to launch the full stack locally in 3 commands.

---

### 2. User Experience & Visual Design (Document Layout & Information Architecture)

- **Hero & First-Screen Viewport Presence**:
  - Centered HTML `<div align="center">` header with bold typography, a crisp 1-sentence engineering value proposition, multilingual capability subtitle (`EN • RU • CJK: 日本語 / 中文 / 한국어`), and flat-square status badges (`TypeScript 5.8 Strict`, `Node.js >= 20`, `CI Build Status`, `License: MIT`).
  - Immediate **🚀 Live Demo & 30-Second Quick Start** block featuring a prominent blockquote call-to-action containing `[Live Demo Placeholder - Link will be added soon]` followed by a 3-command terminal snippet (`git clone`, `pnpm install`, `pnpm dev`).
- **Visual Hierarchy & Scannability**:
  - **Restrained Emoji Discipline**: Used strictly as section anchors (`🏷️`, `🚀`, `🏛️`, `⚡`, `🛠️`, `🧪`, `🗺️`, `🤝`).
  - **Structured Comparison & Complexity Tables**: Tabular breakdown of each subsystem's data structure, time complexity ($O(1)$, $O(\log N)$), memory footprint, and p50/p95/p99 latency.
  - **Collapsible / Scannable Code Blocks**: Syntax-highlighted `bash`, `typescript`, and `json` snippets showing both the exact request and the structured JSON response (including `explain` feature contributions and Shannon category entropy).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Mermaid.js Architecture Diagram**
  - *Chosen Approach*: A 3-tier Mermaid flowchart (`Client Layer` → `API & Security Layer` → `Storage & Core Math Layer`) explicitly mapping `@eidos/sdk`, `@eidos/react`, Fastify `/v1/*` routes, `SecurityGuardrails`, `HNSWIndex` (Int32 flat neighbor lists + INT8 scalar quantization), `BM25Index` (`tokenizeCJK`), `StreamingQuantileScaler` (circular `Float64Array` ring buffer), and `Ranker` / MMR.
  - *Why*: Gives systems engineers an immediate mental model of how queries, embeddings, lexical tokens, and ranking weights flow through the engine without reading source files first.
- **Decision 2: Dual-Level API Examples (Wire Protocol + TypeScript SDK/Core)**
  - *Chosen Approach*: Pair HTTP `cURL` calls to `/v1/search` and `/v1/recommend` with idiomatic `@eidos/sdk` (`EidosClient`) and `@eidos/core` (`Ranker.explain()`, `tokenizeCJK()`) TypeScript snippets.
  - *Why*: Proves both language-agnostic REST interoperability and first-class TypeScript ergonomics, including transparent Explainable AI (`explain`) breakdowns.

---

### 4. Technical Architecture & Section Blueprint *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        EIDOS Flagship README.md Blueprint                      │
├────────────────────────────────────────────────────────────────────────────────┤
│  1. 🏷️ Header & Badges                                                         │
│     ├─ Single-sentence engineering tagline + EN / RU / CJK support subtitle    │
│     └─ Badges: TypeScript 5.8 | Node >= 20 | CI Build (ppiiyo/EIDOS) | MIT     │
│                                                                                │
│  2. 🚀 Live Demo & Quick Start                                                 │
│     ├─ Highlighted CTA Banner: [Live Demo Placeholder - Link will be added soon]│
│     └─ 3-Command Local Launch: git clone -> pnpm install -> pnpm dev           │
│                                                                                │
│  3. 🏛️ System Architecture (Mermaid.js + Monorepo Package Matrix)              │
│     ├─ Client Layer: @eidos/sdk, @eidos/react, Eidos Studio Workbench          │
│     ├─ API Layer: Fastify, Zod Validation, SecurityGuardrails (XSS/Prompt Inj) │
│     └─ Storage & Math Layer: HNSWIndex (Int32/INT8), BM25 CJK, Quantile Scaler │
│                                                                                │
│  4. ⚡ Core Features & Algorithmic Guarantees                                  │
│     ├─ Hybrid Search: Dense HNSW O(log N) + Sparse BM25 Okapi + RRF Fusion     │
│     ├─ Explainable AI: Multi-Feature Linear Ranker + O(1) Ring-Buffer Scaler   │
│     ├─ Real-Time MMR Diversity: Swap-and-Pop O(1) Pruning + Shannon Entropy    │
│     └─ Native CJK & Multilingual: Unicode Unigram/N-Gram (ZH/JA/KO + RU/EN)    │
│                                                                                │
│  5. 🛠️ API & SDK Usage Examples (cURL + TypeScript)                            │
│     ├─ Hybrid Search (/v1/search) with CJK & Multilingual queries              │
│     ├─ Diversified Recommendations (/v1/recommend) with MMR lambda tuning      │
│     └─ Explainable Scoring (Ranker.explain & Adaptive Recommendations)         │
│                                                                                │
│  6. 🧪 Testing, Strict Typing & Quality Gates                                  │
│     ├─ Zero-`any` Strict TypeScript + IEEE 754 NaN/Infinity Guardrails         │
│     ├─ 195+ Vitest Unit & Regression Suites + Playwright Full-Pipeline E2E     │
│     └─ Latency Benchmark Table (p50 / p95 / p99 at 10k+ vectors)               │
│                                                                                │
│  7. 🗺️ Engineering Roadmap & 🤝 Contributing / MIT License                     │
│     ├─ PostgreSQL pgvector native adapter, Dictionary/Morphological CJK NLP,   │
│     │  WebGPU batch distance kernels, Distributed Raft/gRPC sharding           │
│     └─ PR Quality Gates (pnpm lint, pnpm test, pnpm build) & MIT License       │
└────────────────────────────────────────────────────────────────────────────────┘
```
