import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { HNSWConfig, HNSWIndex, HNSWIndexSerializer } from '@eidos/core';

export interface WorkerHnswNodeInput {
  id: string;
  vector: Float32Array | number[];
}

export interface WorkerHnswBuildResult {
  serializedHnsw: Uint8Array;
  sharedBuffer?: SharedArrayBuffer;
  usedWorkerThread: boolean;
  buildDurationMs: number;
  nodeCount: number;
}

const WORKER_SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
const path = require('path');

async function run() {
  const { ids, vectorBuffer, dimension, config, coreDistPath, useSharedOutput } = workerData;
  const core = require(coreDistPath);
  const { HNSWIndex, HNSWIndexSerializer } = core;

  const index = new HNSWIndex(config);
  const flatVectors = new Float32Array(vectorBuffer);

  for (let i = 0; i < ids.length; i++) {
    const start = i * dimension;
    const vec = flatVectors.subarray(start, start + dimension);
    index.insert(ids[i], new Float32Array(vec));
  }

  const serialized = HNSWIndexSerializer.serialize(index);

  if (useSharedOutput && typeof SharedArrayBuffer !== 'undefined') {
    const outSab = new SharedArrayBuffer(serialized.byteLength);
    const outView = new Uint8Array(outSab);
    outView.set(serialized);
    parentPort.postMessage({
      sharedBuffer: outSab,
      byteOffset: 0,
      byteLength: serialized.byteLength,
      nodeCount: index.size(),
    });
    return;
  }

  // O(1) zero-copy ArrayBuffer transfer from worker thread to main thread
  const ab =
    serialized.byteOffset === 0 && serialized.byteLength === serialized.buffer.byteLength
      ? serialized.buffer
      : serialized.slice().buffer;

  parentPort.postMessage(
    {
      transferredBuffer: ab,
      byteOffset: 0,
      byteLength: ab.byteLength,
      nodeCount: index.size(),
    },
    [ab]
  );
}

run().catch((err) => {
  parentPort.postMessage({ error: err && err.message ? err.message : String(err) });
});
`;

function resolveCoreDistIndex(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'packages/core/dist/index.js'),
    path.resolve(__dirname, '../../../../packages/core/dist/index.js'),
    path.resolve(__dirname, '../../../packages/core/dist/index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

/**
 * Offloads HNSW graph construction to a Node.js worker_threads Worker, passing input vectors
 * via SharedArrayBuffer and returning the serialized HNSWIndexSerializer binary buffer in O(1)
 * via zero-copy ArrayBuffer transfer (or SharedArrayBuffer).
 */
export async function buildHnswGraphInWorker(
  nodes: WorkerHnswNodeInput[],
  config?: Partial<HNSWConfig>,
  options?: { useSharedOutput?: boolean }
): Promise<WorkerHnswBuildResult> {
  const t0 = performance.now();
  if (nodes.length === 0) {
    const emptyIdx = new HNSWIndex(config);
    const serialized = HNSWIndexSerializer.serialize(emptyIdx);
    return {
      serializedHnsw: serialized,
      usedWorkerThread: false,
      buildDurationMs: Math.round((performance.now() - t0) * 100) / 100,
      nodeCount: 0,
    };
  }

  const dimension = nodes[0].vector.length || 384;
  const coreDistPath = resolveCoreDistIndex();

  if (!coreDistPath) {
    // Fallback if dist is not built yet
    const index = new HNSWIndex(config);
    for (const n of nodes) {
      const vec = n.vector instanceof Float32Array ? n.vector : new Float32Array(n.vector);
      index.insert(n.id, vec);
    }
    const serialized = HNSWIndexSerializer.serialize(index);
    return {
      serializedHnsw: serialized,
      usedWorkerThread: false,
      buildDurationMs: Math.round((performance.now() - t0) * 100) / 100,
      nodeCount: index.size(),
    };
  }

  // Pack all node vectors into a SharedArrayBuffer (or ArrayBuffer) for zero-copy worker access
  const totalFloats = nodes.length * dimension;
  const byteLen = totalFloats * Float32Array.BYTES_PER_ELEMENT;
  const canUseSab = typeof SharedArrayBuffer !== 'undefined';
  const vectorBuffer = canUseSab ? new SharedArrayBuffer(byteLen) : new ArrayBuffer(byteLen);
  const flatView = new Float32Array(vectorBuffer);
  const ids: string[] = new Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    ids[i] = String(nodes[i].id);
    const v = nodes[i].vector;
    const offset = i * dimension;
    for (let d = 0; d < dimension; d++) {
      flatView[offset + d] = v[d] ?? 0;
    }
  }

  return await new Promise<WorkerHnswBuildResult>((resolve, reject) => {
    const transferList = !canUseSab && vectorBuffer instanceof ArrayBuffer ? [vectorBuffer] : [];
    const worker = new Worker(WORKER_SCRIPT, {
      eval: true,
      workerData: {
        ids,
        vectorBuffer,
        dimension,
        config: config || {},
        coreDistPath,
        useSharedOutput: Boolean(options?.useSharedOutput),
      },
      transferList,
    });

    let settled = false;
    worker.once('message', (msg: {
      error?: string;
      transferredBuffer?: ArrayBuffer;
      sharedBuffer?: SharedArrayBuffer;
      byteOffset?: number;
      byteLength?: number;
      nodeCount?: number;
    }) => {
      if (settled) return;
      settled = true;
      void worker.terminate();

      if (msg.error) {
        reject(new Error(`HNSW Worker failed: ${msg.error}`));
        return;
      }

      if (msg.sharedBuffer) {
        const serializedHnsw = new Uint8Array(
          msg.sharedBuffer,
          msg.byteOffset || 0,
          msg.byteLength || msg.sharedBuffer.byteLength
        );
        resolve({
          serializedHnsw,
          sharedBuffer: msg.sharedBuffer,
          usedWorkerThread: true,
          buildDurationMs: Math.round((performance.now() - t0) * 100) / 100,
          nodeCount: msg.nodeCount ?? nodes.length,
        });
        return;
      }

      if (msg.transferredBuffer) {
        const serializedHnsw = new Uint8Array(
          msg.transferredBuffer,
          msg.byteOffset || 0,
          msg.byteLength || msg.transferredBuffer.byteLength
        );
        resolve({
          serializedHnsw,
          usedWorkerThread: true,
          buildDurationMs: Math.round((performance.now() - t0) * 100) / 100,
          nodeCount: msg.nodeCount ?? nodes.length,
        });
        return;
      }

      reject(new Error('HNSW Worker returned empty payload'));
    });

    worker.once('error', (err) => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(err);
    });

    worker.once('exit', (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`HNSW Worker exited with code ${code}`));
      }
    });
  });
}
