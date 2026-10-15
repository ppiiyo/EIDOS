import { MultiInterestConfig, MultiInterestProfile } from './types';

/**
 * Normalizes a Float32Array vector in-place or returns a new L2-normalized vector.
 *
 * @param vector - Input Float32Array vector
 * @returns L2-normalized vector
 */
function normalizeL2(vector: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) {
    return vector;
  }
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] / norm;
  }
  return result;
}

/**
 * Computes dot product between two equal-length vectors.
 */
function dotProduct(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * MultiInterestUserTower extracts multiple distinct intent/interest capsules from
 * user interaction history (inspired by MIND and ComiRec multi-interest architectures).
 *
 * Rather than collapsing diverse user behaviors (e.g. keyboards + gardening) into
 * a single blurred centroid, it dynamically partitions the session history into K
 * discrete interest vectors via hyperspherical dynamic routing.
 */
export class MultiInterestUserTower {
  private profiles = new Map<string, MultiInterestProfile>();
  private readonly config: MultiInterestConfig;

  /**
   * Initializes the MultiInterestUserTower.
   *
   * @param config - Partial configuration options
   */
  constructor(config?: Partial<MultiInterestConfig>) {
    this.config = {
      maxInterests: config?.maxInterests ?? 3,
      maxHistoryLength: config?.maxHistoryLength ?? 50,
      recencyDecay: config?.recencyDecay ?? 0.95,
      routingIterations: config?.routingIterations ?? 3,
      temperature: config?.temperature ?? 0.25,
      normalization: config?.normalization ?? 'l2',
    };
  }

  /**
   * Constructs a MultiInterestProfile from an ordered sequence of interacted item IDs.
   * Items earlier in the array are older; items at the end are most recent.
   *
   * @param userId - Unique identifier for the user
   * @param history - List of item IDs representing user interaction history
   * @param getEmbedding - Async provider returning embedding vector for an item
   * @param getCategory - Function returning category label for an item
   * @returns MultiInterestProfile containing discrete interest embeddings
   */
  public async buildProfile(
    userId: string,
    history: string[],
    getEmbedding: (itemId: string) => Promise<Float32Array>,
    getCategory: (itemId: string) => string
  ): Promise<MultiInterestProfile> {
    const categoryDistribution = new Map<string, number>();

    if (!history || history.length === 0) {
      const emptyProfile: MultiInterestProfile = {
        userId,
        history: [],
        interestEmbeddings: [new Float32Array(384)],
        interestWeights: [1.0],
        interestCategories: [[]],
        categoryDistribution,
        updatedAt: Date.now(),
      };
      this.profiles.set(userId, emptyProfile);
      return emptyProfile;
    }

    const windowedHistory = history.slice(-this.config.maxHistoryLength);
    const N = windowedHistory.length;

    let targetDim = 0;
    const resolvedEmbeddings: Float32Array[] = [];
    const itemCategories: string[] = [];

    for (const itemId of windowedHistory) {
      const rawEmb = await getEmbedding(itemId);
      const emb = this.config.normalization === 'l2' ? normalizeL2(rawEmb) : rawEmb;
      if (targetDim === 0 && emb.length > 0) {
        targetDim = emb.length;
      }
      resolvedEmbeddings.push(emb);
      const cat = getCategory(itemId) || 'unknown';
      itemCategories.push(cat);
      categoryDistribution.set(cat, (categoryDistribution.get(cat) || 0) + 1);
    }

    if (targetDim === 0) {
      targetDim = 384;
    }

    // Time decay weights: newest item (i = N - 1) gets 1.0, older items decay exponentially
    const itemWeights = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      itemWeights[i] = Math.pow(this.config.recencyDecay, N - 1 - i);
    }

    const K = Math.max(1, Math.min(this.config.maxInterests, N));

    // Handle single item or single cluster case directly
    if (K === 1 || N === 1) {
      const centroid = new Float32Array(targetDim);
      let totalWeight = 0;
      for (let i = 0; i < N; i++) {
        const w = itemWeights[i];
        const emb = resolvedEmbeddings[i];
        for (let d = 0; d < targetDim; d++) {
          centroid[d] += emb[d] * w;
        }
        totalWeight += w;
      }
      if (totalWeight > 0) {
        for (let d = 0; d < targetDim; d++) {
          centroid[d] /= totalWeight;
        }
      }
      const finalEmbedding = this.config.normalization === 'l2' ? normalizeL2(centroid) : centroid;
      const profile: MultiInterestProfile = {
        userId,
        history: [...windowedHistory],
        interestEmbeddings: [finalEmbedding],
        interestWeights: [1.0],
        interestCategories: [Array.from(new Set(itemCategories))],
        categoryDistribution,
        updatedAt: Date.now(),
      };
      this.profiles.set(userId, profile);
      return profile;
    }

    // Hyperspherical K-Means++ style prototype initialization
    const centroids: Float32Array[] = [];
    centroids.push(new Float32Array(resolvedEmbeddings[N - 1])); // Seed with the most recent item

    for (let k = 1; k < K; k++) {
      let maxDist = -Infinity;
      let bestCandidateIdx = 0;

      for (let i = 0; i < N; i++) {
        const emb = resolvedEmbeddings[i];
        // Distance to closest already chosen centroid
        let maxSimToChosen = -Infinity;
        for (const chosen of centroids) {
          const sim = dotProduct(emb, chosen);
          if (sim > maxSimToChosen) {
            maxSimToChosen = sim;
          }
        }
        const dist = 1 - maxSimToChosen;
        if (dist > maxDist) {
          maxDist = dist;
          bestCandidateIdx = i;
        }
      }

      centroids.push(new Float32Array(resolvedEmbeddings[bestCandidateIdx]));
    }

    // Dynamic routing / Spherical EM iterations
    const routingAssignment = new Float32Array(N * K); // Matrix of probabilities p_ik
    const temp = Math.max(0.01, this.config.temperature);

    for (let iter = 0; iter < this.config.routingIterations; iter++) {
      // Step 1: E-step: Softmax assignment of items to interest centroids
      for (let i = 0; i < N; i++) {
        const emb = resolvedEmbeddings[i];
        let maxAffinity = -Infinity;
        const affinities = new Float32Array(K);

        for (let k = 0; k < K; k++) {
          const aff = dotProduct(emb, centroids[k]);
          affinities[k] = aff;
          if (aff > maxAffinity) {
            maxAffinity = aff;
          }
        }

        let sumExp = 0;
        for (let k = 0; k < K; k++) {
          const expVal = Math.exp((affinities[k] - maxAffinity) / temp);
          routingAssignment[i * K + k] = expVal;
          sumExp += expVal;
        }

        if (sumExp > 0) {
          for (let k = 0; k < K; k++) {
            routingAssignment[i * K + k] /= sumExp;
          }
        }
      }

      // Step 2: M-step: Re-compute interest centroids
      for (let k = 0; k < K; k++) {
        const nextCentroid = new Float32Array(targetDim);
        let clusterWeight = 0;

        for (let i = 0; i < N; i++) {
          const p = routingAssignment[i * K + k];
          const w = itemWeights[i] * p;
          const emb = resolvedEmbeddings[i];

          for (let d = 0; d < targetDim; d++) {
            nextCentroid[d] += emb[d] * w;
          }
          clusterWeight += w;
        }

        if (clusterWeight > 1e-6) {
          centroids[k] =
            this.config.normalization === 'l2' ? normalizeL2(nextCentroid) : nextCentroid;
        }
      }
    }

    // Aggregate cluster mass and partition items
    const rawClusterWeights = new Float32Array(K);
    const clusterCategories: Set<string>[] = Array.from({ length: K }, () => new Set<string>());

    for (let i = 0; i < N; i++) {
      let maxP = -1;
      let argmaxCluster = 0;

      for (let k = 0; k < K; k++) {
        const p = routingAssignment[i * K + k];
        rawClusterWeights[k] += itemWeights[i] * p;
        if (p > maxP) {
          maxP = p;
          argmaxCluster = k;
        }
      }

      clusterCategories[argmaxCluster].add(itemCategories[i]);
    }

    // Filter viable clusters and normalize weights
    let totalClusterWeight = 0;
    const viableIndices: number[] = [];

    for (let k = 0; k < K; k++) {
      if (rawClusterWeights[k] > 1e-4) {
        viableIndices.push(k);
        totalClusterWeight += rawClusterWeights[k];
      }
    }

    // Fallback if all degenerate
    if (viableIndices.length === 0) {
      viableIndices.push(0);
      totalClusterWeight = rawClusterWeights[0] || 1;
    }

    // Sort viable clusters by descending weight
    viableIndices.sort((a, b) => rawClusterWeights[b] - rawClusterWeights[a]);

    const finalEmbeddings: Float32Array[] = [];
    const finalWeights: number[] = [];
    const finalCategories: string[][] = [];

    for (const idx of viableIndices) {
      finalEmbeddings.push(centroids[idx]);
      finalWeights.push(
        totalClusterWeight > 0 ? rawClusterWeights[idx] / totalClusterWeight : 1 / viableIndices.length
      );
      finalCategories.push(Array.from(clusterCategories[idx]));
    }

    const profile: MultiInterestProfile = {
      userId,
      history: [...windowedHistory],
      interestEmbeddings: finalEmbeddings,
      interestWeights: finalWeights,
      interestCategories: finalCategories,
      categoryDistribution,
      updatedAt: Date.now(),
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Finds the best matching interest capsule for a candidate item vector
   * (Maximum Inner Product Search across user's interest capsules).
   *
   * @param userId - Unique identifier for the user
   * @param candidateEmbedding - Embedding vector of the item candidate
   * @returns Best matching interest capsule info or null if user not found
   */
  public getTopInterestForCandidate(
    userId: string,
    candidateEmbedding: Float32Array
  ): { interestIndex: number; affinity: number; embedding: Float32Array } | null {
    const profile = this.profiles.get(userId);
    if (!profile || profile.interestEmbeddings.length === 0) {
      return null;
    }

    let maxAffinity = -Infinity;
    let bestIndex = 0;

    for (let i = 0; i < profile.interestEmbeddings.length; i++) {
      const emb = profile.interestEmbeddings[i];
      const aff = dotProduct(emb, candidateEmbedding);
      if (aff > maxAffinity) {
        maxAffinity = aff;
        bestIndex = i;
      }
    }

    return {
      interestIndex: bestIndex,
      affinity: maxAffinity,
      embedding: profile.interestEmbeddings[bestIndex],
    };
  }

  /**
   * Retrieves all interest embeddings for a user.
   */
  public getAllInterestEmbeddings(userId: string): Float32Array[] {
    const profile = this.profiles.get(userId);
    return profile ? profile.interestEmbeddings : [];
  }

  /**
   * Retrieves cached MultiInterestProfile for a user.
   */
  public getProfile(userId: string): MultiInterestProfile | null {
    return this.profiles.get(userId) || null;
  }

  /**
   * Clears all cached user profiles.
   */
  public clear(): void {
    this.profiles.clear();
  }

  /**
   * Evicts user profiles that have not been updated within maxAgeMs milliseconds.
   *
   * @param maxAgeMs - Maximum permitted age in milliseconds (default 24 hours)
   */
  public evictOldProfiles(maxAgeMs = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [userId, profile] of this.profiles.entries()) {
      if (now - profile.updatedAt > maxAgeMs) {
        this.profiles.delete(userId);
      }
    }
  }
}
