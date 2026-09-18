import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

/**
 * In-browser client-side transformer embedding engine using Xenova/all-MiniLM-L6-v2.
 */
export class Embedder {
  private static instance: Embedder | null = null;
  private pipe: FeatureExtractionPipeline | null = null;
  private isLoading = false;
  private cache = new Map<string, Float32Array>();
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  private constructor() {}

  /**
   * Singleton instance retrieval.
   */
  public static getInstance(): Embedder {
    if (!Embedder.instance) {
      Embedder.instance = new Embedder();
    }
    return Embedder.instance;
  }

  /**
   * Initializes and loads the ONNX WebAssembly pipeline.
   */
  public async init(onProgress?: (progress: { status: string; progress?: number }) => void): Promise<void> {
    if (this.pipe) return;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLoading = true;
    try {
      this.pipe = await pipeline('feature-extraction', this.modelName, {
        progress_callback: onProgress,
      });
    } catch (error) {
      console.warn(`Embedder ONNX model load warning, falling back to deterministic vector tokenizer:`, error);
      this.pipe = null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generates a deterministic pseudo-semantic 384-dimensional vector when offline.
   */
  public generateFallbackVector(text: string): Float32Array {
    const vector = new Float32Array(384);
    const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i];
      let hash = 0x811c9dc5;
      for (let c = 0; c < word.length; c++) {
        hash ^= word.charCodeAt(c);
        hash = Math.imul(hash, 0x01000193);
      }
      const index = Math.abs(hash) % 384;
      const sign = (hash & 1) === 0 ? 1.0 : -1.0;
      vector[index] += sign * (1.0 + word.length / 10);

      // Bigram context
      if (i < tokens.length - 1) {
        const bigram = word + '_' + tokens[i + 1];
        let bHash = 0;
        for (let c = 0; c < bigram.length; c++) {
          bHash = (bHash << 5) - bHash + bigram.charCodeAt(c);
          bHash |= 0;
        }
        const bIndex = Math.abs(bHash) % 384;
        vector[bIndex] += 0.5;
      }
    }

    let sumSquares = 0;
    for (let i = 0; i < 384; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares);
    if (norm > 1e-9) {
      for (let i = 0; i < 384; i++) {
        vector[i] /= norm;
      }
    }
    return vector;
  }

  /**
   * Generates a 384-dimensional normalized float vector for the input text.
   */
  public async embed(text: string): Promise<Float32Array> {
    const trimmed = text.trim();
    if (!trimmed) {
      return new Float32Array(384);
    }

    const cached = this.cache.get(trimmed);
    if (cached) {
      return cached;
    }

    if (!this.pipe) {
      try {
        await this.init();
      } catch (err) {
        console.warn('Init error handled, using fallback vector:', err);
      }
    }

    if (!this.pipe) {
      const fallback = this.generateFallbackVector(trimmed);
      this.cache.set(trimmed, fallback);
      return fallback;
    }

    try {
      const output = await this.pipe(trimmed, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = new Float32Array(output.data);
      this.cache.set(trimmed, embedding);
      return embedding;
    } catch (error) {
      console.warn(`Inference fallback for "${trimmed.slice(0, 30)}...":`, error);
      const fallback = this.generateFallbackVector(trimmed);
      this.cache.set(trimmed, fallback);
      return fallback;
    }
  }

  /**
   * Clears the in-memory inference cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
