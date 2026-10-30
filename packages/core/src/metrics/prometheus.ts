/**
 * Isomorphic Enterprise Prometheus Metrics Registry.
 * High-performance, zero-dependency implementation compatible with:
 * - Web Browsers (Vite, Web Workers, WASM)
 * - Node.js (Fastify, Express, CLI)
 * - Cloudflare Workers / Edge Runtimes
 *
 * Produces standard Prometheus text exposition format (version 0.0.4).
 * Uses globalThis singleton anchoring so ESM and CJS module graphs always share
 * a single authoritative registry in memory.
 */

function formatLabels(labels?: Record<string, string | number>): string {
  if (!labels) return '';
  const keys = Object.keys(labels);
  if (keys.length === 0) return '';
  if (keys.length === 1) {
    const k = keys[0];
    const v = labels[k];
    if (v === undefined || v === null) return '';
    return `{${k}="${String(v).replace(/"/g, '\\"')}"}`;
  }
  keys.sort();
  const parts: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = labels[k];
    if (v !== undefined && v !== null) {
      parts.push(`${k}="${String(v).replace(/"/g, '\\"')}"`);
    }
  }
  return parts.length > 0 ? `{${parts.join(',')}}` : '';
}

export class CounterMetric {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  public inc(
    arg1?: number | Record<string, string | number>,
    arg2?: number
  ): void {
    let labels: Record<string, string | number> = {};
    let val = 1;

    if (typeof arg1 === 'number') {
      val = arg1;
    } else if (arg1 && typeof arg1 === 'object') {
      labels = arg1;
      if (typeof arg2 === 'number') {
        val = arg2;
      }
    }

    const key = formatLabels(labels);
    this.values.set(key, (this.values.get(key) || 0) + val);
  }

  public get(labels?: Record<string, string | number>): number {
    if (labels && Object.keys(labels).length > 0) {
      return this.values.get(formatLabels(labels)) || 0;
    }
    let total = 0;
    for (const val of this.values.values()) {
      total += val;
    }
    return total;
  }

  public reset(): void {
    this.values.clear();
  }

  public render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      let total = 0;
      for (const [labels, val] of this.values.entries()) {
        lines.push(`${this.name}${labels} ${val}`);
        total += val;
      }
      if (!this.values.has('')) {
        lines.push(`${this.name} ${total}`);
      }
    }
    return lines.join('\n');
  }
}

export class GaugeMetric {
  private values = new Map<string, number>();
  private defaultValue = 0;

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  public set(
    arg1: number | Record<string, string | number>,
    arg2?: number
  ): void {
    if (typeof arg1 === 'number') {
      this.defaultValue = arg1;
      this.values.set('', arg1);
    } else if (arg1 && typeof arg1 === 'object') {
      const key = formatLabels(arg1);
      const val = typeof arg2 === 'number' ? arg2 : 0;
      this.values.set(key, val);
      this.defaultValue = val;
    }
  }

  public inc(val: number = 1): void {
    this.defaultValue += val;
    this.values.set('', this.defaultValue);
  }

  public dec(val: number = 1): void {
    this.defaultValue -= val;
    this.values.set('', this.defaultValue);
  }

  public get(): number {
    return this.defaultValue;
  }

  public reset(): void {
    this.values.clear();
    this.defaultValue = 0;
  }

  public render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} ${this.defaultValue}`);
    } else {
      for (const [labels, val] of this.values.entries()) {
        lines.push(`${this.name}${labels} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

interface HistogramSeriesAccumulator {
  count: number;
  sum: number;
  bucketCounts: number[];
}

export class HistogramMetric {
  private series = new Map<string, HistogramSeriesAccumulator>();
  private totalCount = 0;
  private totalSum = 0;
  private totalBucketCounts: number[];
  public readonly buckets: number[];

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.totalBucketCounts = new Array<number>(this.buckets.length).fill(0);
  }

  public observe(
    arg1: number | Record<string, string | number>,
    arg2?: number
  ): void {
    let labels: Record<string, string | number> = {};
    let val = 0;

    if (typeof arg1 === 'number') {
      val = arg1;
    } else if (arg1 && typeof arg1 === 'object') {
      labels = arg1;
      if (typeof arg2 === 'number') {
        val = arg2;
      }
    }

    const safeVal = Number.isFinite(val) && val >= 0 ? val : 0;
    const key = formatLabels(labels);

    let acc = this.series.get(key);
    if (!acc) {
      acc = {
        count: 0,
        sum: 0,
        bucketCounts: new Array<number>(this.buckets.length).fill(0),
      };
      this.series.set(key, acc);
    }

    acc.count += 1;
    acc.sum += safeVal;
    this.totalCount += 1;
    this.totalSum += safeVal;

    for (let i = 0; i < this.buckets.length; i++) {
      if (safeVal <= this.buckets[i]) {
        acc.bucketCounts[i] += 1;
        this.totalBucketCounts[i] += 1;
      }
    }
  }

  public getCount(labels?: Record<string, string | number>): number {
    if (labels && Object.keys(labels).length > 0) {
      return this.series.get(formatLabels(labels))?.count || 0;
    }
    return this.totalCount;
  }

  public reset(): void {
    this.series.clear();
    this.totalCount = 0;
    this.totalSum = 0;
    this.totalBucketCounts.fill(0);
  }

  public render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    if (this.totalCount === 0) {
      for (const le of this.buckets) {
        lines.push(`${this.name}_bucket{le="${le}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join('\n');
    }

    for (const [labelsKey, acc] of this.series.entries()) {
      const roundedSum = Math.round(acc.sum * 1e6) / 1e6;
      for (let i = 0; i < this.buckets.length; i++) {
        const le = this.buckets[i];
        const bucketCount = acc.bucketCounts[i];
        if (labelsKey) {
          const inner = labelsKey.slice(1, -1);
          lines.push(`${this.name}_bucket{${inner},le="${le}"} ${bucketCount}`);
        } else {
          lines.push(`${this.name}_bucket{le="${le}"} ${bucketCount}`);
        }
      }

      if (labelsKey) {
        const inner = labelsKey.slice(1, -1);
        lines.push(`${this.name}_bucket{${inner},le="+Inf"} ${acc.count}`);
        lines.push(`${this.name}_sum{${inner}} ${roundedSum}`);
        lines.push(`${this.name}_count{${inner}} ${acc.count}`);
      } else {
        lines.push(`${this.name}_bucket{le="+Inf"} ${acc.count}`);
        lines.push(`${this.name}_sum ${roundedSum}`);
        lines.push(`${this.name}_count ${acc.count}`);
      }
    }

    if (!this.series.has('')) {
      const roundedTotalSum = Math.round(this.totalSum * 1e6) / 1e6;
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket{le="${this.buckets[i]}"} ${this.totalBucketCounts[i]}`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} ${this.totalCount}`);
      lines.push(`${this.name}_sum ${roundedTotalSum}`);
      lines.push(`${this.name}_count ${this.totalCount}`);
    }

    return lines.join('\n');
  }
}

export class MetricsRegistry {
  public readonly contentType = 'text/plain; version=0.0.4; charset=utf-8';
  private metricsList: Array<CounterMetric | GaugeMetric | HistogramMetric> = [];

  public register(metric: CounterMetric | GaugeMetric | HistogramMetric): void {
    const existingIdx = this.metricsList.findIndex((m) => m.name === metric.name);
    if (existingIdx === -1) {
      this.metricsList.push(metric);
    }
  }

  public resetAll(): void {
    for (const metric of this.metricsList) {
      metric.reset();
    }
  }

  public metrics(): string {
    const parts = this.metricsList.map((m) => m.render());

    // Include process runtime & memory metrics if running in Node.js
    if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
      try {
        parts.push(
          `# HELP nodejs_process_uptime_seconds Process uptime in seconds\n# TYPE nodejs_process_uptime_seconds gauge\nnodejs_process_uptime_seconds ${process.uptime()}`
        );
        if (typeof process.memoryUsage === 'function') {
          const mem = process.memoryUsage();
          parts.push(
            `# HELP process_resident_memory_bytes Resident memory size in bytes\n# TYPE process_resident_memory_bytes gauge\nprocess_resident_memory_bytes ${mem.rss}`
          );
          parts.push(
            `# HELP nodejs_heap_used_bytes Process heap used in bytes\n# TYPE nodejs_heap_used_bytes gauge\nnodejs_heap_used_bytes ${mem.heapUsed}`
          );
          parts.push(
            `# HELP nodejs_heap_total_bytes Process heap total in bytes\n# TYPE nodejs_heap_total_bytes gauge\nnodejs_heap_total_bytes ${mem.heapTotal}`
          );
        }
      } catch {
        // ignore
      }
    }

    // Also render standard unprefixed production Prometheus metric names for compatibility with standard Grafana/Alertmanager rules
    const findMetric = (name: string) => this.metricsList.find((m) => m.name === name);
    const searchLat = findMetric('eidos_search_latency_seconds');
    if (searchLat) {
      parts.push(searchLat.render().replace(/eidos_search_latency_seconds/g, 'search_latency_seconds'));
    }
    const reqTotal = findMetric('eidos_requests_total');
    if (reqTotal) {
      parts.push(reqTotal.render().replace(/eidos_requests_total/g, 'search_requests_total'));
    }
    const storeSize = findMetric('eidos_vector_store_size');
    if (storeSize) {
      parts.push(storeSize.render().replace(/eidos_vector_store_size/g, 'index_size_items'));
    }
    const hitRate = findMetric('eidos_cache_hit_rate');
    if (hitRate) {
      parts.push(hitRate.render().replace(/eidos_cache_hit_rate/g, 'cache_hit_ratio'));
    }
    const embedLat = findMetric('eidos_embedding_latency_seconds');
    if (embedLat) {
      parts.push(embedLat.render().replace(/eidos_embedding_latency_seconds/g, 'embedding_time_seconds'));
    }

    return parts.join('\n\n') + '\n';
  }
}

interface GlobalMetricsSingleton {
  registry: MetricsRegistry;
  requestsTotal: CounterMetric;
  requestDuration: HistogramMetric;
  requestSize: HistogramMetric;
  vectorStoreSize: GaugeMetric;
  activeIndexesTotal: GaugeMetric;
  searchLatency: HistogramMetric;
  embeddingLatency: HistogramMetric;
  embeddingsGenerated: CounterMetric;
  cacheHits: CounterMetric;
  cacheMisses: CounterMetric;
  cacheHitRate: GaugeMetric;
  errorsTotal: CounterMetric;
}

const GLOBAL_METRICS_SYMBOL = Symbol.for('eidos.prometheus.metrics.v3');

function getOrCreateGlobalMetrics(): GlobalMetricsSingleton {
  const globalObj = globalThis as unknown as Record<symbol, GlobalMetricsSingleton | undefined>;
  if (globalObj[GLOBAL_METRICS_SYMBOL]) {
    return globalObj[GLOBAL_METRICS_SYMBOL]!;
  }

  const registry = new MetricsRegistry();
  const requestsTotal = new CounterMetric(
    'eidos_requests_total',
    'Total number of HTTP requests processed by Eidos',
    ['method', 'endpoint', 'status', 'status_code']
  );
  const requestDuration = new HistogramMetric(
    'eidos_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'status'],
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  );
  const requestSize = new HistogramMetric(
    'eidos_request_size_bytes',
    'Request payload body size in bytes',
    ['endpoint'],
    [100, 1000, 10000, 100000, 1000000]
  );
  const vectorStoreSize = new GaugeMetric(
    'eidos_vector_store_size',
    'Total number of items indexed in HNSW vector store'
  );
  const activeIndexesTotal = new GaugeMetric(
    'eidos_active_indexes_total',
    'Total number of active tenant vector indexes in StoreRegistry'
  );
  const searchLatency = new HistogramMetric(
    'eidos_search_latency_seconds',
    'Vector approximate nearest neighbor search latency',
    ['search_type'],
    [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
  );
  const embeddingLatency = new HistogramMetric(
    'eidos_embedding_latency_seconds',
    'Transformer embedding inference latency in seconds',
    ['mode'],
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
  );
  const embeddingsGenerated = new CounterMetric(
    'eidos_embeddings_generated_total',
    'Cumulative count of embeddings generated by server embedder'
  );
  const cacheHits = new CounterMetric(
    'eidos_cache_hits_total',
    'Total recommendation and vector cache hits',
    ['cache_type']
  );
  const cacheMisses = new CounterMetric(
    'eidos_cache_misses_total',
    'Total recommendation and vector cache misses',
    ['cache_type']
  );
  const cacheHitRate = new GaugeMetric(
    'eidos_cache_hit_rate',
    'Current recommendation multi-tier cache hit rate (0.0 to 1.0)'
  );
  const errorsTotal = new CounterMetric(
    'eidos_errors_total',
    'Total errors encountered during request lifecycle',
    ['error_type', 'endpoint', 'status']
  );

  registry.register(requestsTotal);
  registry.register(requestDuration);
  registry.register(requestSize);
  registry.register(vectorStoreSize);
  registry.register(activeIndexesTotal);
  registry.register(searchLatency);
  registry.register(embeddingLatency);
  registry.register(embeddingsGenerated);
  registry.register(cacheHits);
  registry.register(cacheMisses);
  registry.register(cacheHitRate);
  registry.register(errorsTotal);

  const instance: GlobalMetricsSingleton = {
    registry,
    requestsTotal,
    requestDuration,
    requestSize,
    vectorStoreSize,
    activeIndexesTotal,
    searchLatency,
    embeddingLatency,
    embeddingsGenerated,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    errorsTotal,
  };

  globalObj[GLOBAL_METRICS_SYMBOL] = instance;
  return instance;
}

const singleton = getOrCreateGlobalMetrics();

export class Metrics {
  public static readonly registry = singleton.registry;
  private static initialized = false;

  // 1. Request metrics
  public static readonly requestsTotal = singleton.requestsTotal;
  public static readonly requestDuration = singleton.requestDuration;
  public static readonly requestSize = singleton.requestSize;

  // 2. Vector store & index metrics
  public static readonly vectorStoreSize = singleton.vectorStoreSize;
  public static readonly activeIndexesTotal = singleton.activeIndexesTotal;
  public static readonly searchLatency = singleton.searchLatency;

  // 3. Embedding metrics
  public static readonly embeddingLatency = singleton.embeddingLatency;
  public static readonly embeddingsGenerated = singleton.embeddingsGenerated;

  // 4. Cache telemetry
  public static readonly cacheHits = singleton.cacheHits;
  public static readonly cacheMisses = singleton.cacheMisses;
  public static readonly cacheHitRate = singleton.cacheHitRate;

  // 5. Error telemetry
  public static readonly errorsTotal = singleton.errorsTotal;

  /**
   * Initializes metrics collection in an environment-safe manner.
   */
  public static initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  /**
   * Resets all registered counters, gauges, and histograms.
   */
  public static reset(): void {
    this.registry.resetAll();
  }

  /**
   * Returns Prometheus registry instance.
   */
  public static getRegistry(): MetricsRegistry {
    return this.registry;
  }

  /**
   * Renders Prometheus text exposition format metrics.
   */
  public static async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Returns Content-Type header string for Prometheus metrics.
   */
  public static getContentType(): string {
    return this.registry.contentType;
  }
}

