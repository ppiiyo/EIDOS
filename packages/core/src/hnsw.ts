import { HNSWConfig, HNSWSearchResult, QuantizedVector } from './types';
import { ScalarQuantizer } from './quantization';

export interface HNSWNode {
  id: string;
  vector: Float32Array;
  quantized?: QuantizedVector;
  level: number;
  // friends[l] contains neighbor node IDs at layer l
  friends: string[][];
}

interface DistCandidate {
  id: string;
  dist: number;
}

/**
 * Normalizes a vector in-place or returns L2-normalized copy.
 */
function normalizeL2(vec: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i] / norm;
  }
  return out;
}

/**
 * Computes cosine distance (1 - cosine_similarity).
 * Guaranteed to be >= 0.
 */
function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const valA = a[i];
    const valB = b[i];
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator <= 1e-12) return 1.0;
  const cos = dot / denominator;
  return Math.max(0.0, 1.0 - cos);
}

/**
 * Computes cosine distance from quantized representation.
 */
function quantizedCosineDistance(a: QuantizedVector, b: QuantizedVector): number {
  const cos = ScalarQuantizer.cosineSimilarity(a, b);
  return Math.max(0.0, 1.0 - cos);
}

/**
 * Hierarchical Navigable Small World (HNSW) vector index.
 * Provides logarithmic-time approximate nearest neighbor (ANN) retrieval for high-dimensional vectors.
 * Supports INT8 scalar quantization for 4x memory savings and accelerated integer dot-products.
 */
export class HNSWIndex {
  private readonly config: HNSWConfig;
  private readonly mL: number;
  private nodes = new Map<string, HNSWNode>();
  private entryPointId: string | null = null;
  private maxLevel = -1;

  /**
   * Initializes the HNSW index.
   *
   * @param config - HNSW hyperparameter configuration
   */
  constructor(config?: Partial<HNSWConfig>) {
    this.config = {
      M: config?.M ?? 16,
      M0: config?.M0 ?? 32,
      efConstruction: config?.efConstruction ?? 64,
      efSearch: config?.efSearch ?? 32,
      useQuantization: config?.useQuantization ?? false,
    };
    this.mL = 1.0 / Math.log(this.config.M);
  }

  /**
   * Calculates distance between query vector and node.
   */
  private getDistance(queryVec: Float32Array, queryQuant: QuantizedVector | undefined, targetNode: HNSWNode): number {
    if (this.config.useQuantization && queryQuant && targetNode.quantized) {
      return quantizedCosineDistance(queryQuant, targetNode.quantized);
    }
    return cosineDistance(queryVec, targetNode.vector);
  }

  /**
   * Samples a random level for a new node using exponential distribution.
   */
  private getRandomLevel(): number {
    const r = Math.random();
    const safeR = r === 0 ? 1e-7 : r;
    return Math.floor(-Math.log(safeR) * this.mL);
  }

  /**
   * Searches a specific layer for nearest neighbors using greedy candidate beam search.
   */
  private searchLayer(
    queryVec: Float32Array,
    queryQuant: QuantizedVector | undefined,
    entryPoints: string[],
    ef: number,
    level: number
  ): DistCandidate[] {
    const visited = new Set<string>();
    const candidates: DistCandidate[] = [];
    const results: DistCandidate[] = [];

    for (const epId of entryPoints) {
      const epNode = this.nodes.get(epId);
      if (!epNode) continue;
      const d = this.getDistance(queryVec, queryQuant, epNode);
      visited.add(epId);
      candidates.push({ id: epId, dist: d });
      results.push({ id: epId, dist: d });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    results.sort((a, b) => a.dist - b.dist);

    while (candidates.length > 0) {
      // Extract nearest candidate
      const current = candidates.shift()!;
      const furthestResultDist = results[results.length - 1]?.dist ?? Infinity;

      if (current.dist > furthestResultDist) {
        break;
      }

      const currNode = this.nodes.get(current.id);
      if (!currNode) continue;

      const friends = currNode.friends[level] || [];
      for (const neighborId of friends) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const d = this.getDistance(queryVec, queryQuant, neighborNode);
        const worstResultDist = results[results.length - 1]?.dist ?? Infinity;

        if (d < worstResultDist || results.length < ef) {
          // Insert into candidates (sorted ascending)
          let cIdx = candidates.findIndex((c) => c.dist > d);
          if (cIdx === -1) candidates.push({ id: neighborId, dist: d });
          else candidates.splice(cIdx, 0, { id: neighborId, dist: d });

          // Insert into results (sorted ascending)
          let rIdx = results.findIndex((r) => r.dist > d);
          if (rIdx === -1) results.push({ id: neighborId, dist: d });
          else results.splice(rIdx, 0, { id: neighborId, dist: d });

          if (results.length > ef) {
            results.pop();
          }
        }
      }
    }

    return results;
  }

  /**
   * Inserts an item into the HNSW graph.
   *
   * @param id - Unique identifier for the item
   * @param vector - Raw Float32Array embedding
   */
  public insert(id: string, vector: Float32Array): void {
    if (this.nodes.has(id)) {
      return;
    }

    const normVec = normalizeL2(vector);
    const quantized = this.config.useQuantization ? ScalarQuantizer.quantize(normVec, id) : undefined;
    const nodeLevel = this.getRandomLevel();

    const friends: string[][] = [];
    for (let l = 0; l <= nodeLevel; l++) {
      friends.push([]);
    }

    const newNode: HNSWNode = {
      id,
      vector: normVec,
      quantized,
      level: nodeLevel,
      friends,
    };

    this.nodes.set(id, newNode);

    if (this.entryPointId === null) {
      this.entryPointId = id;
      this.maxLevel = nodeLevel;
      return;
    }

    let currEp = this.entryPointId;
    let currEpDist = this.getDistance(normVec, quantized, this.nodes.get(currEp)!);

    // Phase 1: Greedy routing from top level down to nodeLevel + 1
    for (let l = this.maxLevel; l > nodeLevel; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const epNode = this.nodes.get(currEp);
        if (!epNode) break;
        const neighbors = epNode.friends[l] || [];

        for (const nId of neighbors) {
          const nNode = this.nodes.get(nId);
          if (!nNode) continue;
          const d = this.getDistance(normVec, quantized, nNode);
          if (d < currEpDist) {
            currEpDist = d;
            currEp = nId;
            changed = true;
          }
        }
      }
    }

    // Phase 2: Insert into levels min(maxLevel, nodeLevel) down to 0
    let enterCandidates = [currEp];
    const topInsertLevel = Math.min(this.maxLevel, nodeLevel);

    for (let l = topInsertLevel; l >= 0; l--) {
      const candidates = this.searchLayer(
        normVec,
        quantized,
        enterCandidates,
        this.config.efConstruction,
        l
      );

      const maxM = l === 0 ? this.config.M0 : this.config.M;
      const selectedNeighbors = candidates.slice(0, maxM);

      for (const neighbor of selectedNeighbors) {
        newNode.friends[l].push(neighbor.id);
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          if (!neighborNode.friends[l]) {
            neighborNode.friends[l] = [];
          }
          neighborNode.friends[l].push(id);

          // Prune neighbor connections if exceeding maxM
          if (neighborNode.friends[l].length > maxM) {
            this.pruneNeighbors(neighborNode, l, maxM);
          }
        }
      }

      enterCandidates = candidates.map((c) => c.id);
    }

    if (nodeLevel > this.maxLevel) {
      this.maxLevel = nodeLevel;
      this.entryPointId = id;
    }
  }

  /**
   * Prunes connections of a node at layer l to keep only the closest maxM neighbors.
   */
  private pruneNeighbors(node: HNSWNode, level: number, maxM: number): void {
    const neighbors = node.friends[level];
    if (!neighbors || neighbors.length <= maxM) return;

    const scored: DistCandidate[] = [];
    for (const nId of neighbors) {
      const target = this.nodes.get(nId);
      if (target) {
        const d = this.getDistance(node.vector, node.quantized, target);
        scored.push({ id: nId, dist: d });
      }
    }

    scored.sort((a, b) => a.dist - b.dist);
    node.friends[level] = scored.slice(0, maxM).map((s) => s.id);
  }

  /**
   * Searches the HNSW index for the K approximate nearest neighbors to a query vector.
   *
   * @param query - Input query vector (384-dim or arbitrary dimension)
   * @param k - Number of top nearest neighbors to retrieve (default: 10)
   * @param efSearch - Optional search candidate pool size (defaults to config.efSearch)
   * @returns Array of HNSWSearchResult sorted by distance ascending (similarity descending)
   */
  public search(query: Float32Array, k = 10, efSearch?: number): HNSWSearchResult[] {
    if (this.entryPointId === null || this.nodes.size === 0) {
      return [];
    }

    const normQuery = normalizeL2(query);
    const queryQuant = this.config.useQuantization
      ? ScalarQuantizer.quantize(normQuery)
      : undefined;

    let currEp = this.entryPointId;
    let currEpDist = this.getDistance(normQuery, queryQuant, this.nodes.get(currEp)!);

    // Greedy routing from top level down to layer 1
    for (let l = this.maxLevel; l >= 1; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const epNode = this.nodes.get(currEp);
        if (!epNode) break;
        const neighbors = epNode.friends[l] || [];

        for (const nId of neighbors) {
          const nNode = this.nodes.get(nId);
          if (!nNode) continue;
          const d = this.getDistance(normQuery, queryQuant, nNode);
          if (d < currEpDist) {
            currEpDist = d;
            currEp = nId;
            changed = true;
          }
        }
      }
    }

    // Search layer 0 with efSearch
    const ef = Math.max(k, efSearch ?? this.config.efSearch);
    const candidates = this.searchLayer(normQuery, queryQuant, [currEp], ef, 0);

    const topK = candidates.slice(0, k);

    return topK.map((c) => {
      // similarity score = 1 - distance
      const score = Math.max(-1.0, Math.min(1.0, 1.0 - c.dist));
      return {
        id: c.id,
        score,
        distance: c.dist,
      };
    });
  }

  /**
   * Returns the total number of indexed vectors.
   */
  public size(): number {
    return this.nodes.size;
  }

  /**
   * Returns all nodes currently stored in the index.
   */
  public getAllNodes(): HNSWNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns a copy of the index hyperparameters configuration.
   */
  public getConfig(): HNSWConfig {
    return { ...this.config };
  }

  /**
   * Returns the current entry point node ID.
   */
  public getEntryPointId(): string | null {
    return this.entryPointId;
  }

  /**
   * Returns the maximum layer level in the graph.
   */
  public getMaxLevel(): number {
    return this.maxLevel;
  }

  /**
   * Deletes a node from the index and rewires connections.
   */
  public delete(id: string): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    this.nodes.delete(id);

    // Clean up references from neighbors at all levels
    for (const node of this.nodes.values()) {
      for (let l = 0; l <= node.level; l++) {
        if (node.friends[l]) {
          const idx = node.friends[l].indexOf(id);
          if (idx !== -1) {
            node.friends[l].splice(idx, 1);
          }
        }
      }
    }

    // If deleted node was the entry point, elect new entry point
    if (this.entryPointId === id) {
      if (this.nodes.size === 0) {
        this.entryPointId = null;
        this.maxLevel = -1;
      } else {
        let bestEp: string | null = null;
        let highestLvl = -1;
        for (const [nId, n] of this.nodes.entries()) {
          if (n.level > highestLvl) {
            highestLvl = n.level;
            bestEp = nId;
          }
        }
        this.entryPointId = bestEp;
        this.maxLevel = highestLvl;
      }
    }

    return true;
  }

  /**
   * Restores internal state of the index from serialized node records.
   */
  public restoreInternalState(
    nodes: Array<{ id: string; level: number; vector: Float32Array; friends: string[][]; quantized?: QuantizedVector }>,
    entryPointId: string | null,
    maxLevel: number
  ): void {
    this.clear();
    for (const n of nodes) {
      this.nodes.set(n.id, {
        id: n.id,
        level: n.level,
        vector: n.vector,
        friends: n.friends,
        quantized: n.quantized,
      });
    }
    this.entryPointId = entryPointId;
    this.maxLevel = maxLevel;
  }

  /**
   * Resets and clears the entire index.
   */
  public clear(): void {
    this.nodes.clear();
    this.entryPointId = null;
    this.maxLevel = -1;
  }
}
