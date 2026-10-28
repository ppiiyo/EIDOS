import crypto from 'crypto';

/**
 * Generate consistent cache keys for different endpoints
 */
export class CacheKeys {
  /**
   * Generate cache key for search endpoint
   * @param query Search query text
   * @param filters Optional filters object
   * @param limit Number of results
   */
  static search(
    query: string,
    filters?: Record<string, any>,
    limit?: number,
    namespace?: string
  ): string {
    const normalized = {
      q: query.toLowerCase().trim(),
      f: filters || {},
      l: limit || 10,
      ...(namespace && namespace !== 'default:default' ? { ns: namespace } : {}),
    };
    const hash = this.hashObject(normalized);
    return namespace && namespace !== 'default:default'
      ? `search:${namespace}:${hash}`
      : `search:${hash}`;
  }

  /**
   * Generate cache key for recommendations endpoint
   * @param itemId Source item ID
   * @param strategy Recommendation strategy
   * @param limit Number of recommendations
   * @param extra Optional extra parameters (filters, userId, history) to avoid cross-request collisions
   * @param namespace Optional tenant/index namespace
   */
  static recommend(
    itemId: string,
    strategy: string = 'simple',
    limit: number = 10,
    extra?: Record<string, any>,
    namespace?: string
  ): string {
    const prefix =
      namespace && namespace !== 'default:default'
        ? `recommend:${namespace}:${strategy}:${itemId}:${limit}`
        : `recommend:${strategy}:${itemId}:${limit}`;
    if (extra && Object.keys(extra).length > 0) {
      const hash = this.hashObject(extra);
      return `${prefix}:${hash}`;
    }
    return prefix;
  }

  /**
   * Generate cache key for user-based recommendations
   * @param userId User ID
   * @param limit Number of recommendations
   */
  static userRecommend(userId: string, limit: number = 10): string {
    return `recommend:user:${userId}:${limit}`;
  }

  /**
   * Generate cache key for catalog stats
   */
  static catalogStats(): string {
    return 'catalog:stats';
  }

  /**
   * Generate cache key for health check
   */
  static healthCheck(): string {
    return 'health:status';
  }

  static readonly TTL = {
    ADAPTIVE_LONG_TAIL: 60,
    ADAPTIVE_WARM: 300,
    ADAPTIVE_HOT: 3600,
    SEARCH: 300,
    RECOMMEND: 600,
  } as const;

  private static frequencyCounts = new Map<string, number>();
  private static readonly MAX_TRACKED_KEYS = 2000;

  /**
   * Computes Adaptive TTL based on query/key popularity:
   * - Hot queries (frequency > 50): 3600s (1 hour)
   * - Warm queries (frequency >= 10): 300s (5 minutes)
   * - Cold / Long-tail queries (< 10): 60s (1 minute)
   */
  static getAdaptiveTTL(keyOrQuery: string, recordHit = true): number {
    const normalized = keyOrQuery.toLowerCase().trim();
    let count = this.frequencyCounts.get(normalized) || 0;

    if (recordHit) {
      count += 1;
      if (!this.frequencyCounts.has(normalized) && this.frequencyCounts.size >= this.MAX_TRACKED_KEYS) {
        const oldestKey = this.frequencyCounts.keys().next().value;
        if (oldestKey !== undefined) {
          this.frequencyCounts.delete(oldestKey);
        }
      }
      this.frequencyCounts.set(normalized, count);
    }

    if (count > 50) {
      return 3600;
    }
    if (count >= 10) {
      return 300;
    }
    return 60;
  }

  static getFrequency(keyOrQuery: string): number {
    return this.frequencyCounts.get(keyOrQuery.toLowerCase().trim()) || 0;
  }

  static resetFrequencies(): void {
    this.frequencyCounts.clear();
  }

  /**
   * Create MD5 hash of object for consistent key generation (recursively sorting nested keys)
   */
  private static canonicalize(val: any): any {
    if (Array.isArray(val)) {
      return val.map((item) => this.canonicalize(item));
    }
    if (val !== null && typeof val === 'object') {
      const sortedObj: Record<string, any> = {};
      for (const key of Object.keys(val).sort()) {
        if (val[key] !== undefined) {
          sortedObj[key] = this.canonicalize(val[key]);
        }
      }
      return sortedObj;
    }
    return val;
  }

  private static hashObject(obj: any): string {
    const sorted = JSON.stringify(this.canonicalize(obj));
    return crypto.createHash('md5').update(sorted).digest('hex').substring(0, 12);
  }
}

