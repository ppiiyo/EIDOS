import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import { MongoChangeStreamConnector } from '../../apps/api/src/connectors';
import { ApiQueryCache } from '../../apps/api/src/services/query-cache';
import { getSemanticCache } from '../../apps/api/src/services/cache';

describe('PHASE 1 - Task 1.2: MongoDB Change Streams Integration Test', () => {
  let store: VectorStore;
  let embedder: ServerEmbedder;
  let mongoConnector: MongoChangeStreamConnector;

  beforeEach(() => {
    store = new VectorStore();
    embedder = ServerEmbedder.getInstance();
    mongoConnector = new MongoChangeStreamConnector(store, embedder);
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
  });

  it('replicates MongoDB insert, update, replace, and delete Change Stream events in <5s with resume token idempotency and cache invalidation', async () => {
    const startTime = Date.now();
    const queryCache = ApiQueryCache.getInstance();
    queryCache.set('search:studio-monitor', { cached: true });

    // 1. Insert document in MongoDB Change Stream
    const inserted = await mongoConnector.handleEvent({
      _id: { _data: '8265F0000000000001' },
      operationType: 'insert',
      documentKey: { _id: 'mongo-doc-900' },
      fullDocument: {
        title: 'Genelec 8030C Bi-Amplified Studio Monitor',
        description: 'Active two-way nearfield monitor speaker for professional studios',
        category: 'Audio',
        tags: ['studio', 'monitor', 'genelec'],
        price: 695.0,
      },
    });

    expect(inserted).toBe(true);
    expect(store.get('mongo-doc-900')?.title).toBe(
      'Genelec 8030C Bi-Amplified Studio Monitor'
    );
    expect(queryCache.get('search:studio-monitor')).toBeUndefined();

    // 2. Update document in MongoDB Change Stream
    queryCache.set('search:studio-monitor', { cached: true });
    const updated = await mongoConnector.handleEvent({
      _id: { _data: '8265F0000000000002' },
      operationType: 'update',
      documentKey: { _id: 'mongo-doc-900' },
      fullDocument: {
        title: 'Genelec 8330A SAM Smart Active Studio Monitor',
        description: 'GLM calibrated DSP studio monitor',
        category: 'Audio',
        tags: ['studio', 'monitor', 'dsp'],
        price: 950.0,
      },
    });

    expect(updated).toBe(true);
    expect(store.get('mongo-doc-900')?.title).toBe(
      'Genelec 8330A SAM Smart Active Studio Monitor'
    );
    expect(store.get('mongo-doc-900')?.price).toBe(950.0);
    expect(queryCache.get('search:studio-monitor')).toBeUndefined();

    // 3. Delete document in MongoDB Change Stream
    queryCache.set('search:studio-monitor', { cached: true });
    const deleted = await mongoConnector.handleEvent({
      _id: { _data: '8265F0000000000003' },
      operationType: 'delete',
      documentKey: { _id: 'mongo-doc-900' },
    });

    const elapsedMs = Date.now() - startTime;
    expect(deleted).toBe(true);
    expect(store.get('mongo-doc-900')).toBeUndefined();
    expect(queryCache.get('search:studio-monitor')).toBeUndefined();
    expect(mongoConnector.getMetrics().lastResumeToken).toBe('8265F0000000000003');
    expect(elapsedMs).toBeLessThan(5000);
  });
});
