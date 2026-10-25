import { cosineSimilarity } from '@eidos/core';
import { recordSemanticCacheHit } from './cache-metrics';

export interface SemanticCacheEntry<T = Record<string, any>> {
  query: string;
  vector: Float32Array;
  filterKey: string;
  limit: number;
  response: T;
  createdAt: number;
  expiresAt: number;
}

export interface SemanticLookupResult<T = Record<string, any>> {
  hit: boolean;
  similarity: number;
  matchedQuery?: string;
  response?: T;
}

/**
 * SemanticQueryCache matches incoming search queries against recently cached
 * 384-d query embeddings using Cosine Similarity (default threshold >= 0.95).
 * Reduces redundant HNSW + BM25+ evaluation for paraphrased and synonymous queries.
 */
export class SemanticQueryCache {
  private static instance: SemanticQueryCache | null = null;
  private readonly entries: SemanticCacheEntry<any>[] = [];
  private readonly maxEntries: number;
  private readonly defaultThreshold: number;

  constructor(options?: { maxEntries?: number; similarityThreshold?: number }) {
    this.maxEntries = options?.maxEntries ?? 250;
    this.defaultThreshold = options?.similarityThreshold ?? 0.95;
  }

  public static getInstance(): SemanticQueryCache {
    if (!SemanticQueryCache.instance) {
      SemanticQueryCache.instance = new SemanticQueryCache();
    }
    return SemanticQueryCache.instance;
  }

  private normalizeFilterKey(
    filters?: string | Record<string, any>,
    limit = 10
  ): string {
    if (typeof filters === 'string') {
      return filters;
    }
    const sortedFilters = filters
      ? JSON.stringify(filters, Object.keys(filters).sort())
      : '{}';
    return `${limit}::${sortedFilters}`;
  }

  /**
   * Searches the ring buffer for a semantically equivalent cached query
   * with CosineSimilarity(queryVec, cachedVec) >= threshold.
   */
  public lookup<T = Record<string, any>>(
    queryVector: Float32Array | number[],
    filters?: string | Record<string, any>,
    limit = 10,
    threshold = this.defaultThreshold
  ): SemanticLookupResult<T> {
    const now = Date.now();
    const filterKey = this.normalizeFilterKey(filters, limit);
    const qVec =
      queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);

    let bestMatch: SemanticCacheEntry<any> | null = null;
    let bestSim = -1;

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.expiresAt <= now) {
        this.entries.splice(i, 1);
        continue;
      }
      if (entry.filterKey !== filterKey) {
        continue;
      }

      const sim = cosineSimilarity(qVec, entry.vector);
      if (sim >= threshold && sim > bestSim) {
        bestSim = sim;
        bestMatch = entry;
      }
    }

    if (bestMatch) {
      recordSemanticCacheHit('search');
      return {
        hit: true,
        similarity: Math.round(bestSim * 10000) / 10000,
        matchedQuery: bestMatch.query,
        response: bestMatch.response as T,
      };
    }

    return {
      hit: false,
      similarity: Math.max(0, Math.round(bestSim * 10000) / 10000),
    };
  }

  /**
   * Stores a query embedding and its response payload in the semantic ring buffer.
   * Supports both (query, vec, filterKey, response, ttl) and (query, vec, response, filters, limit, ttl).
   */
  public store<T = Record<string, any>>(
    query: string,
    queryVector: Float32Array | number[],
    arg3: string | T,
    arg4?: T | Record<string, any> | number,
    arg5 = 10,
    arg6 = 300
  ): void {
    const now = Date.now();
    let filterKey: string;
    let response: T;
    let limit = 10;
    let ttlSeconds = 300;

    if (typeof arg3 === 'string') {
      filterKey = arg3;
      response = arg4 as T;
      ttlSeconds = typeof arg5 === 'number' ? arg5 : 300;
    } else {
      response = arg3;
      filterKey = this.normalizeFilterKey(arg4 as Record<string, any> | undefined, arg5);
      limit = arg5;
      ttlSeconds = arg6;
    }

    const vecCopy =
      queryVector instanceof Float32Array
        ? new Float32Array(queryVector)
        : new Float32Array(queryVector);

    const existingIdx = this.entries.findIndex(
      (e) => e.query.toLowerCase() === query.toLowerCase() && e.filterKey === filterKey
    );
    if (existingIdx !== -1) {
      this.entries.splice(existingIdx, 1);
    } else if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }

    this.entries.push({
      query,
      vector: vecCopy,
      filterKey,
      limit,
      response,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public size(): number {
    return this.entries.length;
  }
}

export function getSemanticCache(): SemanticQueryCache {
  return SemanticQueryCache.getInstance();
}
