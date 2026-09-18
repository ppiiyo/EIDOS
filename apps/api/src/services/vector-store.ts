import { cosineSimilarity } from '@eidos/core';
import { StoredItem } from '../types';

export class VectorStore {
  private items = new Map<string, StoredItem>();

  public upsert(item: StoredItem): void {
    const id = String(item.id);
    const normalized = new Float32Array(item.embedding);
    this.items.set(id, {
      ...item,
      id,
      normalizedVector: normalized,
    });
  }

  public get(id: string): StoredItem | undefined {
    return this.items.get(String(id));
  }

  public count(): number {
    return this.items.size;
  }

  public search(
    queryVector: Float32Array | number[],
    limit = 10,
    minSimilarity = 0.35,
    excludeId?: string,
    filterCategory?: string
  ): { item: StoredItem; score: number }[] {
    const results: { item: StoredItem; score: number }[] = [];

    for (const stored of this.items.values()) {
      if (excludeId && stored.id === excludeId) continue;
      if (filterCategory && stored.category !== filterCategory) continue;

      const vector = stored.normalizedVector || stored.embedding;
      const score = cosineSimilarity(queryVector, vector);

      if (score >= minSimilarity) {
        results.push({
          item: stored,
          score: Math.round(score * 10000) / 10000,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
