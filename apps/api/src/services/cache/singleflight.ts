/**
 * SingleFlight ensures that only one execution of a function
 * is in-flight for a given key at a time.
 *
 * Prevents "thundering herd" problem where cache expiration
 * causes thousands of simultaneous identical requests.
 *
 * Example:
 *   1000 users request "наушники" simultaneously
 *   Cache expires → all 1000 would hit the database
 *   SingleFlight → only 1 hits database, 999 wait for result
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Execute function with single-flight guarantee.
   *
   * @param key - Unique key for deduplication
   * @param fn - Function to execute (only one at a time per key)
   * @param timeoutMs - Maximum time to wait for result (default: 30s)
   * @returns Result of the function
   */
  async do<T>(
    key: string,
    fn: () => Promise<T>,
    timeoutMs: number = 30_000
  ): Promise<T> {
    // If there's already an in-flight request for this key, wait for it
    const existing = this.inFlight.get(key);
    if (existing) {
      return this.withTimeout(existing, timeoutMs, `SingleFlight timeout for key: ${key}`);
    }

    // Start new execution
    const promise = Promise.resolve()
      .then(() => fn())
      .finally(() => {
        // Clean up after completion (success or failure)
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);

    return this.withTimeout(promise, timeoutMs, `SingleFlight timeout for key: ${key}`);
  }

  /**
   * Check if a request is in-flight for the given key
   */
  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  /**
   * Get count of in-flight requests (for monitoring)
   */
  get size(): number {
    return this.inFlight.size;
  }

  /**
   * Clear all in-flight requests (use with caution)
   */
  clear(): void {
    this.inFlight.clear();
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      if (timer.unref) {
        timer.unref();
      }
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }
}

// Singleton instance for application-wide use
let singleFlightInstance: SingleFlight | null = null;

export function getSingleFlight(): SingleFlight {
  if (!singleFlightInstance) {
    singleFlightInstance = new SingleFlight();
  }
  return singleFlightInstance;
}
