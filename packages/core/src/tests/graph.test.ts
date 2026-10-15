import { describe, it, expect } from 'vitest';
import { buildSemanticGraph } from '../graph';
import { CatalogItem } from '../types';

describe('buildSemanticGraph', () => {
  const items: CatalogItem[] = [
    {
      id: '1',
      title: 'Item 1',
      description: 'First',
      category: 'Electronics',
      tags: [],
      embedding: [1, 0, 0],
    },
    {
      id: '2',
      title: 'Item 2',
      description: 'Second',
      category: 'Electronics',
      tags: [],
      embedding: [0.95, 0.05, 0],
    },
    {
      id: '3',
      title: 'Item 3',
      description: 'Third',
      category: 'Books',
      tags: [],
      embedding: [0, 1, 0],
    },
  ];

  it('constructs nodes and connects similar items with threshold', () => {
    const graph = buildSemanticGraph(items, 0.8, 2);

    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);

    // Items 1 and 2 are highly similar (~0.99)
    const edge12 = graph.edges.find((e) => e.source === '1' && e.target === '2');
    expect(edge12).toBeDefined();
    expect(edge12!.weight).toBeGreaterThan(0.9);

    // Items 1 and 3 are orthogonal (0.0) -> no edge
    const edge13 = graph.edges.find((e) => e.source === '1' && e.target === '3');
    expect(edge13).toBeUndefined();

    expect(graph.density).toBeGreaterThan(0);
  });

  it('handles empty catalog gracefully', () => {
    const graph = buildSemanticGraph([]);
    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
    expect(graph.density).toBe(0);
  });
});
