# EIDOS Recommender — Architecture & Pipeline

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                  EIDOS RECOMMENDER PIPELINE                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CATALOG INGESTION                                       │
│     Items / Videos / Vacancies / Articles                   │
│              ↓                                              │
│  2. SEMANTIC EMBEDDINGS (384D)                              │
│     all-MiniLM-L6-v2 / BGE-Small / Multi-Lingual            │
│              ↓                                              │
│  3. COSINE SIMILARITY MATRIX                                │
│     Sim(u, v) = (u · v) / (||u|| ||v||)                     │
│              ↓                                              │
│  4. SEMANTIC TOPOLOGY & CLUSTERING                          │
│     Threshold filtering (tau >= 0.25) + Louvain clusters    │
│              ↓                                              │
│  5. RECOMMENDATION & INFERENCE ENGINE                       │
│     • Item-to-Item (top nearest semantic nodes)             │
│     • Query-to-Item (project query vector onto graph)       │
│     • Explainability generator (reasoning tags)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Why Semantic Embeddings Solve Cold Start

- **Collaborative Filtering** requires historical interaction matrices $R_{m \times n}$.
  When a new item $i_{new}$ is introduced, its column is all zeroes, resulting in $P(i_{new} \mid u) \approx 0$.
- **EIDOS Semantic Map** projects $i_{new}$ into the high-dimensional latent space immediately upon registration using its textual description:
  $$e_{new} = \text{Encoder}(\text{title} \oplus \text{description} \oplus \text{tags})$$
  Because the manifold already exists, $i_{new}$ immediately connects to all semantically adjacent items without requiring a single historical purchase.
