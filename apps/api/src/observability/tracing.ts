import * as crypto from 'node:crypto';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export function parseTraceparent(header?: string): SpanContext {
  if (header) {
    const parts = header.trim().split('-');
    if (parts.length === 4 && parts[1].length === 32 && parts[2].length === 16) {
      return {
        traceId: parts[1],
        parentSpanId: parts[2],
        spanId: crypto.randomBytes(8).toString('hex'),
        sampled: parts[3] === '01',
      };
    }
  }
  return {
    traceId: crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
    sampled: true,
  };
}

export function formatTraceparent(ctx: SpanContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.sampled ? '01' : '00'}`;
}
