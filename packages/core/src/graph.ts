import { cosineSimilarity } from './cosine';
import { CatalogItem, GraphEdge, GraphNode, SemanticGraph } from './types';

/**
 * Builds an interconnected semantic graph from an item catalog with embedded vectors.
 *
 * @param catalog - List of catalog items with precomputed or assigned embeddings
 * @param threshold - Minimum cosine similarity required to instantiate an edge (default: 0.55)
 * @param maxEdgesPerNode - Maximum outbound edges to preserve graph sparsity
 * @returns Fully constructed SemanticGraph
 */
export function buildSemanticGraph(
  catalog: CatalogItem[],
  threshold = 0.55,
  maxEdgesPerNode = 6
): SemanticGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const validItems = catalog.filter(
    (item) => Array.isArray(item.embedding) && item.embedding.length > 0
  );

  const degreeMap = new Map<string, number>();

  // Initialize node degree counts
  for (const item of validItems) {
    degreeMap.set(item.id, 0);
  }

  // Pre-cluster by primary category
  const categories = Array.from(new Set(validItems.map((i) => i.category)));
  const categoryClusterIndex = new Map(categories.map((cat, idx) => [cat, idx]));

  for (let i = 0; i < validItems.length; i++) {
    const itemA = validItems[i];
    const itemAEmbedding = itemA.embedding as number[];
    const candidateEdges: { target: string; weight: number }[] = [];

    for (let j = 0; j < validItems.length; j++) {
      if (i === j) continue;
      const itemB = validItems[j];
      const itemBEmbedding = itemB.embedding as number[];

      const similarity = cosineSimilarity(itemAEmbedding, itemBEmbedding);
      if (similarity >= threshold) {
        candidateEdges.push({ target: itemB.id, weight: similarity });
      }
    }

    // Sort descending by weight and pick top edges
    candidateEdges.sort((a, b) => b.weight - a.weight);
    const topEdges = candidateEdges.slice(0, maxEdgesPerNode);

    for (const edge of topEdges) {
      edges.push({
        source: itemA.id,
        target: edge.target,
        weight: Math.round(edge.weight * 1000) / 1000,
      });
      degreeMap.set(itemA.id, (degreeMap.get(itemA.id) ?? 0) + 1);
    }
  }

  for (const item of validItems) {
    nodes.push({
      id: item.id,
      title: item.title,
      category: item.category,
      cluster: categoryClusterIndex.get(item.category) ?? 0,
      degree: degreeMap.get(item.id) ?? 0,
    });
  }

  const possibleEdges = (validItems.length * (validItems.length - 1)) / 2;
  const density =
    possibleEdges > 0 ? Math.round((edges.length / possibleEdges) * 10000) / 10000 : 0;

  return {
    nodes,
    edges,
    density,
  };
}
