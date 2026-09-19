import { UserProfile, UserTowerConfig } from './types';

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
 * UserTower maintains and computes personalized user profiles from interaction history.
 * Aggregates sequential item embeddings with exponential recency decay, penalizes
 * category saturation, and supports cache eviction.
 */
export class UserTower {
  private profiles = new Map<string, UserProfile>();
  private readonly config: UserTowerConfig;

  /**
   * Initializes the UserTower with optional configuration overrides.
   *
   * @param config - Partial configuration options
   */
  constructor(config?: Partial<UserTowerConfig>) {
    this.config = {
      maxHistoryLength: config?.maxHistoryLength ?? 50,
      recencyDecay: config?.recencyDecay ?? 0.95,
      categoryDiversityWeight: config?.categoryDiversityWeight ?? 0.3,
      normalization: config?.normalization ?? 'l2',
    };
  }

  /**
   * Constructs a UserProfile from an ordered sequence of interacted item IDs.
   * Items earlier in the array are older; items at the end are most recent.
   *
   * @param userId - Unique identifier for the user
   * @param history - List of item IDs representing user interaction history
   * @param getEmbedding - Async provider function returning embedding vector for an item
   * @param getCategory - Function returning category label for an item
   * @returns Computed UserProfile object
   */
  public async buildProfile(
    userId: string,
    history: string[],
    getEmbedding: (itemId: string) => Promise<Float32Array>,
    getCategory: (itemId: string) => string
  ): Promise<UserProfile> {
    const categoryDistribution = new Map<string, number>();

    if (!history || history.length === 0) {
      const emptyProfile: UserProfile = {
        userId,
        history: [],
        embedding: new Float32Array(384),
        categoryDistribution,
        updatedAt: Date.now(),
      };
      this.profiles.set(userId, emptyProfile);
      return emptyProfile;
    }

    // Take the most recent items up to maxHistoryLength
    const windowedHistory = history.slice(-this.config.maxHistoryLength);
    const N = windowedHistory.length;

    let targetDim = 0;
    const resolvedEmbeddings: Float32Array[] = [];
    const itemCategories: string[] = [];

    for (const itemId of windowedHistory) {
      const emb = await getEmbedding(itemId);
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

    const aggregated = new Float32Array(targetDim);
    let totalWeight = 0;

    // Track category seen count sequentially to apply diversity penalty
    const seenCategories = new Map<string, number>();

    for (let i = 0; i < N; i++) {
      const emb = resolvedEmbeddings[i];
      if (emb.length !== targetDim) continue;

      const cat = itemCategories[i];
      const seenCount = seenCategories.get(cat) || 0;
      seenCategories.set(cat, seenCount + 1);

      // Recency decay: newest item (i = N - 1) gets weight 1.0, older items decay
      const timeDecay = Math.pow(this.config.recencyDecay, N - 1 - i);

      // Diversity penalty: repeated items from the same category are weighted down
      const diversityMultiplier = Math.max(0.1, 1 - seenCount * this.config.categoryDiversityWeight);
      const itemWeight = timeDecay * diversityMultiplier;

      for (let d = 0; d < targetDim; d++) {
        aggregated[d] += emb[d] * itemWeight;
      }
      totalWeight += itemWeight;
    }

    if (totalWeight > 1e-12) {
      for (let d = 0; d < targetDim; d++) {
        aggregated[d] /= totalWeight;
      }
    }

    const finalEmbedding =
      this.config.normalization === 'l2' ? normalizeL2(aggregated) : aggregated;

    const profile: UserProfile = {
      userId,
      history: [...windowedHistory],
      embedding: finalEmbedding,
      categoryDistribution,
      updatedAt: Date.now(),
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Retrieves user embedding vector if profile is cached.
   *
   * @param userId - Unique identifier for the user
   * @returns User vector or null if not found
   */
  public getEmbedding(userId: string): Float32Array | null {
    const profile = this.profiles.get(userId);
    return profile ? profile.embedding : null;
  }

  /**
   * Retrieves full user profile if cached.
   *
   * @param userId - Unique identifier for the user
   * @returns UserProfile or null
   */
  public getProfile(userId: string): UserProfile | null {
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
