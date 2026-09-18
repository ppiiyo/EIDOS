import { performance } from 'perf_hooks';
import { cosineSimilarity, normalizeVector } from '../packages/core/src/cosine';
import { calculateCategoryEntropy, calculateMMRScore } from '../packages/core/src/entropy';

function generateRandomVector(dim: number): Float32Array {
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = Math.random() * 2 - 1;
  }
  return normalizeVector(vec);
}

function runBenchmarks() {
  console.log('===============================================================');
  console.log(' EIDOS Production Vector Engine Benchmarks');
  console.log('===============================================================\n');

  const DIM = 384;
  const WARMUP_ITERATIONS = 500;
  const BENCH_ITERATIONS = 10000;

  // Warmup
  const vA = generateRandomVector(DIM);
  const vB = generateRandomVector(DIM);
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

  // 2. Scan over 1,000 vectors
  const corpus1k: Float32Array[] = [];
  for (let i = 0; i < 1000; i++) {
    corpus1k.push(generateRandomVector(DIM));
  }

  const start1k = performance.now();
  const iterations1k = 1000;
  for (let it = 0; it < iterations1k; it++) {
    let maxSim = -1;
    for (let i = 0; i < corpus1k.length; i++) {
      const sim = cosineSimilarity(vA, corpus1k[i]);
      if (sim > maxSim) maxSim = sim;
    }
  }
  const total1kMs = performance.now() - start1k;
  const avg1kMs = total1kMs / iterations1k;

  // 3. Shannon Entropy computation
  const categoriesSample = ['Electronics', 'Audio', 'Electronics', 'Office', 'Accessories', 'Audio', 'Desk'];
  const startEntropy = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    calculateCategoryEntropy(categoriesSample);
  }
  const totalEntropyMs = performance.now() - startEntropy;
  const avgEntropyUs = (totalEntropyMs / BENCH_ITERATIONS) * 1000;

  // 4. MMR Score Computation
  const startMMR = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    calculateMMRScore(0.85, 0.42, 0.7);
  }
  const totalMMRMs = performance.now() - startMMR;
  const avgMMRUs = (totalMMRMs / BENCH_ITERATIONS) * 1000;

  console.log('| Metric Name | Sample Size | Avg Duration | Throughput |');
  console.log('| :--- | :--- | :--- | :--- |');
  console.log(`| Cosine Dot Product (384-dim) | ${BENCH_ITERATIONS} runs | ${avgSingleUs.toFixed(3)} µs | ${(1000000 / avgSingleUs).toFixed(0)} ops/sec |`);
  console.log(`| Corpus Scan (1,000 items) | ${iterations1k} scans | ${avg1kMs.toFixed(3)} ms | ${(1000 / avg1kMs).toFixed(0)} scans/sec |`);
  console.log(`| Shannon Entropy Calculation | ${BENCH_ITERATIONS} runs | ${avgEntropyUs.toFixed(3)} µs | ${(1000000 / avgEntropyUs).toFixed(0)} ops/sec |`);
  console.log(`| MMR Ranking Heuristic | ${BENCH_ITERATIONS} runs | ${avgMMRUs.toFixed(3)} µs | ${(1000000 / avgMMRUs).toFixed(0)} ops/sec |`);
  console.log('\nBenchmark execution completed successfully.');
}

runBenchmarks();
