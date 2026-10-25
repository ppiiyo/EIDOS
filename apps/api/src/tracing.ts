import type { NodeSDK } from '@opentelemetry/sdk-node';

let sdkInstance: NodeSDK | null = null;

/**
 * Initializes OpenTelemetry distributed tracing for Eidos API.
 * Configures OTLP exporter for Jaeger, Zipkin, or Grafana Tempo when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */
export function initTracing(): NodeSDK | null {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST ||
    sdkInstance ||
    (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_ENABLED !== 'true')
  ) {
    return sdkInstance;
  }

  try {
    // Lazy-require heavy OpenTelemetry packages only when tracing export is enabled
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK: OtelNodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resources = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

    const attrs = {
      [SemanticResourceAttributes.SERVICE_NAME]: 'eidos-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: '3.5.0',
      environment: process.env.NODE_ENV || 'development',
    };
    const resObj =
      typeof resources.resourceFromAttributes === 'function'
        ? resources.resourceFromAttributes(attrs)
        : resources.Resource
        ? new resources.Resource(attrs)
        : undefined;

    const sdk: NodeSDK = new OtelNodeSDK({
      ...(resObj ? { resource: resObj } : {}),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
        }),
      ],
    });

    sdk.start();
    sdkInstance = sdk;

    process.once('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => {
          // Tracing gracefully shutdown
        })
        .catch((error) => {
          console.error('Error terminating tracing:', error);
        });
    });

    return sdk;
  } catch (err) {
    console.warn('OpenTelemetry tracing initialization deferred or skipped:', err);
    return null;
  }
}

export type EidosSpanName =
  | 'http.request'
  | 'hnsw.search'
  | 'bm25.lexical_search'
  | 'rrf.fusion'
  | 'mmr.diversification'
  | 'redis.lookup'
  | 'cross_encoder.rerank'
  | string;

export interface RecordedSpan {
  name: EidosSpanName;
  traceId: string;
  spanId: string;
  startTimeMs: number;
  durationMs: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

const spanRingBuffer: RecordedSpan[] = [];
const MAX_RECORDED_SPANS = 500;

function randomHex(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/**
 * Executes an async or sync operation inside an OpenTelemetry-compatible span
 * (`http.request`, `hnsw.search`, `bm25.lexical_search`, `rrf.fusion`, `mmr.diversification`, `redis.lookup`).
 */
export async function traceSpan<T>(
  name: EidosSpanName,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T> | T
): Promise<T> {
  const start = performance.now();
  const startTimeMs = Date.now();
  const traceId = randomHex(32);
  const spanId = randomHex(16);

  try {
    const result = await fn();
    const durationMs = Math.round((performance.now() - start) * 1000) / 1000;

    if (spanRingBuffer.length >= MAX_RECORDED_SPANS) {
      spanRingBuffer.shift();
    }
    spanRingBuffer.push({
      name,
      traceId,
      spanId,
      startTimeMs,
      durationMs,
      status: 'ok',
      attributes,
    });

    return result;
  } catch (error) {
    const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
    if (spanRingBuffer.length >= MAX_RECORDED_SPANS) {
      spanRingBuffer.shift();
    }
    spanRingBuffer.push({
      name,
      traceId,
      spanId,
      startTimeMs,
      durationMs,
      status: 'error',
      attributes: {
        ...attributes,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export function getRecordedSpans(): RecordedSpan[] {
  return [...spanRingBuffer];
}

export function clearRecordedSpans(): void {
  spanRingBuffer.length = 0;
}

