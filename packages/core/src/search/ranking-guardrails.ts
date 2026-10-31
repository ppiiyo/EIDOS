/**
 * Ranking Guardrails & Query Normalization (v3.4 Zero-Bug Search Hardening)
 *
 * Prevents off-domain items (e.g. books/games/laptops on a headphone query) from
 * entering top results due to weak dense noise, enforces title/category consistency
 * boosts, recovers common EN<->RU keyboard layout errors, and calibrates scorePercent (0..100).
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
  'бюджетные',
  'бюджетный',
  'дешевые',
  'дешевый',
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

const EN_TO_RU_KEYMAP: Record<string, string> = {
  q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ',
  a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э',
  z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю',
};

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

export interface NormalizedQueryResult {
  originalQuery: string;
  normalizedQuery: string;
  layoutRecovered: boolean;
  coreTokens: string[];
  coreStems: string[];
}

export interface GuardrailCandidateInput {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  sku?: string;
  brand?: string;
}

export interface GuardrailEvaluation {
  passesLexicalGate: boolean;
  titleMatchCount: number;
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

/**
 * Trims, collapses spaces, and recovers obvious EN->RU keyboard layout mistypes
 * (e.g. "yfceiybrb" -> "наушники") or common translit terms ("naushniki" -> "наушники").
 */
export function normalizeQueryWithLayoutRecovery(rawQuery: string): NormalizedQueryResult {
  const collapsed = (rawQuery || '').trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return {
      originalQuery: rawQuery,
      normalizedQuery: '',
      layoutRecovered: false,
      coreTokens: [],
      coreStems: [],
    };
  }

  let layoutRecovered = false;
  const words = collapsed.split(' ');
  const convertedWords = words.map((w) => {
    const lower = w.toLowerCase();
    if (TRANSLIT_MAP[lower]) {
      layoutRecovered = true;
      return TRANSLIT_MAP[lower];
    }
    // Check if ASCII string maps to a known Russian e-commerce stem via QWERTY->ЙЦУКЕН
    if (/^[a-z,;'\[\].]{4,}$/i.test(w)) {
      const mapped = mapEnLayoutToRu(lower);
      if (KNOWN_RU_ECOM_STEMS.some((stem) => mapped.includes(stem))) {
        layoutRecovered = true;
        return mapped;
      }
    }
    return w;
  });

  const normalizedQuery = convertedWords.join(' ');
  const rawTokens = normalizedQuery
    .toLowerCase()
    .split(/[\s,_\-—"«»'().:;!?、。「」『』【】・]+/)
    .filter((tok) => tok.length >= 2);

  const coreTokens = rawTokens.filter((tok) => !STOPWORDS.has(tok));
  const effectiveTokens = coreTokens.length > 0 ? coreTokens : rawTokens;

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
    coreTokens: effectiveTokens,
    coreStems: Array.from(stemSet),
  };
}

/**
 * Evaluates lexical/category consistency and off-domain gating for a candidate item.
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
  let categoryOrTagMatchCount = 0;
  let descriptionMatchCount = 0;
  const matchedTokens: string[] = [];

  for (const tok of queryInfo.coreTokens) {
    const stems = [tok];
    if (tok.length >= 4) stems.push(tok.slice(0, -1));
    if (tok.length >= 5) stems.push(tok.slice(0, -2));

    const inTitle = stems.some((s) => s.length >= 3 && titleLower.includes(s));
    const inCatTag = stems.some((s) => s.length >= 3 && catTagLower.includes(s));
    const inDesc = stems.some((s) => s.length >= 3 && descLower.includes(s));

    if (inTitle) titleMatchCount++;
    if (inCatTag) categoryOrTagMatchCount++;
    if (inDesc) descriptionMatchCount++;

    if (inTitle || inCatTag || inDesc) {
      matchedTokens.push(tok);
    }
  }

  const totalLexicalMatchCount = titleMatchCount + categoryOrTagMatchCount + descriptionMatchCount;

  // Consistency boost rewards items whose title or category/tags directly match core query nouns
  let consistencyBoost = 0;
  if (titleMatchCount > 0) {
    consistencyBoost += 0.32 * Math.min(2, titleMatchCount);
  }
  if (categoryOrTagMatchCount > 0) {
    consistencyBoost += 0.16 * Math.min(2, categoryOrTagMatchCount);
  }
  if (descriptionMatchCount > 0 && titleMatchCount === 0) {
    consistencyBoost += 0.08 * Math.min(2, descriptionMatchCount);
  }

  // Off-domain lexical gate:
  // 1) If the catalog has items matching the query's title/category tokens, suppress items that have
  //    zero lexical overlap AND weak dense similarity (< 0.48) so off-domain items (books/games/laptops)
  //    do not pollute top results.
  // 2) If no items in the catalog have lexical matches, require at least dense >= 0.26.
  let passesLexicalGate = true;
  if (sparseScore <= 0 && totalLexicalMatchCount === 0) {
    if (catalogHasTitleOrCategoryMatches && denseScore < 0.48) {
      passesLexicalGate = false;
    } else if (denseScore < 0.25) {
      passesLexicalGate = false;
    }
  }

  return {
    passesLexicalGate,
    titleMatchCount,
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
    titleMatchCount > 0 ? 0.92 : categoryOrTagMatchCount > 0 || sparseScore > 0 ? 0.76 : 0.45;
  const semanticSignal = Math.min(1, Math.max(denseScore, 0.35));

  const base =
    0.55 * relativeRatio +
    0.25 * lexicalSignal +
    0.2 * semanticSignal -
    Math.min(0.25, rankIndex * 0.03);

  const pct = Math.round(Math.max(12, Math.min(99, base * 100)));
  return pct;
}
