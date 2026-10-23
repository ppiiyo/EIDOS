# Migrating to EIDOS v3.0 & Connecting Databases (Algolia, Pinecone, Meilisearch, Constructor.io, PostgreSQL, MongoDB)

This guide provides step-by-step migration blueprints, API parameter mappings, database sync connectors, and side-by-side SDK examples for teams transitioning from **Algolia**, **Pinecone**, **Meilisearch**, or **Constructor.io** to **EIDOS v3.0**.

---

## 1. Feature & Concept Mapping

| Capability | Algolia | Pinecone | Meilisearch | Constructor.io | EIDOS v3.0 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hybrid Search** | NeuralSearch (Keyword + Vector) | Dense + Sparse Vectors | Experimental Vector + Keyword | Lexical + Behavioral | `POST /v1/search` (`mode: 'hybrid'`, `alpha: 0.65`) |
| **Item-to-Item Recommendations** | Related Products | `query(id=...)` | Similar Documents | Similar Items Pod | `POST /v1/recommend` (`strategy: 'simple' \| 'adaptive'`) |
| **User Personalization** | Personalization Strategy | Custom User Embedding | None | Personalized Pod | `POST /v1/recommend` (`strategy: 'user'`, `user_id`, `history`) |
| **Diversity Control** | Distinct / Grouping | Manual Post-Processing | Distinct Attribute | Pod Diversity Rules | Native MMR & Submodular MMR (`diversity_factor: 0.35`) |
| **Explainable Ranking X-Ray** | Basic Ranking Info | Raw Score Only | Ranking Score Details | Black-box | Per-hit `explanation` (`denseComponent`, `sparseBm25Component`, `mmrPenalty`, `businessBoost`) |
| **Multi-Objective Business Reranking** | Custom Ranking Rules | None | Custom Ranking | Merchandising Boosts | Real-time sliders & API weights (`margin`, `inventory`, `freshness`, `popularity`) |
| **Cold-Start Exploration** | Manual Merchandising | None | None | Bandit Pods | LinUCB Cholesky Contextual Bandits + 384-d Zero-Click Embeddings |
| **Online Feedback Loop** | `aa('clickedObjectIDs')` | None | None | `trackSearchResultClick` | `POST /v1/feedback` (`click`, `like`, `purchase`, `dislike`) |

---

## 2. Migrating from Algolia (`algoliasearch` -> `@eidos/sdk`) in 15 Minutes

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

### After (EIDOS v3.0)
```typescript
import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

// 1. Ingest catalog (384-d embeddings generated automatically on server)
await eidos.upsertItem({
  id: '1',
  title: 'Cyberpunk 2077',
  category: 'Games',
  price: 59.99,
});

// 2. Hybrid Search (BM25 + 384-d HNSW with Reciprocal Rank Fusion + Explainable X-Ray)
const { results } = await eidos.search({
  query: 'cyberpunk neural rpg',
  limit: 10,
  filterCategory: 'Games',
  mode: 'hybrid',
  alpha: 0.65,
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
const response = await fetch('http://localhost:3000/v1/recommend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.EIDOS_API_KEY || 'eidos_dev_key',
  },
  body: JSON.stringify({
    item_id: '1',
    strategy: 'adaptive',
    limit: 10,
    diversity_factor: 0.35,
    filters: {
      category: 'Games',
      max_price: 60,
    },
  }),
});
const { recommendations, entropy, latencyMs } = await response.json();
```

---

## 4. Migrating from Meilisearch (`meilisearch` -> `@eidos/sdk`)

- Replace `client.index('products').addDocuments(docs)` with `eidos.upsertItem(doc)`.
- Replace `client.index('products').search(q)` with `eidos.search({ query: q, mode: 'hybrid', alpha: 0.65 })` to unlock true semantic understanding alongside exact keyword matching.

---

## 5. Migrating from Constructor.io (Behavioral & Personalized Pods)

### Parameter Translation
- `c.recommendations.getRecommendationsForPod('item_page_1', { itemIds: ['1'] })`
  $\rightarrow$ `POST /v1/recommend` with `{ item_id: '1', strategy: 'adaptive' }`
- `c.recommendations.getRecommendationsForPod('home_page_user', { userId: 'u-42' })`
  $\rightarrow$ `POST /v1/recommend` with `{ user_id: 'u-42', history: ['1', '2'], strategy: 'user' }`
- `c.tracker.trackRecommendationClick({ itemId: '1' })`
  $\rightarrow$ `POST /v1/feedback` with `{ userId: 'u-42', itemId: '1', eventType: 'click' }`

---

## 6. Direct Database Synchronization (PostgreSQL & MongoDB)

### PostgreSQL Batch & Incremental Sync
```typescript
import { Pool } from 'pg';
import { EidosClient } from '@eidos/sdk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const eidos = new EidosClient({ baseUrl: 'http://localhost:3000', apiKey: process.env.EIDOS_API_KEY! });

const { rows } = await pool.query('SELECT id::text, title, description, category, price::float, tags FROM products');
for (const row of rows) {
  await eidos.upsertItem(row);
}
```

### MongoDB Change Streams Real-Time Sync
```typescript
import { MongoClient } from 'mongodb';
import { EidosClient } from '@eidos/sdk';

const mongo = new MongoClient(process.env.MONGO_URI!);
const eidos = new EidosClient({ baseUrl: 'http://localhost:3000', apiKey: process.env.EIDOS_API_KEY! });

await mongo.connect();
const stream = mongo.db('shop').collection('products').watch([], { fullDocument: 'updateLookup' });
for await (const event of stream) {
  if (event.fullDocument) {
    await eidos.upsertItem({
      id: String(event.fullDocument._id),
      title: event.fullDocument.title,
      description: event.fullDocument.description,
      category: event.fullDocument.category,
      price: Number(event.fullDocument.price || 0),
    });
  }
}
```
