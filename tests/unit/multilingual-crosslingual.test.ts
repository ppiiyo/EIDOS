import { describe, it, expect } from 'vitest';
import {
  INITIAL_CATALOG,
  computeTextEmbedding,
  cosineSimilarity,
  detectTextLanguage,
  executeHybridCatalogSearch,
  executeLexicalBm25Search,
  generateSemanticExplanation,
} from '../../apps/workspace/src/utils/recommenderEngine';
import {
  JAPANESE_VIDEO_HOSTING_CATALOG,
  STREAMING_PLATFORM_CATALOG,
  GLOBAL_MULTILINGUAL_CATALOG,
} from '../../apps/workspace/src/data/domainDatabases';
import { ConversationalAgent } from '../../apps/workspace/src/lib/agent/conversational-agent';

function buildEmbeddingsMap(items = INITIAL_CATALOG): Map<string, Float32Array> {
  const map = new Map<string, Float32Array>();
  for (const item of items) {
    map.set(
      String(item.id),
      computeTextEmbedding(
        `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
      )
    );
  }
  return map;
}

describe('Multilingual & Cross-Lingual 384-d Retrieval, CJK BM25 & NLU Verification', () => {
  it('detects RU, EN, JA, ZH, KO, ES, DE, FR scripts accurately via detectTextLanguage', () => {
    expect(detectTextLanguage('релятивистское время и космос')).toBe('ru');
    expect(detectTextLanguage('relativistic time dilation and black holes')).toBe('en');
    expect(detectTextLanguage('宇宙とブラックホールの科学と相対性理論')).toBe('ja');
    expect(detectTextLanguage('星际穿越与黑洞视界：探索宇宙深处的相对论奥秘')).toBe('zh');
    expect(detectTextLanguage('우주와 블랙홀의 과학 다큐멘터리')).toBe('ko');
    expect(detectTextLanguage('El cosmos, agujeros negros y película espacial')).toBe('es');
    expect(detectTextLanguage('Moderne Programmierung und Wissenschaft im Weltraum')).toBe('de');
    expect(detectTextLanguage('Cinéma, musique et programmation dans l’espace')).toBe('fr');
  });

  it('aligns cross-lingual 384-d embeddings across JA, RU, EN, ZH, ES, and DE', () => {
    const ruSpace = computeTextEmbedding('passage: Фильм Интерстеллар о черных дырах и космосе');
    const jaSpace = computeTextEmbedding('query: 宇宙とブラックホールの科学 (JP Query)');
    const enSpace = computeTextEmbedding('query: black holes and relativistic time in space');
    const zhSpace = computeTextEmbedding('query: 探索宇宙深处的黑洞与相对论');
    const ruCoffee = computeTextEmbedding('passage: Кофемашина эспрессо капучино зерновой кофе');

    expect(cosineSimilarity(jaSpace, ruSpace)).toBeGreaterThan(0.45);
    expect(cosineSimilarity(enSpace, ruSpace)).toBeGreaterThan(0.45);
    expect(cosineSimilarity(zhSpace, ruSpace)).toBeGreaterThan(0.45);
    expect(cosineSimilarity(jaSpace, ruSpace)).toBeGreaterThan(cosineSimilarity(jaSpace, ruCoffee) + 0.25);
  });

  it('retrieves Russian cosmic items for Japanese CJK query on Marketplace catalog and English camera query', () => {
    const embeddings = buildEmbeddingsMap(INITIAL_CATALOG);

    // 1. Cross-lingual JP query -> RU Marketplace catalog
    const jpQuery = '宇宙とブラックホールの科学 (JP Query)';
    const jpHits = executeHybridCatalogSearch(
      jpQuery,
      computeTextEmbedding(`query: ${jpQuery}`),
      INITIAL_CATALOG,
      embeddings,
      0.7,
      5
    );
    expect(jpHits.length).toBeGreaterThan(0);
    const topTitles = jpHits.slice(0, 3).map((h) => h.item.title);
    expect(topTitles.some((t) => t.includes('Интерстеллар') || t.includes('Дюна'))).toBe(true);
    expect(jpHits[0].whyRecommended).toMatch(/384次元|ハイブリッド/);

    // 2. Cross-lingual EN query "camera" -> RU Marketplace catalog (matches Смартфон Galaxy Ultra Pro)
    const camHits = executeHybridCatalogSearch(
      'camera',
      computeTextEmbedding('query: camera'),
      INITIAL_CATALOG,
      embeddings,
      0.7,
      5
    );
    expect(camHits.length).toBeGreaterThan(0);
    expect(camHits[0].item.title).toContain('Galaxy Ultra Pro');
  });

  it('retrieves multi-script cosmic and Rust/DB items across GLOBAL_MULTILINGUAL_CATALOG (JA/ZH/EN/RU/ES/DE)', () => {
    const embeddings = buildEmbeddingsMap(GLOBAL_MULTILINGUAL_CATALOG);

    const spaceQuery = '宇宙 ブラックホール space космос 黑洞';
    const spaceHits = executeHybridCatalogSearch(
      spaceQuery,
      computeTextEmbedding(`query: ${spaceQuery}`),
      GLOBAL_MULTILINGUAL_CATALOG,
      embeddings,
      0.7,
      6
    );
    const spaceIds = spaceHits.slice(0, 5).map((h) => String(h.item.id));
    expect(spaceIds).toContain('jp_1');
    expect(spaceIds).toContain('zh_1');
    expect(spaceIds).toContain('str_1');

    const rustQuery = 'Rust database データベース 数据库 программирование';
    const rustHits = executeHybridCatalogSearch(
      rustQuery,
      computeTextEmbedding(`query: ${rustQuery}`),
      GLOBAL_MULTILINGUAL_CATALOG,
      embeddings,
      0.7,
      6
    );
    const rustIds = rustHits.slice(0, 4).map((h) => String(h.item.id));
    expect(rustIds).toContain('jp_5');
    expect(rustIds).toContain('zh_2');
    expect(rustIds).toContain('de_1');
  });

  it('localizes explanations and ConversationalAgent responses across RU, EN, and JA', async () => {
    // 1. Japanese video catalog explanations & agent
    const jpEmbeddings = buildEmbeddingsMap(JAPANESE_VIDEO_HOSTING_CATALOG);
    const jpExp = generateSemanticExplanation(
      JAPANESE_VIDEO_HOSTING_CATALOG[0],
      JAPANESE_VIDEO_HOSTING_CATALOG[1]
    );
    expect(jpExp).toContain('宇宙');

    const jpLexical = executeLexicalBm25Search('ブラックホール 科学', JAPANESE_VIDEO_HOSTING_CATALOG, 3);
    expect(jpLexical.length).toBeGreaterThan(0);
    expect(jpLexical[0].whyRecommended).toContain('BM25 Okapi 語彙一致');

    const jpAgent = new ConversationalAgent(
      JAPANESE_VIDEO_HOSTING_CATALOG,
      jpEmbeddings,
      async (q) => computeTextEmbedding(`query: ${q}`)
    );
    const jpReply = await jpAgent.respond('宇宙とブラックホールの科学動画を探して');
    expect(jpReply.items.length).toBeGreaterThan(0);
    expect(jpReply.text).toContain('アイテムを抽出しました');

    // 2. English streaming catalog agent
    const enEmbeddings = buildEmbeddingsMap(STREAMING_PLATFORM_CATALOG);
    const enAgent = new ConversationalAgent(
      STREAMING_PLATFORM_CATALOG,
      enEmbeddings,
      async (q) => computeTextEmbedding(`query: ${q}`)
    );
    const enReply = await enAgent.respond('recommend sci-fi movies about space and black holes');
    expect(enReply.items.length).toBeGreaterThan(0);
    expect(enReply.text).toContain('Found');
  });
});
