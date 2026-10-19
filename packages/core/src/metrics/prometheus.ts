/**
 * Isomorphic Enterprise Prometheus Metrics Registry.
 * High-performance, zero-dependency implementation compatible with:
 * - Web Browsers (Vite, Web Workers, WASM)
 * - Node.js (Fastify, Express, CLI)
 * - Cloudflare Workers / Edge Runtimes
 *
 * Produces standard Prometheus text exposition format (version 0.0.4).
 */

function formatLabels(labels?: Record<string, string | number>): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  const entries = Object.entries(labels)
    .filter(([_, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
  return entries.length > 0 ? `{${entries.join(',')}}` : '';
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

  public render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [labels, val] of this.values.entries()) {
        lines.push(`${this.name}${labels} ${val}`);
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

export class HistogramMetric {
  private observations: Array<{ labels: string; val: number }> = [];
  public readonly buckets: number[];

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
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

    const key = formatLabels(labels);
    this.observations.push({ labels: key, val });
  }

  public render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    if (this.observations.length === 0) {
      for (const le of this.buckets) {
        lines.push(`${this.name}_bucket{le="${le}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join('\n');
    }

    // Group observations by labels
    const grouped = new Map<string, number[]>();
    for (const obs of this.observations) {
      const list = grouped.get(obs.labels) || [];
      list.push(obs.val);
      grouped.set(obs.labels, list);
    }

    for (const [labelsKey, values] of grouped.entries()) {
      const count = values.length;
      const sum = values.reduce((acc, v) => acc + v, 0);

      for (const le of this.buckets) {
        const bucketCount = values.filter((v) => v <= le).length;
        if (labelsKey) {
          const inner = labelsKey.slice(1, -1);
          lines.push(`${this.name}_bucket{${inner},le="${le}"} ${bucketCount}`);
        } else {
          lines.push(`${this.name}_bucket{le="${le}"} ${bucketCount}`);
        }
      }

      if (labelsKey) {
        const inner = labelsKey.slice(1, -1);
        lines.push(`${this.name}_bucket{${inner},le="+Inf"} ${count}`);
        lines.push(`${this.name}_sum{${inner}} ${sum}`);
        lines.push(`${this.name}_count{${inner}} ${count}`);
      } else {
        lines.push(`${this.name}_bucket{le="+Inf"} ${count}`);
        lines.push(`${this.name}_sum ${sum}`);
        lines.push(`${this.name}_count ${count}`);
      }
    }

    return lines.join('\n');
  }
}

export class MetricsRegistry {
  public readonly contentType = 'text/plain; version=0.0.4; charset=utf-8';
  private metricsList: Array<CounterMetric | GaugeMetric | HistogramMetric> = [];

  public register(metric: CounterMetric | GaugeMetric | HistogramMetric): void {
    this.metricsList.push(metric);
  }

  public metrics(): string {
    const parts = this.metricsList.map((m) => m.render());

    // Include process runtime metrics if running in Node.js
    if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
      try {
        parts.push(
          `# HELP nodejs_process_uptime_seconds Process uptime in seconds\n# TYPE nodejs_process_uptime_seconds gauge\nnodejs_process_uptime_seconds ${process.uptime()}`
        );
      } catch {
        // ignore
      }
    }

    return parts.join('\n\n') + '\n';
  }
}

export class Metrics {
  private static registry = new MetricsRegistry();
  private static initialized = false;

  // 1. Request metrics
  public static readonly requestsTotal = new CounterMetric(
    'eidos_requests_total',
    'Total number of HTTP requests processed by Eidos',
    ['method', 'endpoint', 'status', 'status_code']
  );

  public static readonly requestDuration = new HistogramMetric(
    'eidos_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  );

  public static readonly requestSize = new HistogramMetric(
    'eidos_request_size_bytes',
    'Request payload body size in bytes',
    ['endpoint'],
    [100, 1000, 10000, 100000, 1000000]
  );

  // 2. Vector store & index metrics
  public static readonly vectorStoreSize = new GaugeMetric(
    'eidos_vector_store_size',
    'Total number of items indexed in HNSW vector store'
  );

  public static readonly searchLatency = new HistogramMetric(
    'eidos_search_latency_seconds',
    'Vector approximate nearest neighbor search latency',
    ['search_type'],
    [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
  );

  // 3. Embedding metrics
  public static readonly embeddingLatency = new HistogramMetric(
    'eidos_embedding_latency_seconds',
    'Transformer embedding inference latency in seconds',
    ['mode'],
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
  );

  public static readonly embeddingsGenerated = new CounterMetric(
    'eidos_embeddings_generated_total',
    'Cumulative count of embeddings generated by server embedder'
  );

  // 4. Cache telemetry
  public static readonly cacheHits = new CounterMetric(
    'eidos_cache_hits_total',
    'Total recommendation and vector cache hits',
    ['cache_type']
  );

  public static readonly cacheMisses = new CounterMetric(
    'eidos_cache_misses_total',
    'Total recommendation and vector cache misses',
    ['cache_type']
  );

  public static readonly cacheHitRate = new GaugeMetric(
    'eidos_cache_hit_rate',
    'Current recommendation multi-tier cache hit rate (0.0 to 1.0)'
  );

  // 5. Error telemetry
  public static readonly errorsTotal = new CounterMetric(
    'eidos_errors_total',
    'Total errors encountered during request lifecycle',
    ['error_type', 'endpoint']
  );

  static {
    // Automatically register all static metrics
    this.registry.register(this.requestsTotal);
    this.registry.register(this.requestDuration);
    this.registry.register(this.requestSize);
    this.registry.register(this.vectorStoreSize);
    this.registry.register(this.searchLatency);
    this.registry.register(this.embeddingLatency);
    this.registry.register(this.embeddingsGenerated);
    this.registry.register(this.cacheHits);
    this.registry.register(this.cacheMisses);
    this.registry.register(this.cacheHitRate);
    this.registry.register(this.errorsTotal);
  }

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
