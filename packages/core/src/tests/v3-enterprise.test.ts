import { describe, it, expect } from 'vitest';
import {
  DistributedHNSWCluster,
  HashRingRouter,
  ConversationalCatalogAgent,
  MultimodalEmbedder,
  WebGPUAccelerator,
  EnterpriseRBAC,
  AuditLogger,
  CatalogSyncConnector,
} from '../index';

describe('Distributed HNSW & Consistent Hash Ring', () => {
  it('HashRingRouter distributes keys deterministically across shards', () => {
    const router = new HashRingRouter(['shard-0', 'shard-1', 'shard-2'], 64);
    const shardA = router.getShard('product-101');
    const shardB = router.getShard('product-101');
    expect(shardA).toBe(shardB);
    expect(['shard-0', 'shard-1', 'shard-2']).toContain(shardA);
  });

  it('DistributedHNSWCluster routes insertions and performs scatter-gather search', async () => {
    const cluster = new DistributedHNSWCluster({ shardsCount: 3, virtualNodesPerShard: 32, replicationFactor: 1 });

    // Insert 15 items across shards
    for (let i = 0; i < 15; i++) {
      const vec = new Float32Array(384);
      vec[i % 10] = 1.0;
      cluster.insert(`item-${i}`, vec);
    }

    const topology = cluster.getClusterTopology();
    expect(topology.totalItems).toBe(15);
    expect(topology.shards.length).toBe(3);

    const queryVec = new Float32Array(384);
    queryVec[0] = 1.0;
    const results = await cluster.scatterGatherSearch(queryVec, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('shardId');
    expect(results[0]).toHaveProperty('id');
  });
});

describe('Conversational Catalog Agent', () => {
  it('parses natural language budget, positive accents, and negative exclusions', () => {
    const agent = new ConversationalCatalogAgent();
    const intent = agent.parseIntent('Найди тихий и белый ноутбук до 85000, но не слишком громоздкий');

    expect(intent.maxPrice).toBe(85000);
    expect(intent.positiveModifiers).toContain('тихий');
    expect(intent.positiveModifiers).toContain('белый');
    expect(intent.negativeModifiers).toContain('громоздкий');
  });

  it('executes conversational turn and applies steering vector', async () => {
    const agent = new ConversationalCatalogAgent();
    const mockCatalog = [
      { id: '1', title: 'Ультрабук Air White', description: 'Тонкий тихий белый ноутбук', category: 'Laptops', tags: ['белый', 'тихий'], price: 79000 },
      { id: '2', title: 'Игровой монстр Heavy', description: 'Громоздкий черный корпус', category: 'Laptops', tags: ['громоздкий'], price: 95000 },
    ];

    const resolveEmb = (text: string) => {
      const vec = new Float32Array(384);
      if (text.includes('белый') || text.includes('тихий')) vec[0] = 1.0;
      if (text.includes('громоздкий')) vec[1] = 1.0;
      return vec;
    };

    const reply = await agent.executeTurn('Нужен белый тихий лэптоп до 80000', mockCatalog as any, resolveEmb);
    expect(reply.role).toBe('assistant');
    expect(reply.structuredPayload?.recommendedItemIds).toContain('1');
    expect(reply.content).toContain('Ультрабук Air White');
  });
});

describe('Multimodal Vision-Language Embedder', () => {
  it('fuses joint text and vision embeddings with normalized length', () => {
    const textEmb = new Float32Array(384).fill(0.2);
    const imgEmb = new Float32Array(384).fill(0.3);

    const joint = MultimodalEmbedder.fuseJointEmbedding(textEmb, imgEmb, 0.6);
    expect(joint.length).toBe(384);

    let norm = 0;
    for (let i = 0; i < 384; i++) norm += joint[i] * joint[i];
    expect(Math.sqrt(norm)).toBeCloseTo(1.0, 4);
  });
});

describe('WebGPU & SIMD Acceleration', () => {
  it('batchDotProduct computes accurate inner products', () => {
    const query = new Float32Array([1.0, 0.5, 0.2, 0.0]);
    const candidates = [
      new Float32Array([1.0, 0.5, 0.2, 0.0]),
      new Float32Array([0.0, 0.0, 0.0, 0.0]),
    ];

    const scores = WebGPUAccelerator.batchDotProduct(query, candidates);
    expect(scores.length).toBe(2);
    expect(scores[0]).toBeCloseTo(1.29, 2);
    expect(scores[1]).toBeCloseTo(0.0, 4);
  });
});

describe('Enterprise Open-Core Modules', () => {
  it('EnterpriseRBAC grants community and enterprise scopes accordingly', () => {
    const rbac = new EnterpriseRBAC();
    const commCheck = rbac.validateAccess('community-default', 'read:recommend');
    expect(commCheck.allowed).toBe(true);

    const deniedCheck = rbac.validateAccess('community-default', 'admin:shards');
    expect(deniedCheck.allowed).toBe(false);

    const entCheck = rbac.validateAccess('enterprise-client-01', 'admin:shards');
    expect(entCheck.allowed).toBe(true);
  });

  it('AuditLogger records immutable audit trails', () => {
    const logger = new AuditLogger();
    logger.logEvent({
      tenantId: 'enterprise-client-01',
      action: 'cluster_rebalance',
      actor: 'admin@corp.io',
      status: 'success',
    });

    const logs = logger.getLogs('enterprise-client-01');
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('cluster_rebalance');
  });

  it('CatalogSyncConnector parses YML XML format', () => {
    const sampleYML = `
      <yml_catalog>
        <shop>
          <offers>
            <offer id="101">
              <name>Механическая клавиатура Keychron</name>
              <category>Периферия</category>
              <price>12500</price>
            </offer>
          </offers>
        </shop>
      </yml_catalog>
    `;

    const parsed = CatalogSyncConnector.parseYMLFeed(sampleYML);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('101');
    expect(parsed[0].title).toBe('Механическая клавиатура Keychron');
    expect(parsed[0].price).toBe(12500);
  });
});
