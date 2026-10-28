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

async function runCliBenchmark(): Promise<void> {
  const hnsw = new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 24, useQuantization: true });
  const bm25 = new BM25Index(1.5, 0.75);
  const dim = 384;

  for (let i = 0; i < 1000; i++) {
    const vec = new Float32Array(dim);
    let norm = 0;
    for (let d = 0; d < dim; d++) {
      const v = Math.sin((i + 1) * 0.13 + d * 0.07);
      vec[d] = v;
      norm += v * v;
    }
    const inv = 1 / (Math.sqrt(norm) || 1);
    for (let d = 0; d < dim; d++) vec[d] *= inv;
    hnsw.insert(`bench-${i}`, vec);
    bm25.addDocument(`bench-${i}`, `quantum neural wireless audio headphones series ${i}`);
  }

  const hybrid = new HybridSearch(hnsw, bm25);
  const queryVec = new Float32Array(dim).fill(1 / Math.sqrt(dim));

  const report = await runLoadTest(
    async () => {
      hybrid.search('quantum wireless headphones', queryVec, { limit: 10 });
    },
    300,
    15
  );

  const output = {
    version: '3.2.0',
    timestamp: new Date().toISOString(),
    corpusSize: 1000,
    dimension: dim,
    hybridSearch: report,
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
