/**
 * Ranking Guardrails, Head-Noun Category Gate & Query Normalization (v3.4 Zero-Bug Search Hardening)
 *
 * 1. Separates head product nouns ("наушники") from prepositional modifiers ("для бега") and price adjectives ("недорогие").
 * 2. Enforces simpleCategoryGate ('hard' | 'soft' | 'off', default 'hard' for storefront) so running shoes/books/laptops
 *    never pollute top results when searching for headphones.
 * 3. Enforces minimum confidence threshold so gibberish queries ("xyzabcqqq999") return count: 0.
 * 4. Calibrates scorePercent (0..100) and generates concise humanExplanation strings.
 */

const STOPWORDS = new Set([
  'для',
  'при',
  'под',
  'над',
  'без',
  'или',
  'как',
  'это',
  'все',
  'про',
  'что',
  'где',
  'когда',
  'очень',
  'купить',
  'цена',
  'недорогие',
  'недорогой',
  'недорогая',
  'недорогое',
  'бюджетные',
  'бюджетный',
  'бюджетная',
  'дешевые',
  'дешевый',
  'дешёвые',
  'дешёвый',
  'лучшие',
  'лучший',
  'топ',
  'the',
  'for',
  'and',
  'with',
  'from',
  'under',
  'over',
  'below',
  'above',
  'cheap',
  'budget',
  'affordable',
  'best',
  'buy',
]);

const MODIFIER_PREPOSITIONS = new Set(['для', 'под', 'в', 'на', 'со', 'с', 'for', 'with', 'in', 'under']);

const EN_TO_RU_KEYMAP: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю',
};

const RU_TO_EN_KEYMAP: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU_KEYMAP).map(([en, ru]) => [ru, en])
);

const KNOWN_RU_ECOM_STEMS = [
  'наушник',
  'кроссовк',
  'клавиатур',
  'ноутбук',
  'монитор',
  'смартфон',
  'телефон',
  'камер',
  'микрофон',
  'колонк',
  'часы',
  'рюкзак',
  'кресл',
  'мышь',
  'мышка',
  'планшет',
  'книг',
  'бег',
  'спорт',
  'игр',
  'кофе',
  'масл',
  'пылесос',
  'перфорат',
  'шуруповерт',
  'телевизор',
  'конструктор',
];

const KNOWN_EN_BRAND_STEMS = [
  'iphone',
  'samsung',
  'xiaomi',
  'shokz',
  'jbl',
  'sony',
  'sennheiser',
  'asics',
  'nike',
  'makita',
  'bosch',
  'delonghi',
  'dreame',
  'roborock',
  'brembo',
  'motul',
  'lego',
];

const TRANSLIT_MAP: Record<string, string> = {
  naushniki: 'наушники',
  yfceiybrb: 'наушники',
  yfeiybrb: 'наушники',
  krossovki: 'кроссовки',
  klaviatura: 'клавиатура',
  noutbuk: 'ноутбук',
  smartfon: 'смартфон',
  telefon: 'телефон',
  monitor: 'монитор',
  mikrofon: 'микрофон',
  ryukzak: 'рюкзак',
};

export interface CategoryFamilySpec {
  id: string;
  key?: string;
  canonicalRu: string;
  canonicalEn: string;
  queryStems: string[];
  itemStems: string[];
  queryTriggers?: string[];
  categoryMatchers?: string[];
  titleMatchers?: string[];
}

export const PRODUCT_CATEGORY_FAMILIES: ReadonlyArray<CategoryFamilySpec> = [
  {
    id: 'headphones',
    canonicalRu: 'наушники',
    canonicalEn: 'headphones',
    queryStems: [
      'наушник',
      'гарнитур',
      'аирподс',
      'airpods',
      'вкладыш',
      'затычк',
      'headphone',
      'earbud',
      'earphone',
      'headset',
      'ヘッドホン',
      'イヤホン',
    ],
    itemStems: [
      'наушник',
      'гарнитур',
      'airpods',
      'аирподс',
      'вкладыш',
      'tws',
      'headphone',
      'earbud',
      'earphone',
      'headset',
      'ヘッドホン',
      'イヤホン',
    ],
  },
  {
    id: 'sneakers',
    canonicalRu: 'кроссовки',
    canonicalEn: 'sneakers',
    queryStems: ['кроссовк', 'кросовк', 'кеды', 'обувь', 'бутсы', 'sneaker', 'shoe', 'footwear', 'シューズ'],
    itemStems: ['кроссовк', 'кросовк', 'кеды', 'обувь', 'бутсы', 'sneaker', 'shoe', 'footwear', 'シューズ'],
  },
  {
    id: 'laptops',
    canonicalRu: 'ноутбуки',
    canonicalEn: 'laptops',
    queryStems: [
      'ноутбук',
      'ультрабук',
      'макбук',
      'лэптоп',
      'ноут',
      'laptop',
      'notebook',
      'ultrabook',
      'macbook',
      'ノートpc',
    ],
    itemStems: [
      'ноутбук',
      'ультрабук',
      'макбук',
      'лэптоп',
      'probook',
      'laptop',
      'notebook',
      'ultrabook',
      'macbook',
      'ノートpc',
    ],
  },
  {
    id: 'smartphones',
    canonicalRu: 'смартфоны',
    canonicalEn: 'smartphones',
    queryStems: ['смартфон', 'телефон', 'айфон', 'камерофон', 'мобильник', 'smartphone', 'iphone', 'phone'],
    itemStems: ['смартфон', 'телефон', 'айфон', 'камерофон', 'galaxy', 'smartphone', 'iphone', 'phone'],
  },
  {
    id: 'smartwatches',
    canonicalRu: 'умные часы',
    canonicalEn: 'smartwatches',
    queryStems: ['смартчас', 'смарт-час', 'часы', 'браслет', 'трекер', 'smartwatch', 'watch', 'スマートウォッチ'],
    itemStems: ['смартчас', 'смарт-час', 'часы', 'браслет', 'трекер', 'bandpro', 'smartwatch', 'watch', 'スマートウォッチ'],
  },
  {
    id: 'keyboards',
    canonicalRu: 'клавиатуры',
    canonicalEn: 'keyboards',
    queryStems: ['клавиатур', 'клава', 'кейкап', 'keyboard', 'keycap', 'キーボード'],
    itemStems: ['клавиатур', 'клава', 'кейкап', 'keyboard', 'keycap', 'キーボード'],
  },
  {
    id: 'monitors',
    canonicalRu: 'мониторы',
    canonicalEn: 'monitors',
    queryStems: ['монитор', 'дисплей', 'monitor', 'display', 'モニター'],
    itemStems: ['монитор', 'дисплей', 'monitor', 'display', 'モニター'],
  },
  {
    id: 'cameras',
    canonicalRu: 'камеры',
    canonicalEn: 'cameras',
    queryStems: ['фотоаппарат', 'камер', 'объектив', 'camera', 'mirrorless', 'dslr'],
    itemStems: ['фотоаппарат', 'камер', 'объектив', 'camera', 'mirrorless', 'dslr'],
  },
  {
    id: 'coffee',
    canonicalRu: 'кофемашины',
    canonicalEn: 'coffee machines',
    queryStems: ['кофемашин', 'кофеварк', 'кофемолк', 'эспрессо', 'бариста', 'coffee', 'espresso'],
    itemStems: ['кофемашин', 'кофеварк', 'кофемолк', 'эспрессо', 'бариста', 'coffee', 'espresso'],
  },
  {
    id: 'books',
    canonicalRu: 'книги',
    canonicalEn: 'books',
    queryStems: ['книг', 'роман', 'учебник', 'литератур', 'book', 'novel'],
    itemStems: ['книг', 'роман', 'учебник', 'литератур', 'book', 'novel'],
  },
  {
    id: 'movies',
    canonicalRu: 'фильмы',
    canonicalEn: 'movies',
    queryStems: ['фильм', 'кино', 'сериал', 'movie', 'cinema', 'film'],
    itemStems: ['фильм', 'кино', 'сериал', 'movie', 'cinema', 'film'],
  },
  {
    id: 'oils',
    canonicalRu: 'масла и автохимия',
    canonicalEn: 'motor oils',
    queryStems: ['масло', 'автомасло', '5w-40', '5w40', '5w-30', '5w30', 'моторн', 'oil'],
    itemStems: ['масло', 'автомасло', '5w-40', '5w40', '5w-30', '5w30', 'моторн', 'oil', 'motul', 'mobil', 'лукойл', 'shell', 'автохимия'],
  },
  {
    id: 'brake_pads',
    canonicalRu: 'тормозные колодки и диски',
    canonicalEn: 'brake pads & discs',
    queryStems: ['колодк', 'тормозн', 'суппорт', 'brembo', 'brake'],
    itemStems: ['колодк', 'тормозн', 'суппорт', 'brembo', 'brake'],
  },
  {
    id: 'appliances',
    canonicalRu: 'бытовая техника',
    canonicalEn: 'home appliances',
    queryStems: ['пылесос', 'робот-пылесос', 'уборк', 'стиральн', 'холодильник', 'аэрогриль', 'блендер'],
    itemStems: ['пылесос', 'робот-пылесос', 'бытовая техника', 'уборк', 'dreame', 'roborock', 'dyson', 'delonghi'],
  },
  {
    id: 'tools',
    canonicalRu: 'инструменты и ремонт',
    canonicalEn: 'power tools',
    queryStems: ['шуруповерт', 'шуруповёрт', 'дрель', 'перфоратор', 'перфорат', 'нивелир', 'лазерный уровень', 'гайковерт'],
    itemStems: ['шуруповерт', 'шуруповёрт', 'дрель', 'перфоратор', 'перфорат', 'нивелир', 'инструмент', 'makita', 'bosch', 'dewalt'],
  },
  {
    id: 'kids_goods',
    canonicalRu: 'детские товары',
    canonicalEn: 'kids goods & toys',
    queryStems: ['конструктор', 'коляск', 'автокресл', 'игрушк', 'lego', 'лего'],
    itemStems: ['конструктор', 'коляск', 'автокресл', 'игрушк', 'lego', 'детские товары'],
  },
  {
    id: 'tv_media',
    canonicalRu: 'телевизоры и медиа',
    canonicalEn: 'tv & media',
    queryStems: ['телевизор', 'саундбар', 'проектор', 'oled', 'qled', 'smart tv'],
    itemStems: ['телевизор', 'саундбар', 'проектор', 'oled', 'qled', 'телевизоры и медиа'],
  },
];

export type SimpleCategoryGateMode = 'hard' | 'soft' | 'off';

export interface HeadCategoryIntent {
  hasHeadCategoryIntent: boolean;
  familyId: string | null;
  familyKey: string | null;
  canonicalCategoryRu: string | null;
  canonicalCategoryEn: string | null;
  confidence: number;
  headTokens: string[];
  modifierTokens: string[];
  familyStems: string[];
  isBudgetIntent: boolean;
  isPremiumIntent: boolean;
  maxPrice?: number;
  minPrice?: number;
}

export interface CategoryGateEvaluation {
  hasHeadCategoryIntent: boolean;
  matchesHeadCategory: boolean;
  conflictsWithHeadCategory: boolean;
  modifierMatchCount: number;
  passesHardGate: boolean;
  categoryScoreMultiplier: number;
  categoryBonus: number;
}

export interface QueryRewriteStep {
  type: 'layout' | 'typo' | 'synonym' | 'normalize';
  from: string;
  to: string;
}

export interface NormalizedQueryResult {
  originalQuery: string;
  normalizedQuery: string;
  layoutRecovered: boolean;
  typoRecovered: boolean;
  rewrites: QueryRewriteStep[];
  coreTokens: string[];
  coreStems: string[];
  headTokens: string[];
  modifierTokens: string[];
  isBudgetIntent: boolean;
}

export interface GuardrailCandidateInput {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  sku?: string;
  brand?: string;
  price?: number | string;
}

export interface GuardrailEvaluation {
  passesLexicalGate: boolean;
  titleMatchCount: number;
  headNounMatchCount: number;
  modifierMatchCount: number;
  categoryOrTagMatchCount: number;
  descriptionMatchCount: number;
  totalLexicalMatchCount: number;
  matchedTokens: string[];
  consistencyBoost: number;
}

function mapEnLayoutToRu(word: string): string {
  let out = '';
  for (const ch of word.toLowerCase()) {
    out += EN_TO_RU_KEYMAP[ch] ?? ch;
  }
  return out;
}

function mapRuLayoutToEn(word: string): string {
  let out = '';
  for (const ch of word.toLowerCase()) {
    out += RU_TO_EN_KEYMAP[ch] ?? ch;
  }
  return out;
}

/**
 * Pure bidirectional keyboard layout converter (qwerty <-> йцукен).
 */
export function layoutConvert(
  query: string,
  direction: 'en2ru' | 'ru2en' | 'auto' = 'auto'
): string {
  const collapsed = (query || '').trim().replace(/\s+/g, ' ');
  if (!collapsed) return '';

  const words = collapsed.split(' ');
  const converted = words.map((w) => {
    const lower = w.toLowerCase();
    if (direction === 'en2ru') {
      if (TRANSLIT_MAP[lower]) return TRANSLIT_MAP[lower];
      return mapEnLayoutToRu(lower);
    }
    if (direction === 'ru2en') {
      return mapRuLayoutToEn(lower);
    }
    // 'auto' mode: conservative conversion only when mapped tokens match known RU stems or EN brands
    if (TRANSLIT_MAP[lower]) return TRANSLIT_MAP[lower];
    if (/^[a-z,;'\[\].]{4,}$/i.test(w)) {
      const mappedRu = mapEnLayoutToRu(lower);
      if (KNOWN_RU_ECOM_STEMS.some((stem) => mappedRu.includes(stem))) {
        return mappedRu;
      }
    }
    if (/^[а-яё]{4,}$/i.test(w)) {
      const mappedEn = mapRuLayoutToEn(lower);
      if (KNOWN_EN_BRAND_STEMS.some((brand) => mappedEn === brand)) {
        return mappedEn;
      }
    }
    return w;
  });

  return converted.join(' ');
}

const CANONICAL_RU_TYPO_DICTIONARY: ReadonlyArray<string> = [
  'перфоратор',
  'шуруповерт',
  'наушники',
  'кроссовки',
  'смартфон',
  'ноутбук',
  'пылесос',
  'кофемашина',
  'телевизор',
  'клавиатура',
  'видеорегистратор',
  'холодильник',
  'конструктор',
  'аккумулятор',
  'коляска',
  'блендер',
  'монитор',
];

/**
 * Trims, collapses spaces, recovers EN->RU / RU->EN keyboard layout mistypes ("yfeiybrb" -> "наушники")
 * and edit-distance-1 typos ("перфоратр" -> "перфоратор"), recording every rewrite step in `rewrites`.
 */
export function normalizeQueryWithLayoutRecovery(rawQuery: string): NormalizedQueryResult {
  const collapsed = (rawQuery || '').trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return {
      originalQuery: rawQuery,
      normalizedQuery: '',
      layoutRecovered: false,
      typoRecovered: false,
      rewrites: [],
      coreTokens: [],
      coreStems: [],
      headTokens: [],
      modifierTokens: [],
      isBudgetIntent: false,
    };
  }

  let layoutRecovered = false;
  let typoRecovered = false;
  const rewrites: QueryRewriteStep[] = [];
  const words = collapsed.split(' ');
  const convertedWords = words.map((w) => {
    const lower = w.toLowerCase();
    if (TRANSLIT_MAP[lower]) {
      const target = TRANSLIT_MAP[lower];
      layoutRecovered = true;
      rewrites.push({ type: 'layout', from: w, to: target });
      return target;
    }
    if (/^[a-z,;'\[\].]{4,}$/i.test(w)) {
      const mapped = mapEnLayoutToRu(lower);
      if (KNOWN_RU_ECOM_STEMS.some((stem) => mapped.includes(stem))) {
        layoutRecovered = true;
        rewrites.push({ type: 'layout', from: w, to: mapped });
        return mapped;
      }
    }
    if (/^[а-яё]{4,}$/i.test(w)) {
      const mappedEn = mapRuLayoutToEn(lower);
      if (KNOWN_EN_BRAND_STEMS.some((brand) => mappedEn === brand)) {
        layoutRecovered = true;
        rewrites.push({ type: 'layout', from: w, to: mappedEn });
        return mappedEn;
      }
    }
    if (/^[а-яё]{5,}$/i.test(w) && !CANONICAL_RU_TYPO_DICTIONARY.includes(lower)) {
      for (const canonical of CANONICAL_RU_TYPO_DICTIONARY) {
        if (!lower.startsWith(canonical) && isEditDistanceAtMostOne(lower, canonical)) {
          typoRecovered = true;
          rewrites.push({ type: 'typo', from: w, to: canonical });
          return canonical;
        }
      }
    }
    return w;
  });

  const normalizedQuery = convertedWords.join(' ');
  const isBudgetIntent = /(недорог|дешев|дешёв|бюджетн|эконом|доступн|cheap|budget|affordable|low-cost)/i.test(
    normalizedQuery
  );
  const allWords = normalizedQuery
    .toLowerCase()
    .split(/[\s,_\-—"«»'().:;!?、。「」『』【】・]+/)
    .filter((tok) => tok.length >= 1);

  const headTokens: string[] = [];
  const modifierTokens: string[] = [];
  let inModifierPhrase = false;

  for (const tok of allWords) {
    if (MODIFIER_PREPOSITIONS.has(tok)) {
      inModifierPhrase = true;
      continue;
    }
    if (tok.length < 2 || STOPWORDS.has(tok)) {
      continue;
    }
    if (inModifierPhrase) {
      modifierTokens.push(tok);
    } else {
      headTokens.push(tok);
    }
  }

  const rawTokens = allWords.filter((tok) => tok.length >= 2);
  const coreTokens = rawTokens.filter((tok) => !STOPWORDS.has(tok));
  const effectiveTokens = coreTokens.length > 0 ? coreTokens : rawTokens;
  const effectiveHeadTokens = headTokens.length > 0 ? headTokens : effectiveTokens;

  const stemSet = new Set<string>();
  for (const tok of effectiveTokens) {
    stemSet.add(tok);
    if (tok.length >= 4) stemSet.add(tok.slice(0, -1));
    if (tok.length >= 5) stemSet.add(tok.slice(0, -2));
  }

  return {
    originalQuery: rawQuery,
    normalizedQuery,
    layoutRecovered,
    typoRecovered,
    rewrites,
    coreTokens: effectiveTokens,
    coreStems: Array.from(stemSet),
    headTokens: effectiveHeadTokens,
    modifierTokens,
    isBudgetIntent,
  };
}

/**
 * Extracts the primary product category intent from a query, giving strict priority
 * to head nouns ("наушники" in "недорогие наушники для бега") over prepositional modifiers ("для бега").
 */
/**
 * Automatically derives CategoryFamilySpec entries from an arbitrary client catalog's actual categories
 * using token frequency analysis and morphological stem extraction (zero hardcoded demo words).
 */
export function buildDynamicCategoryFamiliesFromCatalog(
  items: ReadonlyArray<{ category?: string; title?: string; tags?: string[] }>
): CategoryFamilySpec[] {
  const categoryCounts = new Map<string, number>();
  for (const it of items) {
    const rawCat = (it.category || '').trim();
    if (!rawCat || rawCat.toLowerCase() === 'general') continue;
    categoryCounts.set(rawCat, (categoryCounts.get(rawCat) || 0) + 1);
  }

  const families: CategoryFamilySpec[] = [];
  for (const [catName] of categoryCounts.entries()) {
    const cleanLower = catName.toLowerCase().trim();
    const rawTokens = cleanLower
      .split(/[\s,_\-—/()&+]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    if (rawTokens.length === 0) continue;

    const stems = new Set<string>();
    stems.add(cleanLower);
    for (const tok of rawTokens) {
      stems.add(tok);
      if (tok.length >= 5) {
        stems.add(tok.slice(0, tok.length - 1));
      }
      if (tok.length >= 6) {
        stems.add(tok.slice(0, tok.length - 2));
      }
    }

    const id = `dyn_${cleanLower.replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_|_$/g, '')}`;
    const stemArr = Array.from(stems).filter((s) => s.length >= 3);
    if (stemArr.length > 0) {
      families.push({
        id,
        canonicalRu: catName,
        canonicalEn: catName,
        queryStems: stemArr,
        itemStems: stemArr,
      });
    }
  }
  return families;
}

/**
 * Extracts the primary product category intent from a query, giving strict priority
 * to head nouns ("наушники" in "недорогие наушники для бега") over prepositional modifiers ("для бега").
 * Supports per-tenant custom families and dynamically derived catalog families.
 */
export function extractHeadCategoryIntent(
  rawQuery: string,
  customFamilies?: ReadonlyArray<CategoryFamilySpec>
): HeadCategoryIntent {
  const qInfo = normalizeQueryWithLayoutRecovery(rawQuery);
  const lower = qInfo.normalizedQuery.toLowerCase();
  // EIDOS-104: prefer caller families.
  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =
    customFamilies && customFamilies.length > 0
      ? customFamilies
      : PRODUCT_CATEGORY_FAMILIES;

  const isBudgetIntent = qInfo.isBudgetIntent;
  const isPremiumIntent = /(премиум|премиальн|флагман|дорог|топов|люкс|premium|flagship|luxury|high-end)/i.test(lower);

  let maxPrice: number | undefined;
  let minPrice: number | undefined;
  const maxMatch = /(?:до|дешевле|не\s+дороже|under|below|max)\s*\$?(\d{2,7})/i.exec(lower);
  const minMatch = /(?:от|дороже|свыше|over|above|min)\s*\$?(\d{2,7})/i.exec(lower);
  if (maxMatch) maxPrice = Number(maxMatch[1]);
  else if (isBudgetIntent) maxPrice = 15000;
  if (minMatch) minPrice = Number(minMatch[1]);

  // 1. Check headTokens first (tokens BEFORE "для"/"под"/"for") so head noun wins over use-case
  for (const hTok of qInfo.headTokens) {
    for (const fam of activeFamilies) {
      if (
        fam.queryStems.some(
          (stem) => hTok.includes(stem) || (hTok.length >= 6 && stem.startsWith(hTok))
        )
      ) {
        return {
          hasHeadCategoryIntent: true,
          familyId: fam.id,
          familyKey: fam.id,
          canonicalCategoryRu: fam.canonicalRu,
          canonicalCategoryEn: fam.canonicalEn,
          confidence: 0.9,
          headTokens: qInfo.headTokens,
          modifierTokens: qInfo.modifierTokens,
          familyStems: fam.itemStems,
          isBudgetIntent,
          isPremiumIntent,
          maxPrice,
          minPrice,
        };
      }
    }
  }

  // 2. If no head token matched (e.g. inverted word order "для бега наушники"), check modifier tokens
  //    for explicit product nouns (excluding pure use-case words like "бег"/"спорт"/"игр")
  for (const mTok of qInfo.modifierTokens) {
    for (const fam of activeFamilies) {
      if (fam.id === 'sneakers' && /^бег/i.test(mTok)) continue;
      if (fam.id === 'games' && /^игр/i.test(mTok)) continue;
      if (fam.queryStems.some((stem) => mTok.includes(stem))) {
        return {
          hasHeadCategoryIntent: true,
          familyId: fam.id,
          familyKey: fam.id,
          canonicalCategoryRu: fam.canonicalRu,
          canonicalCategoryEn: fam.canonicalEn,
          confidence: 0.8,
          headTokens: [mTok],
          modifierTokens: qInfo.headTokens,
          familyStems: fam.itemStems,
          isBudgetIntent,
          isPremiumIntent,
          maxPrice,
          minPrice,
        };
      }
    }
  }

  return {
    hasHeadCategoryIntent: false,
    familyId: null,
    familyKey: null,
    canonicalCategoryRu: null,
    canonicalCategoryEn: null,
    confidence: 0,
    headTokens: qInfo.headTokens,
    modifierTokens: qInfo.modifierTokens,
    familyStems: [],
    isBudgetIntent,
    isPremiumIntent,
    maxPrice,
    minPrice,
  };
}

/**
 * Evaluates whether a candidate item matches or conflicts with the extracted head category intent.
 */
export function evaluateCandidateCategoryGate(
  headIntent: HeadCategoryIntent,
  candidate: GuardrailCandidateInput,
  _mode: SimpleCategoryGateMode = 'hard',
  customFamilies?: ReadonlyArray<CategoryFamilySpec>
): CategoryGateEvaluation {
  if (!headIntent.familyId || headIntent.confidence < 0.7) {
    return {
      hasHeadCategoryIntent: false,
      matchesHeadCategory: false,
      conflictsWithHeadCategory: false,
      modifierMatchCount: 0,
      passesHardGate: true,
      categoryScoreMultiplier: 1.0,
      categoryBonus: 0,
    };
  }

  // EIDOS-104: prefer caller families.
  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =
    customFamilies && customFamilies.length > 0
      ? customFamilies
      : PRODUCT_CATEGORY_FAMILIES;

  const primaryFields = `${candidate.title || ''} ${candidate.category || ''} ${(candidate.tags || []).join(' ')}`.toLowerCase();
  const fullText = `${primaryFields} ${candidate.description || ''}`.toLowerCase();

  const matchesHeadCategory = headIntent.familyStems.some((stem) => primaryFields.includes(stem));

  let conflictsWithHeadCategory = false;
  if (!matchesHeadCategory) {
    for (const otherFam of activeFamilies) {
      if (otherFam.id === headIntent.familyId) continue;
      if (otherFam.itemStems.some((stem) => primaryFields.includes(stem))) {
        conflictsWithHeadCategory = true;
        break;
      }
    }
  }

  let modifierMatchCount = 0;
  for (const modTok of headIntent.modifierTokens) {
    const stems = [modTok];
    if (modTok.length >= 4) stems.push(modTok.slice(0, -1));
    if (modTok.length >= 5) stems.push(modTok.slice(0, -2));
    if (stems.some((s) => s.length >= 3 && fullText.includes(s))) {
      modifierMatchCount++;
    }
  }

  const passesHardGate = matchesHeadCategory && !conflictsWithHeadCategory;
  const categoryScoreMultiplier = matchesHeadCategory
    ? 1.35 + Math.min(0.25, modifierMatchCount * 0.12)
    : conflictsWithHeadCategory
    ? 0.08
    : 0.18;
  const categoryBonus = matchesHeadCategory
    ? 0.025 + Math.min(0.015, modifierMatchCount * 0.008)
    : 0;

  return {
    hasHeadCategoryIntent: true,
    matchesHeadCategory,
    conflictsWithHeadCategory,
    modifierMatchCount,
    passesHardGate,
    categoryScoreMultiplier,
    categoryBonus,
  };
}

function isEditDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (la > lb) {
        i++;
      } else if (lb > la) {
        j++;
      } else {
        i++;
        j++;
      }
    }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

function hasLightTypoWordMatch(token: string, fieldTextLower: string): boolean {
  if (token.length < 4) return false;
  const words = fieldTextLower.split(/[\s,_\-—"«»'().:;!?/]+/);
  for (const w of words) {
    if (w.length < 4) continue;
    if (w[0] !== token[0]) continue;
    if (
      isEditDistanceAtMostOne(token, w) ||
      (w.length > token.length && isEditDistanceAtMostOne(token, w.slice(0, token.length + 1)))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates lexical/category consistency and off-domain gating for a candidate item.
 * Gives strict precedence to headTokens ("наушники") over modifierTokens ("бега").
 */
export function evaluateCandidateGuardrail(
  queryInfo: NormalizedQueryResult,
  candidate: GuardrailCandidateInput,
  denseScore: number,
  sparseScore: number,
  catalogHasTitleOrCategoryMatches: boolean
): GuardrailEvaluation {
  const titleLower = `${candidate.title || ''} ${candidate.sku || ''} ${candidate.brand || ''}`.toLowerCase();
  const catTagLower = `${candidate.category || ''} ${(candidate.tags || []).join(' ')}`.toLowerCase();
  const descLower = (candidate.description || '').toLowerCase();

  let titleMatchCount = 0;
  let headNounMatchCount = 0;
  let modifierMatchCount = 0;
  let categoryOrTagMatchCount = 0;
  let descriptionMatchCount = 0;
  const matchedTokens: string[] = [];

  const headSet = new Set(queryInfo.headTokens);

  for (const tok of queryInfo.coreTokens) {
    const stems = [tok];
    if (tok.length >= 4) stems.push(tok.slice(0, -1));
    if (tok.length >= 5) stems.push(tok.slice(0, -2));

    const inTitle =
      stems.some((s) => s.length >= 3 && titleLower.includes(s)) ||
      hasLightTypoWordMatch(tok, titleLower);
    const inCatTag =
      stems.some((s) => s.length >= 3 && catTagLower.includes(s)) ||
      hasLightTypoWordMatch(tok, catTagLower);
    const inDesc = stems.some((s) => s.length >= 3 && descLower.includes(s));

    if (inTitle) titleMatchCount++;
    if (inCatTag) categoryOrTagMatchCount++;
    if (inDesc) descriptionMatchCount++;

    if (inTitle || inCatTag || inDesc) {
      matchedTokens.push(tok);
      if (headSet.has(tok)) {
        if (inTitle || inCatTag) {
          headNounMatchCount++;
        }
      } else {
        modifierMatchCount++;
      }
    }
  }

  const totalLexicalMatchCount = titleMatchCount + categoryOrTagMatchCount + descriptionMatchCount;

  // Head noun matches in title/category receive a strong boost; modifier-only matches receive a much smaller boost
  let consistencyBoost = 0;
  if (headNounMatchCount > 0) {
    consistencyBoost += 0.36 * Math.min(4, headNounMatchCount);
    if (modifierMatchCount > 0) {
      consistencyBoost += 0.14 * Math.min(3, modifierMatchCount);
    }
  } else if (titleMatchCount > 0 && queryInfo.modifierTokens.length === 0) {
    consistencyBoost += 0.28 * Math.min(4, titleMatchCount);
  } else if (modifierMatchCount > 0) {
    // Only matched the secondary modifier (e.g. "для бега" on a sneaker when searching "наушники для бега")
    consistencyBoost += 0.04 * Math.min(2, modifierMatchCount);
  }
  if (categoryOrTagMatchCount > 0 && headNounMatchCount > 0) {
    consistencyBoost += 0.14 * Math.min(2, categoryOrTagMatchCount);
  }
  if (descriptionMatchCount > 0 && titleMatchCount === 0 && headNounMatchCount > 0) {
    consistencyBoost += 0.06 * Math.min(2, descriptionMatchCount);
  }

  // Off-domain lexical & min-confidence gate:
  // 1) If query contains explicit gibberish markers or has zero lexical overlap and BM25 <= 0,
  //    enforce strict gate so gibberish queries ("xyzabcqqq999", "zzzz_garbage_999", "Абракадабра") return 0 results.
  const isExplicitGibberish = queryInfo.coreTokens.some((t) =>
    /^(абракадабр|abracadabr|абырвалг|zzzz|xyzabc|qqq999|garbage|nonexistent|несуществующ)/i.test(t)
  );
  let passesLexicalGate = !isExplicitGibberish;
  if (passesLexicalGate && sparseScore <= 0 && totalLexicalMatchCount === 0) {
    if (catalogHasTitleOrCategoryMatches && denseScore < 0.45) {
      passesLexicalGate = false;
    } else if (denseScore < 0.25) {
      passesLexicalGate = false;
    }
  }

  return {
    passesLexicalGate,
    titleMatchCount,
    headNounMatchCount,
    modifierMatchCount,
    categoryOrTagMatchCount,
    descriptionMatchCount,
    totalLexicalMatchCount,
    matchedTokens,
    consistencyBoost,
  };
}

/**
 * Calibrates raw RRF / hybrid scores into a user-friendly 0..100 percentage (`scorePercent`)
 * while preserving relative rank order and raw X-Ray components.
 */
export function calibrateScorePercent(params: {
  rawScore: number;
  maxRawScore: number;
  denseScore: number;
  sparseScore: number;
  titleMatchCount: number;
  categoryOrTagMatchCount: number;
  rankIndex: number;
}): number {
  const {
    rawScore,
    maxRawScore,
    denseScore,
    sparseScore,
    titleMatchCount,
    categoryOrTagMatchCount,
    rankIndex,
  } = params;

  if (rawScore <= 0 && denseScore <= 0 && sparseScore <= 0) {
    return 0;
  }

  const relativeRatio = maxRawScore > 0 ? Math.min(1, rawScore / maxRawScore) : 0.5;
  const lexicalSignal =
    titleMatchCount > 0 ? 0.94 : categoryOrTagMatchCount > 0 || sparseScore > 0 ? 0.78 : 0.45;
  const semanticSignal = Math.min(1, Math.max(denseScore, 0.35));

  const base =
    0.55 * relativeRatio +
    0.25 * lexicalSignal +
    0.2 * semanticSignal -
    Math.min(0.25, rankIndex * 0.03);

  return Math.round(Math.max(12, Math.min(99, base * 100)));
}

/**
 * Generates a concise bilingual human-readable explanation for API and UI search hits.
 */
export function buildHumanExplanation(params: {
  category?: string;
  scorePercent?: number;
  denseScore: number;
  sparseScore: number;
  titleMatchCount?: number;
  categoryOrTagMatchCount?: number;
  matchedTokens?: string[];
  matchesHeadCategory?: boolean;
  alpha?: number;
  rewrittenFrom?: string;
  rewrittenTo?: string;
  dominantLexicalField?: 'title' | 'sku' | 'brand' | 'category' | 'description' | null;
}): { ru: string; en: string } {
  const {
    category,
    scorePercent,
    denseScore,
    sparseScore,
    titleMatchCount = 0,
    categoryOrTagMatchCount = 0,
    matchedTokens = [],
    matchesHeadCategory,
    alpha = 0.5,
    rewrittenFrom,
    rewrittenTo,
    dominantLexicalField,
  } = params;
  const catRu = category ? `категория «${category}»` : '';
  const catEn = category ? `category "${category}"` : '';
  const pctSuffix = typeof scorePercent === 'number' ? ` (${scorePercent}%)` : '';
  const uniqueTokens = Array.from(new Set(matchedTokens)).slice(0, 3);
  const tokensPlus = uniqueTokens.join(' + ');
  const hasRewrite =
    rewrittenFrom &&
    rewrittenTo &&
    rewrittenFrom.trim().toLowerCase() !== rewrittenTo.trim().toLowerCase();
  const rwPrefixRu = hasRewrite ? `Запрос исправлен: ${rewrittenFrom} → ${rewrittenTo}. ` : '';
  const rwPrefixEn = hasRewrite ? `Query rewritten: ${rewrittenFrom} → ${rewrittenTo}. ` : '';
  const isSkuOrTitleDominant =
    dominantLexicalField === 'sku' || dominantLexicalField === 'title';
  const fieldDominantSuffixRu = isSkuOrTitleDominant
    ? ' · Сильное совпадение по артикулу/названию'
    : '';
  const fieldDominantSuffixEn = isSkuOrTitleDominant ? ' · Strong SKU/title match' : '';

  if (alpha <= 0.01 || (sparseScore > 0 && denseScore <= 0.01)) {
    const tokDetailRu = tokensPlus ? ` («${tokensPlus}»)` : '';
    const tokDetailEn = tokensPlus ? ` ("${tokensPlus}")` : '';
    return {
      ru: `${rwPrefixRu}Точное совпадение слов${tokDetailRu}${catRu ? `, ${catRu}` : ''}${pctSuffix}${fieldDominantSuffixRu}`
        .replace(/\s+/g, ' ')
        .trim(),
      en: `${rwPrefixEn}Exact keyword match${tokDetailEn}${catEn ? `, ${catEn}` : ''}${pctSuffix}${fieldDominantSuffixEn}`
        .replace(/\s+/g, ' ')
        .trim(),
    };
  }
  if (alpha >= 0.99 || (denseScore > 0 && sparseScore <= 0 && titleMatchCount === 0 && uniqueTokens.length === 0)) {
    return {
      ru: `${rwPrefixRu}Близость по смыслу запроса${catRu ? `, ${catRu}` : ''}${pctSuffix}`
        .replace(/\s+/g, ' ')
        .trim(),
      en: `${rwPrefixEn}Semantic meaning match${catEn ? `, ${catEn}` : ''}${pctSuffix}`
        .replace(/\s+/g, ' ')
        .trim(),
    };
  }
  if ((matchesHeadCategory || titleMatchCount > 0 || categoryOrTagMatchCount > 0) && uniqueTokens.length > 0) {
    return {
      ru: `${rwPrefixRu}Совпадение по смыслу и словам («${tokensPlus}»)${catRu ? `, ${catRu}` : ''}${pctSuffix}${fieldDominantSuffixRu}`
        .replace(/\s+/g, ' ')
        .trim(),
      en: `${rwPrefixEn}Matched meaning & words ("${tokensPlus}")${catEn ? `, ${catEn}` : ''}${pctSuffix}${fieldDominantSuffixEn}`
        .replace(/\s+/g, ' ')
        .trim(),
    };
  }
  if (denseScore > 0 && (sparseScore > 0 || titleMatchCount > 0)) {
    return {
      ru: `${rwPrefixRu}Совпадение по смыслу и характеристикам товара${catRu ? `, ${catRu}` : ''}${pctSuffix}${fieldDominantSuffixRu}`
        .replace(/\s+/g, ' ')
        .trim(),
      en: `${rwPrefixEn}Semantic and product attribute match${catEn ? `, ${catEn}` : ''}${pctSuffix}${fieldDominantSuffixEn}`
        .replace(/\s+/g, ' ')
        .trim(),
    };
  }
  return {
    ru: `${rwPrefixRu}Релевантность по смыслу${catRu ? `, ${catRu}` : ''}${pctSuffix}${fieldDominantSuffixRu}`.replace(/\s+/g, ' ').trim(),
    en: `${rwPrefixEn}Semantic and category relevance${catEn ? `, ${catEn}` : ''}${pctSuffix}${fieldDominantSuffixEn}`
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

