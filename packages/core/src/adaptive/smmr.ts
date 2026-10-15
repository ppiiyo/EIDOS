import { cosineSimilarity } from '../cosine';
import { SMMRConfig } from './types';

/**
 * SMMR (Sampled Maximum Marginal Relevance) implements diversified candidate selection.
 * In contrast to purely greedy argmax MMR, SMMR samples candidates proportionally to their
 * diversity-relevance trade-off via Boltzmann / softmax distribution, avoiding uniform
 * clusters while maintaining high target relevance.
 */
export class SMMR {
  private readonly config: SMMRConfig;

  /**
   * Initializes the SMMR engine with configuration options.
   * Defaults:
   * lambda = 0.7 (balance between relevance and diversity)
   * sampleSize = 10 (top pool considered for sampling)
   * temperature = 0.5 (exploration temperature)
   * deterministic = false
   *
   * @param config - SMMR options
   */
  constructor(config?: Partial<SMMRConfig>) {
    this.config = {
      lambda: config?.lambda ?? 0.7,
      sampleSize: config?.sampleSize ?? 10,
      temperature: config?.temperature ?? 0.5,
      deterministic: config?.deterministic ?? false,
    };
  }

  /**
   * Re-ranks a list of scored candidates to maximize topical and vector diversity.
   *
   * @param candidates - List of candidate items with relevance score and vector embedding
   * @param limit - Number of items to select
   * @param config - Optional configuration override
   * @returns Diversified subset of candidates ordered by selection sequence
   */
  public rerank(
    candidates: Array<{ id: string; score: number; embedding: Float32Array }>,
    limit: number,
    config?: Partial<SMMRConfig>
  ): Array<{ id: string; score: number }> {
    if (!candidates || candidates.length === 0 || limit <= 0) {
      return [];
    }

    const lambda = config?.lambda ?? this.config.lambda;
    const sampleSize = Math.max(1, config?.sampleSize ?? this.config.sampleSize);
    const temperature = config?.temperature ?? this.config.temperature;
    const deterministic =
      config?.deterministic !== undefined
        ? config.deterministic
        : this.config.deterministic || temperature <= 1e-4;

    const remaining = [...candidates];
    const selected: Array<{ id: string; score: number; embedding: Float32Array }> = [];
    const targetCount = Math.min(limit, candidates.length);

    // Step 1: Select the candidate with highest primary score
    let bestFirstIdx = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].score > remaining[bestFirstIdx].score) {
        bestFirstIdx = i;
      }
    }
    selected.push(remaining[bestFirstIdx]);
    remaining.splice(bestFirstIdx, 1);

    // Step 2: Iteratively select subsequent candidates
    while (selected.length < targetCount && remaining.length > 0) {
      // If lambda === 1, diversity is turned off; simply pick remaining highest score
      if (lambda >= 1.0) {
        let maxIdx = 0;
        for (let i = 1; i < remaining.length; i++) {
          if (remaining[i].score > remaining[maxIdx].score) {
            maxIdx = i;
          }
        }
        selected.push(remaining[maxIdx]);
        remaining.splice(maxIdx, 1);
        continue;
      }

      // Compute MMR score for all candidates in remaining pool
      const scoredPool: Array<{
        index: number;
        mmrScore: number;
      }> = [];

      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        let maxSim = -1.0;
        for (const s of selected) {
          const sim = cosineSimilarity(cand.embedding, s.embedding);
          if (sim > maxSim) {
            maxSim = sim;
          }
        }
        if (maxSim < 0) maxSim = 0;

        const mmrScore = lambda * cand.score - (1.0 - lambda) * maxSim;
        scoredPool.push({ index: i, mmrScore });
      }

      // Sort scored pool descending by MMR score
      scoredPool.sort((a, b) => b.mmrScore - a.mmrScore);

      let chosenIndexInRemaining = scoredPool[0].index;

      if (!deterministic) {
        // Take top-sampleSize
        const poolToSample = scoredPool.slice(0, Math.min(sampleSize, scoredPool.length));

        // Softmax with temperature scaling
        const maxScore = poolToSample[0].mmrScore;
        const expScores = poolToSample.map((item) =>
          Math.exp((item.mmrScore - maxScore) / temperature)
        );
        const totalExp = expScores.reduce((acc, val) => acc + val, 0);

        const r = Math.random() * totalExp;
        let cumulative = 0;
        let picked = poolToSample[0].index;

        for (let j = 0; j < poolToSample.length; j++) {
          cumulative += expScores[j];
          if (r <= cumulative) {
            picked = poolToSample[j].index;
            break;
          }
        }
        chosenIndexInRemaining = picked;
      }

      selected.push(remaining[chosenIndexInRemaining]);
      remaining.splice(chosenIndexInRemaining, 1);
    }

    return selected.map((s) => ({ id: s.id, score: s.score }));
  }
}
