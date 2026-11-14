import * as fs from 'fs';
import * as path from 'path';
import { HNSWIndex, BM25Index, HybridSearch } from '../packages/core/src/index';

export interface BenchmarkReport {
  totalRequests: number;
  concurrency: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export async function runLoadTest(
  fn: () => Promise<void>,
  totalRequests = 200,
  concurrency = 20
): Promise<BenchmarkReport> {
  const latencies: number[] = [];
  const startAll = performance.now();
  let issued = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (issued < totalRequests) {
      issued++;
      const t0 = performance.now();
      await fn();
      latencies.push(performance.now() - t0);
    }
  });

  await Promise.all(workers);
  const totalSec = (performance.now() - startAll) / 1000;
  latencies.sort((a, b) => a - b);
  const pct = (p: number) =>
    Number((latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0).toFixed(3));

  return {
    totalRequests: latencies.length,
    concurrency,
    rps: Math.round(latencies.length / Math.max(totalSec, 0.001)),
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    p99Ms: pct(0.99),
  };
}

export interface RecallBenchmarkResult {
  corpusSize: number;
  dimension: number;
  k: number;
  efSearch: number;
  buildTimeMs: number;
  recallAtK: number;
  hnswLatency: {
    meanLatencyMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    queriesEvaluated: number;
  };
  memoryStats: {
    nodeCount: number;
    estimatedBytes: number;
    internalIdCount: number;
  };
  hybridSearch: BenchmarkReport;
}

export async function runRecallAndLatencyBenchmark(options?: {
  corpusSize?: number;
  queryCount?: number;
  dimension?: number;
  k?: number;
  efSearch?: number;
}): Promise<RecallBenchmarkResult> {
  const corpusSize = options?.corpusSize ?? 1000;
  const queryCount = options?.queryCount ?? 50;
  const dim = options?.dimension ?? 384;
  const k = options?.k ?? 10;
  const efSearch = options?.efSearch ?? 64;

  const hnsw = new HNSWIndex({
    M: 16,
    M0: 32,
    efConstruction: 96,
    efSearch,
    useQuantization: false,
  });
  const bm25 = new BM25Index(1.5, 0.75);

  const clusterCount = 16;
  const centroids: Float32Array[] = [];
  for (let c = 0; c < clusterCount; c++) {
    const center = new Float32Array(dim);
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const v = Math.sin((c + 1) * 1.37 + (d + 1) * 0.11);
      center[d] = v;
      norm += v * v;
    }
    const inv = 1 / (Math.sqrt(norm) || 1);
    for (let d = 0; d < dim; d++) center[d] *= inv;
    centroids.push(center);
  }

  const buildStart = performance.now();
  const sampleVectors: Float32Array[] = [];
  for (let i = 0; i < corpusSize; i++) {
    const base = centroids[i % clusterCount];
    const vec = new Float32Array(dim);
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const jitter = Math.cos((i + 1) * 0.31 + (d + 1) * 0.17) * 0.18;
      const v = base[d] + jitter;
      vec[d] = v;
      norm += v * v;
    }
    const inv = 1 / (Math.sqrt(norm) || 1);
    for (let d = 0; d < dim; d++) vec[d] *= inv;
    hnsw.insert(`bench-${i}`, vec);
    bm25.addDocument(`bench-${i}`, `quantum neural wireless audio headphones series ${i} cluster ${i % clusterCount}`);
    if (sampleVectors.length < queryCount) {
      sampleVectors.push(vec);
    }
  }
  const buildTimeMs = Number((performance.now() - buildStart).toFixed(2));

  const queryVectors: Float32Array[] = sampleVectors.map((base, idx) => {
    const q = new Float32Array(dim);
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const v = base[d] + Math.sin((idx + 1) * 0.23 + d * 0.05) * 0.04;
      q[d] = v;
      norm += v * v;
    }
    const inv = 1 / (Math.sqrt(norm) || 1);
    for (let d = 0; d < dim; d++) q[d] *= inv;
    return q;
  });

  const recallStats = hnsw.evaluateRecallAtK(queryVectors, k, efSearch);
  const hybrid = new HybridSearch(hnsw, bm25);
  const queryVec = queryVectors[0] || new Float32Array(dim).fill(1 / Math.sqrt(dim));

  const report = await runLoadTest(
    async () => {
      hybrid.search('quantum wireless headphones', queryVec, { limit: k });
    },
    200,
    15
  );

  return {
    corpusSize,
    dimension: dim,
    k,
    efSearch,
    buildTimeMs,
    recallAtK: recallStats.recallAtK,
    hnswLatency: {
      meanLatencyMs: recallStats.meanLatencyMs,
      p50Ms: recallStats.p50Ms,
      p95Ms: recallStats.p95Ms,
      p99Ms: recallStats.p99Ms,
      queriesEvaluated: recallStats.queriesEvaluated,
    },
    memoryStats: hnsw.getMemoryStats(),
    hybridSearch: report,
  };
}

async function runCliBenchmark(): Promise<void> {
  const result = await runRecallAndLatencyBenchmark({
    corpusSize: 1000,
    queryCount: 50,
    dimension: 384,
    k: 10,
    efSearch: 64,
  });

  const output = {
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    ...result,
  };

  const outPath = path.resolve(process.cwd(), 'benchmark-results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('Benchmark complete. Wrote benchmark-results.json:', JSON.stringify(output, null, 2));
}

if (require.main === module) {
  runCliBenchmark().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
