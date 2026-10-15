/**
 * Computes Shannon diversity entropy for a set of categorical distributions.
 * Higher entropy indicates higher diversity across categories.
 *
 * @param categories - Array of categorical labels from recommendations
 * @returns Shannon entropy value in bits
 */
export function calculateCategoryEntropy(categories: string[]): number {
  if (categories.length === 0) {
    return 0;
  }

  const frequencyMap = new Map<string, number>();
  for (const cat of categories) {
    frequencyMap.set(cat, (frequencyMap.get(cat) ?? 0) + 1);
  }

  const total = categories.length;
  let entropy = 0;

  for (const count of frequencyMap.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return Math.round(entropy * 10000) / 10000;
}

/**
 * Calculates raw Shannon entropy in bits (log2) for a probability distribution.
 *
 * @param probabilities - Array of probabilities that must sum to 1
 * @returns Shannon entropy value in bits
 */
export function shannonEntropy(probabilities: number[]): number {
  if (probabilities.length === 0) return 0;
  if (probabilities.length === 1 && probabilities[0] === 1) return 0;

  let sum = 0;
  for (const p of probabilities) {
    if (p < 0) {
      throw new Error('Probabilities must be non-negative');
    }
    sum += p;
  }

  if (Math.abs(sum - 1.0) > 1e-4) {
    throw new Error(`Probabilities must sum to 1, got ${sum}`);
  }

  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Calculates Maximum Marginal Relevance (MMR) penalty score to prevent
 * recommendation redundancy while preserving semantic relevance.
 *
 * @param relevanceScore - Raw semantic similarity score to query or source item
 * @param maxSimilarityToSelected - Maximum similarity between candidate and already selected items
 * @param lambda - Diversity trade-off factor [0.0 - 1.0]. 1.0 = purely relevant, 0.0 = purely diverse
 * @returns Combined MMR ranking score
 */
export function calculateMMRScore(
  relevanceScore: number,
  maxSimilarityToSelected: number,
  lambda = 0.7
): number {
  const boundedLambda = Math.max(0, Math.min(1, lambda));
  return boundedLambda * relevanceScore - (1 - boundedLambda) * maxSimilarityToSelected;
}
