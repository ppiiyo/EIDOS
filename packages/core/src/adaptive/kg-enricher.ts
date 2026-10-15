import { KGEnricherConfig } from './types';

/**
 * Normalizes a Float32Array vector in-place.
 */
function normalizeL2(vector: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) return vector;
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] / norm;
  }
  return result;
}

/**
 * Knowledge Graph Enricher uses network topology and path-based neighbor embeddings
 * (inspired by PTransE and TransE graph representation learning) to smooth and enrich
 * dense item embeddings with relational semantic information.
 */
export class KGEnricher {
  private readonly config: KGEnricherConfig;
  private readonly graph: Map<string, { connections: Map<string, number> }>;

  /**
   * Initializes the KGEnricher with a knowledge graph map and config.
   *
   * @param knowledgeGraph - Map of item IDs to their connections and edge weights
   * @param config - Options for path depth and neighbor blending
   */
  constructor(
    knowledgeGraph: Map<string, { connections: Map<string, number> }>,
    config?: Partial<KGEnricherConfig>
  ) {
    this.graph = knowledgeGraph;
    this.config = {
      maxPathLength: config?.maxPathLength ?? 2,
      pathWeight: config?.pathWeight ?? 0.3,
      minPathScore: config?.minPathScore ?? 0.4,
    };
  }

  /**
   * Enriches an item's embedding by blending it with the weighted average
   * of its connected neighbors in the knowledge graph.
   *
   * @param itemId - Target item ID
   * @param originalEmbedding - Native item vector
   * @param getEmbedding - Provider function returning embedding for neighbor IDs
   * @returns Enriched, normalized vector
   */
  public enrich(
    itemId: string,
    originalEmbedding: Float32Array,
    getEmbedding: (id: string) => Float32Array
  ): Float32Array {
    const node = this.graph.get(String(itemId));
    if (!node || node.connections.size === 0) {
      return originalEmbedding;
    }

    const dim = originalEmbedding.length;
    const neighborAgg = new Float32Array(dim);
    let totalWeight = 0;

    for (const [neighborId, weight] of node.connections.entries()) {
      if (weight < this.config.minPathScore) continue;
      const nEmb = getEmbedding(neighborId);
      if (!nEmb || nEmb.length !== dim) continue;

      for (let d = 0; d < dim; d++) {
        neighborAgg[d] += nEmb[d] * weight;
      }
      totalWeight += weight;
    }

    if (totalWeight <= 1e-12) {
      return originalEmbedding;
    }

    // Average neighbor vector
    for (let d = 0; d < dim; d++) {
      neighborAgg[d] /= totalWeight;
    }

    const w = this.config.pathWeight;
    const blended = new Float32Array(dim);
    for (let d = 0; d < dim; d++) {
      blended[d] = (1 - w) * originalEmbedding[d] + w * neighborAgg[d];
    }

    return normalizeL2(blended);
  }

  /**
   * Computes normalized degree centrality of an item in the knowledge graph.
   * Items with many high-weight diverse edges serve as connective hubs/bridges.
   *
   * @param itemId - Target item ID
   * @returns Centrality score normalized to [0, 1]
   */
  public getCentrality(itemId: string): number {
    const node = this.graph.get(String(itemId));
    if (!node || node.connections.size === 0) {
      return 0.0;
    }

    let degreeWeight = 0;
    for (const weight of node.connections.values()) {
      degreeWeight += weight;
    }

    // Normalized with a soft saturation curve (e.g., 10 saturated connections ~ 1.0)
    return Math.max(0, Math.min(1, 1 - Math.exp(-degreeWeight / 5.0)));
  }
}
