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
      console.error(`Failed to initialize Embedder model [${this.modelName}]:`, error);
      throw new Error(`Embedding model load failure: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isLoading = false;
    }
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
      await this.init();
    }

    if (!this.pipe) {
      throw new Error('Embedder pipeline is uninitialized.');
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
      console.error(`Inference error while embedding text "${trimmed.slice(0, 30)}...":`, error);
      throw new Error(`Vector inference error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clears the in-memory inference cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
