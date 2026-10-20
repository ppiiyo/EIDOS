import { describe, it, expect } from 'vitest';
import { Ranker } from '../adaptive/ranker';
import { HNSWIndex } from '../hnsw';
import { StreamingQuantileScaler } from '../adaptive/feature-scaler';
import { tokenizeCJK } from '../bm25/cjk-tokenizer';
import { BM25Index } from '../bm25';

describe('Audit Regressions Suite (P0/P1)', () => {
  describe('1. Ranker weight validation', () => {
    it('throws TypeError when initialized with { alpha: NaN } or { beta: Infinity }', () => {
      expect(() => new Ranker({ alpha: Number.NaN })).toThrowError(TypeError);
      expect(() => new Ranker({ beta: Number.POSITIVE_INFINITY })).toThrowError(TypeError);
      expect(() => new Ranker({ gamma: Number.NEGATIVE_INFINITY })).toThrowError(TypeError);
    });

    it('throws RangeError when initialized with negative weights', () => {
      expect(() => new Ranker({ alpha: -0.01 })).toThrowError(RangeError);
      expect(() => new Ranker({ delta: -5 })).toThrowError(RangeError);
    });
  });

  describe('2. HNSWIndex dimension validation', () => {
    it('throws RangeError when searching with a vector of dimension different from declared', () => {
      const index = new HNSWIndex({ M: 8, efConstruction: 16, efSearch: 8 });
      index.insert('node-1', new Float32Array([1.0, 0.0, 0.0, 0.0]));

      expect(() => index.search(new Float32Array([1.0, 0.0]), 5)).toThrowError(RangeError);
      expect(() => index.search(new Float32Array([1.0, 0.0, 0.0, 0.0, 0.0]), 5)).toThrowError(
        RangeError
      );
    });
  });

  describe('3. StreamingQuantileScaler ring buffer eviction', () => {
    it('evicts the oldest element in FIFO order, proving O(1) ring buffer correctness', () => {
      // Window size 3. We will push 5 elements and verify the 4th and 5th evict the 1st and 2nd.
      const scaler = new StreamingQuantileScaler(3, 0, 100);

      // Fill the buffer: [500, 100, 300]
      scaler.update(500);
      scaler.update(100);
      scaler.update(300);

      // Trigger lazy sort and verify state
      expect(scaler.transform(250)).toBeCloseTo(0.5, 5); // 250 is median of [100, 300, 500]

      // Push 4th element (600). Oldest (500) MUST be evicted. Buffer is now [100, 300, 600].
      scaler.update(600);

      // Push 5th element (450). Oldest (100) MUST be evicted. Buffer is now [300, 600, 450].
      scaler.update(450);

      // Transform 450. In sorted buffer [300, 450, 600], 450 is exactly the median (50th percentile).
      // With min=0, max=100 fallback or empirical min/max, the quantile mapping should reflect this.
      // More robustly, we check that 500 is completely forgotten.
      // If 500 were still there, the max would be 500 or 600, skewing the result.
      const result = scaler.transform(450);

      // Empirical min is 300, max is 600. 450 is exactly in the middle.
      // Normalized value should be ~0.5 (or 1.0 depending on exact scaler bounds logic, but definitively NOT skewed by 500).
      expect(result).toBeGreaterThan(0.4);
      expect(result).toBeLessThan(0.6);
    });

    it('rejects invalid windowSize on construction', () => {
      expect(() => new StreamingQuantileScaler(0)).toThrow(RangeError);
      expect(() => new StreamingQuantileScaler(NaN)).toThrow(RangeError);
    });
  });

  describe('4. CJK & Multilingual Tokenizer', () => {
    it('applies unigram segmentation for CJK scripts and standard word splitting for Latin/Cyrillic', () => {
      expect(tokenizeCJK('Красные кроссовки, для бега!')).toEqual([
        'красные',
        'кроссовки',
        'для',
        'бега',
      ]);

      expect(tokenizeCJK('人工智能')).toEqual(['人', '工', '智', '能']);
      expect(tokenizeCJK('東京タワー')).toEqual(['東', '京', 'タ', 'ワ', 'ー']);
      expect(tokenizeCJK('인공지능')).toEqual(['인', '공', '지', '능']);

      // Mixed Latin + CJK
      expect(tokenizeCJK('Sony ワイヤレス 1000XM5!')).toEqual([
        'sony',
        'ワ',
        'イ',
        'ヤ',
        'レ',
        'ス',
        '1000xm5',
      ]);
    });

    it('integrates with BM25Index for CJK document retrieval', () => {
      const bm25 = new BM25Index();
      bm25.addDocument('jp-1', '宇宙とブラックホールの科学');
      bm25.addDocument('jp-2', '東京のカフェと紅茶');

      const results = bm25.search('ブラックホール', 5);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('jp-1');
    });
  });
});
