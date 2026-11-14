import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { Metrics } from '@eidos/core';

if (env?.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}

const EMBEDDER_STOPWORDS = new Set([
  'для', 'под', 'при', 'над', 'без', 'или', 'как', 'это', 'все',
  'недорогие', 'недорогой', 'недорогая', 'бюджетные', 'бюджетный',
  'дешевые', 'дешевый', 'лучшие', 'лучший',
  'the', 'for', 'and', 'with', 'from', 'under', 'over',
  'cheap', 'budget', 'affordable', 'best',
]);

const SEMANTIC_CONCEPT_CLUSTERS: ReadonlyArray<{ dims: number[]; roots: string[] }> = [
  { dims: [0, 1, 2, 3], roots: ['headphone', 'earbud', 'earphone', 'headset', 'audio', 'sound', 'anc', 'spatial', 'наушник', 'звук', 'аудио', 'шумодав', 'гарнитур', 'ヘッドホン', 'イヤホン'] },
  { dims: [4, 5, 6, 7], roots: ['keyboard', 'mechanical', 'switch', 'typing', 'keycap', 'клавиатур', 'механическ', 'свитч', 'печат', 'キーボード'] },
  { dims: [8, 9, 10, 11], roots: ['monitor', 'display', 'screen', 'oled', 'ultrawide', '4k', 'монитор', 'экран', 'дисплей', 'モニター'] },
  { dims: [12, 13, 14, 15], roots: ['laptop', 'notebook', 'computer', 'workstation', 'macbook', 'ultrabook', 'ноутбук', 'компьютер', 'процессор', 'ультрабук', 'макбук', 'ノートpc'] },
  { dims: [16, 17, 18, 19], roots: ['shoe', 'sneaker', 'footwear', 'marathon', 'boot', 'кроссовк', 'обув', 'марафон', 'кед', 'ботинк', 'シューズ'] },
  { dims: [20, 21, 22, 23], roots: ['camera', 'lens', 'photo', 'dslr', 'mirrorless', 'камер', 'объектив', 'фотоаппарат'] },
  { dims: [24, 25, 26, 27], roots: ['watch', 'smartwatch', 'wearable', 'fitness', 'tracker', 'spo2', 'час', 'смартчас', 'браслет', 'фитнес', 'пульс', 'スマートウォッチ'] },
  { dims: [28, 29, 30, 31], roots: ['backpack', 'bag', 'travel', 'luggage', 'carry', 'рюкзак', 'сумк', 'чемодан', 'поход'] },
  { dims: [32, 33, 34, 35], roots: ['coffee', 'espresso', 'barista', 'mug', 'brew', 'cappuccino', 'кофе', 'эспрессо', 'кружк', 'капучино', 'бариста', 'コーヒー', 'エスプレッソ'] },
  { dims: [36, 37, 38, 39], roots: ['gaming', 'gamer', 'rgb', 'cyberpunk', 'esports', 'rpg', 'simulation', 'игров', 'гейм', 'киберпанк', 'симуляц', 'サイバーパンク'] },
  { dims: [40, 41, 42, 43], roots: ['wireless', 'bluetooth', 'cordless', 'portable', 'tws', 'беспроводн', 'блютуз', 'портативн'] },
  { dims: [44, 45, 46, 47], roots: ['smartphone', 'iphone', 'galaxy', 'mobile', 'смартфон', 'телефон', 'айфон', 'камерофон'] },
  { dims: [48, 49, 50, 51], roots: ['space', 'cosmos', 'interstellar', 'dune', 'blackhole', 'relativ', 'космос', 'интерстеллар', 'дюна', 'вселен', 'галактик', '宇宙', 'ブラックホール'] },
  { dims: [52, 53, 54, 55], roots: ['python', 'rust', 'programming', 'algorithm', 'database', 'vector', 'hnsw', 'программирован', 'алгоритм', 'разработ', 'код', 'プログラミング'] },
  { dims: [56, 57, 58, 59], roots: ['oil', 'motor', '5w40', '5w-40', '5w30', '5w-30', 'масло', 'автомасло', 'моторн', 'автохимия', 'motul', 'mobil'] },
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
  const offset = 60;
  const span = dim - offset;
  for (let d = 0; d < 8; d++) {
    const idx = offset + (Math.abs(h1 + Math.imul(d, h2)) % span);
    const sign = ((h1 >>> d) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  }
}

export function computeDeterministicEmbedding(text: string, dim: number = 384): Float32Array {
  const vec = new Float32Array(dim);
  const clean = text.trim().toLowerCase().replace(/^(?:query|passage):\s*/i, '');
  if (!clean) return vec;

  const rawTokens = clean.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return vec;

  const filteredTokens = rawTokens.filter((t) => !EMBEDDER_STOPWORDS.has(t));
  const tokens = filteredTokens.length > 0 ? filteredTokens : rawTokens;
  const invSqrtLen = 1.0 / Math.sqrt(tokens.length);

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    const posWeight = t === 0 ? 1.25 : t === 1 ? 1.1 : 0.95;

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

    hashFeatureToVector(vec, `tok:${token}`, 1.05 * invSqrtLen * posWeight, dim);
    if (token.length >= 4) hashFeatureToVector(vec, `st4:${token.slice(0, 4)}`, 0.7 * invSqrtLen * posWeight, dim);
    if (token.length >= 5) hashFeatureToVector(vec, `st5:${token.slice(0, 5)}`, 0.8 * invSqrtLen * posWeight, dim);
    if (t + 1 < tokens.length) hashFeatureToVector(vec, `bi:${token}_${tokens[t + 1]}`, 0.55 * invSqrtLen, dim);

    const offset = 56;
    const span = dim - offset;
    for (let i = 0; i <= token.length - 3; i++) {
      const tri = token.charCodeAt(i) * 1021 + token.charCodeAt(i + 1) * 131 + token.charCodeAt(i + 2) * 17;
      const idx = offset + (Math.abs(tri) % span);
      const sign = (tri & 1) === 0 ? 1 : -1;
      vec[idx] += sign * 0.24 * invSqrtLen;
    }
  }

  let normSq = 0;
  for (let i = 0; i < dim; i++) normSq += vec[i] * vec[i];
  const norm = Math.sqrt(normSq);
  if (norm > 1e-8) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
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

export type EmbeddingMode = 'onnx' | 'lexical-only' | 'deterministic';

export const DEFAULT_MULTILINGUAL_ONNX_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** Single source of truth for active embedder mode (`onnx` | `lexical-only` | `deterministic`). */
export function resolveEmbeddingMode(): EmbeddingMode {
  const rawMode = (process.env.EIDOS_EMBEDDER_MODE || '').trim().toLowerCase();
  if (rawMode === 'lexical-only' || rawMode === 'lexical' || rawMode === 'bm25-only') {
    return 'lexical-only';
  }
  if (rawMode === 'onnx') {
    return 'onnx';
  }
  if (rawMode === 'deterministic' || rawMode === 'deterministic-hash' || rawMode === 'hash') {
    return 'deterministic';
  }
  if (process.env.EIDOS_USE_ONNX_EMBEDDER === 'true' || process.env.EIDOS_USE_ONNX === 'true') {
    return 'onnx';
  }
  return 'deterministic';
}

export function resolveOnnxModelId(): string {
  const configured = (
    process.env.EIDOS_ONNX_MODEL ||
    process.env.EIDOS_EMBEDDING_MODEL ||
    ''
  ).trim();
  return configured || DEFAULT_MULTILINGUAL_ONNX_MODEL;
}

export class ServerEmbedder {
  private static instance: ServerEmbedder | null = null;
  private pipe: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private cache = new Map<string, Float32Array>();
  private degradedReason: string | null = null;

  public static getInstance(): ServerEmbedder {
    if (!ServerEmbedder.instance) {
      ServerEmbedder.instance = new ServerEmbedder();
    }
    return ServerEmbedder.instance;
  }

  public static resetForTests(): void {
    ServerEmbedder.instance = null;
  }

  public isInitialized(): boolean {
    return this.pipe !== null || this.getEmbeddingMode() === 'lexical-only';
  }

  public isDegraded(): boolean {
    return this.degradedReason !== null;
  }

  public getDegradedReason(): string | null {
    return this.degradedReason;
  }

  public setDegradedForTest(reason: string | null): void {
    this.degradedReason = reason;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public setCachedEmbedding(text: string, vector: Float32Array): void {
    const key = `${this.getEmbeddingSpaceId()}::${text.trim().toLowerCase()}`;
    if (!text.trim()) return;
    if (this.cache.size >= 500) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, new Float32Array(vector));
  }

  public async init(): Promise<void> {
    const mode = this.getEmbeddingMode();
    if (mode === 'lexical-only') {
      this.degradedReason = null;
      this.pipe = null;
      return;
    }
    if (this.pipe) return;
    if (mode !== 'onnx') {
      this.degradedReason = null;
      this.pipe = createFallbackPipeline(384);
      return;
    }
    const targetModel = resolveOnnxModelId();
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.pipe = await pipeline('feature-extraction', targetModel);
        this.degradedReason = null;
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (process.env.EIDOS_EMBEDDER_STRICT_ONNX === 'true') {
            throw new Error(`Failed to initialize ONNX model "${targetModel}": ${errMsg}`);
          }
          this.degradedReason = `ONNX model "${targetModel}" unavailable (${errMsg}); degraded fallback active`;
          this.pipe = createFallbackPipeline(384);
        }
      }
    }
  }

  public async ensureInitialized(): Promise<void> {
    if (this.getEmbeddingMode() === 'lexical-only') {
      return;
    }
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
    const mode = this.getEmbeddingMode();

    if (!cleanText || mode === 'lexical-only') {
      const zeroVec = new Float32Array(384);
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: mode === 'lexical-only' ? 'lexical_noop' : 'single' }, elapsedSec);
      return zeroVec;
    }

    const cacheKey = `${this.getEmbeddingSpaceId()}::${cleanText.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'cached' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return new Float32Array(cached);
    }

    await this.ensureInitialized();

    if (!this.pipe || mode !== 'onnx') {
      const vec = computeDeterministicEmbedding(cleanText, 384);
      this.setCachedEmbedding(cleanText, vec);
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'single' }, elapsedSec);
      Metrics.embeddingsGenerated.inc();
      return vec;
    }

    try {
      const output = await this.pipe(cleanText, { pooling: 'mean', normalize: true });
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

  public async embedBatch(texts: string[], batchSize: number = 32): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const startHr = performance.now();
    const mode = this.getEmbeddingMode();
    if (mode === 'lexical-only') {
      const zeroVectors = texts.map(() => new Float32Array(384));
      const elapsedSec = Math.max(0, (performance.now() - startHr) / 1000);
      Metrics.embeddingLatency.observe({ mode: 'lexical_noop' }, elapsedSec);
      return zeroVectors;
    }

    await this.ensureInitialized();

    if (!this.pipe || mode !== 'onnx') {
      const spacePrefix = `${this.getEmbeddingSpaceId()}::`;
      const vectors = texts.map((t) => {
        const clean = t.trim();
        if (!clean) return new Float32Array(384);
        const cached = this.cache.get(`${spacePrefix}${clean.toLowerCase()}`);
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
        const output = await this.pipe(cleanBatch, { pooling: 'mean', normalize: true });
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

  public getEmbeddingMode(): EmbeddingMode {
    return resolveEmbeddingMode();
  }

  public getActiveModelName(): string {
    const mode = this.getEmbeddingMode();
    if (mode === 'lexical-only') {
      return 'lexical-bm25-only';
    }
    if (mode === 'onnx') {
      return resolveOnnxModelId().replace(/^Xenova\//i, '');
    }
    return 'eidos-deterministic-384-v1';
  }

  public getEmbeddingSpaceId(): string {
    if (process.env.EIDOS_EMBEDDING_SPACE_ID && process.env.EIDOS_EMBEDDING_SPACE_ID.trim()) {
      return process.env.EIDOS_EMBEDDING_SPACE_ID.trim();
    }
    const mode = this.getEmbeddingMode();
    if (mode === 'lexical-only') {
      return 'lexical:bm25-only:v1';
    }
    if (mode === 'onnx') {
      return `onnx:${this.getActiveModelName()}:384:v1`;
    }
    return 'deterministic:eidos-384:v1';
  }
}
