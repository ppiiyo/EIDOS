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
    it('evicts the oldest element in FIFO order when window capacity is exceeded', () => {
      const scaler = new StreamingQuantileScaler(3, 0, 100);

      scaler.update(10);
      scaler.update(20);
      scaler.update(30);
      expect(scaler.values).toEqual([10, 20, 30]);
      expect(scaler.getStats().count).toBe(3);
      expect(scaler.getStats().mean).toBeCloseTo(20, 5);

      // Push 4th element -> oldest (10) must be evicted
      scaler.update(40);
      expect(scaler.values).toEqual([20, 30, 40]);
      expect(scaler.getStats().count).toBe(3);
      expect(scaler.getStats().mean).toBeCloseTo(30, 5);

      // Push 5th element -> next oldest (20) must be evicted
      scaler.update(50);
      expect(scaler.values).toEqual([30, 40, 50]);
      expect(scaler.getStats().count).toBe(3);
      expect(scaler.getStats().mean).toBeCloseTo(40, 5);
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
