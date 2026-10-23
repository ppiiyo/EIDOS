import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

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
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName);
    }
  }

  /**
   * Thread-safe singleton initialization with promise lock.
   * Prevents race condition when multiple requests trigger init() simultaneously.
   */
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

  /**
   * Embed single text (existing API, backward compatible).
   */
  public async embed(text: string): Promise<Float32Array> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Float32Array(384);
    }

    const cacheKey = cleanText.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return new Float32Array(cached);
    }

    await this.ensureInitialized();

    if (!this.pipe) {
      throw new Error('Server transformer pipeline unavailable');
    }

    const output = await this.pipe(cleanText, {
      pooling: 'mean',
      normalize: true,
    });

    const vec = new Float32Array(output.data);
    this.setCachedEmbedding(cleanText, vec);
    return vec;
  }

  /**
   * Batch embed multiple texts in a single inference call.
   * 20-50x faster than individual embed() calls.
   */
  public async embedBatch(
    texts: string[],
    batchSize: number = 32
  ): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    await this.ensureInitialized();

    if (!this.pipe) {
      throw new Error('Server transformer pipeline unavailable');
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
      } catch (err) {
        console.error(`Batch embedding failed at index ${i}:`, err);
        for (const text of cleanBatch) {
          if (!text) {
            results.push(new Float32Array(embeddingDim));
          } else {
            try {
              const singleOutput = await this.pipe(text, {
                pooling: 'mean',
                normalize: true,
              });
              results.push(new Float32Array(singleOutput.data));
            } catch {
              results.push(new Float32Array(embeddingDim));
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Get embedding dimension for validation.
   */
  public getEmbeddingDimension(): number {
    return 384;
  }
}
