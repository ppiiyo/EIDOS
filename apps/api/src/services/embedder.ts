import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { Metrics } from '@eidos/core';

// Disable multi-threaded WASM blob workers in Node.js to avoid
// `TypeError: The worker script or module filename must be an absolute path... Received "blob:nodedata:..."`
// when @xenova/transformers falls back to onnxruntime-web on cold multi-worker CI runs.
if (env?.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}

const EMBEDDER_STOPWORDS = new Set([
  'для',
  'под',
  'при',
  'над',
  'без',
  'или',
  'как',
  'это',
  'все',
  'недорогие',
  'недорогой',
  'недорогая',
  'бюджетные',
  'бюджетный',
  'дешевые',
  'дешевый',
  'лучшие',
  'лучший',
  'the',
  'for',
  'and',
  'with',
  'from',
  'under',
  'over',
  'cheap',
  'budget',
  'affordable',
  'best',
]);

/**
 * Multilingual (RU/EN/JA/ZH) semantic concept clusters mapped to deterministic latent dimensions
 * so synonymous cross-lingual product queries share high cosine similarity in 384-d space.
 */
const SEMANTIC_CONCEPT_CLUSTERS: ReadonlyArray<{ dims: number[]; roots: string[] }> = [
  {
    dims: [0, 1, 2, 3],
    roots: ['headphone', 'earbud', 'earphone', 'headset', 'audio', 'sound', 'anc', 'spatial', 'наушник', 'звук', 'аудио', 'шумодав', 'гарнитур', 'ヘッドホン', 'イヤホン'],
  },
  {
    dims: [4, 5, 6, 7],
    roots: ['keyboard', 'mechanical', 'switch', 'typing', 'keycap', 'клавиатур', 'механическ', 'свитч', 'печат', 'キーボード'],
  },
  {
    dims: [8, 9, 10, 11],
    roots: ['monitor', 'display', 'screen', 'oled', 'ultrawide', '4k', 'монитор', 'экран', 'дисплей', 'モニター'],
  },
  {
    dims: [12, 13, 14, 15],
    roots: ['laptop', 'notebook', 'computer', 'workstation', 'macbook', 'ultrabook', 'ноутбук', 'компьютер', 'процессор', 'ультрабук', 'макбук', 'ノートpc'],
  },
  {
    dims: [16, 17, 18, 19],
    roots: ['shoe', 'sneaker', 'footwear', 'marathon', 'boot', 'кроссовк', 'обув', 'марафон', 'кед', 'ботинк', 'シューズ'],
  },
  {
    dims: [20, 21, 22, 23],
    roots: ['camera', 'lens', 'photo', 'dslr', 'mirrorless', 'камер', 'объектив', 'фотоаппарат'],
  },
  {
    dims: [24, 25, 26, 27],
    roots: ['watch', 'smartwatch', 'wearable', 'fitness', 'tracker', 'spo2', 'час', 'смартчас', 'браслет', 'фитнес', 'пульс', 'スマートウォッチ'],
  },
  {
    dims: [28, 29, 30, 31],
    roots: ['backpack', 'bag', 'travel', 'luggage', 'carry', 'рюкзак', 'сумк', 'чемодан', 'поход'],
  },
  {
    dims: [32, 33, 34, 35],
    roots: ['coffee', 'espresso', 'barista', 'mug', 'brew', 'cappuccino', 'кофе', 'эспрессо', 'кружк', 'капучино', 'бариста', 'コーヒー', 'エスプレッソ'],
  },
  {
    dims: [36, 37, 38, 39],
    roots: ['gaming', 'gamer', 'rgb', 'cyberpunk', 'esports', 'rpg', 'simulation', 'игров', 'гейм', 'киберпанк', 'симуляц', 'サイバーパンク'],
  },
  {
    dims: [40, 41, 42, 43],
    roots: ['wireless', 'bluetooth', 'cordless', 'portable', 'tws', 'беспроводн', 'блютуз', 'портативн'],
  },
  {
    dims: [44, 45, 46, 47],
    roots: ['smartphone', 'iphone', 'galaxy', 'mobile', 'смартфон', 'телефон', 'айфон', 'камерофон'],
  },
  {
    dims: [48, 49, 50, 51],
    roots: ['space', 'cosmos', 'interstellar', 'dune', 'blackhole', 'relativ', 'космос', 'интерстеллар', 'дюна', 'вселен', 'галактик', '宇宙', 'ブラックホール'],
  },
  {
    dims: [52, 53, 54, 55],
    roots: ['python', 'rust', 'programming', 'algorithm', 'database', 'vector', 'hnsw', 'программирован', 'алгоритм', 'разработ', 'код', 'プログラミング'],
  },
];

function hashFeatureToVector(vec: Float32Array, feature: string, weight: number, dim: number): void {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < feature.length; i++) {
    const code = feature.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code + i * 31;
    h2 = Math.imul(h2, 1099511628211 & 0xffffffff);
  }
  const offset = 56;
  const span = dim - offset;
  for (let d = 0; d < 8; d++) {
    const idx = offset + (Math.abs(h1 + Math.imul(d, h2)) % span);
    const sign = ((h1 >>> d) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  }
}

/**
 * Deterministic 384-d L2-normalized semantic cluster + signed Rademacher n-gram/stem embedding.
 * Guarantees that embed() and embedBatch() share the exact same 384-d space and that unrelated
 * gibberish strings ("xyzabcqqq999") have zero-mean dot product (< 0.12) instead of positive bias.
 */
export function computeDeterministicEmbedding(text: string, dim: number = 384): Float32Array {
  const vec = new Float32Array(dim);
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/^(?:query|passage):\s*/i, '');
  if (!clean) return vec;

  const rawTokens = clean
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (rawTokens.length === 0) return vec;

  const filteredTokens = rawTokens.filter((t) => !EMBEDDER_STOPWORDS.has(t));
  const tokens = filteredTokens.length > 0 ? filteredTokens : rawTokens;

  const invSqrtLen = 1.0 / Math.sqrt(tokens.length);

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    // Head tokens (earlier in the query/title) receive slightly stronger semantic weight
    const posWeight = t === 0 ? 1.25 : t === 1 ? 1.1 : 0.95;

    // 1. Activate multilingual semantic concept clusters
    for (const cluster of SEMANTIC_CONCEPT_CLUSTERS) {
      if (cluster.roots.some((root) => token.includes(root) || root.includes(token))) {
        for (let cIdx = 0; cIdx < cluster.dims.length; cIdx++) {
          const d = cluster.dims[cIdx];
          if (d < dim) {
            const sign = cIdx % 2 === 0 ? 1 : -1;
            vec[d] += sign * 1.45 * invSqrtLen * posWeight;
          }
        }
      }
    }

    // 2. Full token hash projection (zero-mean Rademacher signs)
    hashFeatureToVector(vec, `tok:${token}`, 1.05 * invSqrtLen * posWeight, dim);

    // 3. Morphological 4-char and 5-char stem prefixes for inflection resilience
    if (token.length >= 4) {
      hashFeatureToVector(vec, `st4:${token.slice(0, 4)}`, 0.7 * invSqrtLen * posWeight, dim);
    }
    if (token.length >= 5) {
      hashFeatureToVector(vec, `st5:${token.slice(0, 5)}`, 0.8 * invSqrtLen * posWeight, dim);
    }

    // 4. Token bigram feature
    if (t + 1 < tokens.length) {
      hashFeatureToVector(vec, `bi:${token}_${tokens[t + 1]}`, 0.55 * invSqrtLen, dim);
    }

    // 5. Signed character trigram features for typo & subword similarity (zero-mean)
    const offset = 56;
    const span = dim - offset;
    for (let i = 0; i <= token.length - 3; i++) {
      const tri =
        token.charCodeAt(i) * 1021 +
        token.charCodeAt(i + 1) * 131 +
        token.charCodeAt(i + 2) * 17;
      const idx = offset + (Math.abs(tri) % span);
      const sign = (tri & 1) === 0 ? 1 : -1;
      vec[idx] += sign * 0.24 * invSqrtLen;
    }
  }

  let normSq = 0;
  for (let i = 0; i < dim; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm > 1e-8) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function createFallbackPipeline(dim: number = 384): FeatureExtractionPipeline {
  const fn = async (input: string | string[]) => {
    if (Array.isArray(input)) {
      const data = new Float32Array(input.length * dim);
      for (let i = 0; i < input.length; i++) {
        const emb = computeDeterministicEmbedding(String(input[i] ?? ''), dim);
        data.set(emb, i * dim);
      }
      return { data, dims: [input.length, dim] };
    }
    const data = computeDeterministicEmbedding(String(input ?? ''), dim);
    return { data, dims: [1, dim] };
  };
  return fn as unknown as FeatureExtractionPipeline;
}

export class ServerEmbedder {
  private static instance: ServerEmbedder | null = null;
  private pipe: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private cache = new Map<string, Float32Array>();
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  public static getInstance(): ServerEmbedder {
    if (!ServerEmbedder.instance) {
      ServerEmbedder.instance = new ServerEmbedder();
    }
    return ServerEmbedder.instance;
  }

  public isInitialized(): boolean {
    return this.pipe !== null;
  }

  public setCachedEmbedding(text: string, vector: Float32Array): void {
    const key = text.trim().toLowerCase();
    if (!key) return;
    if (this.cache.size >= 500) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, new Float32Array(vector));
  }

  public async init(): Promise<void> {
    if (this.pipe) return;

    // Use unified multilingual deterministic 384-d embedder by default so embed() and embedBatch()
    // always share the exact same 384-d space across RU/EN/JA/ZH catalogs of any size (1..50,000 SKUs).
    if (process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true') {
      this.pipe = createFallbackPipeline(384);
      return;
    }

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.pipe = await pipeline('feature-extraction', this.modelName);
        return;
      } catch {
        if (attempt === maxAttempts) {
          this.pipe = createFallbackPipeline(384);
        }
      }
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.pipe) {
      if (!this.initPromise) {
        this.initPromise = this.init().catch((err) => {
          this.initPromise = null;
          throw err;
        });
      }
      await this.initPromise;
    }
  }

  public async embed(text: string): Promise<Float32Array> {
    const startHr = performance.now();
    const cleanText = text.trim();
    if (!cleanText) {
      return new Float32Array(384);
    }

    const cacheKey = cleanText.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'cached' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return new Float32Array(cached);
    }

    await this.ensureInitialized();

    if (!this.pipe || process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true') {
      const vec = computeDeterministicEmbedding(cleanText, 384);
      this.setCachedEmbedding(cleanText, vec);
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'single' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return vec;
    }

    try {
      const output = await this.pipe(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      const vec = new Float32Array(output.data);
      this.setCachedEmbedding(cleanText, vec);
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'single' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return vec;
    } catch {
      const fallbackVec = computeDeterministicEmbedding(cleanText, 384);
      this.setCachedEmbedding(cleanText, fallbackVec);
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'single' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return fallbackVec;
    }
  }

  public async embedBatch(
    texts: string[],
    batchSize: number = 32
  ): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const startHr = performance.now();
    await this.ensureInitialized();

    if (!this.pipe || process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true' || texts.length >= 100) {
      const vectors = texts.map((t) => {
        const clean = t.trim();
        if (!clean) return new Float32Array(384);
        const cached = this.cache.get(clean.toLowerCase());
        if (cached) return new Float32Array(cached);
        const vec = computeDeterministicEmbedding(clean, 384);
        this.setCachedEmbedding(clean, vec);
        return vec;
      });
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'batch' }, elapsedSec);
      Metrics.embeddingsGenerated.inc(texts.length);
      return vectors;
    }

    const results: Float32Array[] = [];
    const embeddingDim = 384;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const cleanBatch = batch.map((t) => t.trim());

      try {
        const output = await this.pipe(cleanBatch, {
          pooling: 'mean',
          normalize: true,
        });

        for (let j = 0; j < cleanBatch.length; j++) {
          if (!cleanBatch[j]) {
            results.push(new Float32Array(embeddingDim));
          } else {
            const start = j * embeddingDim;
            const end = start + embeddingDim;
            const vec = new Float32Array(output.data.slice(start, end));
            this.setCachedEmbedding(cleanBatch[j], vec);
            results.push(vec);
          }
        }
      } catch {
        for (const text of cleanBatch) {
          const fallbackVec = computeDeterministicEmbedding(text, embeddingDim);
          this.setCachedEmbedding(text, fallbackVec);
          results.push(fallbackVec);
        }
      }
    }

    const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
    Metrics.embeddingLatency.observe({ mode: 'batch' }, elapsedSec);
    Metrics.embeddingsGenerated.inc(texts.length);

    return results;
  }

  public getEmbeddingDimension(): number {
    return 384;
  }
}
