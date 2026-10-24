import { Counter, Histogram, Gauge, register } from 'prom-client';
import { Metrics, HistogramMetric, GaugeMetric, CounterMetric } from '@eidos/core';

/**
 * Prometheus metrics for cache monitoring.
 *
 * Metrics exposed:
 * - eidos_cache_hits_total: Total cache hits by endpoint
 * - eidos_cache_misses_total: Total cache misses by endpoint
 * - eidos_cache_operation_duration_ms: Cache operation latency
 * - eidos_cache_keys_total: Total keys in cache
 * - eidos_cache_hit_rate: Current hit rate (0-1)
 * - eidos_cache_errors_total: Total number of cache errors
 */

function getOrCreateCounter<T extends string>(config: {
  name: string;
  help: string;
  labelNames: readonly T[];
}): Counter<T> {
  const existing = register.getSingleMetric(config.name) as Counter<T> | undefined;
  if (existing) return existing;
  return new Counter(config);
}

function getOrCreateHistogram<T extends string>(config: {
  name: string;
  help: string;
  labelNames: readonly T[];
  buckets: number[];
}): Histogram<T> {
  const existing = register.getSingleMetric(config.name) as Histogram<T> | undefined;
  if (existing) return existing;
  return new Histogram(config);
}

function getOrCreateGauge<T extends string>(config: {
  name: string;
  help: string;
  labelNames: readonly T[];
}): Gauge<T> {
  const existing = register.getSingleMetric(config.name) as Gauge<T> | undefined;
  if (existing) return existing;
  return new Gauge(config);
}

export const cacheMetrics = {
  hits: getOrCreateCounter({
    name: 'eidos_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['endpoint', 'cache_type'] as const,
  }),

  misses: getOrCreateCounter({
    name: 'eidos_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['endpoint', 'cache_type'] as const,
  }),

  operationDuration: getOrCreateHistogram({
    name: 'eidos_cache_operation_duration_ms',
    help: 'Cache operation latency in milliseconds',
    labelNames: ['operation', 'cache_type'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250],
  }),

  keysTotal: getOrCreateGauge({
    name: 'eidos_cache_keys_total',
    help: 'Total number of keys in cache',
    labelNames: ['cache_type'] as const,
  }),

  hitRate: getOrCreateGauge({
    name: 'eidos_cache_hit_rate',
    help: 'Current cache hit rate (0-1)',
    labelNames: ['endpoint'] as const,
  }),

  errors: getOrCreateCounter({
    name: 'eidos_cache_errors_total',
    help: 'Total number of cache errors',
    labelNames: ['operation', 'error_type'] as const,
  }),
};

// Also register extended cache metrics in @eidos/core Metrics.registry so /metrics exposes them seamlessly
const coreOperationDuration = new HistogramMetric(
  'eidos_cache_operation_duration_ms',
  'Cache operation latency in milliseconds',
  ['operation', 'cache_type'],
  [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250]
);
const coreKeysTotal = new GaugeMetric(
  'eidos_cache_keys_total',
  'Total number of keys in cache',
  ['cache_type']
);
const coreCacheErrors = new CounterMetric(
  'eidos_cache_errors_total',
  'Total number of cache errors',
  ['operation', 'error_type']
);

let coreRegistered = false;
function ensureCoreRegistered(): void {
  if (!coreRegistered) {
    coreRegistered = true;
    Metrics.registry.register(coreOperationDuration);
    Metrics.registry.register(coreKeysTotal);
    Metrics.registry.register(coreCacheErrors);
  }
}
ensureCoreRegistered();

let totalHitsCount = 0;
let totalMissesCount = 0;

/**
 * Record cache hit
 */
export function recordCacheHit(endpoint: string = 'unknown', cacheType: string = 'redis'): void {
  totalHitsCount++;
  cacheMetrics.hits.inc({ endpoint, cache_type: cacheType });
  Metrics.cacheHits.inc({ endpoint, cache_type: cacheType });
  const total = totalHitsCount + totalMissesCount;
  if (total > 0) {
    const rate = Math.round((totalHitsCount / total) * 10000) / 10000;
    cacheMetrics.hitRate.set({ endpoint: 'all' }, rate);
    Metrics.cacheHitRate.set(rate);
  }
}

/**
 * Record cache miss
 */
export function recordCacheMiss(endpoint: string = 'unknown', cacheType: string = 'redis'): void {
  totalMissesCount++;
  cacheMetrics.misses.inc({ endpoint, cache_type: cacheType });
  Metrics.cacheMisses.inc({ endpoint, cache_type: cacheType });
  const total = totalHitsCount + totalMissesCount;
  if (total > 0) {
    const rate = Math.round((totalHitsCount / total) * 10000) / 10000;
    cacheMetrics.hitRate.set({ endpoint: 'all' }, rate);
    Metrics.cacheHitRate.set(rate);
  }
}

/**
 * Record cache operation duration
 */
export function recordCacheOperation(
  operation: 'get' | 'set' | 'del' | 'invalidate',
  durationMs: number,
  cacheType: string = 'redis'
): void {
  const rounded = Math.round(durationMs * 1000) / 1000;
  cacheMetrics.operationDuration.observe({ operation, cache_type: cacheType }, rounded);
  coreOperationDuration.observe({ operation, cache_type: cacheType }, rounded);
}

/**
 * Record cache keys total gauge
 */
export function recordCacheKeysTotal(keys: number, cacheType: string = 'redis'): void {
  cacheMetrics.keysTotal.set({ cache_type: cacheType }, keys);
  coreKeysTotal.set({ cache_type: cacheType }, keys);
}

/**
 * Record cache error
 */
export function recordCacheError(operation: string, errorType: string): void {
  cacheMetrics.errors.inc({ operation, error_type: errorType });
  coreCacheErrors.inc({ operation, error_type: errorType });
}
