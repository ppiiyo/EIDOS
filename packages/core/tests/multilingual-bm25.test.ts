import { describe, it, expect } from 'vitest';
import { BM25Index } from '../src/search/bm25';
import { HybridSearch } from '../src/search/hybrid-search';
import { HNSWIndex } from '../src/hnsw';

describe('Universal Multilingual & CJK (Japanese/Chinese/Korean) BM25 + Hybrid Search', () => {
  it('tokenizes Japanese (Kanji, Hiragana, Katakana) into character unigrams and bigrams without spaces', () => {
    const tokens = BM25Index.tokenize('東京夜景とアニメ映画');
    expect(tokens.length).toBeGreaterThan(5);
    expect(tokens).toContain('東');
    expect(tokens).toContain('東京');
    expect(tokens).toContain('アニメ');
  });

  it('retrieves Japanese video hosting items accurately with BM25 and Hybrid RRF', () => {
    const bm25 = new BM25Index();
    bm25.addDocument({
      id: 'jp-v1',
      title: '【4K 60fps】夜の東京・新宿歌舞伎町サイバーパンク散歩 | Shinjuku Night Walk',
      description: '雨上がりの新宿・歌舞伎町のネオン街を4K HDRカメラで歩く没入型アンビエント映像。',
      category: '風景・Vlog (Tokyo Walk)',
      tags: ['東京', '新宿', '夜景', '4K', 'サイバーパンク', '散歩'],
    });
    bm25.addDocument({
      id: 'jp-v2',
      title: '【職人技】銀座の老舗寿司店・大将が握る究極の江戸前寿司15貫 | Omakase Sushi',
      description: '東京・銀座で予約1年待ちの名店。豊洲市場で仕入れた最高級の本マグロ、ウニ、コハダ。',
      category: 'グルメ・料理 (Gourmet)',
      tags: ['寿司', 'グルメ', '東京', '銀座', '職人', '和食'],
    });
    bm25.addDocument({
      id: 'jp-v3',
      title: '新海誠スタイル・アニメーション制作メイキング | 背景美術と光の表現講座',
      description: '日本のアニメーションスタジオによる背景美術（空・雲・夕暮れの光）のデジタル作画メイキング。',
      category: 'アニメ・制作 (Anime & Art)',
      tags: ['アニメ', '作画', 'メイキング', 'イラスト', '背景美術'],
    });

    const sushiHits = bm25.search('寿司 グルメ 職人', 5);
    expect(sushiHits.length).toBeGreaterThan(0);
    expect(sushiHits[0].id).toBe('jp-v2');

    const tokyoNightHits = bm25.search('東京の夜景と散歩', 5);
    expect(tokyoNightHits.length).toBeGreaterThan(0);
    expect(tokyoNightHits[0].id).toBe('jp-v1');

    const animeHits = bm25.search('アニメーション作画メイキング', 5);
    expect(animeHits.length).toBeGreaterThan(0);
    expect(animeHits[0].id).toBe('jp-v3');
  });

  it('supports Chinese, Korean, Russian, and English in a unified HybridSearch (HNSW + BM25)', () => {
    const bm25 = new BM25Index();
    const hnsw = new HNSWIndex(4);

    bm25.addDocument({
      id: 'ru-1',
      title: 'Беспроводные наушники с шумоподавлением ANC',
      description: 'Студийный звук и глубокие басы для музыки и путешествий',
      category: 'Аудио',
      tags: ['наушники', 'музыка', 'anc'],
    });
    bm25.addDocument({
      id: 'zh-1',
      title: '无线降噪耳机 Pro 空间音频',
      description: '高保真音质与主动降噪，适合长途旅行与办公',
      category: '音频设备',
      tags: ['耳机', '降噪', '音乐'],
    });
    bm25.addDocument({
      id: 'ko-1',
      title: '서울 야경 4K 시네마틱 브이로그',
      description: '비 오는 날 서울 강남과 홍대 거리의 네온사인 감성 산책',
      category: '브이로그',
      tags: ['서울', '야경', '브이로그'],
    });

    hnsw.insert('ru-1', new Float32Array([0.9, 0.1, 0.0, 0.0]));
    hnsw.insert('zh-1', new Float32Array([0.85, 0.15, 0.0, 0.0]));
    hnsw.insert('ko-1', new Float32Array([0.0, 0.0, 0.9, 0.1]));

    expect(bm25.search('наушники с шумоподавлением', 3)[0]?.id).toBe('ru-1');
    expect(bm25.search('降噪耳机', 3)[0]?.id).toBe('zh-1');
    expect(bm25.search('서울 야경', 3)[0]?.id).toBe('ko-1');

    const hybrid = new HybridSearch(hnsw, bm25);
    const hybridHits = hybrid.search('降噪耳机', new Float32Array([0.85, 0.15, 0.0, 0.0]), { limit: 3 });
    expect(hybridHits[0].id).toBe('zh-1');
    expect(hybridHits[0].source).toBe('hybrid');
  });
});
