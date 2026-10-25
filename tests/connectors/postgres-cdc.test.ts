import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import {
  PostgresCDCConnector,
  MongoChangeStreamConnector,
} from '../../apps/api/src/connectors';
import { getSemanticCache } from '../../apps/api/src/services/cache';

describe('EIDOS v3.2 - Zero-ETL Connectors (Postgres CDC & MongoDB Change Streams)', () => {
  let store: VectorStore;
  let embedder: ServerEmbedder;
  let pgConnector: PostgresCDCConnector;
  let mongoConnector: MongoChangeStreamConnector;

  beforeEach(() => {
    store = new VectorStore();
    embedder = new ServerEmbedder();
    pgConnector = new PostgresCDCConnector(store, embedder);
    mongoConnector = new MongoChangeStreamConnector(store, embedder);
  });

  it('processes Postgres logical replication INSERT, UPDATE, and DELETE WAL events with cache invalidation', async () => {
    const semCache = getSemanticCache();
    semCache.clear();

    // 1. INSERT via Postgres CDC
    const insertMetrics = await pgConnector.processBatch([
      {
        lsn: '0/16B3748',
        op: 'INSERT',
        table: 'catalog_items',
        after: {
          id: 'cdc-pg-101',
          title: 'Pro Mechanical Keyboard RGB',
          description: 'Hot-swappable tactile mechanical keyboard for developers',
          category: 'Electronics',
          tags: ['keyboard', 'mechanical', 'rgb'],
          price: 149.99,
        },
      },
    ]);

    expect(insertMetrics.inserted).toBe(1);
    expect(store.count()).toBe(1);
    expect(store.get('cdc-pg-101')?.title).toBe('Pro Mechanical Keyboard RGB');

    // 2. UPDATE via Postgres CDC
    const updateMetrics = await pgConnector.processBatch([
      {
        lsn: '0/16B3790',
        op: 'UPDATE',
        table: 'catalog_items',
        after: {
          id: 'cdc-pg-101',
          title: 'Pro Mechanical Keyboard Wireless V2',
          description: 'Updated wireless hot-swappable keyboard',
          category: 'Electronics',
          tags: ['keyboard', 'wireless'],
          price: 169.99,
        },
      },
    ]);

    expect(updateMetrics.updated).toBe(1);
    expect(store.get('cdc-pg-101')?.title).toBe('Pro Mechanical Keyboard Wireless V2');
    expect(store.get('cdc-pg-101')?.price).toBe(169.99);

    // 3. DELETE via Postgres CDC
    const deleteMetrics = await pgConnector.processBatch([
      {
        lsn: '0/16B3810',
        op: 'DELETE',
        table: 'catalog_items',
        before: { id: 'cdc-pg-101' },
      },
    ]);

    expect(deleteMetrics.deleted).toBe(1);
    expect(store.get('cdc-pg-101')).toBeUndefined();
    expect(pgConnector.getMetrics().lastProcessedId).toBe('0/16B3810');
  });

  it('processes MongoDB Change Stream events with resume token deduplication', async () => {
    const event = {
      _id: { _data: '8265B1C000000001' },
      operationType: 'insert' as const,
      documentKey: { _id: 'mongo-item-55' },
      fullDocument: {
        title: 'Ergonomic Studio Chair',
        description: 'Breathable mesh lumbar support office chair',
        category: 'Home',
        tags: ['ergonomic', 'chair', 'office'],
        price: 399.0,
      },
    };

    const firstPass = await mongoConnector.handleEvent(event);
    expect(firstPass).toBe(true);
    expect(store.get('mongo-item-55')?.title).toBe('Ergonomic Studio Chair');

    // Replay same resume token -> idempotently skipped
    const duplicatePass = await mongoConnector.handleEvent(event);
    expect(duplicatePass).toBe(false);
    expect(mongoConnector.getMetrics().inserted).toBe(1);

    // Delete event with new resume token
    const deletePass = await mongoConnector.handleEvent({
      _id: { _data: '8265B1C000000002' },
      operationType: 'delete',
      documentKey: { _id: 'mongo-item-55' },
    });
    expect(deletePass).toBe(true);
    expect(store.get('mongo-item-55')).toBeUndefined();
    expect(mongoConnector.getMetrics().deleted).toBe(1);
  });
});
