import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdkInstance: NodeSDK | null = null;

/**
 * Initializes OpenTelemetry distributed tracing for EIDOS API.
 * Configures OTLP exporter for Jaeger, Zipkin, or Grafana Tempo.
 */
export function initTracing(): NodeSDK | null {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST || sdkInstance) {
    return sdkInstance;
  }

  try {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'eidos-api',
        [SemanticResourceAttributes.SERVICE_VERSION]: '2.1.0',
        environment: process.env.NODE_ENV || 'development',
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fastify': { enabled: true },
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
