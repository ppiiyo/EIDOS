import { describe, it, expect } from 'vitest';
import { HNSWIndex } from '../hnsw';
import { WriteAheadLog } from '../persistence/wal';
import { Metrics } from '../metrics/prometheus';

describe('COMPREHENSIVE FIX: Production Hardening Tasks', () => {
  it('TASK 0.2: WriteAheadLog supports logSize tracking, needsRotation and flush', async () => {
    let flushed = false;
    const wal = new WriteAheadLog(10, async () => {
      flushed = true;
    });

    expect(wal.getLogSize()).toBe(0);
    expect(wal.needsRotation()).toBe(false);

    const vec = new Float32Array([0.1, 0.2, 0.3]);
    wal.append({
      type: 'INSERT_NODE',
      nodeId: 'item-1',
      vector: vec,
    });

    expect(wal.size()).toBe(1);
    expect(wal.getLogSize()).toBeGreaterThan(120);

    await wal.flush();
    expect(flushed).toBe(true);
    expect(wal.size()).toBe(0);
  });

  it('TASK 0.3: HNSWIndex memory statistics and internal ID layer', () => {
    const index = new HNSWIndex({ M: 16 });
    const stats0 = index.getMemoryStats();
    expect(stats0.nodeCount).toBe(0);
    expect(stats0.internalIdCount).toBe(0);
    expect(stats0.estimatedBytes).toBe(0);

    const v1 = new Float32Array(384).fill(0.1);
    const v2 = new Float32Array(384).fill(0.2);

    index.insert('doc-1', v1);
    index.insert('doc-2', v2);

    const internal1 = index.getInternalId('doc-1');
    const internal2 = index.getInternalId('doc-2');
    expect(typeof internal1).toBe('number');
    expect(typeof internal2).toBe('number');
    expect(index.getExternalId(internal1)).toBe('doc-1');
    expect(index.getExternalId(internal2)).toBe('doc-2');

    const statsAfter = index.getMemoryStats();
    expect(statsAfter.nodeCount).toBe(2);
    expect(statsAfter.internalIdCount).toBe(2);
    expect(statsAfter.estimatedBytes).toBeGreaterThan(3000);

    const deleted = index.delete('doc-1');
    expect(deleted).toBe(true);
    expect(index.getMemoryStats().nodeCount).toBe(1);
    expect(index.getMemoryStats().internalIdCount).toBe(1);
  });

  it('TASK 1.1: Prometheus Metrics comprehensive observability registry', async () => {
    Metrics.initialize();

    Metrics.requestsTotal.inc({ method: 'POST', endpoint: '/v1/search', status: 200, status_code: '200' });
    Metrics.requestDuration.observe({ method: 'POST', endpoint: '/v1/search' }, 0.015);
    Metrics.vectorStoreSize.set(42);
    Metrics.searchLatency.observe({ search_type: 'hnsw' }, 0.003);
    Metrics.embeddingLatency.observe({ mode: 'batch' }, 0.024);
    Metrics.embeddingsGenerated.inc({}, 10);
    Metrics.cacheHits.inc({ cache_type: 'l1' });
    Metrics.cacheMisses.inc({ cache_type: 'l2' });
    Metrics.errorsTotal.inc({ error_type: 'Validation', endpoint: '/v1/search' });

    const rendered = await Metrics.getMetrics();
    expect(rendered).toContain('kostra44sip_requests_total');
    expect(rendered).toContain('kostra44sip_request_duration_seconds');
    expect(rendered).toContain('kostra44sip_vector_store_size 42');
    expect(rendered).toContain('kostra44sip_search_latency_seconds');
    expect(rendered).toContain('kostra44sip_embedding_latency_seconds');
    expect(rendered).toContain('kostra44sip_embeddings_generated_total');
    expect(rendered).toContain('kostra44sip_cache_hits_total');
    expect(rendered).toContain('kostra44sip_cache_misses_total');
    expect(rendered).toContain('kostra44sip_errors_total');
  });
});
