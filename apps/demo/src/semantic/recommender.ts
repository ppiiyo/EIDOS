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

  /**
   * Ingests catalog items and ensures vectors are accessible.
   */
  public loadCatalog(items: DemoItem[]): void {
    this.catalog.clear();
    for (const item of items) {
      this.catalog.set(item.id, item);
    }
  }

  /**
   * Builds and indexes vectors for any catalog items missing embeddings.
   */
  public async indexAll(onProgress?: (count: number, total: number) => void): Promise<void> {
    const items = Array.from(this.catalog.values());
    let completed = 0;

    for (const item of items) {
      if (!item.embedding || item.embedding.length === 0) {
        const text = `${item.title}. ${item.category}. ${item.tags.join(', ')}. ${item.description}`;
        item.embedding = await this.embedder.embed(text);
      }
      completed++;
      if (onProgress) onProgress(completed, items.length);
    }
  }

  /**
   * Recommends semantically related items for a given source item ID.
   */
  public recommend(itemId: string, limit = 5, minSimilarity = 0.3): RecommendationResult[] {
    const target = this.catalog.get(itemId);
    if (!target || !target.embedding) {
      return [];
    }

    const results: RecommendationResult[] = [];
    for (const [id, item] of this.catalog.entries()) {
      if (id === itemId || !item.embedding) continue;

      const sim = computeCosine(target.embedding, item.embedding);
      if (sim >= minSimilarity) {
        results.push({ item, similarity: Math.round(sim * 10000) / 10000 });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Executes natural language semantic search across the catalog.
   */
  public async search(query: string, limit = 10, minSimilarity = 0.25): Promise<RecommendationResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const queryVector = await this.embedder.embed(trimmed);
    const results: RecommendationResult[] = [];

    for (const item of this.catalog.values()) {
      if (!item.embedding) continue;
      const sim = computeCosine(queryVector, item.embedding);
      if (sim >= minSimilarity) {
        results.push({ item, similarity: Math.round(sim * 10000) / 10000 });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
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
