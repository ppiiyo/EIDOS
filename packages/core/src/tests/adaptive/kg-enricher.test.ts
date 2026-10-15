import { describe, it, expect } from 'vitest';
import { KGEnricher } from '../../adaptive/kg-enricher';

describe('KGEnricher', () => {
  it('enriches item vector using connected graph neighbors', () => {
    const graph = new Map<string, { connections: Map<string, number> }>();
    const node1Connections = new Map<string, number>();
    node1Connections.set('item-2', 0.8);
    graph.set('item-1', { connections: node1Connections });

    const enricher = new KGEnricher(graph, { pathWeight: 0.5, minPathScore: 0.4 });

    const item1Vector = new Float32Array([1.0, 0.0]);
    const item2Vector = new Float32Array([0.0, 1.0]);

    const enriched = enricher.enrich('item-1', item1Vector, (id) =>
      id === 'item-2' ? item2Vector : new Float32Array([0, 0])
    );

    // Blended vector has components from both item1 and item2
    expect(enriched[0]).toBeGreaterThan(0.4);
    expect(enriched[1]).toBeGreaterThan(0.4);
    const norm = Math.hypot(enriched[0], enriched[1]);
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('isolated items with no graph connections return untouched original vector', () => {
    const graph = new Map<string, { connections: Map<string, number> }>();
    const enricher = new KGEnricher(graph);

    const original = new Float32Array([0.6, 0.8]);
    const enriched = enricher.enrich('isolated-item', original, () => new Float32Array(2));

    expect(enriched).toEqual(original);
    expect(enricher.getCentrality('isolated-item')).toBe(0.0);
  });

  it('calculates centrality correctly as connectivity scales', () => {
    const graph = new Map<string, { connections: Map<string, number> }>();
    const hubConnections = new Map<string, number>();
    hubConnections.set('b', 1.0);
    hubConnections.set('c', 1.0);
    hubConnections.set('d', 1.0);
    graph.set('hub', { connections: hubConnections });

    const enricher = new KGEnricher(graph);
    const centrality = enricher.getCentrality('hub');
    expect(centrality).toBeGreaterThan(0.4);
    expect(centrality).toBeLessThanOrEqual(1.0);
  });
});
