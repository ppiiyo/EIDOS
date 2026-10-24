import { performance } from 'perf_hooks';
import { buildServer } from '../apps/api/src/server';
import { ApiQueryCache } from '../apps/api/src/services/query-cache';

const DEFAULT_PORT = 8080;
const API_URL = process.env.API_URL || `http://localhost:${DEFAULT_PORT}`;
const API_KEY = process.env.EIDOS_API_KEY || 'test-key';

interface BenchmarkResult {
  operation: string;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  cacheHitRate: number;
}

async function isServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/v1/health/live`);
    return res.ok;
  } catch {
    return false;
  }
}

async function benchmarkSearch(baseUrl: string, iterations: number = 100): Promise<BenchmarkResult> {
  const queries = [
    'wireless headphones',
    'running shoes',
    'coffee maker',
    'laptop stand',
    'yoga mat',
    'mechanical keyboard',
    'gaming monitor',
    'ergonomic chair',
    'smart watch',
    'bluetooth speaker',
    'noise cancelling earbuds',
    'standing desk',
    'webcam 4k',
    'usb-c hub',
    'portable charger',
    'fitness tracker',
    'espresso machine',
    'air purifier',
    'desk lamp',
    'backpack waterproof',
  ];

  const latencies: number[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  console.log(`\n🔥 Running ${iterations} search requests (20 unique queries x 5 cycles)...`);

  for (let i = 0; i < iterations; i++) {
    const query = queries[i % queries.length];
    const start = performance.now();

    try {
      const response = await fetch(`${baseUrl}/v1/search`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query, limit: 10 }),
      });

      const data = (await response.json()) as { cacheHit?: boolean };
      const latency = performance.now() - start;
      latencies.push(latency);

      if (data.cacheHit) {
        cacheHits++;
      } else {
        cacheMisses++;
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Completed ${i + 1}/${iterations} requests...`);
      }
    } catch (err: any) {
      console.error(`Request ${i + 1} failed:`, err.message);
    }
  }

  latencies.sort((a, b) => a - b);

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  return {
    operation: 'search',
    totalRequests: iterations,
    cacheHits,
    cacheMisses,
    avgLatencyMs: Math.round(avg * 100) / 100,
    p50LatencyMs: Math.round(p50 * 100) / 100,
    p95LatencyMs: Math.round(p95 * 100) / 100,
    p99LatencyMs: Math.round(p99 * 100) / 100,
    cacheHitRate: Math.round((cacheHits / iterations) * 10000) / 100,
  };
}

async function benchmarkRecommend(baseUrl: string, iterations: number = 100): Promise<BenchmarkResult> {
  const itemIds = Array.from({ length: 20 }, (_, i) => `item-${i + 10}`);
  const latencies: number[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  console.log(`\n🔥 Running ${iterations} recommend requests (20 unique items x 5 cycles)...`);

  for (let i = 0; i < iterations; i++) {
    const item_id = itemIds[i % itemIds.length];
    const start = performance.now();

    try {
      const response = await fetch(`${baseUrl}/v1/recommend`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ item_id, strategy: 'simple', limit: 10 }),
      });

      const data = (await response.json()) as { cacheHit?: boolean };
      const latency = performance.now() - start;
      latencies.push(latency);

      if (data.cacheHit) {
        cacheHits++;
      } else {
        cacheMisses++;
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Completed ${i + 1}/${iterations} requests...`);
      }
    } catch (err: any) {
      console.error(`Request ${i + 1} failed:`, err.message);
    }
  }

  latencies.sort((a, b) => a - b);

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  return {
    operation: 'recommend',
    totalRequests: iterations,
    cacheHits,
    cacheMisses,
    avgLatencyMs: Math.round(avg * 100) / 100,
    p50LatencyMs: Math.round(p50 * 100) / 100,
    p95LatencyMs: Math.round(p95 * 100) / 100,
    p99LatencyMs: Math.round(p99 * 100) / 100,
    cacheHitRate: Math.round((cacheHits / iterations) * 10000) / 100,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log('\n═══════════════════════════════════════════');
  console.log(`📊 BENCHMARK RESULTS (${result.operation.toUpperCase()})`);
  console.log('═══════════════════════════════════════════');
  console.log(`Total Requests:    ${result.totalRequests}`);
  console.log(`Cache Hits:        ${result.cacheHits} (${result.cacheHitRate}%)`);
  console.log(`Cache Misses:      ${result.cacheMisses}`);
  console.log(`Avg Latency:       ${result.avgLatencyMs} ms`);
  console.log(`P50 Latency:       ${result.p50LatencyMs} ms`);
  console.log(`P95 Latency:       ${result.p95LatencyMs} ms`);
  console.log(`P99 Latency:       ${result.p99LatencyMs} ms`);
  console.log('═══════════════════════════════════════════');
}

async function main() {
  console.log('🚀 EIDOS Redis Cache Benchmark\n');

  process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '10000';

  let baseUrl = process.env.API_URL || '';
  let ephemeralApp: Awaited<ReturnType<typeof buildServer>> | null = null;

  if (!baseUrl || !(await isServerReachable(baseUrl))) {
    ApiQueryCache.invalidateAll();
    ephemeralApp = await buildServer();
    const address = await ephemeralApp.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address;
  }

  try {
    // Warm up embedder model initialization before measuring latency
    await fetch(`${baseUrl}/v1/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ query: 'warmup embedder model', limit: 1 }),
    });

    const searchResult = await benchmarkSearch(baseUrl, 100);
    printResult(searchResult);

    const recResult = await benchmarkRecommend(baseUrl, 100);
    printResult(recResult);

    if (searchResult.cacheHitRate >= 70 && searchResult.p95LatencyMs < 15) {
      console.log('\n✅ BENCHMARK PASSED! Redis cache is working optimally.\n');
    } else {
      console.log('\n⚠️  BENCHMARK WARNING: Performance below target.\n');
    }
  } finally {
    if (ephemeralApp) {
      await ephemeralApp.close();
    }
  }
}

main().catch(console.error);
