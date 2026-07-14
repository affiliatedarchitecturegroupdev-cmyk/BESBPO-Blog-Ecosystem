// OpenTelemetry Tracing Setup for BESBPO Blog Platform
// Reference: Master Plan Section 7 - Observability
// 
// Provides distributed tracing across all services

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { AwsLambdaInstrumentation } from '@opentelemetry/instrumentation-aws-lambda';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

// Configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'cms-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

// Resource with service metadata
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  'service.namespace': 'besbpo',
  'service.instance.id': process.env.HOSTNAME || 'local',
});

// Trace exporter (OTLP/gRPC)
const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/opentelemetry.proto.collector.trace.v1.TraceService/Export`,
});

// Alternative Jaeger exporter for development
const jaegerExporter = new JaegerExporter({
  endpoint: 'http://localhost:14250',
});

// Metric exporter (OTLP/gRPC)
const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/opentelemetry.proto.collector.metrics.v1.MetricsService/Export`,
});

// Initialize the SDK
export const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export every 60 seconds
  }),
  instrumentations: [
    // HTTP instrumentation (automatic for fetch/http)
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (request) => {
        // Ignore health check endpoints
        return request.url === '/health' || request.url === '/ready';
      },
      ignoreOutgoingRequestHook: (request) => {
        // Ignore telemetry endpoints
        return request.hostname === 'localhost' && request.port === 4317;
      },
    }),
    // Express instrumentation
    new ExpressInstrumentation({
      requestHook: (span, request) => {
        span.setAttribute('http.request_id', request.headers['x-request-id'] || '');
      },
    }),
    // PostgreSQL instrumentation
    new PgInstrumentation({
      enhancedDatabaseReporting: true,
    }),
    // Redis instrumentation
    new RedisInstrumentation({
      dbStatementSerializer: (cmdName, cmdArgs) => {
        return `${cmdName} ${cmdArgs.join(' ')}`;
      },
    }),
    // AWS Lambda instrumentation
    new AwsLambdaInstrumentation(),
  ],
  spanProcessors: [
    new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
    }),
  ],
});

// Graceful shutdown
export async function shutdownTracing(): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry SDK', error);
  }
}

// Helper function to create a custom span
export function createSpan(name: string, fn: (span: any) => Promise<any>): Promise<any> {
  return sdk.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 0 }); // OK
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

// Helper to add attributes to current span
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = sdk.trace.getActiveSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

// Helper to record exception on current span
export function recordException(error: Error): void {
  const span = sdk.trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
  }
}

// Start the SDK
if (process.env.OTEL_ENABLED === 'true') {
  sdk.start();
  console.log('OpenTelemetry SDK initialized');
  
  // Handle graceful shutdown
  process.on('SIGTERM', shutdownTracing);
  process.on('SIGINT', shutdownTracing);
}

// Export for use in other modules
export { trace, context, propagation } from '@opentelemetry/api';
