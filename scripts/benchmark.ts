import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import {
  cosineSimilarity,
  normalizeVector,
  HNSWIndex,
  BM25Index,
  HybridSearch,
  ScalarQuantizer,
  calculateCategoryEntropy,
  calculateMMRScore,
} from '../packages/core/src/index';

/**
 * Deterministic Mulberry32 PRNG for reproducible CI benchmarks.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDeterministicVector(dim: number, rng: () => number): Float32Array {
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = rng() * 2 - 1;
  }
  return normalizeVector(vec);
}

function runBenchmarks() {
  console.log('===============================================================');
  console.log(' Eidos Production Vector Engine Benchmarks (Deterministic CI)');
  console.log('===============================================================\n');

  const rng = mulberry32(20261020);
  const DIM = 384;
  const WARMUP_ITERATIONS = 500;
  const BENCH_ITERATIONS = 10000;

  // Warmup
  const vA = generateDeterministicVector(DIM, rng);
  const vB = generateDeterministicVector(DIM, rng);
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    cosineSimilarity(vA, vB);
  }

  // 1. Single Vector Dot Product Latency
  const startSingle = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    cosineSimilarity(vA, vB);
  }
  const totalSingleMs = performance.now() - startSingle;
  const avgSingleUs = (totalSingleMs / BENCH_ITERATIONS) * 1000;

  // 2. Corpus Generation & Linear Scan vs HNSW ANN (1,000 items, 384-d)
  const CORPUS_SIZE = 1000;
  const corpus: Float32Array[] = [];
  const hnsw = new HNSWIndex({
    dimension: DIM,
    M: 16,
    efConstruction: 64,
    efSearch: 48,
  });
  const bm25 = new BM25Index();

  const startIndexBuild = performance.now();
  for (let i = 0; i < CORPUS_SIZE; i++) {
    const vec = generateDeterministicVector(DIM, rng);
    corpus.push(vec);
    const id = `doc-${i}`;
    hnsw.insert(id, vec);
    bm25.addDocument(
      id,
      `Product ${i} quantum neural processor high-performance vector search category-${i % 8}`
    );
  }
  const indexBuildMs = performance.now() - startIndexBuild;

  const startLinear = performance.now();
  const scanRuns = 200;
  let linearTopId = '';
  for (let it = 0; it < scanRuns; it++) {
    let maxSim = -2;
    for (let i = 0; i < corpus.length; i++) {
      const sim = cosineSimilarity(vA, corpus[i]);
      if (sim > maxSim) {
        maxSim = sim;
        linearTopId = `doc-${i}`;
      }
    }
  }
  const avgLinearMs = (performance.now() - startLinear) / scanRuns;

  // 3. HNSW ANN Search Latency
  const startHnsw = performance.now();
  let hnswHits = hnsw.search(vA, 10, 48);
  for (let it = 1; it < scanRuns; it++) {
    hnswHits = hnsw.search(vA, 10, 48);
  }
  const avgHnswMs = (performance.now() - startHnsw) / scanRuns;

  // 4. Hybrid RRF Search (BM25 + Dense HNSW)
  const hybrid = new HybridSearch(hnsw, bm25);
  const startHybrid = performance.now();
  const hybridRuns = 200;
  for (let it = 0; it < hybridRuns; it++) {
    hybrid.search('quantum neural processor vector', vA, { limit: 10, alpha: 0.65 });
  }
  const avgHybridMs = (performance.now() - startHybrid) / hybridRuns;

  // 5. INT8 Scalar Quantization Fidelity & Compression
  const sq8 = ScalarQuantizer.quantize(vA, 'bench-vA');
  const dequantized = ScalarQuantizer.dequantize(sq8);
  const sq8Fidelity = cosineSimilarity(vA, dequantized);
  const compressionRatio = vA.byteLength / sq8.data.byteLength;

  // 6. Shannon Entropy & MMR Score Computation
  const categoriesSample = ['Electronics', 'Audio', 'Electronics', 'Office', 'Accessories', 'Audio', 'Desk'];
  const startEntropy = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    calculateCategoryEntropy(categoriesSample);
  }
  const avgEntropyUs = ((performance.now() - startEntropy) / BENCH_ITERATIONS) * 1000;

  const startMMR = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    calculateMMRScore(0.85, 0.42, 0.7);
  }
  const avgMMRUs = ((performance.now() - startMMR) / BENCH_ITERATIONS) * 1000;

  console.log('| Metric Name | Sample Size | Avg Duration | Throughput / Quality |');
  console.log('| :--- | :--- | :--- | :--- |');
  console.log(`| Cosine Dot Product (384-dim) | ${BENCH_ITERATIONS} runs | ${avgSingleUs.toFixed(3)} µs | ${(1000000 / avgSingleUs).toFixed(0)} ops/sec |`);
  console.log(`| Linear Corpus Scan (1,000 items) | ${scanRuns} scans | ${avgLinearMs.toFixed(3)} ms | ${(1000 / avgLinearMs).toFixed(0)} qps |`);
  console.log(`| HNSW ANN Search (1,000 items) | ${scanRuns} queries | ${avgHnswMs.toFixed(3)} ms | ${(1000 / avgHnswMs).toFixed(0)} qps |`);
  console.log(`| Hybrid RRF Search (BM25 + HNSW) | ${hybridRuns} queries | ${avgHybridMs.toFixed(3)} ms | ${(1000 / avgHybridMs).toFixed(0)} qps |`);
  console.log(`| INT8 Scalar Quantization (SQ8) | 384-dim | ${compressionRatio.toFixed(1)}x compression | ${sq8Fidelity.toFixed(5)} cosine fidelity |`);
  console.log(`| Shannon Entropy Calculation | ${BENCH_ITERATIONS} runs | ${avgEntropyUs.toFixed(3)} µs | ${(1000000 / avgEntropyUs).toFixed(0)} ops/sec |`);
  console.log(`| MMR Ranking Heuristic | ${BENCH_ITERATIONS} runs | ${avgMMRUs.toFixed(3)} µs | ${(1000000 / avgMMRUs).toFixed(0)} ops/sec |`);

  // Enforce strict regression gates (non-stub assertions)
  if (avgSingleUs > 50) {
    throw new Error(`Performance regression: Cosine 384-d took ${avgSingleUs.toFixed(2)} µs (> 50 µs budget)`);
  }
  if (avgHnswMs > 25) {
    throw new Error(`Performance regression: HNSW search took ${avgHnswMs.toFixed(2)} ms (> 25 ms budget)`);
  }
  if (sq8Fidelity < 0.99) {
    throw new Error(`Quantization fidelity regression: SQ8 cosine fidelity ${sq8Fidelity} < 0.99`);
  }
  if (hnswHits.length === 0 || !linearTopId) {
    throw new Error('Benchmark sanity check failed: empty search results');
  }

  const report = {
    timestamp: new Date().toISOString(),
    dimension: DIM,
    corpusSize: CORPUS_SIZE,
    metrics: {
      cosineDotProductUs: Number(avgSingleUs.toFixed(4)),
      indexBuildMs: Number(indexBuildMs.toFixed(2)),
      linearScanMs: Number(avgLinearMs.toFixed(4)),
      hnswSearchMs: Number(avgHnswMs.toFixed(4)),
      hybridRrfSearchMs: Number(avgHybridMs.toFixed(4)),
      sq8Fidelity: Number(sq8Fidelity.toFixed(5)),
      sq8CompressionRatio: compressionRatio,
      shannonEntropyUs: Number(avgEntropyUs.toFixed(4)),
      mmrScoreUs: Number(avgMMRUs.toFixed(4)),
    },
  };

  const outPath = path.resolve(process.cwd(), 'benchmark-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✓ Benchmark assertions passed. Saved JSON report to ${outPath}`);
}

runBenchmarks();
