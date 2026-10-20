import { CatalogItem } from "../types";

export interface ExportedCatalogBundle {
  version: string;
  format: 'eidos-vectors-bundle-v1';
  exportedAt: string;
  totalItems: number;
  embeddingDimension: number;
  items: Array<CatalogItem & { embedding?: number[] }>;
}

/**
 * Serializes the current catalog items and their Float32Array embeddings
 * into a JSON file and triggers a browser download.
 */
export function exportCatalogWithEmbeddings(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  filename = 'eidos-catalog-vectors-export.json'
): void {
  let sampleDim = 384;
  const itemsWithVectors = catalog.map((item) => {
    const vec = embeddings.get(item.id);
    if (vec && vec.length > 0) {
      sampleDim = vec.length;
    }
    return {
      ...item,
      embedding: vec ? Array.from(vec) : undefined,
    };
  });

  const bundle: ExportedCatalogBundle = {
    version: '3.0.0',
    format: 'eidos-vectors-bundle-v1',
    exportedAt: new Date().toISOString(),
    totalItems: itemsWithVectors.length,
    embeddingDimension: sampleDim,
    items: itemsWithVectors,
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

export interface ParseBatchVectorsResult {
  items: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  vectorsCount: number;
  detectedDim: number;
}

/**
 * Parses raw JSON string or object containing items with pre-computed vectors.
 * Accepts either:
 * 1. An ExportedCatalogBundle ({ version, items: [...] })
 * 2. A plain array of items with `embedding` or `vector` field
 */
export function parseCatalogWithEmbeddings(rawContent: string): ParseBatchVectorsResult {
  const parsed = JSON.parse(rawContent);
  let rawList: any[] = [];

  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && Array.isArray(parsed.items)) {
    rawList = parsed.items;
  } else {
    throw new Error('Некорректный формат JSON: ожидается массив элементов или объект с полем items');
  }

  const items: CatalogItem[] = [];
  const embeddings = new Map<string, Float32Array>();
  let detectedDim = 0;

  for (let idx = 0; idx < rawList.length; idx++) {
    const raw = rawList[idx];
    const id = String(raw.id || `batch_${Date.now()}_${idx}`);
    const title = String(raw.title || `Товар #${id}`);
    const description = String(raw.description || '');
    const category = String(raw.category || 'Импорт с векторами');
    const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
    const price = raw.price ? String(raw.price) : undefined;
    const icon = raw.icon || '📦';
    const rating = Number(raw.rating) || 4.8;
    const reviews = Number(raw.reviews) || 42;

    const item: CatalogItem = {
      id,
      title,
      description,
      category,
      tags,
      price,
      icon,
      rating,
      reviews,
      badge: raw.badge || 'Векторный батч',
      custom: true,
    };
    items.push(item);

    // Extract pre-computed vector if available
    const vectorData = raw.embedding || raw.vector || raw.embeddings;
    if (Array.isArray(vectorData) && vectorData.length > 0) {
      const floatArr = new Float32Array(vectorData);
      embeddings.set(id, floatArr);
      if (detectedDim === 0) {
        detectedDim = floatArr.length;
      }
    }
  }

  return {
    items,
    embeddings,
    vectorsCount: embeddings.size,
    detectedDim: detectedDim || 384,
  };
}
