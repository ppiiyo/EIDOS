import { CatalogItem } from '../../types';
import { computeTextEmbedding } from '../../utils/recommenderEngine';

const WORKER_SCRIPT = `
self.onmessage = function(e) {
  const { items, batchId } = e.data;
  const DIM = 384;

  function hashGram(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function embedText(text) {
    const vec = new Float32Array(DIM);
    const clean = (text || '').toLowerCase().replace(/^passage:\\s*/, '').trim();
    const words = clean.split(/[\\s,_\\-—"«»'().:;!?]+/).filter(Boolean);

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const stem = words[wIdx].slice(0, 5);
      const h = hashGram(stem);
      const idx = h % 96;
      const sign = (h & 0x100) ? 1 : -1;
      vec[idx] += sign * 0.95;
    }

    const padded = '^' + clean + '$';
    for (let len = 3; len <= 5; len++) {
      for (let i = 0; i <= padded.length - len; i++) {
        const gram = padded.slice(i, i + len);
        const h = hashGram(gram);
        const idx = 96 + (h % 224);
        const sign = (h & 0x100) ? 1 : -1;
        const weight = len === 3 ? 0.25 : len === 4 ? 0.32 : 0.22;
        vec[idx] += sign * weight;
      }
    }

    vec[368] = Math.min(clean.length / 60, 1.0);
    for (let i = 0; i < clean.length; i++) {
      const chCode = clean.charCodeAt(i);
      const targetIdx = 369 + (chCode % 15);
      vec[targetIdx] += 0.14 * Math.cos((i + 1) * 0.35);
    }

    let sumSq = 0;
    for (let i = 0; i < DIM; i++) sumSq += vec[i] * vec[i];
    const mag = Math.sqrt(sumSq) || 1e-6;
    for (let i = 0; i < DIM; i++) vec[i] /= mag;
    return vec;
  }

  const flatBuffer = new Float32Array(items.length * DIM);
  const ids = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    ids[i] = String(it.id);
    const vec = embedText(it.text);
    flatBuffer.set(vec, i * DIM);
  }

  self.postMessage(
    { batchId, ids, buffer: flatBuffer.buffer },
    [flatBuffer.buffer]
  );
};
`;

/**
 * Vectorizes a catalog of items in a dedicated Web Worker (using Transferable ArrayBuffer)
 * when running in a browser on large catalogs (>= 250 SKUs), with a seamless synchronous
 * fallback for small catalogs or test environments.
 */
export async function vectorizeCatalogInWorker(
  items: CatalogItem[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, Float32Array>> {
  const result = new Map<string, Float32Array>();
  if (items.length === 0) return result;

  const canUseWorker =
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    items.length >= 250;

  if (!canUseWorker) {
    const CHUNK = 200;
    for (let start = 0; start < items.length; start += CHUNK) {
      const end = Math.min(items.length, start + CHUNK);
      for (let i = start; i < end; i++) {
        const item = items[i];
        result.set(
          String(item.id),
          computeTextEmbedding(
            `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
          )
        );
      }
      onProgress?.(end, items.length);
      if (items.length >= 500 && end < items.length) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return result;
  }

  let workerUrl = '';
  let worker: Worker | null = null;
  try {
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);

    const CHUNK_SIZE = 250;
    let completed = 0;

    for (let start = 0; start < items.length; start += CHUNK_SIZE) {
      const slice = items.slice(start, start + CHUNK_SIZE).map((item) => ({
        id: String(item.id),
        text: `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`,
      }));

      await new Promise<void>((resolve, reject) => {
        if (!worker) {
          reject(new Error('Worker unavailable'));
          return;
        }
        const handleMessage = (e: MessageEvent<{ batchId: number; ids: string[]; buffer: ArrayBuffer }>) => {
          worker?.removeEventListener('message', handleMessage);
          worker?.removeEventListener('error', handleError);
          const { ids, buffer } = e.data;
          const flat = new Float32Array(buffer);
          for (let i = 0; i < ids.length; i++) {
            const sub = flat.slice(i * 384, (i + 1) * 384);
            result.set(ids[i], sub);
          }
          completed += ids.length;
          onProgress?.(completed, items.length);
          resolve();
        };
        const handleError = (err: ErrorEvent) => {
          worker?.removeEventListener('message', handleMessage);
          worker?.removeEventListener('error', handleError);
          reject(err.error || new Error('Worker error'));
        };
        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        worker.postMessage({ items: slice, batchId: start });
      });
    }

    return result;
  } catch {
    // Fallback to main thread computeTextEmbedding if CSP or environment blocks Blob Worker
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      result.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
        )
      );
    }
    onProgress?.(items.length, items.length);
    return result;
  } finally {
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
  }
}
