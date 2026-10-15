/**
 * StreamingQuantileScaler for Feature Normalization Layer.
 * Normalizes unbounded continuous ranking features (popularity, freshness, views, etc.)
 * into a well-behaved [0, 1] range using online quantile estimation and rolling window statistics.
 *
 * High-performance implementation:
 * - Circular Float64Array buffer for O(1) ingestion without memory reallocations or Array.shift().
 * - Lazy sorted cache for O(log N) quantile queries via binary search.
 * - Robust 1st/99th percentile clipping against extreme outliers.
 */
export class StreamingQuantileScaler {
  private readonly windowSize: number;
  private readonly defaultMin: number;
  private readonly defaultMax: number;
  private buffer: Float64Array;
  private head: number = 0;
  private count: number = 0;
  private sortedCache: Float64Array | null = null;
  private min: number;
  private max: number;
  private sum: number = 0;

  /**
   * @param windowSize - Maximum number of historical samples to retain (default: 10,000)
   * @param defaultMin - Fallback lower bound for cold-start (default: 0.0)
   * @param defaultMax - Fallback upper bound for cold-start (default: 1.0)
   */
  constructor(
    windowSize: number = 10000,
    defaultMin: number = 0.0,
    defaultMax: number = 1.0
  ) {
    this.windowSize = Math.max(10, windowSize);
    this.defaultMin = defaultMin;
    this.defaultMax = defaultMax;
    this.min = defaultMin;
    this.max = defaultMax;
    this.buffer = new Float64Array(this.windowSize);
  }

  /**
   * Ingests a new continuous observation into the circular rolling buffer.
   * Runs in strictly O(1) time complexity.
   */
  public update(value: number): void {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return;
    }

    if (this.count === this.windowSize) {
      // Overwrite oldest item in circular ring buffer
      const evicted = this.buffer[this.head];
      this.sum -= evicted;
    } else {
      this.count++;
    }

    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.windowSize;
    this.sum += value;
    this.sortedCache = null; // Invalidate cache on update

    if (this.count === 1) {
      this.min = value;
      this.max = value;
    } else {
      if (value < this.min) this.min = value;
      if (value > this.max) this.max = value;
    }
  }

  /**
   * Batch update multiple observations.
   */
  public updateBatch(values: readonly number[]): void {
    for (const v of values) {
      this.update(v);
    }
  }

  /**
   * Returns a snapshot array of current values stored in the window.
   */
  public get values(): number[] {
    const res: number[] = new Array(this.count);
    if (this.count < this.windowSize) {
      for (let i = 0; i < this.count; i++) {
        res[i] = this.buffer[i];
      }
    } else {
      for (let i = 0; i < this.count; i++) {
        const idx = (this.head + i) % this.windowSize;
        res[i] = this.buffer[idx];
      }
    }
    return res;
  }

  /**
   * Normalizes a raw feature value into [0, 1].
   *
   * Edge-case strategies:
   * 1. Cold start (< 5 samples): Uses Min-Max normalization against default bounds.
   * 2. Homogeneous data (all samples identical): Returns 0.5 (neutral).
   * 3. Adequate data: Uses empirical quantile rank with 1st/99th percentile clipping to eliminate outliers.
   * 4. Lazy sorted cache ensures consecutive transforms take only O(log N) binary search time.
   */
  public transform(value: number): number {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return 0.5;
    }

    // 1. Cold Start Fallback (< 5 samples)
    if (this.count < 5) {
      const span = this.defaultMax - this.defaultMin;
      if (span <= 1e-9) return 0.5;
      const normalized = (value - this.defaultMin) / span;
      return Math.min(1.0, Math.max(0.0, normalized));
    }

    // 2. Build or reuse sorted cache
    if (!this.sortedCache) {
      const arr = new Float64Array(this.count);
      if (this.count < this.windowSize) {
        arr.set(this.buffer.subarray(0, this.count));
      } else {
        arr.set(this.buffer);
      }
      arr.sort();
      this.sortedCache = arr;
      this.min = arr[0];
      this.max = arr[arr.length - 1];
    }

    const sorted = this.sortedCache;
    const total = sorted.length;

    // 3. Homogeneous Data Check
    if (this.max - this.min <= 1e-9) {
      return 0.5;
    }

    // 4. Percentile clipping bounds (p01 and p99)
    const p01Idx = Math.floor(0.01 * (total - 1));
    const p99Idx = Math.ceil(0.99 * (total - 1));
    const p01 = sorted[p01Idx];
    const p99 = sorted[p99Idx];

    if (p99 - p01 <= 1e-9) {
      const span = this.max - this.min;
      if (span <= 1e-9) return 0.5;
      return Math.min(1.0, Math.max(0.0, (value - this.min) / span));
    }

    if (value <= p01) return 0.0;
    if (value >= p99) return 1.0;

    // 5. Binary search in sorted array
    let low = p01Idx;
    let high = p99Idx;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (sorted[mid] < value) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const rank = (low - p01Idx) / (p99Idx - p01Idx);
    return Math.min(1.0, Math.max(0.0, rank));
  }

  /**
   * Convenience method to update statistics and transform in a single step.
   */
  public fitTransform(value: number): number {
    this.update(value);
    return this.transform(value);
  }

  /**
   * Retrieves summary statistics for telemetry and diagnostics.
   */
  public getStats(): { count: number; min: number; max: number; mean: number } {
    return {
      count: this.count,
      min: this.count === 0 ? this.defaultMin : this.min,
      max: this.count === 0 ? this.defaultMax : this.max,
      mean: this.count > 0 ? this.sum / this.count : 0,
    };
  }

  /**
   * Serializes internal state for persistence and snapshotting.
   */
  public serialize(): { window: number[]; windowSize: number; defaultMin: number; defaultMax: number } {
    return {
      window: this.values,
      windowSize: this.windowSize,
      defaultMin: this.defaultMin,
      defaultMax: this.defaultMax,
    };
  }

  /**
   * Restores state from a serialized snapshot.
   */
  public static deserialize(data: {
    window: number[];
    windowSize: number;
    defaultMin?: number;
    defaultMax?: number;
  }): StreamingQuantileScaler {
    const scaler = new StreamingQuantileScaler(
      data.windowSize,
      data.defaultMin ?? 0.0,
      data.defaultMax ?? 1.0
    );
    scaler.updateBatch(data.window);
    return scaler;
  }
}
