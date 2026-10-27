import { describe, it, expect } from 'vitest';
import { parseTraceparent, formatTraceparent } from '../../apps/api/src/observability/tracing';

describe('W3C Traceparent Propagation', () => {
  it('parses incoming traceparent and generates child spanId', () => {
    const incoming = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const ctx = parseTraceparent(incoming);
    expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(ctx.parentSpanId).toBe('00f067aa0ba902b7');
    expect(ctx.spanId).toHaveLength(16);
    expect(formatTraceparent(ctx)).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
  });
});
