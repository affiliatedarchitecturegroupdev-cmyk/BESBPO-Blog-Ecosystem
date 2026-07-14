// OpenTelemetry Tracing Setup for BESBPO Blog Platform
// Reference: Master Plan Section 7 - Observability

import { trace, SpanStatusCode, Span, context } from '@opentelemetry/api';

const SERVICE_NAME = process.env.SERVICE_NAME || 'cms-api';
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

// Tracer instance
const tracer = trace.getTracer(SERVICE_NAME);

// Helper function to create a traced span
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return context.with(trace.setSpan(context.active(), tracer.startSpan(name)), async () => {
    const span = trace.getActiveSpan();
    if (!span) throw new Error('No active span');
    
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Get current active span
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

// Add attributes to current span
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

// Export trace utilities
export { trace, SpanStatusCode, Span };
