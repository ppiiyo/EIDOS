import * as fs from 'fs';
import * as path from 'path';

interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number | string;
  embedding?: number[];
}

/**
 * Deterministic 384-dimensional normalized vector generator
 * for zero-cost offline & CI pre-computation.
 */
function generateDeterministicEmbedding(text: string, dims = 384): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let d = 0; d < dims; d++) {
      const seed = Math.imul(hash ^ (d * 2654435761), 1597334677);
      const val = ((seed >>> 0) / 4294967296) * 2 - 1;
      vec[d] += val / Math.sqrt(tokens.length);
    }
  }

  let norm = 0;
  for (let d = 0; d < dims; d++) {
    norm += vec[d] * vec[d];
  }
  norm = Math.sqrt(norm) || 1;

  return vec.map((v) => Number((v / norm).toFixed(6)));
}

async function main() {
  const rootDir = process.cwd();
  const catalogPath = path.join(rootDir, 'data', 'catalog.json');

  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog file not found at ${catalogPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(catalogPath, 'utf-8');
  const items: CatalogItem[] = JSON.parse(raw);

  console.log(`Generating 384-d embeddings for ${items.length} catalog items...`);

  const enriched: CatalogItem[] = items.map((item) => {
    const text = `${item.title} ${item.category} ${item.description} ${(item.tags || []).join(' ')}`;
    const embedding = generateDeterministicEmbedding(text, 384);
    return {
      ...item,
      id: String(item.id),
      embedding,
    };
  });

  const serialized = JSON.stringify(enriched, null, 2) + '\n';
  fs.writeFileSync(catalogPath, serialized, 'utf-8');

  console.log(`Updated ${catalogPath} with 384-dimensional embeddings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
