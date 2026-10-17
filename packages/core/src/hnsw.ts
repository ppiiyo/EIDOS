import { HNSWConfig, HNSWSearchResult, QuantizedVector } from './types';
import { ScalarQuantizer } from './quantization';

export interface HNSWNode {
  id: string;
  intId: number;
  vector: Float32Array;
  quantized?: QuantizedVector;
  level: number;
  // Phase 2: Int32 friends per level stored in flat Int32Array
  friendsInt32: Int32Array[];
  // Backwards-compatible string array per layer
  friends: string[][];
}

export interface DistCandidate {
  id: string;
  intId: number;
  dist: number;
}

/**
 * High-performance Binary Heap for O(log N) priority queue operations.
 */
export class BinaryHeap<T> {
  private data: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  public push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  public pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  public peek(): T | undefined {
    return this.data[0];
  }

  public size(): number {
    return this.data.length;
  }

  public values(): T[] {
    return this.data;
  }

  public toSortedArray(): T[] {
    const copy = [...this.data];
    return copy.sort(this.compare);
  }

  private bubbleUp(index: number): void {
    const item = this.data[index];
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      const parent = this.data[parentIdx];
      if (this.compare(item, parent) >= 0) break;
      this.data[index] = parent;
      index = parentIdx;
    }
    this.data[index] = item;
  }

  private sinkDown(index: number): void {
    const length = this.data.length;
    const item = this.data[index];
    while (true) {
      const leftIdx = (index << 1) + 1;
      const rightIdx = leftIdx + 1;
      let swapIdx = -1;

      if (leftIdx < length) {
        if (this.compare(this.data[leftIdx], item) < 0) {
          swapIdx = leftIdx;
        }
      }
      if (rightIdx < length) {
        const compareWith = swapIdx === -1 ? item : this.data[swapIdx];
        if (this.compare(this.data[rightIdx], compareWith) < 0) {
          swapIdx = rightIdx;
        }
      }

      if (swapIdx === -1) break;
      this.data[index] = this.data[swapIdx];
      index = swapIdx;
    }
    this.data[index] = item;
  }
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
 * Phase 2 optimized: Int32 flat array neighbor links and Binary Heap searchLayer.
 */
export class HNSWIndex {
  private readonly config: HNSWConfig;
  private readonly mL: number;
  private nodes = new Map<string, HNSWNode>();
  private idToInternal = new Map<string, number>();
  private internalToId: string[] = [];
  private internalToNode: (HNSWNode | undefined)[] = [];
  private nextInternalId = 0;
  private entryPointId: string | null = null;
  private maxLevel = -1;

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
   * Translates external string ID to compact Int32 identifier.
   */
  public getInternalId(id: string): number {
    let internalId = this.idToInternal.get(id);
    if (internalId === undefined) {
      internalId = this.nextInternalId++;
      this.idToInternal.set(id, internalId);
      this.internalToId[internalId] = id;
    }
    return internalId;
  }

  /**
   * Translates internal Int32 identifier back to external string ID.
   */
  public getExternalId(internalId: number): string | undefined {
    return this.internalToId[internalId];
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
   * Phase 2: High-performance Layer Search using Binary Min/Max Heaps and Int32 Flat Friends.
   */
  private searchLayer(
    queryVec: Float32Array,
    queryQuant: QuantizedVector | undefined,
    entryPoints: string[],
    ef: number,
    level: number
  ): DistCandidate[] {
    const visited = new Set<number>();

    // Min-heap for unvisited candidates: lowest distance on top (to explore closest first)
    const candidateHeap = new BinaryHeap<DistCandidate>((a, b) => a.dist - b.dist);

    // Max-heap for current top results: furthest distance on top (to easily inspect / drop worst)
    const resultHeap = new BinaryHeap<DistCandidate>((a, b) => b.dist - a.dist);

    for (const epId of entryPoints) {
      const epNode = this.nodes.get(epId);
      if (!epNode) continue;
      const d = this.getDistance(queryVec, queryQuant, epNode);
      visited.add(epNode.intId);
      const cand: DistCandidate = { id: epId, intId: epNode.intId, dist: d };
      candidateHeap.push(cand);
      resultHeap.push(cand);
    }

    while (candidateHeap.size() > 0) {
      const current = candidateHeap.pop()!;
      const worstResult = resultHeap.peek();

      // Early termination: if closest candidate is worse than furthest in full results pool
      if (worstResult && resultHeap.size() >= ef && current.dist > worstResult.dist) {
        break;
      }

      const currNode = this.internalToNode[current.intId];
      if (!currNode) continue;

      // Phase 2: Traverse flat Int32Array friends buffer directly
      const friendsInt32 = currNode.friendsInt32[level];
      if (!friendsInt32) continue;

      const friendsLen = friendsInt32.length;
      for (let i = 0; i < friendsLen; i++) {
        const neighborIntId = friendsInt32[i];
        if (visited.has(neighborIntId)) continue;
        visited.add(neighborIntId);

        const neighborNode = this.internalToNode[neighborIntId];
        if (!neighborNode) continue;

        const d = this.getDistance(queryVec, queryQuant, neighborNode);
        const currentWorst = resultHeap.peek();

        if (resultHeap.size() < ef || (currentWorst && d < currentWorst.dist)) {
          const cand: DistCandidate = {
            id: neighborNode.id,
            intId: neighborIntId,
            dist: d,
          };

          candidateHeap.push(cand);
          resultHeap.push(cand);

          if (resultHeap.size() > ef) {
            resultHeap.pop(); // Drop furthest result in O(log ef)
          }
        }
      }
    }

    // Return results sorted by distance ascending (nearest first)
    return resultHeap.values().sort((a, b) => a.dist - b.dist);
  }

  /**
   * Synchronizes flat Int32Array and string array for a node's level.
   */
  private setNodeFriends(node: HNSWNode, level: number, friendIntIds: number[]): void {
    node.friendsInt32[level] = new Int32Array(friendIntIds);
    node.friends[level] = friendIntIds.map((intId) => this.internalToId[intId] || '');
  }

  /**
   * Adds a friend link to a node at a given level.
   */
  private addFriend(node: HNSWNode, level: number, friendIntId: number): void {
    const existing = node.friendsInt32[level];
    if (!existing || existing.length === 0) {
      node.friendsInt32[level] = new Int32Array([friendIntId]);
      node.friends[level] = [this.internalToId[friendIntId] || ''];
      return;
    }

    // Avoid duplicates
    for (let i = 0; i < existing.length; i++) {
      if (existing[i] === friendIntId) return;
    }

    const next = new Int32Array(existing.length + 1);
    next.set(existing);
    next[existing.length] = friendIntId;
    node.friendsInt32[level] = next;
    node.friends[level].push(this.internalToId[friendIntId] || '');
  }

  /**
   * Inserts an item into the HNSW graph.
   */
  public insert(id: string, vector: Float32Array): void {
    if (this.nodes.has(id)) {
      return;
    }

    const normVec = normalizeL2(vector);
    const quantized = this.config.useQuantization ? ScalarQuantizer.quantize(normVec, id) : undefined;
    const nodeLevel = this.getRandomLevel();
    const intId = this.getInternalId(id);

    const friendsInt32: Int32Array[] = [];
    const friends: string[][] = [];
    for (let l = 0; l <= nodeLevel; l++) {
      friendsInt32.push(new Int32Array(0));
      friends.push([]);
    }

    const newNode: HNSWNode = {
      id,
      intId,
      vector: normVec,
      quantized,
      level: nodeLevel,
      friendsInt32,
      friends,
    };

    this.nodes.set(id, newNode);
    this.internalToNode[intId] = newNode;

    if (this.entryPointId === null) {
      this.entryPointId = id;
      this.maxLevel = nodeLevel;
      return;
    }

    let currEp = this.entryPointId;
    let currEpNode = this.nodes.get(currEp)!;
    let currEpDist = this.getDistance(normVec, quantized, currEpNode);

    // Phase 1: Greedy routing from top level down to nodeLevel + 1
    for (let l = this.maxLevel; l > nodeLevel; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const epNode = this.nodes.get(currEp);
        if (!epNode) break;
        const neighbors = epNode.friendsInt32[l];
        if (!neighbors) break;

        for (let i = 0; i < neighbors.length; i++) {
          const nNode = this.internalToNode[neighbors[i]];
          if (!nNode) continue;
          const d = this.getDistance(normVec, quantized, nNode);
          if (d < currEpDist) {
            currEpDist = d;
            currEp = nNode.id;
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

      const newFriendIntIds: number[] = [];
      for (const neighbor of selectedNeighbors) {
        newFriendIntIds.push(neighbor.intId);
        const neighborNode = this.internalToNode[neighbor.intId];
        if (neighborNode) {
          this.addFriend(neighborNode, l, intId);

          // Prune neighbor connections if exceeding maxM
          if (neighborNode.friendsInt32[l].length > maxM) {
            this.pruneNeighbors(neighborNode, l, maxM);
          }
        }
      }

      this.setNodeFriends(newNode, l, newFriendIntIds);
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
    const neighbors = node.friendsInt32[level];
    if (!neighbors || neighbors.length <= maxM) return;

    const scored: { intId: number; dist: number }[] = [];
    for (let i = 0; i < neighbors.length; i++) {
      const target = this.internalToNode[neighbors[i]];
      if (target) {
        const d = this.getDistance(node.vector, node.quantized, target);
        scored.push({ intId: neighbors[i], dist: d });
      }
    }

    scored.sort((a, b) => a.dist - b.dist);
    const pruned = scored.slice(0, maxM).map((s) => s.intId);
    this.setNodeFriends(node, level, pruned);
  }

  /**
   * Searches the HNSW index for the K approximate nearest neighbors.
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
    let currEpNode = this.nodes.get(currEp)!;
    let currEpDist = this.getDistance(normQuery, queryQuant, currEpNode);

    // Greedy routing from top level down to layer 1
    for (let l = this.maxLevel; l >= 1; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const epNode = this.nodes.get(currEp);
        if (!epNode) break;
        const neighbors = epNode.friendsInt32[l];
        if (!neighbors) break;

        for (let i = 0; i < neighbors.length; i++) {
          const nNode = this.internalToNode[neighbors[i]];
          if (!nNode) continue;
          const d = this.getDistance(normQuery, queryQuant, nNode);
          if (d < currEpDist) {
            currEpDist = d;
            currEp = nNode.id;
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
      const score = Math.max(-1.0, Math.min(1.0, 1.0 - c.dist));
      return {
        id: c.id,
        score,
        distance: c.dist,
      };
    });
  }

  public size(): number {
    return this.nodes.size;
  }

  public getAllNodes(): HNSWNode[] {
    return Array.from(this.nodes.values());
  }

  public getConfig(): HNSWConfig {
    return { ...this.config };
  }

  public getEntryPointId(): string | null {
    return this.entryPointId;
  }

  public getMaxLevel(): number {
    return this.maxLevel;
  }

  public delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    const intId = node.intId;
    this.nodes.delete(id);
    this.internalToNode[intId] = undefined;
    delete this.internalToId[intId];
    this.idToInternal.delete(id);

    // Clean up references from neighbors at all levels
    for (const other of this.nodes.values()) {
      for (let l = 0; l <= other.level; l++) {
        const friends = other.friendsInt32[l];
        if (friends) {
          const filtered: number[] = [];
          for (let i = 0; i < friends.length; i++) {
            if (friends[i] !== intId) filtered.push(friends[i]);
          }
          if (filtered.length !== friends.length) {
            this.setNodeFriends(other, l, filtered);
          }
        }
      }
    }

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

  public restoreInternalState(
    nodes: Array<{ id: string; level: number; vector: Float32Array; friends: string[][]; quantized?: QuantizedVector }>,
    entryPointId: string | null,
    maxLevel: number
  ): void {
    this.clear();
    for (const n of nodes) {
      const intId = this.getInternalId(n.id);
      const friendsInt32: Int32Array[] = [];
      const nodeObj: HNSWNode = {
        id: n.id,
        intId,
        level: n.level,
        vector: n.vector,
        friends: n.friends,
        friendsInt32,
        quantized: n.quantized,
      };
      this.nodes.set(n.id, nodeObj);
      this.internalToNode[intId] = nodeObj;
    }

    // Now resolve friend internal IDs
    for (const node of this.nodes.values()) {
      for (let l = 0; l <= node.level; l++) {
        const stringFriends = node.friends[l] || [];
        const intFriends = stringFriends
          .map((sf) => this.idToInternal.get(sf))
          .filter((id): id is number => id !== undefined);
        node.friendsInt32[l] = new Int32Array(intFriends);
      }
    }

    this.entryPointId = entryPointId;
    this.maxLevel = maxLevel;
  }

  public getMemoryStats(): {
    nodeCount: number;
    estimatedBytes: number;
    internalIdCount: number;
  } {
    const nodeCount = this.nodes.size;
    const dimension = 384;
    const avgFriendsPerNode = this.config.M;
    const bytesPerNode = 40 + (dimension * 4) + (avgFriendsPerNode * 4); // Phase 2: Int32 is 4 bytes vs string overhead
    const estimatedBytes = nodeCount * bytesPerNode;

    return {
      nodeCount,
      estimatedBytes,
      internalIdCount: this.idToInternal.size,
    };
  }

  public clear(): void {
    this.nodes.clear();
    this.idToInternal.clear();
    this.internalToId = [];
    this.internalToNode = [];
    this.nextInternalId = 0;
    this.entryPointId = null;
    this.maxLevel = -1;
  }
}
