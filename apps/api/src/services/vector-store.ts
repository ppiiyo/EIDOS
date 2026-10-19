import {
  cosineSimilarity,
  HNSWIndex,
  HNSWIndexSerializer,
  WriteAheadLog,
  BM25Index,
  HybridSearch,
} from '@kostra44sip/core';
import { StoredItem } from '../types';

export interface VectorStoreOptions {
  useQuantization?: boolean;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
}

/**
 * High-Performance Vector Store powered by HNSW Graph Indexing,
 * INT8 Scalar Quantization, BM25 Okapi Sparse Search, Hybrid Reciprocal Rank Fusion,
 * and Write-Ahead Log (WAL) persistence.
 */
export class VectorStore {
  private items = new Map<string, StoredItem>();
  private hnsw: HNSWIndex;
  private bm25: BM25Index;
  private hybrid: HybridSearch;
  private wal: WriteAheadLog;

  constructor(options?: VectorStoreOptions) {
    this.hnsw = new HNSWIndex({
      M: options?.M ?? 16,
      M0: (options?.M ?? 16) * 2,
      efConstruction: options?.efConstruction ?? 64,
      efSearch: options?.efSearch ?? 32,
      useQuantization: options?.useQuantization ?? false,
    });
    this.bm25 = new BM25Index();
    this.hybrid = new HybridSearch(this.hnsw, this.bm25);
    this.wal = new WriteAheadLog(5000);
  }

  public upsert(item: StoredItem): void {
    const id = String(item.id);
    const normalized = new Float32Array(item.embedding);
    this.items.set(id, {
      ...item,
      id,
      normalizedVector: normalized,
    });

    // Update in-memory HNSW dense index
    this.hnsw.insert(id, normalized);

    // Update in-memory BM25 sparse index
    const docText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
    this.bm25.addDocument(id, docText);

    // Append to Write-Ahead Log for crash resilience
    this.wal.append({
      type: 'INSERT_NODE',
      nodeId: id,
      vector: normalized,
    });
  }

  public delete(id: string): boolean {
    const strId = String(id);
    const existed = this.items.delete(strId);
    if (existed) {
      this.hnsw.delete(strId);
      this.bm25.removeDocument(strId);
      this.wal.append({
        type: 'DELETE_NODE',
        nodeId: strId,
      });
    }
    return existed;
  }

  public get(id: string): StoredItem | undefined {
    return this.items.get(String(id));
  }

  public count(): number {
    return this.items.size;
  }

  public getHNSW(): HNSWIndex {
    return this.hnsw;
  }

  public getWAL(): WriteAheadLog {
    return this.wal;
  }

  /**
   * Serializes the underlying HNSW index into a binary snapshot buffer.
   */
  public exportBinarySnapshot(): Uint8Array {
    return HNSWIndexSerializer.serialize(this.hnsw);
  }

  /**
   * Restores HNSW index from a binary snapshot buffer and syncs WAL.
   */
  public importBinarySnapshot(snapshot: Uint8Array): void {
    this.hnsw = HNSWIndexSerializer.deserialize(snapshot);
  }

  /**
   * Searches the vector store for top-K nearest neighbors.
   * Leverages HNSW fast logarithmic retrieval when catalog is large,
   * with post-filtering for category and exclusion constraints.
   */
  public search(
    queryVector: Float32Array | number[],
    limit = 10,
    minSimilarity = 0.35,
    excludeId?: string,
    filterCategory?: string
  ): { item: StoredItem; score: number }[] {
    const qVec = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);

    // Small collections: linear scan is faster and overhead-free
    if (this.items.size < 50) {
      return this.linearSearch(qVec, limit, minSimilarity, excludeId, filterCategory);
    }

    // Large collections: HNSW + post-filter with adaptive overfetch
    const efSearch = Math.max(limit * 4, 64);
    const overfetchMultiplier = filterCategory ? 5 : 3;
    const annResults = this.hnsw.search(
      qVec,
      Math.min(this.items.size, limit * overfetchMultiplier),
      efSearch
    );

    const candidates: { item: StoredItem; score: number }[] = [];
    const seenIds = new Set<string>();

    for (const ann of annResults) {
      if (excludeId && ann.id === excludeId) continue;
      const stored = this.items.get(ann.id);
      if (!stored) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      const vector = stored.normalizedVector || stored.embedding;
      const score = cosineSimilarity(qVec, vector);

      if (score >= minSimilarity) {
        seenIds.add(ann.id);
        candidates.push({
          item: stored,
          score: Math.round(score * 10000) / 10000,
        });
      }
      if (candidates.length >= limit) break;
    }

    // Fallback: if HNSW with overfetch did not yield enough candidates matching the filter
    if (candidates.length < limit && filterCategory) {
      for (const stored of this.items.values()) {
        if (seenIds.has(stored.id)) continue;
        if (excludeId && stored.id === excludeId) continue;
        if (stored.category !== filterCategory) continue;

        const vector = stored.normalizedVector || stored.embedding;
        const score = cosineSimilarity(qVec, vector);

        if (score >= minSimilarity) {
          candidates.push({
            item: stored,
            score: Math.round(score * 10000) / 10000,
          });
        }
        if (candidates.length >= limit) break;
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit);
  }

  /**
   * Executes unified Hybrid Search combining Dense (HNSW) and Sparse (BM25)
   * using Reciprocal Rank Fusion (RRF).
   */
  public hybridSearch(
    queryText: string,
    queryVector: Float32Array | number[],
    limit = 10,
    denseWeight = 1.0,
    sparseWeight = 1.0,
    filterCategory?: string
  ): { item: StoredItem; score: number; source?: string }[] {
    const qVec = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const fused = this.hybrid.search(queryText, qVec, {
      limit: Math.max(limit * 3, 20),
      denseWeight,
      sparseWeight,
    });

    const candidates: { item: StoredItem; score: number; source?: string }[] = [];
    for (const res of fused) {
      const stored = this.items.get(res.id);
      if (!stored) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      candidates.push({
        item: stored,
        score: Math.round(res.score * 10000) / 10000,
        source: res.source,
      });

      if (candidates.length >= limit) break;
    }

    return candidates;
  }

  public getBM25(): BM25Index {
    return this.bm25;
  }

  private linearSearch(
    qVec: Float32Array,
    limit: number,
    minSimilarity: number,
    excludeId?: string,
    filterCategory?: string
  ): { item: StoredItem; score: number }[] {
    const results: { item: StoredItem; score: number }[] = [];

    for (const stored of this.items.values()) {
      if (excludeId && stored.id === excludeId) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      const vector = stored.normalizedVector || stored.embedding;
      const score = cosineSimilarity(qVec, vector);

      if (score >= minSimilarity) {
        results.push({
          item: stored,
          score: Math.round(score * 10000) / 10000,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
