import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

export class ServerEmbedder {
  private static instance: ServerEmbedder | null = null;
  private pipe: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  public static getInstance(): ServerEmbedder {
    if (!ServerEmbedder.instance) {
      ServerEmbedder.instance = new ServerEmbedder();
    }
    return ServerEmbedder.instance;
  }

  public async init(): Promise<void> {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName);
    }
  }

  public async embed(text: string): Promise<Float32Array> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Float32Array(384);
    }

    if (!this.pipe) {
      await this.init();
    }

    if (!this.pipe) {
      throw new Error('Server transformer pipeline unavailable');
    }

    const output = await this.pipe(cleanText, {
      pooling: 'mean',
      normalize: true,
    });

    return new Float32Array(output.data);
  }
}
