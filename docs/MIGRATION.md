# Migrating to EIDOS from Algolia, Pinecone, and Constructor.io

This guide provides step-by-step migration blueprints, API parameter mappings, and side-by-side SDK examples for teams transitioning from **Algolia**, **Pinecone**, or **Constructor.io** to **EIDOS**.

---

## 1. Feature & Concept Mapping

| Capability | Algolia | Pinecone | Constructor.io | EIDOS |
| :--- | :--- | :--- | :--- | :--- |
| **Hybrid Search** | NeuralSearch (Keyword + Vector) | Dense + Sparse Vectors | Lexical + Behavioral | `POST /v1/search` (`mode: 'hybrid'`, `alpha: 0.5`) |
| **Item-to-Item Recommendations** | Related Products | `query(id=...)` | Similar Items Pod | `POST /v1/recommend` (`strategy: 'simple' \| 'adaptive'`) |
| **User Personalization** | Personalization Strategy | Custom User Embedding | Personalized Pod | `POST /v1/recommend` (`strategy: 'user'`, `user_id`, `history`) |
| **Diversity Control** | Distinct / Grouping | Manual Post-Processing | Pod Diversity Rules | Native MMR & Submodular MMR (`diversity_factor: 0.7`) |
| **Cold-Start Exploration** | Manual Merchandising | None | Bandit Pods | LinUCB Cholesky Contextual Bandits + 384-d Zero-Click Embeddings |
| **Online Feedback Loop** | `aa('clickedObjectIDs')` | None | `trackSearchResultClick` | `POST /v1/feedback` (`click`, `like`, `purchase`, `dislike`) |

---

## 2. Migrating from Algolia (`algoliasearch` -> `@eidos/sdk`)

### Before (Algolia)
```typescript
import algoliasearch from 'algoliasearch';

const client = algoliasearch('APP_ID', 'ALGOLIA_API_KEY');
const index = client.initIndex('products');

// 1. Index records
await index.saveObjects([
  { objectID: '1', title: 'Cyberpunk 2077', category: 'Games', price: 59.99 }
]);

// 2. Search
const { hits } = await index.search('cyberpunk neural rpg', {
  hitsPerPage: 10,
  filters: 'category:Games',
});
```

### After (EIDOS)
```typescript
import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.EIDOS_API_KEY!,
});

// 1. Ingest catalog (384-d embeddings generated automatically on server)
await eidos.upsertItem({
  id: '1',
  title: 'Cyberpunk 2077',
  category: 'Games',
  price: 59.99,
});

// 2. Hybrid Search (BM25 + 384-d HNSW with Reciprocal Rank Fusion)
const { results } = await eidos.search({
  query: 'cyberpunk neural rpg',
  limit: 10,
  filterCategory: 'Games',
  mode: 'hybrid',
  alpha: 0.5,
});
```

---

## 3. Migrating from Pinecone (`@pinecone-database/pinecone` -> `@eidos/sdk`)

### Before (Pinecone)
```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({ apiKey: 'PINECONE_KEY' });
const index = pc.index('catalog');

// Requires external OpenAI/Cohere embedding pipeline before query
const queryRes = await index.query({
  id: '1',
  topK: 10,
  filter: { category: { $eq: 'Games' }, price: { $lte: 60 } },
  includeMetadata: true,
});
```

### After (EIDOS Unified `/v1/recommend`)
```typescript
// Built-in 384-d embeddings, HNSW INT8 quantization, and MMR diversity re-ranking
const response = await fetch('http://localhost:8080/v1/recommend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.EIDOS_API_KEY!,
  },
  body: JSON.stringify({
    item_id: '1',
    strategy: 'adaptive',
    limit: 10,
    diversity_factor: 0.7,
    filters: {
      category: 'Games',
      max_price: 60,
    },
  }),
});
const { recommendations, entropy, latencyMs } = await response.json();
```

---

## 4. Migrating from Constructor.io (Behavioral & Personalized Pods)

### Parameter Translation
- `c.recommendations.getRecommendationsForPod('item_page_1', { itemIds: ['1'] })`
  $\rightarrow$ `POST /v1/recommend` with `{ item_id: '1', strategy: 'adaptive' }`
- `c.recommendations.getRecommendationsForPod('home_page_user', { userId: 'u-42' })`
  $\rightarrow$ `POST /v1/recommend` with `{ user_id: 'u-42', history: ['1', '2'], strategy: 'user' }`
- `c.tracker.trackRecommendationClick({ itemId: '1' })`
  $\rightarrow$ `POST /v1/feedback` with `{ userId: 'u-42', itemId: '1', eventType: 'click' }`
