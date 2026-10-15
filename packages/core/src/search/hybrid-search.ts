import { HNSWIndex } from '../hnsw';
import { BM25Index } from './bm25';

export interface HybridSearchResult {
  id: string;
  score: number;
  source: 'dense' | 'sparse' | 'hybrid';
  denseScore?: number;
  sparseScore?: number;
}

export interface HybridSearchOptions {
  limit?: number;
  rrfK?: number; // Reciprocal Rank Fusion constant (default: 60)
  denseWeight?: number; // Weight for dense rank contribution (default: 1.0)
  sparseWeight?: number; // Weight for sparse rank contribution (default: 1.0)
}

/**
 * HybridSearch combines Dense semantic vector search (HNSW)
 * and Sparse exact keyword search (BM25) via Reciprocal Rank Fusion (RRF).
 *
 * RRF Score formula:
 * RRF(d) = Σ_m (w_m / (k + rank_m(d)))
 */
export class HybridSearch {
  private readonly denseIndex: HNSWIndex;
  private readonly sparseIndex: BM25Index;

  constructor(denseIndex: HNSWIndex, sparseIndex: BM25Index) {
    this.denseIndex = denseIndex;
    this.sparseIndex = sparseIndex;
  }

  /**
   * Executes unified hybrid search with Reciprocal Rank Fusion.
   *
   * @param queryText - Search query string for BM25
   * @param queryVector - Dense semantic vector embedding for HNSW
   * @param options - Fusion parameters and limits
   * @returns Fused and sorted array of items
   */
  public search(
    queryText: string,
    queryVector: Float32Array,
    options?: HybridSearchOptions
  ): HybridSearchResult[] {
    const limit = options?.limit ?? 10;
    const rrfK = options?.rrfK ?? 60;
    const denseWeight = options?.denseWeight ?? 1.0;
    const sparseWeight = options?.sparseWeight ?? 1.0;
    const candidateFetchLimit = Math.max(limit * 3, 20);

    // 1. Dense Search (HNSW)
    const denseHits = this.denseIndex.search(queryVector, candidateFetchLimit);

    // 2. Sparse Search (BM25)
    const sparseHits = this.sparseIndex.search(queryText, candidateFetchLimit);

    // 3. Reciprocal Rank Fusion
    const fusionMap = new Map<
      string,
      {
        totalScore: number;
        hasDense: boolean;
        hasSparse: boolean;
        denseScore?: number;
        sparseScore?: number;
      }
    >();

    denseHits.forEach((hit, rank) => {
      const rrfContribution = denseWeight / (rrfK + rank + 1);
      const existing = fusionMap.get(hit.id) ?? {
        totalScore: 0,
        hasDense: false,
        hasSparse: false,
      };
      existing.totalScore += rrfContribution;
      existing.hasDense = true;
      existing.denseScore = hit.score;
      fusionMap.set(hit.id, existing);
    });

    sparseHits.forEach((hit, rank) => {
      const rrfContribution = sparseWeight / (rrfK + rank + 1);
      const existing = fusionMap.get(hit.id) ?? {
        totalScore: 0,
        hasDense: false,
        hasSparse: false,
      };
      existing.totalScore += rrfContribution;
      existing.hasSparse = true;
      existing.sparseScore = hit.score;
      fusionMap.set(hit.id, existing);
    });

    // 4. Sort and format results
    const results: HybridSearchResult[] = Array.from(fusionMap.entries())
      .map(([id, entry]) => {
        let source: 'dense' | 'sparse' | 'hybrid' = 'hybrid';
        if (entry.hasDense && !entry.hasSparse) source = 'dense';
        if (!entry.hasDense && entry.hasSparse) source = 'sparse';

        return {
          id,
          score: entry.totalScore,
          source,
          denseScore: entry.denseScore,
          sparseScore: entry.sparseScore,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }
}
