import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import * as resources from '@opentelemetry/resources';
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
    const attrs = {
      [SemanticResourceAttributes.SERVICE_NAME]: 'eidos-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: '3.5.0',
      environment: process.env.NODE_ENV || 'development',
    };
    const resObj =
      typeof (resources as any).resourceFromAttributes === 'function'
        ? (resources as any).resourceFromAttributes(attrs)
        : (resources as any).Resource
        ? new (resources as any).Resource(attrs)
        : undefined;

    const sdk = new NodeSDK({
      ...(resObj ? { resource: resObj } : {}),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
        } as any),
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
