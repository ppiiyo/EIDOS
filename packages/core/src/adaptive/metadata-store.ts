import { ItemMetadata } from './types';

/**
 * MetadataStore provides structured caching and real-time retrieval
 * for item metadata including publication age, categories, popularity,
 * and custom attributes.
 */
export class MetadataStore {
  private store = new Map<string, ItemMetadata>();

  /**
   * Adds or replaces metadata for a single catalog item.
   *
   * @param item - Metadata for the item
   */
  public add(item: ItemMetadata): void {
    this.store.set(String(item.id), {
      ...item,
      id: String(item.id),
      popularity: Math.max(0, Math.min(1, item.popularity)),
      attributes: { ...item.attributes },
    });
  }

  /**
   * Batch upserts metadata for multiple items.
   *
   * @param items - Array of ItemMetadata records
   */
  public addBatch(items: ItemMetadata[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Retrieves metadata record by item id.
   *
   * @param id - Item ID
   * @returns ItemMetadata or undefined if absent
   */
  public get(id: string): ItemMetadata | undefined {
    return this.store.get(String(id));
  }

  /**
   * Checks whether item metadata is present.
   *
   * @param id - Item ID
   */
  public has(id: string): boolean {
    return this.store.has(String(id));
  }

  /**
   * Returns current count of stored items.
   */
  public size(): number {
    return this.store.size;
  }

  /**
   * Calculates normalized freshness score [0, 1] based on createdAt timestamp.
   * Items created just now receive 1.0; items older than maxAgeDays approach 0.0.
   *
   * @param id - Item ID
   * @param maxAgeDays - Horizon window in days (default 30)
   * @returns Freshness score between 0.0 and 1.0
   */
  public getFreshness(id: string, maxAgeDays = 30): number {
    const item = this.store.get(String(id));
    if (!item || !item.createdAt) {
      return 0.5; // Neutral baseline if unspecified
    }

    const now = Date.now();
    const ageMs = Math.max(0, now - item.createdAt);
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    // Linear decay with exponential tail
    const ratio = ageMs / maxAgeMs;
    return Math.max(0, Math.min(1, Math.exp(-ratio)));
  }

  /**
   * Returns normalized popularity score [0, 1].
   *
   * @param id - Item ID
   */
  public getPopularity(id: string): number {
    const item = this.store.get(String(id));
    return item ? item.popularity : 0.0;
  }

  /**
   * Returns primary category of the item.
   *
   * @param id - Item ID
   */
  public getCategory(id: string): string {
    const item = this.store.get(String(id));
    return item?.category || 'General';
  }

  /**
   * Returns arbitrary attributes of the item.
   *
   * @param id - Item ID
   */
  public getAttributes(id: string): Record<string, string | number> {
    const item = this.store.get(String(id));
    return item?.attributes ? { ...item.attributes } : {};
  }

  /**
   * Updates the popularity of an item incrementally, clamped to [0, 1].
   *
   * @param id - Item ID
   * @param delta - Change in popularity (+0.05, -0.02, etc.)
   */
  public updatePopularity(id: string, delta: number): void {
    const item = this.store.get(String(id));
    if (item) {
      item.popularity = Math.max(0, Math.min(1, item.popularity + delta));
    }
  }

  /**
   * Clears all stored metadata records.
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Exports all item metadata records as an array.
   */
  public export(): ItemMetadata[] {
    return Array.from(this.store.values());
  }

  /**
   * Imports an array of item metadata records.
   *
   * @param items - Item metadata records to import
   */
  public import(items: ItemMetadata[]): void {
    this.addBatch(items);
  }
}
