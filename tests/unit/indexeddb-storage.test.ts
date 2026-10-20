import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { HNSWIndex } from '@eidos/core';
import {
  saveBinaryEmbeddingsToIdb,
  loadBinaryEmbeddingsFromIdb,
  saveHnswIndexToIdb,
  loadHnswIndexFromIdb,
  saveProjectsToIdb,
  loadProjectsFromIdb,
  clearAllIdbStorage,
  StorageQuotaError,
  simulateQuotaExceededForTests,
} from '../../apps/workspace/src/lib/storage';
import {
  trackEvent,
  getEvents,
  clearAnalytics,
  flushAnalyticsToIdb,
  hydrateAnalyticsFromIdb,
} from '../../apps/workspace/src/lib/analytics/tracker';
import {
  createExperiment,
  listExperiments,
  flushExperimentsToIdb,
  hydrateExperimentsFromIdb,
} from '../../apps/workspace/src/lib/ab-testing/engine';

describe('Phase 3: IndexedDB Binary Persistence & Zero localStorage (TDD)', () => {
  beforeEach(async () => {
    simulateQuotaExceededForTests(false);
    await clearAllIdbStorage();
    clearAnalytics();
  });

  it('persists and restores 1,500 binary Float32Array(384) embeddings in IndexedDB without JSON serialization loss', async () => {
    const embeddings = new Map<string, Float32Array>();
    for (let i = 0; i < 1500; i++) {
      const vec = new Float32Array(384);
      vec[0] = 0.5;
      vec[1] = (i % 100) / 100;
      vec[383] = 0.25;
      embeddings.set(`sku_${i}`, vec);
    }

    await saveBinaryEmbeddingsToIdb(embeddings);
    const loaded = await loadBinaryEmbeddingsFromIdb();

    expect(loaded.size).toBe(1500);
    const sample = loaded.get('sku_1499');
    expect(sample).toBeDefined();
    expect(sample).toBeInstanceOf(Float32Array);
    expect(sample!.length).toBe(384);
    expect(sample![0]).toBeCloseTo(0.5, 6);
    expect(sample![1]).toBeCloseTo(0.99, 6);
    expect(sample![383]).toBeCloseTo(0.25, 6);
  });

  it('serializes and restores HNSWIndex binary graph in IndexedDB', async () => {
    const index = new HNSWIndex({ M: 8, efConstruction: 32, efSearch: 16 });
    const v1 = new Float32Array([1, 0, 0, 0]);
    const v2 = new Float32Array([0.9, 0.1, 0, 0]);
    index.insert('node_1', v1);
    index.insert('node_2', v2);

    await saveHnswIndexToIdb(index);
    const restored = await loadHnswIndexFromIdb();

    expect(restored).not.toBeNull();
    expect(restored!.size()).toBe(2);
    const hits = restored!.search(v1, 2);
    expect(hits[0].id).toBe('node_1');
  });

  it('persists and loads projects via IndexedDB', async () => {
    const projects = [
      {
        id: 'proj_test',
        name: 'Test IndexedDB Project',
        description: 'Stored in IndexedDB',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        concepts: [{ id: 'c1', name: 'HNSW', category: 'AI' }],
        threshold: 0.4,
      },
    ];
    await saveProjectsToIdb(projects);
    const loaded = await loadProjectsFromIdb();
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('Test IndexedDB Project');
  });

  it('throws explicit StorageQuotaError when IndexedDB quota is exceeded', async () => {
    simulateQuotaExceededForTests(true);
    const map = new Map<string, Float32Array>([['1', new Float32Array([1, 0])]]);
    await expect(saveBinaryEmbeddingsToIdb(map)).rejects.toThrow(StorageQuotaError);
  });

  it('persists analytics events and A/B experiments into IndexedDB without localStorage', async () => {
    trackEvent({ type: 'search', query: 'indexeddb vector search' });
    await flushAnalyticsToIdb();
    const eventsAfterHydrate = await hydrateAnalyticsFromIdb();
    expect(eventsAfterHydrate.some((e) => e.query === 'indexeddb vector search')).toBe(true);
    expect(getEvents().length).toBeGreaterThan(0);

    createExperiment({
      name: 'IDB Experiment',
      description: 'Persisted in IDB',
      variantNames: ['Control', 'Treatment'],
      trafficSplit: [0.5, 0.5],
      metric: 'conversion',
    });
    await flushExperimentsToIdb();
    const exps = await hydrateExperimentsFromIdb();
    expect(exps.some((e) => e.name === 'IDB Experiment')).toBe(true);
    expect(listExperiments().some((e) => e.name === 'IDB Experiment')).toBe(true);
  });
});
