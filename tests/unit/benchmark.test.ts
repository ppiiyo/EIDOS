import { describe, it, expect } from 'vitest';
import { runLoadTest } from '../../scripts/benchmark';

describe('Automated Load Testing Suite', () => {
  it('measures RPS and latency percentiles accurately', async () => {
    const report = await runLoadTest(async () => {
      let s = 0;
      for (let i = 0; i < 500; i++) s += i;
      if (s < 0) throw new Error('Unreachable');
    }, 100, 10);
    expect(report.totalRequests).toBe(100);
    expect(report.rps).toBeGreaterThan(100);
    expect(report.p99Ms).toBeGreaterThanOrEqual(report.p50Ms);
  });
});
