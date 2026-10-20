import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmbeddingModelNotReadyError,
  getEmbeddingEngineState,
  generateEmbedding,
  initEmbeddingModel,
  resetEmbeddingEngineForTests,
  setMockPipelineLoaderForTests,
} from '../../apps/workspace/src/lib/embeddings';
import {
  mulberry32,
  generateSyntheticScaledCatalog,
  executeLexicalBm25Search,
  INITIAL_CATALOG,
} from '../../apps/workspace/src/utils/recommenderEngine';

describe('Phase 2: Honest Browser Embedding Pipeline & Determinism (TDD)', () => {
  beforeEach(() => {
    resetEmbeddingEngineForTests();
  });

  it('throws EmbeddingModelNotReadyError when generateEmbedding is called before model is ready (no silent hash fallback)', async () => {
    expect(getEmbeddingEngineState().status).toBe('idle');
    await expect(generateEmbedding('wireless headphones')).rejects.toThrow(
      EmbeddingModelNotReadyError
    );
  });

  it('transitions idle -> loading-model -> ready and produces normalized 384-d Float32Array when pipeline resolves', async () => {
    const states: string[] = [];
    setMockPipelineLoaderForTests(async (onProgress) => {
      onProgress?.(45);
      states.push(getEmbeddingEngineState().status);
      onProgress?.(100);
      return async (text: string) => {
        const arr = new Float32Array(384);
        for (let i = 0; i < 384; i++) {
          arr[i] = ((text.charCodeAt(i % text.length) + i) % 19) / 19;
        }
        return { data: arr };
      };
    });

    await initEmbeddingModel();
    expect(states).toContain('loading-model');
    expect(getEmbeddingEngineState().status).toBe('ready');
    expect(getEmbeddingEngineState().progress).toBe(100);

    const vec = await generateEmbedding('neural search engine');
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(384);

    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSq += vec[i] * vec[i];
    }
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 4);
  });

  it('transitions to error state and throws EmbeddingModelNotReadyError if ONNX load fails', async () => {
    setMockPipelineLoaderForTests(async () => {
      throw new Error('WASM fetch failed');
    });

    await expect(initEmbeddingModel()).rejects.toThrow('WASM fetch failed');
    expect(getEmbeddingEngineState().status).toBe('error');
    await expect(generateEmbedding('query')).rejects.toThrow(
      EmbeddingModelNotReadyError
    );
  });

  it('mulberry32 PRNG and generateSyntheticScaledCatalog are 100% deterministic for the same seed', () => {
    const rng1 = mulberry32(1337);
    const rng2 = mulberry32(1337);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);

    const runA = generateSyntheticScaledCatalog(60, INITIAL_CATALOG.slice(0, 5), undefined, 2026);
    const runB = generateSyntheticScaledCatalog(60, INITIAL_CATALOG.slice(0, 5), undefined, 2026);

    expect(runA.catalog.length).toBe(60);
    expect(runB.catalog.length).toBe(60);
    const vecA = runA.embeddings.get('scale_25')!;
    const vecB = runB.embeddings.get('scale_25')!;
    expect(Array.from(vecA)).toEqual(Array.from(vecB));
  });

  it('executeLexicalBm25Search explicitly marks results with retrievalMode = lexical-bm25 and denseScore = 0', () => {
    const hits = executeLexicalBm25Search('Интерстеллар космос', INITIAL_CATALOG, 5);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.source).toBe('sparse');
      expect(hit.denseScore).toBe(0);
      expect(hit.bm25Score).toBeGreaterThan(0);
      expect(hit.retrievalMode).toBe('lexical-bm25');
    }
  });
});
