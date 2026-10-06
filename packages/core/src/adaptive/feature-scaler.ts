/**
 * StreamingQuantileScaler for Feature Normalization Layer.
 * Normalizes unbounded continuous ranking features (popularity, freshness, views, etc.)
 * into a well-behaved [0, 1] range using online quantile estimation and rolling window statistics.
 *
 * Prevents feature dominance (e.g., raw popularity = 10,000 completely overshadowing similarity = 0.9).
 */
export class StreamingQuantileScaler {
  private readonly windowSize: number;
  private readonly defaultMin: number;
  private readonly defaultMax: number;
  private values: number[] = [];
  private isSorted: boolean = true;
  private min: number;
  private max: number;

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
  }

  /**
   * Ingests a new continuous observation into the rolling window.
   */
  public update(value: number): void {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return;
    }

    if (this.values.length >= this.windowSize) {
      this.values.shift();
    }
    this.values.push(value);
    this.isSorted = false;

    if (this.values.length === 1) {
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
   * Ensures the internal buffer is sorted for percentile / quantile queries.
   */
  private ensureSorted(): void {
    if (!this.isSorted) {
      this.values.sort((a, b) => a - b);
      this.isSorted = true;
      if (this.values.length > 0) {
        this.min = this.values[0];
        this.max = this.values[this.values.length - 1];
      }
    }
  }

  /**
   * Normalizes a raw feature value into [0, 1].
   *
   * Edge-case strategies:
   * 1. Cold start (< 5 samples): Uses Min-Max normalization against default bounds.
   * 2. Homogeneous data (all samples identical): Returns 0.5 (neutral).
   * 3. Adequate data: Uses empirical quantile rank with 1st/99th percentile clipping to eliminate outliers.
   */
  public transform(value: number): number {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return 0.5;
    }

    // 1. Cold Start Fallback
    if (this.values.length < 5) {
      const span = this.defaultMax - this.defaultMin;
      if (span <= 1e-9) return 0.5;
      const normalized = (value - this.defaultMin) / span;
      return Math.min(1.0, Math.max(0.0, normalized));
    }

    this.ensureSorted();
    const count = this.values.length;

    // 2. Homogeneous Data: All values are identical
    if (this.max - this.min <= 1e-9) {
      return 0.5;
    }

    // 3. Percentile clipping bounds (p01 and p99) to resist extreme outliers
    const p01Idx = Math.floor(0.01 * (count - 1));
    const p99Idx = Math.ceil(0.99 * (count - 1));
    const p01 = this.values[p01Idx];
    const p99 = this.values[p99Idx];

    if (p99 - p01 <= 1e-9) {
      const span = this.max - this.min;
      if (span <= 1e-9) return 0.5;
      return Math.min(1.0, Math.max(0.0, (value - this.min) / span));
    }

    if (value <= p01) return 0.0;
    if (value >= p99) return 1.0;

    // 4. Empirical Cumulative Distribution Function (ECDF) rank via Binary Search
    let low = p01Idx;
    let high = p99Idx;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.values[mid] < value) {
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
  public getStats(): { count: number; min: number; max: number } {
    return {
      count: this.values.length,
      min: this.values.length === 0 ? this.defaultMin : this.min,
      max: this.values.length === 0 ? this.defaultMax : this.max,
    };
  }
}
