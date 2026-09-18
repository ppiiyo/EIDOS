import { Embedder } from './embedder';
import { computeCosine } from './similarity';

export interface DemoItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  embedding?: number[] | Float32Array;
}

export interface RecommendationResult {
  item: DemoItem;
  similarity: number;
}

/**
 * High-performance client-side semantic recommender and search manager.
 */
export class Recommender {
  private catalog: Map<string, DemoItem> = new Map();
  private embedder: Embedder = Embedder.getInstance();

  constructor(items?: DemoItem[]) {
    if (items) {
      this.loadCatalog(items);
    }
  }

  private isZeroVector(vec?: number[] | Float32Array): boolean {
    if (!vec || vec.length === 0) return true;
    for (let i = 0; i < vec.length; i++) {
      if (vec[i] !== 0) return false;
    }
    return true;
  }

  /**
   * Ingests catalog items and ensures vectors are accessible.
   */
  public loadCatalog(items: DemoItem[]): void {
    this.catalog.clear();
    for (const rawItem of items) {
      const id = String(rawItem.id);
      const item: DemoItem = { ...rawItem, id };
      if (!item.embedding || item.embedding.length === 0 || this.isZeroVector(item.embedding)) {
        const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
        item.embedding = this.embedder.generateFallbackVector(text);
      }
      this.catalog.set(id, item);
    }
  }

  /**
   * Builds and indexes vectors for any catalog items missing embeddings.
   */
  public async indexAll(onProgress?: (count: number, total: number) => void): Promise<void> {
    const items = Array.from(this.catalog.values());
    let completed = 0;

    for (const item of items) {
      if (!item.embedding || item.embedding.length === 0 || this.isZeroVector(item.embedding)) {
        const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
        item.embedding = await this.embedder.embed(text);
      }
      completed++;
      if (onProgress) onProgress(completed, items.length);
    }
  }

  /**
   * Recommends semantically related items for a given source item ID.
   */
  public recommend(itemId: string, limit = 5, minSimilarity = 0.2): RecommendationResult[] {
    const id = String(itemId);
    const target = this.catalog.get(id);
    if (!target) {
      return [];
    }

    if (!target.embedding || target.embedding.length === 0 || this.isZeroVector(target.embedding)) {
      const text = `${target.title}. ${target.category}. ${(target.tags || []).join(', ')}. ${target.description}`;
      target.embedding = this.embedder.generateFallbackVector(text);
    }

    const results: RecommendationResult[] = [];
    const allMatches: RecommendationResult[] = [];

    for (const [otherId, item] of this.catalog.entries()) {
      if (otherId === id) continue;

      if (!item.embedding || item.embedding.length === 0 || this.isZeroVector(item.embedding)) {
        const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
        item.embedding = this.embedder.generateFallbackVector(text);
      }

      const sim = computeCosine(target.embedding, item.embedding);
      const entry: RecommendationResult = { item, similarity: Math.round(sim * 10000) / 10000 };
      allMatches.push(entry);

      if (sim >= minSimilarity) {
        results.push(entry);
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    if (results.length > 0) {
      return results.slice(0, limit);
    }

    // Fallback: return top ranked items even if below strict similarity threshold
    allMatches.sort((a, b) => b.similarity - a.similarity);
    return allMatches.slice(0, limit);
  }

  /**
   * Executes natural language semantic search across the catalog.
   */
  public async search(query: string, limit = 10, minSimilarity = 0.15): Promise<RecommendationResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const queryVector = await this.embedder.embed(trimmed);
    const results: RecommendationResult[] = [];
    const allMatches: RecommendationResult[] = [];

    for (const item of this.catalog.values()) {
      if (!item.embedding || item.embedding.length === 0 || this.isZeroVector(item.embedding)) {
        const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
        item.embedding = this.embedder.generateFallbackVector(text);
      }

      const sim = computeCosine(queryVector, item.embedding);
      const entry: RecommendationResult = { item, similarity: Math.round(sim * 10000) / 10000 };
      allMatches.push(entry);

      if (sim >= minSimilarity) {
        results.push(entry);
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    if (results.length > 0) {
      return results.slice(0, limit);
    }

    allMatches.sort((a, b) => b.similarity - a.similarity);
    return allMatches.slice(0, limit);
  }

  /**
   * Retrieves the direct cosine similarity score between two item IDs.
   */
  public getSimilarity(id1: string, id2: string): number {
    const item1 = this.catalog.get(id1);
    const item2 = this.catalog.get(id2);

    if (!item1?.embedding || !item2?.embedding) {
      return 0;
    }

    return computeCosine(item1.embedding, item2.embedding);
  }

  /**
   * Returns all items currently held in catalog.
   */
  public getAllItems(): DemoItem[] {
    return Array.from(this.catalog.values());
  }
}
