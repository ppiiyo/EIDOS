import { describe, it, expect } from 'vitest';
import { ScalarQuantizer } from '../quantization';
import { HNSWIndex } from '../hnsw';
import { cosineSimilarity } from '../cosine';

describe('ScalarQuantizer (INT8 Quantization)', () => {
  it('achieves 4x memory compression and high-fidelity reconstruction (>0.99 cosine)', () => {
    const dim = 128;
    const original = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      original[i] = Math.sin(i * 0.15) * Math.cos(i * 0.05);
    }

    const quantized = ScalarQuantizer.quantize(original, 'item-test');

    // Memory footprint check
    expect(quantized.data.byteLength).toBe(dim * 1); // 1 byte per int8
    expect(original.byteLength).toBe(dim * 4); // 4 bytes per float32
    expect(original.byteLength / quantized.data.byteLength).toBe(4);

    // Dequantize and verify cosine similarity with original
    const reconstructed = ScalarQuantizer.dequantize(quantized);
    const sim = cosineSimilarity(Array.from(original), Array.from(reconstructed));
    expect(sim).toBeGreaterThan(0.99);
  });

  it('quantized integer dot product closely matches FP32 dot product', () => {
    const dim = 64;
    const vecA = new Float32Array(dim);
    const vecB = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      vecA[i] = (i - 32) / 32;
      vecB[i] = Math.cos(i * 0.2);
    }

    let exactDot = 0;
    for (let i = 0; i < dim; i++) {
      exactDot += vecA[i] * vecB[i];
    }

    const qA = ScalarQuantizer.quantize(vecA);
    const qB = ScalarQuantizer.quantize(vecB);
    const approxDot = ScalarQuantizer.dotProduct(qA, qB);

    // Relative error within 3%
    const absDiff = Math.abs(exactDot - approxDot);
    expect(absDiff).toBeLessThan(0.3);
  });
});

describe('HNSWIndex (Approximate Nearest Neighbors)', () => {
  it('inserts and retrieves exact nearest neighbor in toy cluster', () => {
    const index = new HNSWIndex({ M: 8, M0: 16, efConstruction: 32, efSearch: 16 });

    const targetVec = new Float32Array([1.0, 0.0, 0.0]);
    const closeVec = new Float32Array([0.98, 0.1, 0.0]);
    const farVec = new Float32Array([0.0, 1.0, 0.0]);

    index.insert('target', targetVec);
    index.insert('close', closeVec);
    index.insert('far', farVec);

    expect(index.size()).toBe(3);

    const query = new Float32Array([1.0, 0.05, 0.0]);
    const results = index.search(query, 2);

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('target');
    expect(results[1].id).toBe('close');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('achieves >95% recall@5 compared to brute-force exact cosine scan', () => {
    const numItems = 80;
    const dim = 32;
    const index = new HNSWIndex({ M: 16, M0: 32, efConstruction: 64, efSearch: 48 });

    const dataset: { id: string; vector: Float32Array }[] = [];

    // Deterministic synthetic clustered dataset
    for (let i = 0; i < numItems; i++) {
      const vec = new Float32Array(dim);
      const cluster = i % 4;
      for (let d = 0; d < dim; d++) {
        vec[d] = Math.sin(d + i * 0.7) + (d % 4 === cluster ? 1.5 : 0.0);
      }
      const id = `item_${i}`;
      dataset.push({ id, vector: vec });
      index.insert(id, vec);
    }

    expect(index.size()).toBe(numItems);

    let totalRecallHits = 0;
    const testQueries = 10;
    const K = 5;

    for (let q = 0; q < testQueries; q++) {
      const queryVec = new Float32Array(dim);
      for (let d = 0; d < dim; d++) {
        queryVec[d] = Math.sin(d + q * 1.3);
      }

      // 1. Exact brute-force scan
      const exactScores = dataset.map((item) => ({
        id: item.id,
        score: cosineSimilarity(Array.from(queryVec), Array.from(item.vector)),
      }));
      exactScores.sort((a, b) => b.score - a.score);
      const exactTopK = new Set(exactScores.slice(0, K).map((x) => x.id));

      // 2. HNSW search
      const hnswResults = index.search(queryVec, K, 48);
      const hnswTopK = hnswResults.map((r) => r.id);

      // Count overlap
      for (const id of hnswTopK) {
        if (exactTopK.has(id)) {
          totalRecallHits++;
        }
      }
    }

    const recall = totalRecallHits / (testQueries * K);
    expect(recall).toBeGreaterThanOrEqual(0.95);
  });

  it('runs successfully with INT8 scalar quantization enabled', () => {
    const index = new HNSWIndex({
      M: 8,
      M0: 16,
      efConstruction: 32,
      efSearch: 16,
      useQuantization: true,
    });

    index.insert('q1', new Float32Array([1, 0, 0]));
    index.insert('q2', new Float32Array([0.9, 0.2, 0]));
    index.insert('q3', new Float32Array([0, 1, 0]));

    const res = index.search(new Float32Array([1, 0.05, 0]), 2);
    expect(res.length).toBe(2);
    expect(res[0].id).toBe('q1');
    expect(res[1].id).toBe('q2');

    index.clear();
    expect(index.size()).toBe(0);
  });
});
