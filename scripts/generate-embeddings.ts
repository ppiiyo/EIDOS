import * as fs from 'fs';
import * as path from 'path';

interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  embedding?: number[];
}

/**
 * Deterministic pseudo-semantic embedding generator for offline pre-seeding
 * when running without an external GPU or server pipeline.
 * Generates an L2-normalized 384-dimensional vector based on token frequencies and n-grams.
 */
function computeDeterministicVector(text: string, dimensions = 384): number[] {
  const vector = new Float32Array(dimensions);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    let hash = 0x811c9dc5;
    for (let c = 0; c < word.length; c++) {
      hash ^= word.charCodeAt(c);
      hash = Math.imul(hash, 0x01000193);
    }

    const index = Math.abs(hash) % dimensions;
    const sign = (hash & 1) === 0 ? 1.0 : -1.0;
    vector[index] += sign * (1.0 + (word.length / 10));

    // Bigram context
    if (i < tokens.length - 1) {
      const bigram = word + '_' + tokens[i + 1];
      let bHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        bHash = (bHash << 5) - bHash + bigram.charCodeAt(c);
        bHash |= 0;
      }
      const bIndex = Math.abs(bHash) % dimensions;
      vector[bIndex] += 0.5;
    }
  }

  // L2 Normalize
  let sumSquares = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares);
  if (norm > 1e-9) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return Array.from(vector);
}

async function main() {
  const catalogPath = path.resolve(process.cwd(), 'data/catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog file not found at: ${catalogPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(catalogPath, 'utf-8');
  const items: CatalogItem[] = JSON.parse(rawData);

  console.log(`Processing ${items.length} items for embedding generation...`);

  const startTime = Date.now();
  let updatedCount = 0;

  for (const item of items) {
    const compositeText = `${item.title}. ${item.category}. ${item.tags.join(', ')}. ${item.description}`;
    item.embedding = computeDeterministicVector(compositeText, 384);
    updatedCount++;
  }

  fs.writeFileSync(catalogPath, JSON.stringify(items, null, 2), 'utf-8');
  const duration = Date.now() - startTime;

  console.log(`Generated embeddings for ${updatedCount} items in ${duration}ms.`);
  console.log(`Saved updated catalog to ${catalogPath}`);
}

main().catch(console.error);
