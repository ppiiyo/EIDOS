import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import { PostgresCDCConnector } from '../../apps/api/src/connectors';
import { ApiQueryCache } from '../../apps/api/src/services/query-cache';
import { getSemanticCache } from '../../apps/api/src/services/cache';

describe('PHASE 1 - Task 1.2: PostgreSQL CDC Integration Test', () => {
  let store: VectorStore;
  let embedder: ServerEmbedder;
  let pgConnector: PostgresCDCConnector;

  beforeEach(() => {
    store = new VectorStore();
    embedder = ServerEmbedder.getInstance();
    pgConnector = new PostgresCDCConnector(store, embedder);
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
  });

  it('replicates INSERT, UPDATE, and DELETE WAL events into EIDOS in <5s and automatically invalidates query caches', async () => {
    const startTime = Date.now();
    const queryCache = ApiQueryCache.getInstance();
    queryCache.set('search:mechanical-keyboard', { cached: true, hits: 1 });
    expect(queryCache.get('search:mechanical-keyboard')).toBeDefined();

    // 1. INSERT into PostgreSQL -> verify item indexed in EIDOS
    const insertResult = await pgConnector.processBatch([
      {
        lsn: '0/21A0010',
        op: 'INSERT',
        table: 'products',
        after: {
          id: 'pg-prod-501',
          title: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
          description: 'Full aluminum QMK/VIA wireless mechanical keyboard',
          category: 'Peripherals',
          tags: ['keyboard', 'qmk', 'wireless'],
          price: 199.0,
        },
      },
    ]);

    expect(insertResult.inserted).toBe(1);
    expect(store.get('pg-prod-501')?.title).toBe(
      'Keychron Q1 Pro Wireless Custom Mechanical Keyboard'
    );
    // Cache must be automatically invalidated on CDC mutation
    expect(queryCache.get('search:mechanical-keyboard')).toBeUndefined();

    // 2. UPDATE in PostgreSQL -> verify updated fields & vector in EIDOS
    queryCache.set('search:mechanical-keyboard', { cached: true, hits: 2 });
    const updateResult = await pgConnector.processWalBatch({
      lsn: '0/21A0090',
      change: [
        {
          kind: 'update',
          schema: 'public',
          table: 'products',
          columnnames: ['id', 'title', 'description', 'category', 'price', 'tags'],
          columnvalues: [
            'pg-prod-501',
            'Keychron Q1 HE Hall Effect Magnetic Keyboard',
            'Rapid trigger magnetic hall effect switches',
            'Peripherals',
            219.0,
            'keyboard,magnetic,hall-effect',
          ],
        },
      ],
    });

    expect(updateResult.upserted).toBe(1);
    expect(store.get('pg-prod-501')?.title).toBe(
      'Keychron Q1 HE Hall Effect Magnetic Keyboard'
    );
    expect(store.get('pg-prod-501')?.price).toBe(219.0);
    expect(queryCache.get('search:mechanical-keyboard')).toBeUndefined();

    // 3. DELETE in PostgreSQL -> verify removal from EIDOS
    queryCache.set('search:mechanical-keyboard', { cached: true, hits: 3 });
    const deleteResult = await pgConnector.processWalBatch({
      lsn: '0/21A0120',
      change: [
        {
          kind: 'delete',
          schema: 'public',
          table: 'products',
          oldkeys: {
            keynames: ['id'],
            keyvalues: ['pg-prod-501'],
          },
        },
      ],
    });

    const elapsedMs = Date.now() - startTime;
    expect(deleteResult.deleted).toBe(1);
    expect(store.get('pg-prod-501')).toBeUndefined();
    expect(queryCache.get('search:mechanical-keyboard')).toBeUndefined();
    expect(elapsedMs).toBeLessThan(5000);
  });
});
