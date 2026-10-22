# EIDOS v2.0 — Deep Audit, Visual Overhaul & Competitive Super-Capabilities Plan

This plan covers a full technical and visual-UX audit of EIDOS, adding the live demo URL (`https://eidos-semantic-ideation-platform.ai.studio/`) to `README.md`, eliminating remaining UI/API discrepancies, implementing three industry-first capabilities that surpass Algolia and Pinecone, and delivering the audit report and Master Engineering Prompt directly in the chat response.

## User Review & Critical Decisions

> [!IMPORTANT]
> Updated per your feedback:

- **No Master Prompt in `README.md` or Repo Files**: `README.md` will strictly contain clean, production-grade project documentation and the live demo link (`https://eidos-semantic-ideation-platform.ai.studio/`). The full audit report and the Master Engineering Prompt will be output exclusively in our chat response.
- **Confirmed Killer Capabilities (Live Implementation)**:
  1. **Explainable Ranking X-Ray (HNSW + BM25 + RRF + MMR)**: Per-item mathematical score decomposition showing dense cosine similarity, sparse BM25 lexical token hits, Reciprocal Rank Fusion ($k=60$) rank contributions, and MMR diversity adjustments.
  2. **Built-in Live API Playground & Multi-Language SDK Code Generator**: Real HTTP execution against `/v1/search`, `/v1/recommend`, `/v1/catalog/stats`, and `/v1/health` with live response headers (`x-cache`, `x-response-time`, `x-request-id`) and one-click code generation for TypeScript SDK, Python SDK, and cURL.
  3. **Interactive Multi-Objective Business Reranking Sliders**: Real-time sliders for Semantic Relevance ($\alpha$), Popularity ($\beta$), Freshness ($\gamma$), Profit/Price Affinity ($\delta$), and MMR Diversity ($\lambda$) with live NDCG@K, Shannon Category Entropy, and catalog coverage metrics.
- **Confirmed Visual & UX Focus**: Deep UI/UX overhaul of the React 19 Studio Workbench paired with live Fastify backend integration on port `3000`.

---

## 1. Overview & Key Audit Findings

### Deep Audit Findings to Resolve
1. **Documentation & Live Demo Link in `README.md`**:
   - Replace `[Live Demo Placeholder - Link will be added soon]` in `README.md` with the live production demo URL `https://eidos-semantic-ideation-platform.ai.studio/` and synchronize cURL/SDK port examples to port `3000`.
2. **Mocked API Console vs. Real Fastify Backend**:
   - Upgrade the Studio's API Console from simulated in-memory responses (`POST /v1/search/hybrid`, `POST /v1/recommendations/mmr`) to real `fetch()` requests against the unified Fastify `/v1/search`, `/v1/recommend` (`strategy: 'simple' | 'adaptive' | 'user'`), `/v1/catalog/stats` (5,005 HNSW items), and `/v1/health` routes.
3. **Opaque Search & Recommendation Scoring**:
   - Expose a visual **Ranking X-Ray Inspector** in both Search and Recommendations views showing exact HNSW dense rank, BM25 sparse rank, matched multilingual tokens (`RU` / `EN` / `CJK`), RRF fused score contributions, and business weight multipliers.
4. **Static Merchandising Controls**:
   - Add continuous multi-objective business weight sliders (Semantic Relevance $\alpha$, Popularity $\beta$, Freshness $\gamma$, Price/Value Affinity $\delta$, MMR Diversity $\lambda$) so teams can tune ranking formulas in real time and observe immediate `NDCG@K` and Shannon Entropy shifts.
5. **Visual & Typographic Polish**:
   - Replace legacy `border-l-4` callout borders and pill-badge clutter with clean single-elevation surfaces, hairline dividers, `Plus Jakarta Sans` + `JetBrains Mono` (`tabular-nums`) typography, and responsive 1440px workspace ergonomics.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Explainable Hybrid Search X-Ray Flow**:
   - User enters a multilingual query (`RU` / `EN` / `JA` CJK) and adjusts the $\alpha$ slider (`0.00` Pure BM25 $\leftrightarrow$ `1.00` Pure 384-d Vector).
   - User toggles **Ranking X-Ray Inspector** on search results to inspect stacked horizontal contribution bars: Dense HNSW Cosine Score & Rank, Sparse BM25 Score & Matched Tokens, RRF Fused Score ($\frac{\alpha}{60 + r_{\text{dense}}} + \frac{1-\alpha}{60 + r_{\text{sparse}}}$), and Security Guardrail status.
2. **Multi-Objective Business Reranking Flow**:
   - In the Recommendations Workbench, the user adjusts 5 real-time objective sliders ($\alpha$ Semantic Similarity, $\beta$ Popularity, $\gamma$ Freshness, $\delta$ Price/Value Affinity, $\lambda$ MMR Diversity) plus category/price filters.
   - As sliders move, candidate cards re-rank in `< 5ms` with live **X-Ray Score Decomposition** bars and real-time KPI deltas (`NDCG@K`, `Shannon Entropy bits`, `Intra-List Diversity`, `Catalog Coverage %`).
3. **Live HTTP API Playground & SDK Generator Flow**:
   - User opens the **Live API & SDK Console**, selects `/v1/recommend`, `/v1/search`, `/v1/catalog/stats`, or `/v1/health`, and clicks **Execute Live HTTP Request**.
   - The console fires a real HTTP request to the Fastify backend, displays HTTP status, latency, and response headers (`x-cache: HIT | MISS`, `x-request-id`, `x-response-time`, `x-ratelimit-remaining`), and generates copy-ready **TypeScript (`@eidos/sdk`)**, **Python (`eidos-sdk`)**, and **cURL** snippets matching the exact active parameters.

### Visual Identity & Theme
- **Aesthetic Direction**: High-precision Enterprise Developer & ML Observability Console.
- **Color Palette & Surface Posture**:
  - Dominant Canvas (60%): Deep Obsidian Slate (`#090D16`) in dark mode / Crisp Alabaster (`#F8FAFC`) in light mode.
  - Structural Surfaces (30%): Elevated Carbon (`#111827`) with `1px solid rgba(255, 255, 255, 0.08)` hairline borders and zero nested card shadows.
  - Accent Budget (10%): Electric Indigo (`#6366F1`) for primary interactive controls, Emerald (`#10B981`) for cache hits & nominal health probes, Amber (`#F59E0B`) for lexical BM25 highlights.
- **Typography & Tabular Discipline**:
  - Display & UI Structure: `Plus Jakarta Sans` (600/700, `text-wrap: balance`).
  - Telemetry, Vectors, Scores & Latencies: `JetBrains Mono` with strict `font-variant-numeric: tabular-nums` so score bars, latencies, and rank counters never jitter during slider drags.
- **Anti-Slop & Zero-Pill Discipline**:
  - Remove `border-l-4` callouts and decorative badge sandwiches; present item metadata as clean inline typographic strings (`Electronics · $249 · ★ 4.9 · ID #item-42`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Engine Live Execution in API Console (Real HTTP Fastify + Instant In-Browser Kernel)**
  - *Chosen Approach*: Execute real `fetch('/v1/...')` calls against the unified Fastify backend on port `3000` with real auth headers (`x-api-key: eidos_dev_key`) and response header inspection, with automatic fallback to the in-browser `@eidos/core` kernel if offline.
  - *Why*: Proves end-to-end production readiness (security headers, LRU query cache `HIT`/`MISS`, 5,005 HNSW items) directly inside the interactive demo.
- **Decision 2: Deterministic 5-Factor Multi-Objective Reranker with Live X-Ray**
  - *Chosen Approach*: Extend the recommendation scoring pipeline with normalized multi-objective weights ($\alpha, \beta, \gamma, \delta, \lambda$) and expose exact per-feature contribution percentages on every card.
  - *Why*: Unlike black-box vector databases (Pinecone) or keyword engines (Algolia), engineers and product managers get full mathematical transparency and instant business control.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     EIDOS UNIFIED WORKBENCH & API (PORT 3000)                    │
├────────────────────────────────────────┬─────────────────────────────────────────┤
│     React 19 Studio UI (Workspace)     │        Fastify Production API (/v1)     │
│                                        │                                         │
│  ┌──────────────────────────────────┐  │  ┌───────────────────────────────────┐  │
│  │ Search Lab + Ranking X-Ray       │  │  │ POST /v1/search                   │  │
│  │ • α Slider (BM25 <-> 384d HNSW)  │──┼─▶│ • SecurityGuardrails              │  │
│  │ • RRF & Token Hit Breakdown      │  │  │ • HNSW + BM25 + RRF Fusion        │  │
│  └──────────────────────────────────┘  │  └───────────────────────────────────┘  │
│                                        │                                         │
│  ┌──────────────────────────────────┐  │  ┌───────────────────────────────────┐  │
│  │ Multi-Objective Recommender Lab  │  │  │ POST /v1/recommend                │  │
│  │ • Sliders: α, β, γ, δ, λ (MMR)   │──┼─▶│ • Strategies: simple|adaptive|user│  │
│  │ • Live NDCG@K & Shannon Entropy  │  │  │ • ApiQueryCache (x-cache HIT/MISS)│  │
│  │ • Per-Card Feature X-Ray Bars    │  │  │ • Category / Price / ID Filters   │  │
│  └──────────────────────────────────┘  │  └───────────────────────────────────┘  │
│                                        │                                         │
│  ┌──────────────────────────────────┐  │  ┌───────────────────────────────────┐  │
│  │ Live HTTP Playground & SDK Gen   │  │  │ GET /v1/catalog/stats & /v1/health│  │
│  │ • Real fetch() + Header Inspector│──┼─▶│ • 5,005 HNSW Items (<35ms boot)   │  │
│  │ • TS / Python / cURL Generator   │  │  │ • Liveness / Readiness / Metrics  │  │
│  └──────────────────────────────────┘  │  └───────────────────────────────────┘  │
└────────────────────────────────────────┴─────────────────────────────────────────┘
```

### Interactive Component & State Mapping
1. **Search X-Ray Inspector**:
   - Computes and displays exact `denseRank`, `sparseRank`, `rrfDenseContribution`, `rrfSparseContribution`, and `matchedTokens` for each result in `SearchView` and `SearchResultsColumns`.
2. **Multi-Objective Business Reranker**:
   - Adds interactive sliders for Semantic Similarity ($\alpha$), Popularity ($\beta$), Freshness ($\gamma$), Value/Price Affinity ($\delta$), and MMR Diversity ($\lambda$) in `RecommendationsView` & `MerchandisingToolbar`, updating per-card `RecommendationCard` X-Ray contribution bars and live IR metrics (`NDCG@6`, `Entropy`, `Coverage`).
3. **Live HTTP API & SDK Console**:
   - Upgrades `ApiConsoleModal` and `ApiConsoleSnippets` to execute real HTTP calls against `/v1/recommend`, `/v1/search`, `/v1/catalog/stats`, and `/v1/health`, inspect live HTTP headers (`x-cache`, `x-response-time`, `x-request-id`), and generate synchronized TypeScript, Python, and cURL code.
4. **Clean `README.md` Demo Update**:
   - Updates `README.md` exclusively with the live demo badge/URL (`https://eidos-semantic-ideation-platform.ai.studio/`) and accurate port `3000` / unified `/v1/recommend` examples (no master prompt in `README.md`).
