# EIDOS — Engine P1: High-ROI Retrieval Controls (`RETRIEVAL_P1.md`)

This document specifies the four native EIDOS P1 retrieval controls implemented in `@eidos/core` and `/v1/search` + `/v1/suggest`:
1. **Field Boosts (`fieldBoosts`)** — Multi-field lexical BM25 scoring (`sku > title > brand > category > description`)
2. **Structured Pre-RRF Filters (`filters`)** — Strict boolean eligibility predicates (`filter != score`)
3. **Per-Channel Rank Window (`rankWindow`)** — Candidate truncation before RRF fusion
4. **Formalized Weighted RRF (`rankConstant`, `weights`, `hit.rrf`)** — Exact reciprocal rank fusion math and X-Ray transparency

---

## 1. End-to-End Retrieval Pipeline

```text
Request (/v1/search or /v1/suggest)
  │
  ├─► 1. Query Normalization + Layout Recovery (yfeiybrb → наушники) + Typo Recovery (перфоратр → перфоратор)
  │
  ├─► 2. Structured Pre-RRF Filters (filters: category, brand, priceMin, priceMax, inStock, ids, excludeIds)
  │      Boolean eligibility check only (0 score added). Records candidatesBeforeFilter & candidatesAfterFilter.
  │
  ├─► 3. Parallel Retrieval on Eligible Candidates:
  │      ├── Lexical Channel: Multi-field BM25 with fieldBoosts → sort desc (tie-break id asc) → slice(0, rankWindow.lexical)
  │      └── Dense Channel:   HNSW 384-d + exact cosine        → sort desc (tie-break id asc) → slice(0, rankWindow.dense)
  │
  ├─► 4. Formalized Weighted RRF Fusion (k = rankConstant, w_lexical, w_dense)
  │      Computes lexicalRank, denseRank, lexicalContribution, denseContribution, fusedScore.
  │
  ├─► 5. Head-Category Gate (simpleCategoryGate: 'hard' | 'soft' | 'off') & Zero-Results Guardrail
  │      Strict intersection with structured filters (conflicts are never bypassed).
  │
  └─► 6. Optional Merchandising Rules (pin / boost / bury) + Top-K Response & X-Ray Formatting
```

---

## 2. Formalized Weighted RRF Formula & Weight Mapping

For each candidate document $d$ present in the union of the truncated lexical and dense windows:

$$\text{score}(d) = w_{\text{lexical}} \cdot \frac{1}{k + \text{rank}_{\text{lexical}}(d)} + w_{\text{dense}} \cdot \frac{1}{k + \text{rank}_{\text{dense}}(d)}$$

- **Rank indexing**: $\text{rank} \in \{1, 2, \dots, W\}$ (1-based).
- **Missing channel handling**: If document $d$ is absent from a channel's top `rankWindow`, its rank in that channel is `null` and its contribution for that channel is `0` (no artificial fallback rank is substituted).
- **Rank constant ($k$)**: `rankConstant` defaults to `60` (`min: 1`, `max: 200`). Smaller $k$ (e.g. `20`) sharpens the advantage of rank #1 over rank #10; larger $k$ (e.g. `100`) flattens the rank curve.
- **Deterministic tie-break**: Equal scores break ties deterministically by `id` ascending (lexicographical order).

### Backward-Compatible Weight Resolution

| Request Input | Resolved `w_dense` | Resolved `w_lexical` |
| :--- | :--- | :--- |
| `weights: { dense, lexical }` | `weights.dense` | `weights.lexical` |
| `weights: { semantic, sparse }` | `weights.semantic` | `weights.sparse` |
| `alpha` (`0..1`, no `weights`) | `alpha` | `1 - alpha` |
| `mode: 'dense'` | `1` | `0` |
| `mode: 'sparse'` | `0` | `1` |
| Default (omitted) | `0.5` | `0.5` |

### Per-Hit `rrf` X-Ray Object

Every hit in `/v1/search` and `/v1/suggest` includes:

```json
{
  "rrf": {
    "k": 60,
    "lexicalRank": 1,
    "denseRank": 4,
    "lexicalWeight": 0.5,
    "denseWeight": 0.5,
    "lexicalContribution": 0.008197,
    "denseContribution": 0.007813,
    "fusedScore": 0.01601
  }
}
```

---

## 3. Field Boosts (`fieldBoosts`)

Multi-field BM25 weights apply exclusively to the lexical channel (dense 384-d embeddings remain untouched):

```ts
export const DEFAULT_FIELD_BOOSTS = {
  title: 3,
  sku: 5,
  brand: 2,
  category: 1.5,
  description: 1,
};
```

- Setting a field boost to `0` (e.g., `fieldBoosts: { description: 0 }`) completely disables lexical scoring from that field.
- Negative values, `NaN`, or unknown field names return `400 Bad Request` with `code: "INVALID_FIELD_BOOSTS"`.
- Each hit's `explanation.lexicalFieldContributions` lists `{ field, boost, contribution }` for full X-Ray transparency. When `sku` or `title` dominates, `humanExplanation` includes `"Сильное совпадение по артикулу/названию"` (`"Strong SKU/title match"`).

---

## 4. Rank Window (`rankWindow`)

Controls how many candidates from each retrieval channel enter Weighted RRF fusion:

```ts
export interface RankWindow {
  lexical?: number; // default 50, min 1, max 200
  dense?: number;   // default 50, min 1, max 200
}
```

- Values `<= 0` or `> 200` (or non-numeric) return `400 Bad Request` with `code: "INVALID_RANK_WINDOW"`.

---

## 5. Structured Pre-RRF Filters (`filters`) & Category Gate Interaction

```ts
export interface SearchFilters {
  category?: string | string[];
  brand?: string | string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  ids?: string[];
  excludeIds?: string[];
}
```

- **Semantics**: `AND` across distinct fields; `OR` within array values (`category: ["Audio", "Accessories"]`).
- **Missing values (`filterStrictMissing: true`)**: When `priceMin` or `priceMax` is active, documents without a numeric `price` are excluded.
- **Category Gate Intersection**: When `simpleCategoryGate: "hard"` is active and the query has a head-category intent (e.g., `"наушники"` → `audio_headphones`) while `filters.category` specifies a conflicting category (e.g., `"Обувь и кроссовки"`), the strict intersection yields `0` results (`count: 0`) rather than leaking off-category items.
- **Response `meta` telemetry**:
  - `meta.filtersApplied`
  - `meta.candidatesBeforeFilter`
  - `meta.candidatesAfterFilter`

---

## 6. Example `curl` Requests

### 1. SKU-Prioritized Search with Custom `fieldBoosts`
```bash
curl -X POST http://localhost:3000/v1/demo/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "BOS-1001",
    "fieldBoosts": { "sku": 10, "title": 3, "description": 0 },
    "limit": 5
  }'
```

### 2. Structured Filter (`priceMax` + `inStock` + `brand`)
```bash
curl -X POST http://localhost:3000/v1/demo/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "наушники",
    "filters": {
      "priceMax": 5000,
      "inStock": true
    },
    "limit": 10
  }'
```

### 3. Custom `rankWindow`, `rankConstant`, and `weights`
```bash
curl -X POST http://localhost:3000/v1/demo/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "перфоратор",
    "rankWindow": { "lexical": 25, "dense": 25 },
    "rankConstant": 30,
    "weights": { "lexical": 0.7, "dense": 0.3 },
    "limit": 5
  }'
```
