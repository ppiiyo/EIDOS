import { Candidate } from './types';

/**
 * Candidate Fusion combines candidate items retrieved from disparate retrieval streams
 * (semantic similarity, personalized user history, popularity head, knowledge graph).
 * Implements Reciprocal Rank Fusion (RRF) and normalized weighted score fusion.
 */
export class CandidateFusion {
  private readonly perSourceLimit: number;
  private readonly fusionMethod: 'rrf' | 'weighted';
  private readonly rrfConstantK: number;

  /**
   * Initializes the CandidateFusion engine.
   *
   * @param config - perSourceLimit, fusionMethod ('rrf' | 'weighted'), and optional rrfConstantK (default 60)
   */
  constructor(config?: {
    perSourceLimit?: number;
    fusionMethod?: 'rrf' | 'weighted';
    rrfConstantK?: number;
  }) {
    this.perSourceLimit = config?.perSourceLimit ?? 50;
    this.fusionMethod = config?.fusionMethod ?? 'rrf';
    this.rrfConstantK = config?.rrfConstantK ?? 60;
  }

  /**
   * Combines candidates across sources and dedupes items while aggregating scores.
   *
   * @param candidatesBySource - Map where key is source name and value is candidate array
   * @param limit - Maximum total candidates to output
   * @returns Fused candidate items sorted descending by fusedScore
   */
  public fuse(
    candidatesBySource: Map<string, Candidate[]>,
    limit = 50
  ): Array<{ id: string; fusedScore: number; embedding: Float32Array }> {
    const itemMap = new Map<
      string,
      {
        id: string;
        embedding: Float32Array;
        scores: number[];
        rrfScore: number;
      }
    >();

    for (const [, candidates] of candidatesBySource.entries()) {
      // Limit items per stream
      const streamCandidates = candidates.slice(0, this.perSourceLimit);

      for (let rank = 0; rank < streamCandidates.length; rank++) {
        const cand = streamCandidates[rank];
        const existing = itemMap.get(cand.id);

        // Reciprocal rank score: 1 / (k + rank + 1)
        const rankContrib = 1 / (this.rrfConstantK + rank + 1);

        if (!existing) {
          itemMap.set(cand.id, {
            id: cand.id,
            embedding: cand.embedding,
            scores: [cand.rawScore],
            rrfScore: rankContrib,
          });
        } else {
          existing.scores.push(cand.rawScore);
          existing.rrfScore += rankContrib;
          if (
            existing.embedding.length === 0 ||
            (existing.embedding[0] === 0 && cand.embedding.length > 0)
          ) {
            existing.embedding = cand.embedding;
          }
        }
      }
    }

    const results: Array<{ id: string; fusedScore: number; embedding: Float32Array }> = [];

    for (const entry of itemMap.values()) {
      let finalScore = 0;
      if (this.fusionMethod === 'rrf') {
        finalScore = entry.rrfScore;
      } else {
        // Weighted average / max score
        const sum = entry.scores.reduce((a, b) => a + b, 0);
        finalScore = sum / entry.scores.length;
      }

      results.push({
        id: entry.id,
        fusedScore: finalScore,
        embedding: entry.embedding,
      });
    }

    results.sort((a, b) => b.fusedScore - a.fusedScore);
    return results.slice(0, limit);
  }
}
