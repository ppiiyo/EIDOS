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
  static search(query: string, filters?: Record<string, any>, limit?: number): string {
    const normalized = {
      q: query.toLowerCase().trim(),
      f: filters || {},
      l: limit || 10,
    };
    const hash = this.hashObject(normalized);
    return `search:${hash}`;
  }

  /**
   * Generate cache key for recommendations endpoint
   * @param itemId Source item ID
   * @param strategy Recommendation strategy
   * @param limit Number of recommendations
   * @param extra Optional extra parameters (filters, userId, history) to avoid cross-request collisions
   */
  static recommend(
    itemId: string,
    strategy: string = 'simple',
    limit: number = 10,
    extra?: Record<string, any>
  ): string {
    if (extra && Object.keys(extra).length > 0) {
      const hash = this.hashObject(extra);
      return `recommend:${strategy}:${itemId}:${limit}:${hash}`;
    }
    return `recommend:${strategy}:${itemId}:${limit}`;
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

  /**
   * Create MD5 hash of object for consistent key generation
   */
  private static hashObject(obj: any): string {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(sorted).digest('hex').substring(0, 12);
  }
}
