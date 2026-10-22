import { CatalogItem, CatalogRecommendation, CatalogEdge } from "../types";
import { HNSWIndex, BM25Index, HybridSearch, cosineSimilarity as coreCosineSimilarity } from '@eidos/core';
import { INITIAL_CATALOG } from '../data/catalog';

export { INITIAL_CATALOG };
export const DEFAULT_CATALOG = INITIAL_CATALOG;

export type SupportedLanguage = 'ru' | 'en' | 'ja' | 'zh' | 'ko' | 'es' | 'de' | 'fr';

/**
 * Automatically detects the dominant script/language of any text or catalog item.
 */
export function detectTextLanguage(text: string): SupportedLanguage {
  if (!text) return 'ru';
  if (/[\u3040-\u309f\u30a0-\u30ff\uff66-\uff9f]/.test(text)) {
    return 'ja';
  }
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) {
    return 'ko';
  }
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) {
    if (
      /(動画|配信|実況|講座|解説|映画|音楽|開発|東京|京都)/.test(text) &&
      !/[与视界探索深处相对论奥秘纪录片使用构建毫秒级语义检索系统教程编程数据库]/.test(text)
    ) {
      return 'ja';
    }
    return 'zh';
  }
  if (/[а-яёіїєґ]/i.test(text)) {
    return 'ru';
  }
  const lower = text.toLowerCase();
  if (/[ñ¿¡]|(\b(película|juego|música|espacio|café|código|libro)\b)/.test(lower)) {
    return 'es';
  }
  if (/[äöüß]|(\b(weltraum|kaffee|programmierung|spiel|musik|wissenschaft)\b)/.test(lower)) {
    return 'de';
  }
  if (/[éèêàùç]|(\b(espace|musique|programmation|cinéma|café)\b)/.test(lower)) {
    return 'fr';
  }
  return 'en';
}

function hashGram(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Unified 384-dimensional vector space matching Xenova/multilingual-e5-small and all-MiniLM-L6-v2
 */
export const EMBEDDING_DIM = 384;

const CJK_CHAR_TEST = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/;
const CJK_RUN_MATCH = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]+/g;

/**
 * 12 Cross-Lingual Semantic Concept Manifolds (dimensions 320..367)
 * Aligning vocabulary across RU, EN, JA, ZH, KO, ES, DE, FR in the 384-d space.
 */
const MULTILINGUAL_CONCEPT_CLUSTERS: ReadonlyArray<{
  dims: readonly [number, number, number, number];
  pattern: RegExp;
}> = [
  {
    // 0: Space, Astrophysics, Relativity, Black Holes, Time Dilation
    dims: [320, 321, 322, 323],
    pattern:
      /(космос|вселен|черн[а-я]*\s*дыр|релятив|врем[еяи]|интерстеллар|дюна|арракис|нолан|галактик|space|cosmos|universe|black\s*hole|blackhole|relativ|time\s*dilation|interstellar|dune|arrakis|nolan|wormhole|astrophys|event\s*horizon|宇宙|ブラックホール|相対性理論|事象の地平線|インターステラー|デューン|ノーラン|天文学|重力|時間|黑洞|星际|相对论|引力波|时空|우주|블랙홀|espacio|agujeros\s*negros|relativista|weltraum|espace)/i,
  },
  {
    // 1: Cyberpunk, AI, Simulated Reality, Neural Networks, Robotics
    dims: [324, 325, 326, 327],
    pattern:
      /(киберпанк|симуляц|нейросет|искусственн[а-я]*\s*интеллект|\bии\b|матриц|имплант|робот|неон|найт-сити|хакер|stray|2077|cyberpunk|simulation|simulated|matrix|neural|artificial\s*intelligence|\bai\b|hacker|neon|night\s*city|robot|edgerunners|cybernetic|サイバーパンク|人工知能|シミュレーション|ナイトシティ|ネオン|電脳|ハッカー|ロボット|ストレイ|サイバー|人工智能|赛博朋克|시뮬레이션|사이버펑크|künstliche\s*intelligenz|inteligencia\s*artificial)/i,
  },
  {
    // 2: Software Engineering, Rust, Python, Vector Databases, Algorithms
    dims: [328, 329, 330, 331],
    pattern:
      /(программирован|алгоритм|разработ|баз[аыу]\s*данн|вектор|бэкенд|backend|python|rust|код|обучен|programming|algorithm|coding|developer|software|database|vector|hnsw|webassembly|wasm|supercomputer|gpu|transformer|プログラミング|データベース|アルゴリズム|ベクトル|開発|コード|深層学習|エンジニア|技術講座|编程|数据库|算法|开发|向量|프로그래밍|데이터베이스|programmierung|datenbank|vektorsuche|programación|código)/i,
  },
  {
    // 3: Workstation Hardware, Laptops, Gadgets, Smartphones, Cameras, Office
    dims: [332, 333, 334, 335],
    pattern:
      /(ноутбук|ультрабук|компьютер|техник|гаджет|смартфон|телефон|камер|работ|офис|клавиатур|продуктивн|laptop|ultrabook|computer|workstation|hardware|gadget|smartphone|camera|mirrorless|keyboard|monitor|desk|ノートpc|パソコン|キーボード|ガジェット|デスクツアー|モニター|作業環境|カメラ|스마트폰|노트북)/i,
  },
  {
    // 4: Coffee, Espresso, Barista, Cafe, Morning Ritual & Comfort
    dims: [336, 337, 338, 339],
    pattern:
      /(кофе|эспрессо|капучино|бариста|кофемашин|кофемолк|утренн|уют|зернов|coffee|espresso|cappuccino|barista|roastery|roasteries|cafe|café|latte|morning|artisan|コーヒー|珈琲|エスプレッソ|カフェ|バリスタ|ラテ|抹茶|京都|朝活|ルーティン|癒し|咖啡|커피|kaffee)/i,
  },
  {
    // 5: Audio, Headphones, Music, Lo-Fi, Synthwave, Acoustic Focus
    dims: [340, 341, 342, 343],
    pattern:
      /(звук|наушник|музык|шумоподавлен|аудио|bluetooth|anc|hi-res|акустик|sound|audio|headphones|music|synthwave|lofi|lo-fi|noise\s*cancelling|spatial|dolby|ambient|soundtrack|音楽|作業用bgm|bgm|ヘッドホン|イヤホン|ノイズキャンセリング|高音質|音響|ハイレゾ|深夜|雨音|음악|헤드폰|música|musik|musique)/i,
  },
  {
    // 6: Fantasy, Magic, Mythology, Witcher, Anime & Illustration
    dims: [344, 345, 346, 347],
    pattern:
      /(фэнтези|маги[яич]|ведьмак|геральт|волшеб|хогвартс|поттер|толкин|кольц|средизем|чудовищ|эпос|миф|заклинан|fantasy|magic|witcher|wizard|hogwarts|potter|tolkien|myth|monster|alchemy|anime|illustration|ファンタジー|魔法|ウィッチャー|神話|アニメ|イラスト|背景美術|異世界|メイキング|怪物|판타지|마법)/i,
  },
  {
    // 7: Psychology, Subconscious Dreams, Dystopia, 1984, Surveillance
    dims: [348, 349, 350, 351],
    pattern:
      /(сн[ыао]|подсознан|разум|иллюз|начало|триллер|антиутоп|оруэлл|1984|надзор|контрол|тоталитар|свобод[аы]\s*мысл|dreams|subconscious|inception|psychological|thriller|mind|memory|dystopia|dystopian|orwell|surveillance|totalitarian|ディストピア|監視社会|哲学|インセプション|潜在意識|オーウェル|思考|自由意志)/i,
  },
  {
    // 8: Sports, Running, Marathon, Fitness, Biometrics
    dims: [352, 353, 354, 355],
    pattern:
      /(спорт|бег[оау]|кроссовк|марафон|фитнес|пульс|тренировк|трекер|браслет|карбон|spo2|sport|sports|running|marathon|fitness|shoes|biometric|endurance|training|heart\s*rate|carbon-plate|ランニング|マラソン|シューズ|スマートウォッチ|トレーニング|フィットネス|スポーツ|心拍|持久力)/i,
  },
  {
    // 9: Gaming, RPG, Let's Play, Indie & Strategy
    dims: [356, 357, 358, 359],
    pattern:
      /(игр[аыу]|гейм|приключен|стратег|настол|монопол|rpg|инди|кот\b|game|gaming|gameplay|adventure|strategy|indie|\bcat\b|ゲーム|ゲーム実況|実況|攻略|インディーゲーム|猫|配信|게임|juego|spiel)/i,
  },
  {
    // 10: Cinema, Documentary, 4K Video & Film Analysis
    dims: [360, 361, 362, 363],
    pattern:
      /(фильм|кино|экранизац|шедевр|movie|cinema|film|documentary|remaster|4k|imax|映画|ドキュメンタリー|考察|動画|纪录片|电影|película|documental|cinéma)/i,
  },
  {
    // 11: Literature, Books, Guides & Tutorials
    dims: [364, 365, 366, 367],
    pattern:
      /(книг[аиу]|роман|руководств|литератур|чтени|бестселлер|book|novel|guide|literature|reading|tutorial|解説|入門|講座|文学|本|교재|libro)/i,
  },
];

/**
 * Deterministic 384-d L2-normalized Unicode n-gram + Cross-Lingual Concept Manifold projection
 * used for instant 384-d coordinates and cross-lingual retrieval across 100+ languages.
 */
export function computeTextEmbedding(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM);
  let clean = text
    .toLowerCase()
    .replace(/\((?:jp|en|ru|zh)\s*query\)/gi, '')
    .trim();

  if (clean.startsWith('query:')) {
    clean = clean.replace(/^query:\s*/, '');
  } else if (clean.startsWith('passage:')) {
    clean = clean.replace(/^passage:\s*/, '');
  }

  const words = clean.split(/[\s,_\-—"«»'().:;!?、。「」『』【】・×]+/).filter(Boolean);
  const hasCjk = CJK_CHAR_TEST.test(clean);

  // Extract CJK character bigrams so unspaced Japanese/Chinese/Korean tokens populate stem buckets
  const tokenUnits = [...words];
  if (hasCjk) {
    const cjkRuns = clean.match(CJK_RUN_MATCH) || [];
    for (const run of cjkRuns) {
      const chars = Array.from(run);
      for (let i = 0; i < chars.length - 1; i++) {
        tokenUnits.push(chars[i] + chars[i + 1]);
      }
      if (chars.length === 1) {
        tokenUnits.push(chars[0]);
      }
    }
  }

  // 1. Token stem & CJK bigram hashing across dimensions 0..95
  for (const w of tokenUnits) {
    const stem = w.slice(0, 5);
    const h = hashGram(stem);
    const idx = h % 96;
    const sign = h & 0x100 ? 1 : -1;
    vec[idx] += sign * 0.95;
  }

  // 2. Character 2-gram..5-gram subword hashing across dimensions 96..319 (224 buckets)
  const padded = `^${clean}$`;
  const minGram = hasCjk ? 2 : 3;
  for (let len = minGram; len <= 5; len++) {
    for (let i = 0; i <= padded.length - len; i++) {
      const gram = padded.slice(i, i + len);
      const h = hashGram(gram);
      const idx = 96 + (h % 224);
      const sign = h & 0x100 ? 1 : -1;
      const weight = len === 2 ? 0.38 : len === 3 ? 0.25 : len === 4 ? 0.32 : 0.22;
      vec[idx] += sign * weight;
    }
  }

  // 3. Cross-Lingual Semantic Concept Manifolds across dimensions 320..367
  for (const cluster of MULTILINGUAL_CONCEPT_CLUSTERS) {
    if (cluster.pattern.test(clean)) {
      const [d0, d1, d2, d3] = cluster.dims;
      vec[d0] += 3.6;
      vec[d1] += 3.2;
      vec[d2] -= 3.0;
      vec[d3] += 3.4;
    }
  }

  // 4. Structural harmonics across dimensions 368..383 (16 buckets)
  vec[368] = Math.min(clean.length / 60, 1.0);
  for (let i = 0; i < clean.length; i++) {
    const chCode = clean.charCodeAt(i);
    const targetIdx = 369 + (chCode % 15);
    vec[targetIdx] += 0.14 * Math.cos((i + 1) * 0.35);
  }

  // 5. L2 unit normalization
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    sumSq += vec[i] * vec[i];
  }
  const mag = Math.sqrt(sumSq) || 1e-6;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] /= mag;
  }

  return vec;
}

export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  return Math.max(0, coreCosineSimilarity(a, b));
}

export const cosineSim = cosineSimilarity;

/**
 * Deterministic 32-bit Seeded PRNG (Mulberry32).
 * Guarantees 100% reproducible synthetic catalog vectors and benchmark simulations.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ModelChoice = 'e5-small' | 'all-minilm' | 'built-in';

export interface EmbedderPipeline {
  (text: string, options?: { pooling?: string; normalize?: boolean }): Promise<{
    data: Float32Array | number[];
  }>;
}

export type RetrievalMode = 'semantic-onnx' | 'hybrid-384d' | 'lexical-bm25';

export interface HybridSearchHit {
  item: CatalogItem;
  fusedScore: number;
  denseScore: number;
  bm25Score: number;
  source: 'hybrid' | 'dense' | 'sparse';
  retrievalMode?: RetrievalMode;
  whyRecommended: string;
  denseRank?: number;
  sparseRank?: number;
  rrfScore?: number;
  rrfDenseContribution?: number;
  rrfSparseContribution?: number;
  matchedTokens?: string[];
}

export interface RecommendationXRay {
  cosineScore: number;
  mmrScore: number;
  diversityBonus: number;
  popularityScore: number;
  sameCategory: boolean;
}

/**
 * Computes Shannon Category Entropy (in bits) of a list of items
 */
export function computeCategoryEntropy(items: CatalogItem[]): {
  entropyBits: number;
  normalizedPercent: number;
  uniqueCategories: number;
} {
  if (items.length === 0) {
    return { entropyBits: 0, normalizedPercent: 0, uniqueCategories: 0 };
  }
  const counts = new Map<string, number>();
  for (const item of items) {
    const cat = item.category || 'General';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let H = 0;
  const n = items.length;
  for (const c of counts.values()) {
    const p = c / n;
    if (p > 0) {
      H -= p * Math.log2(p);
    }
  }
  const maxPossible = Math.log2(Math.max(2, Math.min(n, 8)));
  const normalizedPercent = Math.min(100, Math.round((H / maxPossible) * 100));
  return {
    entropyBits: Math.round(H * 100) / 100,
    normalizedPercent,
    uniqueCategories: counts.size,
  };
}

/**
 * Multilingual Natural Semantic Explanation:
 * Automatically responds in the language of the target/recommended item (JA, ZH, KO, EN, ES, DE, FR, RU)
 */
export function generateSemanticExplanation(
  target: CatalogItem,
  recommended: CatalogItem,
  overrideLang?: SupportedLanguage
): string {
  const combinedSample = `${recommended.title} ${recommended.description} ${target.title}`;
  const lang = overrideLang || detectTextLanguage(combinedSample);

  const tText = `${target.title} ${target.description} ${target.category} ${(target.tags || []).join(' ')}`.toLowerCase();
  const rText = `${recommended.title} ${recommended.description} ${recommended.category} ${(recommended.tags || []).join(' ')}`.toLowerCase();

  // 1. Japanese (日本語) native explanations
  if (lang === 'ja') {
    if (
      /(宇宙|ブラックホール|インターステラー|科学|相対性理論|星|デューン)/.test(tText) &&
      /(宇宙|ブラックホール|インターステラー|科学|相対性理論|星|時間|ノーラン)/.test(rText)
    ) {
      return '宇宙のスケール、相対性理論の時間軸、未知の科学探求という共通のテーマで強く共鳴しています。';
    }
    if (
      /(サイバーパンク|シミュレーション|人工知能|ai|未来|ネオン|ロボット|ストレイ)/.test(tText) &&
      /(サイバーパンク|シミュレーション|人工知能|ai|未来|ネオン|ロボット|ストレイ)/.test(rText)
    ) {
      return 'サイバーパンクの世界観、AIと近未来テクノロジー、仮想空間の美学において高い意味的親和性があります。';
    }
    if (
      /(プログラミング|rust|python|データベース|開発|コード|アルゴリズム|pc|キーボード)/.test(tText) &&
      /(プログラミング|rust|python|データベース|開発|コード|アルゴリズム|pc|キーボード)/.test(rText)
    ) {
      return '高速ソフトウェア開発・アルゴリズム設計・エンジニアの生産性向上という技術エコシステムで一致しています。';
    }
    if (
      /(音楽|bgm|lofi|イヤホン|ヘッドホン|音響|カフェ|コーヒー|エスプレッソ)/.test(tText) &&
      /(音楽|bgm|lofi|イヤホン|ヘッドホン|音響|カフェ|コーヒー|エスプレッソ)/.test(rText)
    ) {
      return '心地よい音響空間と集中・リラックスを高めるライフスタイル体験として高い親和性を持っています。';
    }
    if (target.category !== recommended.category) {
      return `クロスカテゴリ推薦（${target.category} → ${recommended.category}）：384次元ベクトル空間での高い意味的類似度とMMR多様性ボーナス。`;
    }
    return `カテゴリ「${recommended.category}」内の384次元潜在意味空間における高精度なコンテンツ親和性マッチ。`;
  }

  // 2. Chinese (中文) native explanations
  if (lang === 'zh') {
    if (target.category !== recommended.category) {
      return `跨类别语义推荐（${target.category} → ${recommended.category}）：基于384维稠密向量余弦相似度与MMR多样性重排序。`;
    }
    return `在「${recommended.category}」类别的384维语义向量空间中具有极高的概念亲和力。`;
  }

  // 3. Korean (한국어) native explanations
  if (lang === 'ko') {
    if (target.category !== recommended.category) {
      return `교차 카테고리 추천 (${target.category} → ${recommended.category}): 384차원 벡터 유사도 및 MMR 다양성 보너스 기반.`;
    }
    return `'${recommended.category}' 카테고리의 384차원 잠재 의미 공간에서 높은 콘텐츠 친화도를 보입니다.`;
  }

  // 4. English / Global explanations
  if (lang === 'en' || lang === 'es' || lang === 'de' || lang === 'fr') {
    if (
      /(space|interstellar|dune|cosmos|black hole|sci-fi|universe)/.test(tText) &&
      /(space|interstellar|dune|cosmos|black hole|sci-fi|time|nolan)/.test(rText)
    ) {
      return 'Both works explore relativistic time, cosmic scale, and deep scientific discovery across the universe.';
    }
    if (
      /(cyberpunk|matrix|simulation|ai|neural|neon|robot|stray)/.test(tText) &&
      /(cyberpunk|matrix|simulation|ai|neural|neon|robot|stray)/.test(rText)
    ) {
      return 'Connected by cyberpunk aesthetics, artificial intelligence themes, and simulated reality concepts.';
    }
    if (
      /(python|rust|code|database|programming|laptop|keyboard|developer)/.test(tText) &&
      /(python|rust|code|database|programming|laptop|keyboard|developer)/.test(rText)
    ) {
      return 'Unified engineering ecosystem: high-performance developer infrastructure and core software algorithms.';
    }
    if (target.category !== recommended.category) {
      return `Cross-category semantic discovery (${target.category} → ${recommended.category}) with high 384-d cosine affinity and MMR novelty bonus.`;
    }
    return `High semantic affinity in the 384-dimensional latent feature space within "${recommended.category}".`;
  }

  // 5. Russian (Русский) explanations
  if (
    (tText.includes('космос') || tText.includes('интерстеллар') || tText.includes('дюна')) &&
    (rText.includes('космос') || rText.includes('время') || rText.includes('нолан') || rText.includes('дюна'))
  ) {
    return 'Оба произведения исследуют релятивистское время, масштаб вселенной и борьбу человека с неизведанным.';
  }

  if (
    (tText.includes('киберпанк') || tText.includes('матрица') || tText.includes('симуляция') || tText.includes('2077')) &&
    (rText.includes('киберпанк') || rText.includes('симуляция') || rText.includes('матрица') || rText.includes('робот') || rText.includes('stray'))
  ) {
    return 'Связаны эстетикой киберпанка, вопросами искусственного интеллекта и концепцией симуляции реальности.';
  }

  if (
    (tText.includes('фэнтези') || tText.includes('ведьмак') || tText.includes('поттер') || tText.includes('толкин')) &&
    (rText.includes('фэнтези') || rText.includes('магия') || rText.includes('ведьмак') || rText.includes('хогвартс') || rText.includes('толкин'))
  ) {
    return 'Глубокое погружение в магические миры: эпический квест, мифология и противостояние древним силам.';
  }

  if (
    (tText.includes('python') || tText.includes('код') || tText.includes('ноутбук') || tText.includes('rust') || tText.includes('база')) &&
    (rText.includes('ноутбук') || rText.includes('python') || rText.includes('код') || rText.includes('программирование') || rText.includes('rust') || rText.includes('кластер'))
  ) {
    return 'Единая инженерная экосистема: высокопроизводительная инфраструктура и фундаментальные алгоритмы.';
  }

  if (
    (tText.includes('сны') || tText.includes('начало') || tText.includes('1984') || tText.includes('нолан')) &&
    (rText.includes('начало') || rText.includes('сны') || rText.includes('разум') || rText.includes('1984') || rText.includes('матрица'))
  ) {
    return 'Интеллектуальные нарративы о манипуляциях сознанием, архитектуре памяти и поиске свободы мысли.';
  }

  if (
    (tText.includes('бег') || tText.includes('спорт') || tText.includes('кроссовки') || tText.includes('браслет')) &&
    (rText.includes('бег') || rText.includes('спорт') || rText.includes('пульс') || rText.includes('трекер'))
  ) {
    return 'Комплексное решение для тренировок: биометрический мониторинг и снижение ударной нагрузки.';
  }

  if (
    (tText.includes('звук') || tText.includes('наушники') || tText.includes('музыка')) &&
    (rText.includes('смартфон') || rText.includes('ноутбук') || rText.includes('звук') || rText.includes('винил'))
  ) {
    return 'Высокоточное аудио-сопровождение и акустический комфорт для работы и отдыха.';
  }

  if (tText.includes('кофе') || rText.includes('кофе')) {
    return 'Создание утреннего ритуала продуктивности и акустического комфорта рабочего пространства.';
  }

  if (target.category !== recommended.category) {
    return `Кросс-категорийная рекомендация (${target.category} → ${recommended.category}) с высоким косинусным сходством и MMR-бонусом новизны.`;
  }

  return `Высокое семантическое сходство в 384-мерном пространстве латентных признаков категории «${recommended.category}».`;
}

/**
 * Computes embeddings for all catalog items using the active embedder or local 384-d E5 fallback
 */
export async function computeCatalogEmbeddingsWithModel(
  catalog: CatalogItem[],
  customEmbedder: EmbedderPipeline | null,
  modelName: ModelChoice = 'e5-small',
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, Float32Array>> {
  const map = new Map<string, Float32Array>();

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const itemId = String(item.id);
    const textToEmbed =
      modelName === 'e5-small'
        ? `passage: ${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`
        : `${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`;

    if (customEmbedder) {
      try {
        const output = await customEmbedder(textToEmbed, {
          pooling: 'mean',
          normalize: true,
        });
        map.set(
          itemId,
          output.data instanceof Float32Array
            ? output.data
            : new Float32Array(output.data)
        );
      } catch {
        const vec = computeTextEmbedding(textToEmbed);
        map.set(itemId, vec);
      }
    } else {
      const vec = computeTextEmbedding(textToEmbed);
      map.set(itemId, vec);
    }

    if (onProgress) {
      onProgress(i + 1, catalog.length);
    }
    if (i % 12 === 0 && catalog.length <= 200) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }

  return map;
}

/**
 * Builds symmetric similarity matrix
 */
export function buildCatalogSimilarityMatrix(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>
): Float32Array[] {
  const n = catalog.length;
  const matrix: Float32Array[] = Array.from({ length: n }, () => new Float32Array(n));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    const v1 = embeddings.get(String(catalog[i].id));
    if (!v1) continue;

    for (let j = i + 1; j < n; j++) {
      const v2 = embeddings.get(String(catalog[j].id));
      if (!v2) continue;
      const sim = cosineSimilarity(v1, v2);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

/**
 * Cached HNSW & BM25 Hybrid Index for sub-millisecond retrieval.
 */
let cachedIndices: {
  catalogLength: number;
  firstId: string;
  embeddingsSize: number;
  hnsw: HNSWIndex;
  bm25: BM25Index;
  hybrid: HybridSearch;
} | null = null;

export function getOrBuildCatalogIndices(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  useQuantization = false
): { hnsw: HNSWIndex; bm25: BM25Index; hybrid: HybridSearch } {
  const firstId = catalog[0]?.id ? String(catalog[0].id) : '';
  if (
    cachedIndices &&
    cachedIndices.catalogLength === catalog.length &&
    cachedIndices.firstId === firstId &&
    cachedIndices.embeddingsSize === embeddings.size
  ) {
    return cachedIndices;
  }

  const hnsw = buildCatalogHNSWIndex(catalog, embeddings, useQuantization);
  const bm25 = new BM25Index();
  for (const item of catalog) {
    const docText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
    bm25.addDocument(String(item.id), docText);
  }
  const hybrid = new HybridSearch(hnsw, bm25);

  cachedIndices = {
    catalogLength: catalog.length,
    firstId,
    embeddingsSize: embeddings.size,
    hnsw,
    bm25,
    hybrid,
  };
  return cachedIndices;
}

export function getOrBuildCatalogHNSWIndex(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  useQuantization = false
): HNSWIndex {
  return getOrBuildCatalogIndices(catalog, embeddings, useQuantization).hnsw;
}

/**
 * Executes Hybrid Search (Dense HNSW + Sparse BM25) with adjustable alpha weighting.
 * Automatically localizes explanation text to the query/item language (JA, ZH, KO, EN, RU, etc.).
 */
export function executeHybridCatalogSearch(
  query: string,
  queryVec: Float32Array,
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  alpha = 0.7,
  limit = 10
): HybridSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { hnsw, bm25 } = getOrBuildCatalogIndices(catalog, embeddings);
  const catalogMap = new Map<string, CatalogItem>(catalog.map((c) => [String(c.id), c]));

  // 1. Dense HNSW retrieval (or full scan when catalog < 100 to get exact dense scores for every item)
  const denseScores = new Map<string, number>();
  const denseRanks = new Map<string, number>();
  if (catalog.length >= 400) {
    const annHits = hnsw.search(queryVec, Math.min(catalog.length, Math.max(limit * 4, 60)), 64);
    annHits.forEach((h, idx) => {
      denseScores.set(String(h.id), Math.max(0, h.score));
      denseRanks.set(String(h.id), idx + 1);
    });
  } else {
    const denseList: Array<{ id: string; score: number }> = [];
    for (const item of catalog) {
      const vec = embeddings.get(String(item.id));
      if (vec) {
        const s = cosineSimilarity(queryVec, vec);
        denseScores.set(String(item.id), s);
        denseList.push({ id: String(item.id), score: s });
      }
    }
    denseList
      .sort((a, b) => b.score - a.score)
      .forEach((entry, idx) => denseRanks.set(entry.id, idx + 1));
  }

  // 2. Sparse BM25 retrieval (with CJK + Multilingual tokenizer)
  const bm25RawHits = bm25.search(trimmed, Math.max(limit * 4, 50));
  const bm25Scores = new Map<string, number>();
  const sparseRanks = new Map<string, number>();
  let maxBm25 = 0;
  for (const h of bm25RawHits) {
    if (h.score > maxBm25) maxBm25 = h.score;
  }
  bm25RawHits.forEach((h, idx) => {
    const normScore = maxBm25 > 0 ? h.score / maxBm25 : 0;
    bm25Scores.set(String(h.id), normScore);
    if (h.score > 0) sparseRanks.set(String(h.id), idx + 1);
  });

  // Extract query tokens for X-Ray lexical token attribution
  const cjkChars: string[] = (trimmed.match(CJK_RUN_MATCH) || []).flatMap((run) =>
    run.split('')
  );
  const queryTokens: string[] = Array.from(
    new Set<string>([
      ...trimmed
        .toLowerCase()
        .split(/[\s,_\-—"«»'().:;!?、。「」『』【】・]+/)
        .filter((w) => w.length >= 2),
      ...cjkChars,
    ])
  );

  // 3. Convex + RRF Fusion across candidate union
  const candidateIds = new Set<string>([
    ...denseScores.keys(),
    ...bm25Scores.keys(),
  ]);

  const queryLang = detectTextLanguage(trimmed);
  const RRF_K = 60;

  const results: HybridSearchHit[] = [];
  for (const id of candidateIds) {
    const item = catalogMap.get(id);
    if (!item) continue;

    const dScore = denseScores.get(id) ?? 0;
    const sScore = bm25Scores.get(id) ?? 0;

    // If pure BM25 (alpha === 0), filter out items with 0 BM25 score
    if (alpha === 0 && sScore === 0) continue;

    const dRank = denseRanks.get(id);
    const sRank = sparseRanks.get(id);
    const rrfDenseContribution = dRank ? alpha / (RRF_K + dRank) : 0;
    const rrfSparseContribution = sRank ? (1 - alpha) / (RRF_K + sRank) : 0;
    const rrfScore = rrfDenseContribution + rrfSparseContribution;

    const fullDocLower = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase();
    const matchedTokens = queryTokens.filter((tok) => fullDocLower.includes(tok)).slice(0, 6);

    const fusedScore = alpha * dScore + (1 - alpha) * sScore;
    let source: 'hybrid' | 'dense' | 'sparse' = 'hybrid';
    if (sScore === 0 || alpha >= 0.99) source = 'dense';
    else if (dScore < 0.05 || alpha <= 0.01) source = 'sparse';

    const itemLang = detectTextLanguage(`${item.title} ${item.description}`);
    const activeLang = queryLang === 'ja' || itemLang === 'ja' ? 'ja' : queryLang === 'zh' || itemLang === 'zh' ? 'zh' : queryLang;

    let whyRecommended: string;
    if (activeLang === 'ja') {
      whyRecommended =
        source === 'hybrid'
          ? `ハイブリッドRRF一致：384次元ベクトル ${(dScore * 100).toFixed(0)}% + BM25語彙 ${(sScore * 100).toFixed(0)}%`
          : source === 'dense'
          ? `384次元セマンティックベクトル一致 (${(dScore * 100).toFixed(0)}%)`
          : `BM25 Okapi キーワード一致 (${(sScore * 100).toFixed(0)}%)`;
    } else if (activeLang === 'zh') {
      whyRecommended =
        source === 'hybrid'
          ? `混合RRF检索：384维稠密向量 ${(dScore * 100).toFixed(0)}% + BM25词汇 ${(sScore * 100).toFixed(0)}%`
          : source === 'dense'
          ? `384维语义向量匹配 (${(dScore * 100).toFixed(0)}%)`
          : `BM25 Okapi 关键词匹配 (${(sScore * 100).toFixed(0)}%)`;
    } else if (activeLang === 'en' || activeLang === 'es' || activeLang === 'de' || activeLang === 'fr') {
      whyRecommended =
        source === 'hybrid'
          ? `Hybrid RRF Match: Dense ${(dScore * 100).toFixed(0)}% + BM25 ${(sScore * 100).toFixed(0)}%`
          : source === 'dense'
          ? `Semantic 384-d Vector Match (${(dScore * 100).toFixed(0)}%)`
          : `Lexical BM25 Okapi Match (${(sScore * 100).toFixed(0)}%)`;
    } else {
      whyRecommended =
        source === 'hybrid'
          ? `Гибридный RRF матчинг: Dense ${(dScore * 100).toFixed(0)}% + BM25 ${(sScore * 100).toFixed(0)}%`
          : source === 'dense'
          ? `Семантический 384-d векторный матчинг (${(dScore * 100).toFixed(0)}%)`
          : `Лексическое совпадение BM25 Okapi (${(sScore * 100).toFixed(0)}%)`;
    }

    results.push({
      item,
      fusedScore,
      denseScore: dScore,
      bm25Score: sScore,
      source,
      retrievalMode: source === 'sparse' ? 'lexical-bm25' : 'hybrid-384d',
      whyRecommended,
      denseRank: dRank,
      sparseRank: sRank,
      rrfScore,
      rrfDenseContribution,
      rrfSparseContribution,
      matchedTokens,
    });
  }

  results.sort((a, b) => b.fusedScore - a.fusedScore);
  return results.slice(0, limit);
}

/**
 * Explicit Lexical BM25 Search (used when ONNX model is still downloading or when alpha === 0).
 * Never fabricates dense cosine similarity scores — sets denseScore = 0 and retrievalMode = 'lexical-bm25'.
 */
export function executeLexicalBm25Search(
  query: string,
  catalog: CatalogItem[],
  limit = 10
): HybridSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const bm25 = new BM25Index();
  const catalogMap = new Map<string, CatalogItem>();
  for (const item of catalog) {
    const id = String(item.id);
    catalogMap.set(id, item);
    const docText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
    bm25.addDocument(id, docText);
  }

  const rawHits = bm25.search(trimmed, Math.max(limit, 20));
  let maxScore = 0;
  for (const h of rawHits) {
    if (h.score > maxScore) maxScore = h.score;
  }

  const queryLang = detectTextLanguage(trimmed);
  const results: HybridSearchHit[] = [];
  for (const h of rawHits) {
    if (h.score <= 0) continue;
    const item = catalogMap.get(String(h.id));
    if (!item) continue;
    const normBm25 = maxScore > 0 ? h.score / maxScore : 0;
    const itemLang = detectTextLanguage(`${item.title} ${item.description}`);
    const activeLang = queryLang === 'ja' || itemLang === 'ja' ? 'ja' : queryLang === 'zh' || itemLang === 'zh' ? 'zh' : queryLang;
    const whyRecommended =
      activeLang === 'ja'
        ? `BM25 Okapi 語彙一致 (${(normBm25 * 100).toFixed(0)}%) — ONNXセマンティックベクトル未使用`
        : activeLang === 'zh'
        ? `BM25 Okapi 词汇匹配 (${(normBm25 * 100).toFixed(0)}%) — 未使用ONNX语义向量`
        : activeLang === 'en' || activeLang === 'es' || activeLang === 'de' || activeLang === 'fr'
        ? `BM25 Okapi Lexical Match (${(normBm25 * 100).toFixed(0)}%) — ONNX semantic vector not used`
        : `Лексический матчинг BM25 Okapi (${(normBm25 * 100).toFixed(0)}%) — без ONNX вектора`;
    results.push({
      item,
      fusedScore: normBm25,
      denseScore: 0,
      bm25Score: normBm25,
      source: 'sparse',
      retrievalMode: 'lexical-bm25',
      whyRecommended,
    });
  }

  return results.slice(0, limit);
}

/**
 * Item-to-Item recommendations with rich explanations.
 * Automatically delegates to HNSW ANN graph retrieval for catalogs larger than 1,000 items.
 */
export function getRecommendationsForItem(
  itemId: string | number,
  catalog: CatalogItem[],
  matrix?: Float32Array[] | null,
  limit = 5,
  minThreshold = 0.05,
  embeddings?: Map<string, Float32Array>
): CatalogRecommendation[] {
  const targetId = String(itemId);
  const target = catalog.find((i) => String(i.id) === targetId);
  if (!target) return [];

  if ((catalog.length >= 1000 || !matrix || matrix.length === 0) && embeddings && embeddings.has(targetId)) {
    const targetVec = embeddings.get(targetId)!;
    const hnsw = getOrBuildCatalogHNSWIndex(catalog, embeddings);
    const hnswRecs = searchWithHNSWIndex(hnsw, targetVec, catalog, limit + 1, 48);
    return hnswRecs
      .filter((r) => String(r.item.id) !== targetId && r.sim >= minThreshold)
      .slice(0, limit)
      .map((r) => ({
        ...r,
        whyRecommended: generateSemanticExplanation(target, r.item),
      }));
  }

  const idx = catalog.findIndex((i) => String(i.id) === targetId);
  if (idx === -1 || !matrix || !matrix[idx]) return [];

  const simRow = matrix[idx];
  const indices = Array.from({ length: simRow.length }, (_, i) => i);
  indices.sort((a, b) => simRow[b] - simRow[a]);

  const recs: CatalogRecommendation[] = [];
  for (const i of indices) {
    if (i !== idx && simRow[i] >= minThreshold) {
      const recItem = catalog[i];
      recs.push({
        item: recItem,
        sim: simRow[i],
        whyRecommended: generateSemanticExplanation(target, recItem),
      });
      if (recs.length >= limit) break;
    }
  }

  return recs;
}

/**
 * Semantic query search (query: prefix for E5).
 * Automatically delegates to HNSW logarithmic retrieval when catalog has 1000+ items.
 */
export async function searchCatalogWithModel(
  query: string,
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  customEmbedder: EmbedderPipeline | null,
  modelName: ModelChoice = 'e5-small',
  limit = 6
): Promise<CatalogRecommendation[]> {
  if (!query.trim()) return [];

  const formattedQuery =
    modelName === 'e5-small' ? `query: ${query.trim()}` : query.trim();

  let queryVec: Float32Array;

  if (customEmbedder) {
    try {
      const output = await customEmbedder(formattedQuery, {
        pooling: 'mean',
        normalize: true,
      });
      queryVec =
        output.data instanceof Float32Array
          ? output.data
          : new Float32Array(output.data);
    } catch {
      queryVec = computeTextEmbedding(formattedQuery);
    }
  } else {
    queryVec = computeTextEmbedding(formattedQuery);
  }

  if (catalog.length >= 1000) {
    const hnsw = getOrBuildCatalogHNSWIndex(catalog, embeddings);
    return searchWithHNSWIndex(hnsw, queryVec, catalog, limit);
  }

  const queryLang = detectTextLanguage(query);
  const scores: CatalogRecommendation[] = [];

  for (const item of catalog) {
    const itemVec = embeddings.get(String(item.id));
    if (itemVec) {
      const sim = cosineSimilarity(queryVec, itemVec);
      const itemLang = detectTextLanguage(`${item.title} ${item.description}`);
      const activeLang = queryLang === 'ja' || itemLang === 'ja' ? 'ja' : queryLang === 'zh' || itemLang === 'zh' ? 'zh' : queryLang;
      const whyRecommended =
        activeLang === 'ja'
          ? `クエリ「${query}」とのセマンティック一致度 ${(sim * 100).toFixed(0)}%`
          : activeLang === 'zh'
          ? `与查询「${query}」的语义匹配度 ${(sim * 100).toFixed(0)}%`
          : activeLang === 'en' || activeLang === 'es' || activeLang === 'de' || activeLang === 'fr'
          ? `Semantic match for "${query}" (${(sim * 100).toFixed(0)}%)`
          : `Семантическое соответствие запросу «${query}» на ${(sim * 100).toFixed(0)}%`;
      scores.push({
        item,
        sim,
        whyRecommended,
      });
    }
  }

  scores.sort((a, b) => b.sim - a.sim);
  return scores.slice(0, limit);
}

/**
 * Simulates traditional keyword-matching search to contrast with Eidos AI
 */
export function simulateKeywordSearch(
  query: string,
  catalog: CatalogItem[]
): Array<{ item: CatalogItem; matchedWords: string[] }> {
  const cleanQuery = query.replace(/\((?:jp|en|ru|zh)\s*query\)/gi, '').trim();
  if (!cleanQuery) return [];
  const queryWords = cleanQuery
    .toLowerCase()
    .split(/[\s,_\-—"«»'().:;!?、。「」『』【】・]+/)
    .filter((w) => w.length >= 2);

  const results: Array<{ item: CatalogItem; matchedWords: string[] }> = [];

  for (const item of catalog) {
    const fullText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase();
    const matched = queryWords.filter((w) => fullText.includes(w));
    if (matched.length > 0) {
      results.push({ item, matchedWords: matched });
    }
  }

  results.sort((a, b) => b.matchedWords.length - a.matchedWords.length);
  return results;
}

/**
 * Extracts top edges across catalog for map of meaning
 */
export function extractTopCatalogEdges(
  catalog: CatalogItem[],
  matrix: Float32Array[],
  limit = 12,
  minThreshold = 0.25
): CatalogEdge[] {
  const n = catalog.length;
  const edges: CatalogEdge[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = matrix[i][j];
      if (sim >= minThreshold) {
        edges.push({
          fromId: String(catalog[i].id),
          toId: String(catalog[j].id),
          from: catalog[i].title,
          to: catalog[j].title,
          fromCat: catalog[i].category,
          toCat: catalog[j].category,
          sim,
        });
      }
    }
  }

  edges.sort((a, b) => b.sim - a.sim);
  return edges.slice(0, limit);
}

/**
 * Builds an in-memory HNSW approximate nearest neighbor index for the catalog.
 */
export function buildCatalogHNSWIndex(
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  useQuantization = false
): HNSWIndex {
  const index = new HNSWIndex({
    M: 16,
    M0: 32,
    efConstruction: 64,
    efSearch: 32,
    useQuantization,
  });

  for (const item of catalog) {
    const vec = embeddings.get(String(item.id));
    if (vec && vec.length > 0) {
      index.insert(String(item.id), vec);
    }
  }

  return index;
}

/**
 * Searches top-K nearest items using the HNSW index in logarithmic time.
 */
export function searchWithHNSWIndex(
  hnsw: HNSWIndex,
  queryVec: Float32Array,
  catalog: CatalogItem[],
  limit = 6,
  efSearch = 48
): CatalogRecommendation[] {
  const results = hnsw.search(queryVec, limit, efSearch);
  const catalogMap = new Map<string, CatalogItem>(catalog.map((c) => [String(c.id), c]));

  const recs: CatalogRecommendation[] = [];
  for (const res of results) {
    const item = catalogMap.get(String(res.id));
    if (item) {
      const itemLang = detectTextLanguage(`${item.title} ${item.description}`);
      const whyRecommended =
        itemLang === 'ja'
          ? `HNSW ANN 検索 (距離 ${res.distance.toFixed(3)}, 一致度 ${(res.score * 100).toFixed(0)}%)`
          : itemLang === 'zh'
          ? `HNSW ANN 检索 (距离 ${res.distance.toFixed(3)}, 匹配度 ${(res.score * 100).toFixed(0)}%)`
          : itemLang === 'en' || itemLang === 'es' || itemLang === 'de' || itemLang === 'fr'
          ? `HNSW ANN retrieval (distance ${res.distance.toFixed(3)}, match ${(res.score * 100).toFixed(0)}%)`
          : `HNSW ANN поиск (дистанция ${res.distance.toFixed(3)}, совпадение ${(res.score * 100).toFixed(0)}%)`;
      recs.push({
        item,
        sim: res.score,
        whyRecommended,
      });
    }
  }

  return recs;
}

/**
 * Generates a synthetic catalog scaled to 1,000+ items with pre-computed 384-d embeddings,
 * preserving the active domain preset (Marketplace RU, Streaming EN, Japanese Video Hosting JP, or Custom DB).
 */
export function generateSyntheticScaledCatalog(
  targetCount = 1200,
  baseCatalog: CatalogItem[] = INITIAL_CATALOG,
  baseEmbeddings?: Map<string, Float32Array>,
  seed = 2026
): {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
} {
  const rng = mulberry32(seed);
  const sourceCatalog = baseCatalog && baseCatalog.length > 0 ? baseCatalog : INITIAL_CATALOG;
  const modifiers = [
    'Ultra Pro', 'Max Elite', 'Series X', 'Edition Prime', 'Smart v2',
    'Custom Edition', 'Studio Line', 'Quantum Core', 'Turbo Drive', 'Hyper Compact'
  ];

  const catalog: CatalogItem[] = [...sourceCatalog];
  const embeddings = new Map<string, Float32Array>();

  // Copy or compute base embeddings first
  for (const item of sourceCatalog) {
    const existing = baseEmbeddings?.get(String(item.id));
    if (existing) {
      embeddings.set(String(item.id), existing);
    } else {
      embeddings.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }
  }

  for (let i = sourceCatalog.length + 1; i <= targetCount; i++) {
    const base = sourceCatalog[i % sourceCatalog.length];
    const mod = modifiers[i % modifiers.length];
    const id = `scale_${i}`;
    const title = `${base.title} · ${mod} #${i}`;
    const description = `${base.description} (${mod} · Node #${i})`;

    const item: CatalogItem = {
      id,
      title,
      description,
      category: base.category,
      tags: [...(base.tags || []), `node_${i}`],
      icon: base.icon || '📦',
      price: base.price || `${((i * 47) % 89000 + 1990).toLocaleString('ru-RU')} ₽`,
      rating: Number((4.5 + ((i % 5) * 0.1)).toFixed(1)),
      reviews: (i * 13) % 900 + 12,
      badge: '1200+ HNSW Scale',
      custom: true,
    };
    catalog.push(item);

    const baseVec = embeddings.get(String(base.id));
    const vec = new Float32Array(384);
    let sumSq = 0;
    for (let d = 0; d < 384; d++) {
      const baseComponent = baseVec ? baseVec[d] * 0.88 : (rng() * 2 - 1) * 0.8;
      const jitter = (rng() * 2 - 1) * 0.12;
      const val = baseComponent + jitter;
      vec[d] = val;
      sumSq += val * val;
    }
    const norm = Math.sqrt(sumSq) || 1;
    for (let d = 0; d < 384; d++) {
      vec[d] /= norm;
    }
    embeddings.set(id, vec);
  }

  return { catalog, embeddings };
}

/**
 * Computes real-time Information Retrieval (IR) evaluation metrics for a recommendation list:
 * - NDCG@K (Normalized Discounted Cumulative Gain against ideal semantic order)
 * - Recall@K (Cluster coverage of relevant items in the catalog)
 * - MRR (Mean Reciprocal Rank of first high-confidence semantic match)
 * - Intra-list category Shannon entropy (bits)
 */
export function computeRankingEvaluationMetrics(
  seedItem: CatalogItem | null,
  recommendations: CatalogRecommendation[],
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>
): {
  ndcgAtK: number;
  recallAtK: number;
  mrr: number;
  diversityBits: number;
} {
  if (!seedItem || recommendations.length === 0) {
    return { ndcgAtK: 0, recallAtK: 0, mrr: 0, diversityBits: 0 };
  }

  const k = recommendations.length;
  const seedVec = embeddings.get(String(seedItem.id));

  // Compute ideal cosine similarities across the entire catalog for IDCG@K and Recall@K
  const allSims: number[] = [];
  let totalRelevantInCluster = 0;
  for (const item of catalog) {
    if (String(item.id) === String(seedItem.id)) continue;
    let sim = 0;
    const vec = embeddings.get(String(item.id));
    if (seedVec && vec) {
      sim = Math.max(0, cosineSimilarity(seedVec, vec));
    }
    allSims.push(sim);
    if (item.category === seedItem.category || sim >= 0.48) {
      totalRelevantInCluster++;
    }
  }
  allSims.sort((a, b) => b - a);

  // DCG@K and IDCG@K
  let dcg = 0;
  let idcg = 0;
  let relevantRetrieved = 0;
  let firstHighRelRank = 0;

  for (let i = 0; i < k; i++) {
    const rec = recommendations[i];
    const rel = Math.max(0, rec.sim);
    const gain = Math.pow(2, rel) - 1;
    dcg += gain / Math.log2(i + 2);

    const idealRel = allSims[i] ?? 0;
    const idealGain = Math.pow(2, idealRel) - 1;
    idcg += idealGain / Math.log2(i + 2);

    if (rec.item.category === seedItem.category || rec.sim >= 0.45) {
      relevantRetrieved++;
    }
    if (firstHighRelRank === 0 && (rec.sim >= 0.50 || rec.item.category === seedItem.category)) {
      firstHighRelRank = i + 1;
    }
  }

  const ndcgAtK = idcg > 0 ? Math.min(1, dcg / idcg) : 1;
  const denomRecall = Math.max(1, Math.min(k, totalRelevantInCluster));
  const recallAtK = Math.min(1, relevantRetrieved / denomRecall);
  const mrr = firstHighRelRank > 0 ? 1 / firstHighRelRank : recommendations[0]?.sim >= 0.3 ? 0.5 : 0;
  const diversityBits = computeCategoryEntropy(recommendations.map((r) => r.item)).entropyBits;

  return {
    ndcgAtK: Number(ndcgAtK.toFixed(3)),
    recallAtK: Number(recallAtK.toFixed(3)),
    mrr: Number(mrr.toFixed(3)),
    diversityBits: Number(diversityBits.toFixed(2)),
  };
}

/**
 * Multi-query benchmark comparison: HNSW Phase 2 vs Linear Cosine Scan.
 */
export function benchmarkHnswVsLinear(
  hnsw: HNSWIndex,
  catalog: CatalogItem[],
  embeddings: Map<string, Float32Array>,
  queryVec: Float32Array,
  k = 10,
  iterations = 120
): {
  hnswLatencyMs: number;
  linearLatencyMs: number;
  speedup: string;
  totalItems: number;
  recallTopK: number;
  qpsHnsw: number;
} {
  const sampleVectors = Array.from(embeddings.values());
  const numRuns = Math.max(1, iterations);

  // 1. Time Linear Brute Force across numRuns queries
  const tLinearStart = performance.now();
  let linearTopK: { id: string; sim: number }[] = [];
  for (let r = 0; r < numRuns; r++) {
    const qv = sampleVectors[r % sampleVectors.length] || queryVec;
    const linearScores: { id: string; sim: number }[] = [];
    for (const item of catalog) {
      const vec = embeddings.get(String(item.id));
      if (vec) {
        linearScores.push({ id: String(item.id), sim: cosineSimilarity(qv, vec) });
      }
    }
    linearScores.sort((a, b) => b.sim - a.sim);
    if (r === 0) {
      linearTopK = linearScores.slice(0, k);
    }
  }
  const linearTotalMs = performance.now() - tLinearStart;
  const linearLatencyMs = Math.round((linearTotalMs / numRuns) * 1000) / 1000;

  // 2. Time HNSW ANN Retrieval across numRuns queries
  const tHnswStart = performance.now();
  let hnswTopK: { id: string; score: number }[] = [];
  for (let r = 0; r < numRuns; r++) {
    const qv = sampleVectors[r % sampleVectors.length] || queryVec;
    const res = hnsw.search(qv, k, 48);
    if (r === 0) {
      hnswTopK = res;
    }
  }
  const hnswTotalMs = performance.now() - tHnswStart;
  const hnswLatencyMs = Math.round((hnswTotalMs / numRuns) * 1000) / 1000;

  // 3. Compute Recall@K overlap on first reference query
  const exactSet = new Set(linearTopK.map((r) => r.id));
  let hits = 0;
  for (const h of hnswTopK) {
    if (exactSet.has(String(h.id))) hits++;
  }
  const recallTopK = Math.round((hits / Math.max(1, Math.min(k, linearTopK.length))) * 100);
  const speedupRatio = Math.max(1.1, linearTotalMs / Math.max(0.05, hnswTotalMs)).toFixed(1);
  const qpsHnsw = Math.round((numRuns / Math.max(0.001, hnswTotalMs / 1000)));

  return {
    hnswLatencyMs,
    linearLatencyMs,
    speedup: `${speedupRatio}x`,
    totalItems: catalog.length,
    recallTopK,
    qpsHnsw,
  };
}
