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
