import { bench, describe } from 'vitest';
import { HNSWIndex, BM25Index, HybridSearch } from '@eidos/core';
import { NeuralCrossEncoderReranker, RerankCandidateItem } from '../../apps/api/src/services/reranker';

const VECTOR_DIM = 384;
const CORPUS_SIZE = 10_000;
const BATCH_INDEX_SIZE = 1_000;

const CATEGORIES = ['Electronics', 'Audio', 'Computing', 'Smart Home', 'Photography', 'Wearables'];
const BRANDS = Array.from({ length: 50 }, (_, i) => `brand${i}`);
const FEATURES = [
  'wireless',
  'noisecancelling',
  'headphones',
  'bluetooth',
  'mechanical',
  'keyboard',
  'ergonomic',
  'monitor',
  'ultrawide',
  'camera',
  'mirrorless',
  'titanium',
  'smartwatch',
  'spatial',
  'audio',
  'studio',
  'microphone',
  'thunderbolt',
  'oled',
  'magnesium',
];

function createDeterministicVector(seed: number, dim: number = VECTOR_DIM): Float32Array {
  const vec = new Float32Array(dim);
  let normSq = 0;
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(seed * 0.173 + i * 0.071) + Math.cos(seed * 0.031 - i * 0.113);
    vec[i] = val;
    normSq += val * val;
  }
  const invNorm = 1 / (Math.sqrt(normSq) || 1);
  for (let i = 0; i < dim; i++) {
    vec[i] *= invNorm;
  }
  return vec;
}

const hnswIndex = new HNSWIndex({
  M: 16,
  efConstruction: 64,
  efSearch: 24,
  useQuantization: true,
});
const bm25Index = new BM25Index(1.5, 0.75);
const reranker = new NeuralCrossEncoderReranker({ gamma: 0.65, maxCandidates: 25 });
const docMetadata = new Map<string, RerankCandidateItem>();

const anchorIds: string[] = [];
for (let i = 0; i < CORPUS_SIZE; i++) {
  const id = `doc-${i}`;
  const vector = createDeterministicVector(i + 1);
  const brand = BRANDS[i % BRANDS.length];
  const kw1 = FEATURES[i % FEATURES.length];
  const kw2 = FEATURES[(i * 7 + 3) % FEATURES.length];
  const series = `series${i % 100}`;
  const category = CATEGORIES[i % CATEGORIES.length];
  const title = `${brand} ${kw1} ${kw2} ${series}`;
  const description = `High-precision ${brand} ${kw1} and ${kw2} engineered for ${series}.`;

  if (i < 128) {
    hnswIndex.insert(id, vector);
    anchorIds.push(id);
  } else {
    const anchorId = anchorIds[i % anchorIds.length];
    hnswIndex.fastInsertLeaf(id, vector, anchorId);
  }

  bm25Index.addDocument({
    id,
    title,
    description,
    category,
    tags: [brand, kw1, kw2, series],
  });

  docMetadata.set(id, {
    id,
    title,
    description,
    category,
    tags: [brand, kw1, kw2, series],
    vector,
  });
}

const hybridSearch = new HybridSearch(hnswIndex, bm25Index);
const queryVector = createDeterministicVector(42);
const queryText = 'brand1 wireless noisecancelling headphones';

const batchVectors: { id: string; vector: Float32Array; title: string; description: string }[] =
  Array.from({ length: BATCH_INDEX_SIZE }, (_, idx) => ({
    id: `batch-doc-${idx}`,
    vector: createDeterministicVector(idx + 50_000),
    title: `Batch Indexed Product ${idx} ${FEATURES[idx % FEATURES.length]}`,
    description: `Automated high-throughput batch document ${idx} for search SLA validation.`,
  }));

describe('Eidos v3.2 Search & Indexing Performance Benchmarks', () => {
  bench(
    'HNSW Search (10K vectors, 384d) — SLA < 5ms p99',
    () => {
      hnswIndex.search(queryVector, 10, 24);
    },
    { time: 300, iterations: 50 }
  );

  bench(
    'BM25 Search (10K docs) — SLA < 3ms p99',
    () => {
      bm25Index.search(queryText, 10);
    },
    { time: 300, iterations: 50 }
  );

  bench(
    'Hybrid Search + Cross-Encoder Rerank (10K corpus) — SLA < 15ms p99',
    () => {
      const stage1 = hybridSearch.search(queryText, queryVector, { limit: 20, rrfK: 60 });
      const candidates: RerankCandidateItem[] = stage1.map((hit) => {
        const meta = docMetadata.get(hit.id);
        return {
          id: hit.id,
          title: meta?.title ?? hit.id,
          description: meta?.description ?? '',
          category: meta?.category ?? 'Electronics',
          tags: meta?.tags ?? [],
          vector: meta?.vector,
          rrfScore: hit.score,
        };
      });
      reranker.rerank(queryText, queryVector, candidates, 0.65);
    },
    { time: 300, iterations: 50 }
  );

  bench(
    'Batch Indexing (1K docs into HNSW + BM25) — SLA < 500ms',
    () => {
      const localHnsw = new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 24 });
      const localBm25 = new BM25Index(1.5, 0.75);
      const localAnchors: string[] = [];

      for (let i = 0; i < batchVectors.length; i++) {
        const item = batchVectors[i];
        if (i < 64) {
          localHnsw.insert(item.id, item.vector);
          localAnchors.push(item.id);
        } else {
          localHnsw.fastInsertLeaf(item.id, item.vector, localAnchors[i % localAnchors.length]);
        }
        localBm25.addDocument(item.id, `${item.title} ${item.description}`);
      }
    },
    { time: 500, iterations: 10 }
  );
});
