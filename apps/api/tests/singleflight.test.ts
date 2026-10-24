import { describe, it, expect } from 'vitest';
import { SingleFlight } from '../src/services/cache/singleflight';

describe('SingleFlight', () => {
  it('should execute function only once for concurrent requests', async () => {
    const sf = new SingleFlight();
    let executionCount = 0;

    const fn = async () => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'result';
    };

    // Launch 100 concurrent requests with same key
    const promises = Array.from({ length: 100 }, () => sf.do('key1', fn));

    const results = await Promise.all(promises);

    // All should get the same result
    expect(results.every((r) => r === 'result')).toBe(true);

    // But function should only execute ONCE
    expect(executionCount).toBe(1);
  });

  it('should allow different keys to execute in parallel', async () => {
    const sf = new SingleFlight();
    let executionCount = 0;

    const fn = async () => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return executionCount;
    };

    // Launch 3 requests with different keys
    const promises = [sf.do('key1', fn), sf.do('key2', fn), sf.do('key3', fn)];

    await Promise.all(promises);

    // Each key should execute independently
    expect(executionCount).toBe(3);
  });
});
