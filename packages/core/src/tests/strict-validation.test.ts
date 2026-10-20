import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalizeVector } from '../cosine';
import { HNSWIndex } from '../hnsw';
import { BM25Index, HybridSearch } from '../search';
import { SMMR } from '../adaptive/smmr';
import { BanditExplorer } from '../adaptive/bandit-explorer';
import { calculateMMRScore } from '../entropy';
import { ScalarQuantizer } from '../quantization';
import { VectorSteering } from '../adaptive/vector-steering';
import { CrossEncoderRanker } from '../adaptive/cross-encoder';
import { MultimodalEmbedder } from '../multimodal';

describe('Phase 1: Strict Mathematical Invariants & RangeError Validation', () => {
  describe('cosineSimilarity & normalizeVector', () => {
    it('throws RangeError when vector dimensions do not match', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0]);
      expect(() => cosineSimilarity(a, b)).toThrowError(RangeError);
    });

    it('throws RangeError on empty vectors', () => {
      expect(() => cosineSimilarity([], [])).toThrowError(RangeError);
      expect(() => normalizeVector(new Float32Array(0))).toThrowError(RangeError);
    });

    it('throws RangeError when vector contains NaN or Infinity', () => {
      const valid = new Float32Array([1, 0, 0]);
      const withNaN = new Float32Array([1, Number.NaN, 0]);
      const withInf = new Float32Array([1, Number.POSITIVE_INFINITY, 0]);

      expect(() => cosineSimilarity(valid, withNaN)).toThrowError(RangeError);
      expect(() => cosineSimilarity(withInf, valid)).toThrowError(RangeError);
      expect(() => normalizeVector(withNaN)).toThrowError(RangeError);
      expect(() => normalizeVector(withInf)).toThrowError(RangeError);
    });
  });

  describe('HNSWIndex strict validation', () => {
    it('throws RangeError on invalid constructor hyperparameters', () => {
      expect(() => new HNSWIndex({ M: 1 })).toThrowError(RangeError);
      expect(() => new HNSWIndex({ M: 16, efConstruction: 8 })).toThrowError(RangeError);
      expect(() => new HNSWIndex({ efSearch: 0 })).toThrowError(RangeError);
      expect(() => new HNSWIndex({ M: Number.NaN })).toThrowError(RangeError);
    });

    it('throws RangeError on inserting empty vector, NaN/Infinity, or mismatched dimension', () => {
      const index = new HNSWIndex({ M: 8, efConstruction: 16, efSearch: 8 });
      expect(() => index.insert('empty', new Float32Array(0))).toThrowError(RangeError);
      expect(() => index.insert('nan', new Float32Array([0.1, Number.NaN, 0.2]))).toThrowError(RangeError);
      expect(() => index.insert('inf', new Float32Array([0.1, Number.NEGATIVE_INFINITY, 0.2]))).toThrowError(RangeError);

      index.insert('v1', new Float32Array([1, 0, 0]));
      expect(() => index.insert('v2_wrong_dim', new Float32Array([1, 0]))).toThrowError(RangeError);
    });

    it('throws RangeError on searching with mismatched dimension, NaN/Infinity, or invalid k', () => {
      const index = new HNSWIndex({ M: 8, efConstruction: 16, efSearch: 8 });
      index.insert('v1', new Float32Array([1, 0, 0]));

      expect(() => index.search(new Float32Array([1, 0]), 5)).toThrowError(RangeError);
      expect(() => index.search(new Float32Array([1, Number.NaN, 0]), 5)).toThrowError(RangeError);
      expect(() => index.search(new Float32Array([1, 0, 0]), 0)).toThrowError(RangeError);
    });
  });

  describe('BM25Index & HybridSearch strict validation', () => {
    it('throws RangeError on invalid BM25 hyperparameters', () => {
      expect(() => new BM25Index(0, 0.75)).toThrowError(RangeError);
      expect(() => new BM25Index(-1, 0.75)).toThrowError(RangeError);
      expect(() => new BM25Index(1.5, -0.1)).toThrowError(RangeError);
      expect(() => new BM25Index(1.5, 1.2)).toThrowError(RangeError);
      expect(() => new BM25Index(Number.NaN, 0.75)).toThrowError(RangeError);
    });

    it('throws RangeError on invalid HybridSearch options or NaN query vector', () => {
      const hnsw = new HNSWIndex();
      const bm25 = new BM25Index();
      hnsw.insert('doc1', new Float32Array([1, 0, 0]));
      bm25.addDocument('doc1', 'test document');

      const hybrid = new HybridSearch(hnsw, bm25);
      expect(() =>
        hybrid.search('test', new Float32Array([1, 0, 0]), { rrfK: 0 })
      ).toThrowError(RangeError);
      expect(() =>
        hybrid.search('test', new Float32Array([1, 0, 0]), { limit: 0 })
      ).toThrowError(RangeError);
      expect(() =>
        hybrid.search('test', new Float32Array([1, 0, 0]), { denseWeight: -1 })
      ).toThrowError(RangeError);
      expect(() =>
        hybrid.search('test', new Float32Array([1, Number.NaN, 0]))
      ).toThrowError(RangeError);
    });
  });

  describe('SMMR & calculateMMRScore strict validation', () => {
    it('throws RangeError on invalid lambda or NaN in calculateMMRScore', () => {
      expect(() => calculateMMRScore(0.8, 0.2, -0.1)).toThrowError(RangeError);
      expect(() => calculateMMRScore(0.8, 0.2, 1.5)).toThrowError(RangeError);
      expect(() => calculateMMRScore(Number.NaN, 0.2, 0.7)).toThrowError(RangeError);
    });

    it('throws RangeError on invalid SMMR config or mismatched candidate embeddings', () => {
      expect(() => new SMMR({ lambda: -0.2 })).toThrowError(RangeError);
      expect(() => new SMMR({ lambda: 1.5 })).toThrowError(RangeError);
      expect(() => new SMMR({ sampleSize: 0 })).toThrowError(RangeError);
      expect(() => new SMMR({ temperature: -1 })).toThrowError(RangeError);

      const smmr = new SMMR({ lambda: 0.5, deterministic: true });
      expect(() =>
        smmr.rerank(
          [
            { id: '1', score: 0.9, embedding: new Float32Array([1, 0, 0]) },
            { id: '2', score: 0.8, embedding: new Float32Array([0, 1]) },
          ],
          2
        )
      ).toThrowError(RangeError);

      expect(() =>
        smmr.rerank(
          [{ id: '1', score: Number.NaN, embedding: new Float32Array([1, 0]) }],
          1
        )
      ).toThrowError(RangeError);
    });
  });

  describe('BanditExplorer strict validation', () => {
    it('throws RangeError on invalid BanditConfig or NaN context/reward', () => {
      expect(() => new BanditExplorer({ featureDimension: 0 })).toThrowError(RangeError);
      expect(() => new BanditExplorer({ alpha: -0.5 })).toThrowError(RangeError);
      expect(() => new BanditExplorer({ lambda: 0 })).toThrowError(RangeError);

      const explorer = new BanditExplorer({ featureDimension: 3 });
      expect(() =>
        explorer.predictArm('arm1', new Float32Array([1, Number.NaN, 0]))
      ).toThrowError(RangeError);
      expect(() =>
        explorer.update('arm1', new Float32Array([1, 0, 0]), Number.NaN)
      ).toThrowError(RangeError);
      expect(() =>
        explorer.update('arm1', new Float32Array([1, 0]), 1.0)
      ).toThrowError(RangeError);
    });
  });

  describe('No silent Math.min(a.length, b.length) across auxiliary modules', () => {
    it('throws RangeError on dimension mismatch in ScalarQuantizer, VectorSteering, CrossEncoder, MultimodalEmbedder', () => {
      const q1 = ScalarQuantizer.quantize(new Float32Array([1, 0, 0]));
      const q2 = ScalarQuantizer.quantize(new Float32Array([1, 0]));
      expect(() => ScalarQuantizer.dotProduct(q1, q2)).toThrowError(RangeError);

      expect(() =>
        VectorSteering.computeDelta(new Float32Array([1, 0, 0]), new Float32Array([1, 0]))
      ).toThrowError(RangeError);

      expect(() =>
        VectorSteering.steer(new Float32Array([1, 0, 0]), [
          { vector: new Float32Array([1, 0]), weight: 0.5, type: 'positive' },
        ])
      ).toThrowError(RangeError);

      const ce = new CrossEncoderRanker();
      expect(() =>
        ce.rank(
          { embedding: new Float32Array([1, 0, 0]) },
          [{ id: 'c1', embedding: new Float32Array([1, 0]), baseScore: 0.5 }]
        )
      ).toThrowError(RangeError);

      expect(() =>
        MultimodalEmbedder.fuseJointEmbedding(new Float32Array([1, 0, 0]), new Float32Array([1, 0]))
      ).toThrowError(RangeError);
    });
  });
});
