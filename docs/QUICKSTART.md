# EIDOS Quickstart Guide (5 Minutes)

Get up and running with the EIDOS Semantic Vector Engine in under 5 minutes.

---

## 1. Installation

Install the core TypeScript library in your project:

```bash
# Using pnpm
pnpm add @eidos/core

# Using npm
npm install @eidos/core

# Using yarn
yarn add @eidos/core
```

---

## 2. Basic Usage: Cosine Similarity & Normalization

```typescript
import { cosineSimilarity, normalizeVector, calculateMMRScore } from '@eidos/core';

// 1. Define two embedding vectors (e.g. from an embedding model)
const rawA = new Float32Array([0.25, 0.55, 0.78, 0.12]);
const rawB = new Float32Array([0.28, 0.52, 0.81, 0.10]);

// 2. Unit-normalize vectors for L2 distance comparisons
const vecA = normalizeVector(rawA);
const vecB = normalizeVector(rawB);

// 3. Compute cosine similarity (returns score between -1.0 and 1.0)
const similarity = cosineSimilarity(vecA, vecB);
console.log(`Semantic similarity: ${(similarity * 100).toFixed(2)}%`);

// 4. Compute Maximum Marginal Relevance (MMR) for diverse re-ranking
const relevance = similarity;
const maxSimilarityToSelected = 0.45;
const diversityFactor = 0.7; // 70% relevance, 30% diversity
const mmrScore = calculateMMRScore(relevance, maxSimilarityToSelected, diversityFactor);
console.log(`MMR re-ranking score: ${mmrScore.toFixed(4)}`);
```

---

## 3. Running the Interactive Demo Locally

Clone the monorepo and start the browser workspace:

```bash
# Clone the repository
git clone https://github.com/ppiiyo/EIDOS.git
cd EIDOS

# Install monorepo dependencies
pnpm install

# Launch Vite interactive demo
pnpm --filter @eidos/demo dev
```

Open `http://localhost:5173` in your browser to inspect real-time semantic graph topology and in-browser embeddings via WebAssembly.

---

## 4. One-Liner Docker Deployment for the REST API

Launch a self-contained EIDOS Fastify REST API instance:

```bash
docker run -d -p 8080:8080 -e EIDOS_API_KEY=test-key --name eidos-api ghcr.io/ppiiyo/eidos-api:latest
```

Verify service readiness:

```bash
curl -i http://localhost:8080/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "itemsCount": 2,
  "uptimeSeconds": 1,
  "model": "all-MiniLM-L6-v2"
}
```

---

## 5. Fetching Recommendations via REST API

```bash
curl -X POST http://localhost:8080/v1/recommend \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "item_id": "1",
    "limit": 5,
    "diversityFactor": 0.7
  }'
```
