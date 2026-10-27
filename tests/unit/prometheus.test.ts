import { describe, it, expect } from 'vitest';
import { PrometheusRegistry } from '../../apps/api/src/observability/prometheus';

describe('PrometheusRegistry', () => {
  it('formats counters and latency histograms in Prometheus text format', () => {
    const reg = new PrometheusRegistry();
    reg.incCounter('eidos_http_requests_total', { route: '/search', status: '200' });
    reg.observeHistogram('eidos_search_latency_ms', 3.4);
    reg.observeHistogram('eidos_search_latency_ms', 12.1);
    const text = reg.serialize();
    expect(text).toContain('eidos_http_requests_total{route="/search",status="200"} 1');
    expect(text).toContain('eidos_search_latency_ms_bucket{le="5"} 1');
    expect(text).toContain('eidos_search_latency_ms_count 2');
  });
});
