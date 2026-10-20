/**
 * Honest Browser-First ONNX / WASM Embedding Engine (@xenova/transformers).
 *
 * Principle #1: Never disguise pseudo-hash vectors as 384-d neural embeddings.
 * If the ONNX model is still downloading or initializing, `generateEmbedding`
 * throws `EmbeddingModelNotReadyError` so the caller can explicitly route to
 * lexical BM25 search and display an honest status indicator in the UI.
 */

export type EmbeddingEngineStatus = 'idle' | 'loading-model' | 'ready' | 'error';

export interface EmbeddingEngineState {
  status: EmbeddingEngineStatus;
  modelId: string;
  progress: number;
  errorMessage: string | null;
}

export class EmbeddingModelNotReadyError extends Error {
  public readonly engineStatus: EmbeddingEngineStatus;

  constructor(status: EmbeddingEngineStatus, message?: string) {
    super(
      message ||
        `ONNX Embedding model is not ready (current status: "${status}"). Use explicit lexical BM25 fallback until status === "ready".`
    );
    this.name = 'EmbeddingModelNotReadyError';
    this.engineStatus = status;
  }
}

export type PipelineFn = (
  text: string,
  options?: { pooling?: 'mean' | 'cls'; normalize?: boolean }
) => Promise<{ data: Float32Array | number[] }>;

type PipelineLoader = (onProgress?: (pct: number) => void) => Promise<PipelineFn>;

const DEFAULT_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let currentState: EmbeddingEngineState = {
  status: 'idle',
  modelId: DEFAULT_MODEL_ID,
  progress: 0,
  errorMessage: null,
};

let activePipeline: PipelineFn | null = null;
let inflightInit: Promise<PipelineFn> | null = null;
let mockLoader: PipelineLoader | null = null;

const listeners = new Set<(state: EmbeddingEngineState) => void>();

function notifyListeners(): void {
  const snapshot = { ...currentState };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function updateState(patch: Partial<EmbeddingEngineState>): void {
  currentState = { ...currentState, ...patch };
  notifyListeners();
}

export function getEmbeddingEngineState(): EmbeddingEngineState {
  return { ...currentState };
}

export function isEmbeddingModelReady(): boolean {
  return currentState.status === 'ready' && activePipeline !== null;
}

export function subscribeEmbeddingStatus(
  listener: (state: EmbeddingEngineState) => void
): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
}

async function defaultTransformersLoader(
  modelId: string,
  onProgress?: (pct: number) => void
): Promise<PipelineFn> {
  const transformers = await import('@xenova/transformers');
  if (transformers.env) {
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
  }
  const extractor = await transformers.pipeline('feature-extraction', modelId, {
    quantized: true,
    progress_callback: (evt: { progress?: number; status?: string }) => {
      if (typeof evt?.progress === 'number' && Number.isFinite(evt.progress)) {
        onProgress?.(Math.min(99, Math.max(1, Math.round(evt.progress))));
      }
    },
  });
  return async (text: string, options?: { pooling?: 'mean' | 'cls'; normalize?: boolean }) => {
    const out = await extractor(text, {
      pooling: options?.pooling ?? 'mean',
      normalize: options?.normalize ?? true,
    });
    return { data: out.data as Float32Array };
  };
}

/**
 * Initializes the ONNX/WASM embedding pipeline in the browser.
 * Safe to call multiple times (deduplicates concurrent initialization).
 */
export async function initEmbeddingModel(
  modelId: string = DEFAULT_MODEL_ID
): Promise<PipelineFn> {
  if (currentState.status === 'ready' && activePipeline && currentState.modelId === modelId) {
    return activePipeline;
  }
  if (inflightInit) {
    return inflightInit;
  }

  updateState({
    status: 'loading-model',
    modelId,
    progress: 5,
    errorMessage: null,
  });

  inflightInit = (async () => {
    try {
      const loader: PipelineLoader =
        mockLoader ?? ((onProg) => defaultTransformersLoader(modelId, onProg));
      const pipe = await loader((pct) => {
        updateState({
          status: 'loading-model',
          progress: Math.min(99, Math.max(5, pct)),
        });
      });
      activePipeline = pipe;
      updateState({
        status: 'ready',
        modelId,
        progress: 100,
        errorMessage: null,
      });
      return pipe;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      activePipeline = null;
      updateState({
        status: 'error',
        progress: 0,
        errorMessage: msg,
      });
      throw err;
    } finally {
      inflightInit = null;
    }
  })();

  return inflightInit;
}

/**
 * L2-normalizes a Float32Array in place and returns it.
 */
function normalizeL2(vec: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    if (!Number.isFinite(vec[i])) {
      throw new RangeError(`Embedding coordinate at index ${i} is not finite: ${vec[i]}`);
    }
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) {
    throw new RangeError('Embedding vector has zero L2 norm');
  }
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i] / norm;
  }
  return out;
}

/**
 * Generates a 384-dimensional semantic embedding using the loaded ONNX model.
 * Throws `EmbeddingModelNotReadyError` if the model has not finished loading.
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (currentState.status !== 'ready' || !activePipeline) {
    throw new EmbeddingModelNotReadyError(currentState.status);
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new RangeError('Cannot generate embedding for empty text');
  }

  const output = await activePipeline(trimmed, {
    pooling: 'mean',
    normalize: true,
  });

  const raw =
    output.data instanceof Float32Array
      ? output.data
      : new Float32Array(output.data);

  return normalizeL2(raw);
}

/**
 * Test helpers for deterministic unit testing without network calls.
 */
export function resetEmbeddingEngineForTests(): void {
  activePipeline = null;
  inflightInit = null;
  mockLoader = null;
  currentState = {
    status: 'idle',
    modelId: DEFAULT_MODEL_ID,
    progress: 0,
    errorMessage: null,
  };
  notifyListeners();
}

export function setMockPipelineLoaderForTests(loader: PipelineLoader | null): void {
  mockLoader = loader;
}
