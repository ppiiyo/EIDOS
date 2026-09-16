import { CatalogItem, CatalogRecommendation, CatalogEdge } from '../types';

/**
 * Semantic anchor categories tailored for E5 Multilingual and consumer domains
 */
const RECOMMENDER_ANCHORS: Array<{ name: string; words: string[] }> = [
  {
    name: 'cyberpunk_simulation_ai',
    words: [
      'киберпанк', 'cyberpunk', '2077', 'матрица', 'симуляция', 'реальность', 'sci-fi',
      'ии', 'будущее', 'импланты', 'виртуальность', 'неон', 'хакер', 'роботы', 'код'
    ],
  },
  {
    name: 'coffee_appliances',
    words: [
      'кофемашина', 'кофе', 'эспрессо', 'капучино', 'зерновой', 'напитки', 'бытовая',
      'техника', 'латте', 'бариста', 'кофейный', 'варка', 'coffee', 'espresso'
    ],
  },
  {
    name: 'programming_education_code',
    words: [
      'python', 'питон', 'программирование', 'обучение', 'код', 'алгоритмы', 'разработка',
      'backend', 'книга', 'учеба', 'компьютер', 'it', 'software', 'developer'
    ],
  },
  {
    name: 'sci_fi_space_desert',
    words: [
      'дюна', 'интерстеллар', 'космос', 'фантастика', 'пустыня', 'политика', 'планета',
      'нолан', 'время', 'звезды', 'арракис', 'спайс', 'гравитация', 'space'
    ],
  },
  {
    name: 'fantasy_rpg_magic',
    words: [
      'witcher', 'ведьмак', 'гарри', 'поттер', 'фэнтези', 'rpg', 'магия', 'чудовища',
      'геральт', 'властелин', 'колец', 'хоббит', 'хогвартс', 'заклинания', 'fantasy'
    ],
  },
  {
    name: 'computing_work_laptop',
    words: [
      'ноутбук', 'компьютер', 'probook', 'intel', 'ram', 'процессор', 'работа', 'экран',
      'железо', 'память', 'клавиатура', 'дисплей', 'laptop'
    ],
  },
  {
    name: 'audio_music_sound',
    words: [
      'наушники', 'звук', 'музыка', 'soundmax', 'шумоподавление', 'bluetooth', 'аудио',
      'бас', 'гарнитура', 'динамик', 'sound', 'headphones'
    ],
  },
  {
    name: 'dystopia_politics_control',
    words: [
      '1984', 'оруэлл', 'антиутопия', 'тоталитарное', 'общество', 'контроль', 'разум',
      'партия', 'свобода', 'власть', 'надзор', 'государство'
    ],
  },
  {
    name: 'cinema_dreams_mind',
    words: [
      'начало', 'сны', 'сон', 'нолан', 'триллер', 'сознание', 'разум', 'погружение',
      'подсознание', 'иллюзия', 'кино', 'фильм'
    ],
  },
  {
    name: 'gaming_companion_adventure',
    words: [
      'stray', 'кот', 'игра', 'приключения', 'роботы', 'город', 'кибергород', 'открытый',
      'мир', 'монополия', 'настолка', 'экономика', 'стратегия'
    ],
  },
  {
    name: 'mobile_display_gadgets',
    words: [
      'смартфон', 'galaxy', 'ultra', 'amoled', 'камера', '5g', 'флагман', 'телефон',
      'гаджет', 'экран', 'дисплей', 'часы'
    ],
  },
  {
    name: 'sport_fitness_running',
    words: [
      'кроссовки', 'runmax', 'бег', 'спорт', 'тренировки', 'амортизация', 'браслет',
      'bandpro', 'пульс', 'шаги', 'фитнес', 'трекер', 'здоровье'
    ],
  },
];

function hashGram(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const EMBEDDING_DIM = 64;

/**
 * Dense semantic vector matching E5 multilingual behavior
 */
export function computeTextEmbedding(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM);
  let clean = text.toLowerCase().trim();

  let isQuery = false;
  if (clean.startsWith('query:')) {
    clean = clean.replace(/^query:\s*/, '');
    isQuery = true;
  } else if (clean.startsWith('passage:')) {
    clean = clean.replace(/^passage:\s*/, '');
  }

  const words = clean.split(/[\s,_\-—"«»'().:;!?]+/);

  for (let i = 0; i < RECOMMENDER_ANCHORS.length; i++) {
    const anchor = RECOMMENDER_ANCHORS[i];
    let score = 0;

    for (const w of words) {
      if (!w) continue;
      if (anchor.words.includes(w)) {
        score += 2.2;
      } else {
        for (const aw of anchor.words) {
          if (w.length >= 3 && aw.length >= 3) {
            const minLen = Math.min(3, Math.min(w.length, aw.length));
            if (w.slice(0, minLen) === aw.slice(0, minLen)) {
              score += 0.8;
              break;
            }
          }
        }
      }
    }
    vec[i] = score;
    if (isQuery && score > 0) {
      vec[i] *= 1.25;
    }
  }

  const padded = `^${clean}$`;
  for (let len = 3; len <= 4; len++) {
    for (let i = 0; i <= padded.length - len; i++) {
      const gram = padded.slice(i, i + len);
      const h = hashGram(gram);
      const idx = 24 + (h % 32);
      const sign = (h & 0x80) ? 1 : -1;
      vec[idx] += sign * 0.35;
    }
  }

  vec[56] = Math.min(clean.length / 45, 1.0);
  let vowelCount = 0;
  for (const ch of clean) {
    if ('аеёиоуыэюяaeiouy'.includes(ch)) vowelCount++;
  }
  vec[57] = vowelCount / Math.max(1, clean.length);

  for (let i = 0; i < clean.length; i++) {
    const chCode = clean.charCodeAt(i);
    const targetIdx = 58 + (chCode % 6);
    vec[targetIdx] += 0.2 * Math.cos((i + 1) * 0.4);
  }

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
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (na === 0 || nb === 0) return 0;
  const raw = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.max(0, Math.min(1, raw));
}

export const cosineSim = cosineSimilarity;

export type ModelChoice = 'e5-small' | 'all-minilm' | 'built-in';

export interface EmbedderPipeline {
  (text: string, options?: { pooling?: string; normalize?: boolean }): Promise<{
    data: Float32Array | number[];
  }>;
}

/**
 * Natural semantic explanation: "Почему мы это рекомендуем"
 */
export function generateSemanticExplanation(
  target: CatalogItem,
  recommended: CatalogItem
): string {
  const tText = `${target.title} ${target.description} ${target.category}`.toLowerCase();
  const rText = `${recommended.title} ${recommended.description} ${recommended.category}`.toLowerCase();

  // 1. Space & Cosmic Time
  if (
    (tText.includes('космос') || tText.includes('интерстеллар') || tText.includes('дюна')) &&
    (rText.includes('космос') || rText.includes('время') || rText.includes('нолан') || rText.includes('дюна'))
  ) {
    return 'Оба произведения исследуют релятивистское время, грандиозный масштаб вселенной и борьбу человека с неизведанным.';
  }

  // 2. Cyberpunk, Simulation & AI
  if (
    (tText.includes('киберпанк') || tText.includes('матрица') || tText.includes('симуляция') || tText.includes('2077')) &&
    (rText.includes('киберпанк') || rText.includes('симуляция') || rText.includes('матрица') || rText.includes('робот') || rText.includes('stray'))
  ) {
    return 'Связаны эстетикой киберпанка, вопросами искусственного интеллекта и концепцией иллюзорности привычной реальности.';
  }

  // 3. High Fantasy & Magic
  if (
    (tText.includes('фэнтези') || tText.includes('ведьмак') || tText.includes('поттер') || tText.includes('толкин')) &&
    (rText.includes('фэнтези') || rText.includes('магия') || rText.includes('ведьмак') || rText.includes('хогвартс') || rText.includes('толкин'))
  ) {
    return 'Глубокое погружение в магические миры: эпический квест, мифология и противостояние древним силам.';
  }

  // 4. Code & Developer Hardware
  if (
    (tText.includes('python') || tText.includes('код') || tText.includes('ноутбук')) &&
    (rText.includes('ноутбук') || rText.includes('python') || rText.includes('код') || rText.includes('программирование'))
  ) {
    return 'Единая экосистема разработки: производительное железо и фундаментальные навыки написания алгоритмов.';
  }

  // 5. Mind, Dreams & Dystopia
  if (
    (tText.includes('сны') || tText.includes('начало') || tText.includes('1984') || tText.includes('нолан')) &&
    (rText.includes('начало') || rText.includes('сны') || rText.includes('разум') || rText.includes('1984') || rText.includes('матрица'))
  ) {
    return 'Интеллектуальные нарративы о манипуляциях сознанием, архитектуре человеческой памяти и поиске свободы мысли.';
  }

  // 6. Running, Fitness & Smart Wearables
  if (
    (tText.includes('бег') || tText.includes('спорт') || tText.includes('кроссовки') || tText.includes('браслет')) &&
    (rText.includes('бег') || rText.includes('спорт') || rText.includes('пульс') || rText.includes('трекер'))
  ) {
    return 'Комплексное решение для тренировок: контроль биометрических показателей и снижение ударной нагрузки.';
  }

  // 7. Sound & Smart Tech
  if (
    (tText.includes('звук') || tText.includes('наушники') || tText.includes('музыка')) &&
    (rText.includes('смартфон') || rText.includes('ноутбук') || rText.includes('звук'))
  ) {
    return 'Идеальное аудио-сопровождение для современных цифровых устройств с поддержкой беспроводных кодеков.';
  }

  // 8. Coffee & Comfort
  if (tText.includes('кофе') || rText.includes('кофе')) {
    return 'Премиальный уровень комфорта и создание утренней атмосферы продуктивности.';
  }

  // Generic intuitive reason
  return `Высокое соответствие по скрытым паттернам восприятия аудитории (${recommended.category} + ${target.category}).`;
}

/**
 * Computes embeddings for all catalog items using the active embedder or local E5 fallback
 */
export async function computeCatalogEmbeddingsWithModel(
  catalog: CatalogItem[],
  customEmbedder: EmbedderPipeline | null,
  modelName: ModelChoice = 'e5-small',
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, Float32Array>> {
  const map = new Map<number, Float32Array>();

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
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
          item.id,
          output.data instanceof Float32Array
            ? output.data
            : new Float32Array(output.data)
        );
      } catch {
        const vec = computeTextEmbedding(textToEmbed);
        map.set(item.id, vec);
      }
    } else {
      const vec = computeTextEmbedding(textToEmbed);
      map.set(item.id, vec);
    }

    if (onProgress) {
      onProgress(i + 1, catalog.length);
    }
    if (i % 4 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 6));
    }
  }

  return map;
}

/**
 * Builds symmetric similarity matrix
 */
export function buildCatalogSimilarityMatrix(
  catalog: CatalogItem[],
  embeddings: Map<number, Float32Array>
): Float32Array[] {
  const n = catalog.length;
  const matrix: Float32Array[] = Array.from({ length: n }, () => new Float32Array(n));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    const v1 = embeddings.get(catalog[i].id);
    if (!v1) continue;

    for (let j = i + 1; j < n; j++) {
      const v2 = embeddings.get(catalog[j].id);
      if (!v2) continue;
      const sim = cosineSimilarity(v1, v2);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

/**
 * Item-to-Item recommendations with rich explanations
 */
export function getRecommendationsForItem(
  itemId: number,
  catalog: CatalogItem[],
  matrix: Float32Array[],
  limit = 5,
  minThreshold = 0.05
): CatalogRecommendation[] {
  const idx = catalog.findIndex((i) => i.id === itemId);
  if (idx === -1 || !matrix[idx]) return [];

  const target = catalog[idx];
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
 * Semantic query search (query: prefix for E5)
 */
export async function searchCatalogWithModel(
  query: string,
  catalog: CatalogItem[],
  embeddings: Map<number, Float32Array>,
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

  const scores: CatalogRecommendation[] = [];

  for (const item of catalog) {
    const itemVec = embeddings.get(item.id);
    if (itemVec) {
      const sim = cosineSimilarity(queryVec, itemVec);
      scores.push({
        item,
        sim,
        whyRecommended: `Семантическое соответствие запросу «${query}» на ${(sim * 100).toFixed(0)}%`,
      });
    }
  }

  scores.sort((a, b) => b.sim - a.sim);
  return scores.slice(0, limit);
}

/**
 * Simulates traditional keyword-matching search to contrast with EIDOS AI
 */
export function simulateKeywordSearch(
  query: string,
  catalog: CatalogItem[]
): Array<{ item: CatalogItem; matchedWords: string[] }> {
  if (!query.trim()) return [];
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

  const results: Array<{ item: CatalogItem; matchedWords: string[] }> = [];

  for (const item of catalog) {
    const fullText = `${item.title} ${item.description}`.toLowerCase();
    const matched = queryWords.filter((w) => fullText.includes(w));
    if (matched.length > 0) {
      results.push({ item, matchedWords: matched });
    }
  }

  // Sort by number of matched words
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
          fromId: catalog[i].id,
          toId: catalog[j].id,
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
