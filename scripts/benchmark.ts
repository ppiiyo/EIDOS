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
