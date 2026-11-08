/**
 * EIDOS Engine P1 — High-ROI Retrieval Controls
 *
 * Implements native EIDOS retrieval stages:
 * 1. Multi-field BM25 lexical scoring with configurable FieldBoosts (`title`, `sku`, `brand`, `category`, `description`)
 * 2. Pre-fusion Structured Filters (`SearchFilters`) with strict conjunction (AND) and OR within multi-value arrays
 * 3. Per-channel RankWindow candidate truncation (`lexical`, `dense`, default 50, max 200)
 * 4. Formalized Weighted Reciprocal Rank Fusion (`Weighted RRF`, default k=60) + honest X-Ray breakdown
 */

import { BM25Index } from './bm25';

export type FieldBoostField = 'title' | 'sku' | 'brand' | 'category' | 'description';

export interface FieldBoosts {
  title?: number;       // default 3
  sku?: number;         // default 5
  brand?: number;       // default 2
  category?: number;    // default 1.5
  description?: number; // default 1
}

export const DEFAULT_FIELD_BOOSTS: Required<FieldBoosts> = Object.freeze({
  title: 3,
  sku: 5,
  brand: 2,
  category: 1.5,
  description: 1,
});

export interface LexicalFieldContribution {
  field: FieldBoostField;
  boost: number;
  contribution: number;
}

export interface SearchFilters {
  category?: string | string[];
  brand?: string | string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  ids?: string[];
  excludeIds?: string[];
  // Legacy snake_case aliases supported for backward compatibility
  min_price?: number;
  max_price?: number;
}

export interface RankWindow {
  lexical?: number; // default 50, max 200
  dense?: number;   // default 50, max 200
}

export const DEFAULT_RANK_WINDOW: Required<RankWindow> = Object.freeze({
  lexical: 50,
  dense: 50,
});

export const MAX_RANK_WINDOW = 200;
export const DEFAULT_RANK_CONSTANT = 60;

export interface RrfChannelWeights {
  semantic?: number;
  lexical?: number;
  dense?: number;
  sparse?: number;
}

export interface RrfBreakdown {
  k: number;
  lexicalRank: number | null;
  denseRank: number | null;
  lexicalWeight: number;
  denseWeight: number;
  lexicalContribution: number;
  denseContribution: number;
  fusedScore: number;
}

export interface RetrievalValidationResult<T> {
  valid: boolean;
  value: T;
  code?: string;
  message?: string;
}

const VALID_FIELD_BOOST_KEYS: ReadonlyArray<FieldBoostField> = [
  'title',
  'sku',
  'brand',
  'category',
  'description',
];

/**
 * Validates and resolves FieldBoosts against defaults.
 * Any negative, NaN, or non-finite boost value is rejected with INVALID_FIELD_BOOSTS.
 */
export function validateAndResolveFieldBoosts(
  input?: FieldBoosts | Record<string, unknown>,
  defaults: Required<FieldBoosts> = DEFAULT_FIELD_BOOSTS
): RetrievalValidationResult<Required<FieldBoosts>> {
  const resolved: Required<FieldBoosts> = { ...defaults };
  if (!input || typeof input !== 'object') {
    return { valid: true, value: resolved };
  }

  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (rawVal === undefined) continue;
    if (!VALID_FIELD_BOOST_KEYS.includes(rawKey as FieldBoostField)) {
      return {
        valid: false,
        value: resolved,
        code: 'INVALID_FIELD_BOOSTS',
        message: `fieldBoosts.${rawKey}: unknown field (allowed: title, sku, brand, category, description)`,
      };
    }
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal < 0) {
      return {
        valid: false,
        value: resolved,
        code: 'INVALID_FIELD_BOOSTS',
        message: `fieldBoosts.${rawKey}: must be a non-negative finite number (>= 0)`,
      };
    }
    resolved[rawKey as FieldBoostField] = rawVal;
  }

  return { valid: true, value: resolved };
}

/**
 * Validates and resolves RankWindow against defaults (min 1, max 200).
 */
export function validateAndResolveRankWindow(
  input?: RankWindow | Record<string, unknown>,
  defaults: Required<RankWindow> = DEFAULT_RANK_WINDOW
): RetrievalValidationResult<Required<RankWindow>> {
  const resolved: Required<RankWindow> = { ...defaults };
  if (!input || typeof input !== 'object') {
    return { valid: true, value: resolved };
  }

  for (const key of ['lexical', 'dense'] as const) {
    const val = (input as Record<string, unknown>)[key];
    if (val === undefined) continue;
    if (
      typeof val !== 'number' ||
      !Number.isFinite(val) ||
      !Number.isInteger(val) ||
      val < 1 ||
      val > MAX_RANK_WINDOW
    ) {
      return {
        valid: false,
        value: resolved,
        code: 'INVALID_RANK_WINDOW',
        message: `rankWindow.${key}: must be an integer between 1 and ${MAX_RANK_WINDOW}`,
      };
    }
    resolved[key] = val;
  }

  return { valid: true, value: resolved };
}

/**
 * Validates and resolves RRF rankConstant k (default 60, must be finite > 0).
 */
export function validateAndResolveRankConstant(
  input?: unknown,
  defaultK: number = DEFAULT_RANK_CONSTANT
): RetrievalValidationResult<number> {
  if (input === undefined || input === null) {
    return { valid: true, value: defaultK };
  }
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0 || input > 10000) {
    return {
      valid: false,
      value: defaultK,
      code: 'INVALID_RANK_CONSTANT',
      message: 'rankConstant: must be a positive number (> 0)',
    };
  }
  return { valid: true, value: input };
}

/**
 * Resolves Weighted RRF channel weights consistently with existing weights/alpha/mode API:
 *   w_dense   = weights.semantic ?? weights.dense ?? alpha ?? 0.5
 *   w_lexical = weights.lexical ?? weights.sparse ?? (1 - alpha) ?? 0.5
 */
export function resolveWeightedRrfWeights(params: {
  weights?: RrfChannelWeights;
  alpha?: number;
  mode?: 'hybrid' | 'dense' | 'sparse';
  defaultWeights?: { semantic: number; lexical: number };
}): {
  lexicalWeight: number;
  denseWeight: number;
  effectiveAlpha: number;
} {
  const { weights, alpha, mode = 'hybrid', defaultWeights } = params;
  const fallbackAlpha = alpha ?? defaultWeights?.semantic ?? 0.5;

  let denseWeight: number;
  let lexicalWeight: number;

  if (weights && (weights.semantic !== undefined || weights.dense !== undefined || weights.lexical !== undefined || weights.sparse !== undefined)) {
    const rawDense = weights.semantic ?? weights.dense;
    const rawLexical = weights.lexical ?? weights.sparse;
    if (rawDense !== undefined && rawLexical !== undefined) {
      denseWeight = Math.max(0, rawDense);
      lexicalWeight = Math.max(0, rawLexical);
    } else if (rawDense !== undefined) {
      denseWeight = Math.max(0, rawDense);
      lexicalWeight = Math.max(0, 1 - Math.min(1, denseWeight));
    } else {
      lexicalWeight = Math.max(0, rawLexical!);
      denseWeight = Math.max(0, 1 - Math.min(1, lexicalWeight));
    }
  } else if (alpha !== undefined) {
    denseWeight = Math.max(0, Math.min(1, alpha));
    lexicalWeight = Math.max(0, Number((1 - denseWeight).toFixed(6)));
  } else if (defaultWeights) {
    denseWeight = Math.max(0, defaultWeights.semantic);
    lexicalWeight = Math.max(0, defaultWeights.lexical);
  } else {
    denseWeight = 0.5;
    lexicalWeight = 0.5;
  }

  if (mode === 'dense') {
    lexicalWeight = 0;
    if (denseWeight === 0) denseWeight = 1;
  } else if (mode === 'sparse') {
    denseWeight = 0;
    if (lexicalWeight === 0) lexicalWeight = 1;
  }

  const sum = denseWeight + lexicalWeight;
  const effectiveAlpha = sum > 0 ? Number((denseWeight / sum).toFixed(4)) : fallbackAlpha;

  return {
    lexicalWeight: Number(lexicalWeight.toFixed(6)),
    denseWeight: Number(denseWeight.toFixed(6)),
    effectiveAlpha,
  };
}

/**
 * Computes Weighted RRF score and honest X-Ray breakdown for a single candidate document.
 * Formula:
 *   score(d) = Σ_c w_c * (1 / (k + rank_c(d)))
 * If a document is absent from a channel (rank === null), that channel contributes 0.
 */
export function computeWeightedRrfBreakdown(params: {
  k: number;
  lexicalRank: number | null;
  denseRank: number | null;
  lexicalWeight: number;
  denseWeight: number;
}): RrfBreakdown {
  const { k, lexicalRank, denseRank, lexicalWeight, denseWeight } = params;
  const safeK = k > 0 ? k : DEFAULT_RANK_CONSTANT;

  const lexicalContribution =
    lexicalRank !== null && lexicalRank >= 1 && lexicalWeight > 0
      ? lexicalWeight * (1 / (safeK + lexicalRank))
      : 0;

  const denseContribution =
    denseRank !== null && denseRank >= 1 && denseWeight > 0
      ? denseWeight * (1 / (safeK + denseRank))
      : 0;

  const fusedScore = lexicalContribution + denseContribution;

  return {
    k: safeK,
    lexicalRank,
    denseRank,
    lexicalWeight: Number(lexicalWeight.toFixed(6)),
    denseWeight: Number(denseWeight.toFixed(6)),
    lexicalContribution: Number(lexicalContribution.toFixed(8)),
    denseContribution: Number(denseContribution.toFixed(8)),
    fusedScore: Number(fusedScore.toFixed(8)),
  };
}

export interface FilterableCatalogItem {
  id: string;
  sku?: string;
  brand?: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price?: number;
  inStock?: boolean;
  stock?: number;
}

/**
 * Normalizes raw SearchFilters (including legacy min_price / max_price and top-level filterCategory)
 * into a canonical SearchFilters object, or returns null if no structured filters are active.
 */
export function normalizeSearchFilters(
  rawFilters?: SearchFilters,
  topLevelCategory?: string
): SearchFilters | null {
  if (!rawFilters && !topLevelCategory) return null;

  const normalized: SearchFilters = {};
  let hasAny = false;

  const catSource = rawFilters?.category ?? topLevelCategory;
  if (catSource !== undefined) {
    if (Array.isArray(catSource)) {
      const cleaned = catSource.map((c) => String(c).trim()).filter(Boolean);
      if (cleaned.length > 0) {
        normalized.category = cleaned;
        hasAny = true;
      }
    } else if (typeof catSource === 'string' && catSource.trim() !== '') {
      normalized.category = catSource.trim();
      hasAny = true;
    }
  }

  if (rawFilters?.brand !== undefined) {
    if (Array.isArray(rawFilters.brand)) {
      const cleaned = rawFilters.brand.map((b) => String(b).trim()).filter(Boolean);
      if (cleaned.length > 0) {
        normalized.brand = cleaned;
        hasAny = true;
      }
    } else if (typeof rawFilters.brand === 'string' && rawFilters.brand.trim() !== '') {
      normalized.brand = rawFilters.brand.trim();
      hasAny = true;
    }
  }

  const priceMin = rawFilters?.priceMin ?? rawFilters?.min_price;
  if (typeof priceMin === 'number' && Number.isFinite(priceMin)) {
    normalized.priceMin = priceMin;
    hasAny = true;
  }

  const priceMax = rawFilters?.priceMax ?? rawFilters?.max_price;
  if (typeof priceMax === 'number' && Number.isFinite(priceMax)) {
    normalized.priceMax = priceMax;
    hasAny = true;
  }

  if (typeof rawFilters?.inStock === 'boolean') {
    normalized.inStock = rawFilters.inStock;
    hasAny = true;
  }

  if (Array.isArray(rawFilters?.ids) && rawFilters.ids.length > 0) {
    normalized.ids = rawFilters.ids.map((id) => String(id).trim()).filter(Boolean);
    if (normalized.ids.length > 0) hasAny = true;
  }

  if (Array.isArray(rawFilters?.excludeIds) && rawFilters.excludeIds.length > 0) {
    normalized.excludeIds = rawFilters.excludeIds.map((id) => String(id).trim()).filter(Boolean);
    if (normalized.excludeIds.length > 0) hasAny = true;
  }

  return hasAny ? normalized : null;
}

/**
 * Evaluates whether a catalog item satisfies all active structured filters (AND across fields, OR within multi-value field).
 * Filters do NOT contribute to score.
 */
export function matchesStructuredFilters(
  item: FilterableCatalogItem,
  filters: SearchFilters | null | undefined,
  filterStrictMissing: boolean = true
): boolean {
  if (!filters) return true;

  // 1. ids allowlist
  if (filters.ids && filters.ids.length > 0) {
    const itemId = String(item.id).trim();
    const itemSku = item.sku ? String(item.sku).trim() : '';
    const allowed = filters.ids.some(
      (id) => id === itemId || (itemSku !== '' && id.toLowerCase() === itemSku.toLowerCase())
    );
    if (!allowed) return false;
  }

  // 2. excludeIds denylist
  if (filters.excludeIds && filters.excludeIds.length > 0) {
    const itemId = String(item.id).trim();
    const itemSku = item.sku ? String(item.sku).trim() : '';
    const excluded = filters.excludeIds.some(
      (id) => id === itemId || (itemSku !== '' && id.toLowerCase() === itemSku.toLowerCase())
    );
    if (excluded) return false;
  }

  // 3. category filter (OR within array)
  if (filters.category !== undefined) {
    const allowedCats = (Array.isArray(filters.category) ? filters.category : [filters.category])
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (allowedCats.length > 0) {
      const itemCat = (item.category || '').trim().toLowerCase();
      if (!itemCat) return !filterStrictMissing;
      const matched = allowedCats.some((c) => itemCat === c || itemCat.includes(c));
      if (!matched) return false;
    }
  }

  // 4. brand filter (OR within array)
  if (filters.brand !== undefined) {
    const allowedBrands = (Array.isArray(filters.brand) ? filters.brand : [filters.brand])
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);
    if (allowedBrands.length > 0) {
      const itemBrand = (item.brand || '').trim().toLowerCase();
      const titleLower = (item.title || '').toLowerCase();
      if (!itemBrand) {
        if (filterStrictMissing) {
          // Check if brand is explicitly present as a distinct token in title when item.brand wasn't populated separately
          const inTitle = allowedBrands.some((b) => titleLower.split(/[\s,()/-]+/).includes(b));
          if (!inTitle) return false;
        } else {
          return true;
        }
      } else {
        const matched = allowedBrands.some((b) => itemBrand === b);
        if (!matched) return false;
      }
    }
  }

  // 5. priceMin / priceMax
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const hasPrice = typeof item.price === 'number' && Number.isFinite(item.price);
    if (!hasPrice) {
      if (filterStrictMissing) return false;
    } else {
      if (filters.priceMin !== undefined && item.price! < filters.priceMin) return false;
      if (filters.priceMax !== undefined && item.price! > filters.priceMax) return false;
    }
  }

  // 6. inStock
  if (filters.inStock !== undefined) {
    const hasNumericStock = typeof item.stock === 'number' && Number.isFinite(item.stock);
    const hasBooleanInStock = typeof item.inStock === 'boolean';
    if (!hasNumericStock && !hasBooleanInStock) {
      if (filterStrictMissing) return false;
    } else {
      const effectiveInStock = hasNumericStock ? item.stock! > 0 : Boolean(item.inStock);
      if (effectiveInStock !== filters.inStock) return false;
    }
  }

  return true;
}

/**
 * Computes multi-field BM25 score and per-field contributions for a document.
 * Evaluates each field (`sku`, `title`, `brand`, `category`, `description`) independently
 * and multiplies its BM25 score by the corresponding field boost.
 */
export function scoreMultiFieldLexicalDocument(params: {
  query: string;
  item: FilterableCatalogItem;
  fieldBoosts: Required<FieldBoosts>;
  idfLookup?: (token: string) => number;
}): {
  totalScore: number;
  contributions: LexicalFieldContribution[];
  dominantField: FieldBoostField | null;
} {
  const { query, item, fieldBoosts, idfLookup } = params;
  const rawQueryTokens = BM25Index.tokenize(query);

  // Also preserve hyphenated SKU/code tokens (e.g., "sku-123", "5w-40") from raw query
  const rawCodeTokens = query
    .toLowerCase()
    .split(/[\s,;()[\]"«»]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[a-zа-яё0-9]+-[a-zа-яё0-9]+/i.test(t));

  const queryTokens = Array.from(new Set([...rawQueryTokens, ...rawCodeTokens]));
  if (queryTokens.length === 0) {
    return { totalScore: 0, contributions: [], dominantField: null };
  }

  const fields: Array<{
    field: FieldBoostField;
    text: string;
    avgLen: number;
    boost: number;
  }> = [
    {
      field: 'sku',
      text: item.sku ? String(item.sku) : '',
      avgLen: 2,
      boost: fieldBoosts.sku,
    },
    {
      field: 'title',
      text: item.title || '',
      avgLen: 8,
      boost: fieldBoosts.title,
    },
    {
      field: 'brand',
      text: item.brand || '',
      avgLen: 2,
      boost: fieldBoosts.brand,
    },
    {
      field: 'category',
      text: `${item.category || ''} ${(item.tags || []).join(' ')}`.trim(),
      avgLen: 6,
      boost: fieldBoosts.category,
    },
    {
      field: 'description',
      text: item.description || '',
      avgLen: 24,
      boost: fieldBoosts.description,
    },
  ];

  const k1 = 1.5;
  const b = 0.75;
  const k1Plus1 = k1 + 1.0;

  const contributions: LexicalFieldContribution[] = [];
  let totalScore = 0;
  let dominantField: FieldBoostField | null = null;
  let maxContribution = 0;

  for (const f of fields) {
    if (!f.text || f.boost <= 0) continue;

    const fieldLower = f.text.toLowerCase().trim();
    const fieldTokens = BM25Index.tokenize(f.text);
    if (fieldTokens.length === 0 && !fieldLower) continue;

    const tfMap = new Map<string, number>();
    for (const ft of fieldTokens) {
      tfMap.set(ft, (tfMap.get(ft) || 0) + 1);
    }

    // For SKU and brand fields, also index the full normalized code string (e.g. "sku-123")
    if (f.field === 'sku' || f.field === 'brand' || f.field === 'title') {
      const codeParts = fieldLower.split(/[\s,;()[\]"«»]+/).filter(Boolean);
      for (const cp of codeParts) {
        if (!tfMap.has(cp)) {
          tfMap.set(cp, 1);
        }
      }
    }

    const docLen = Math.max(1, fieldTokens.length);
    const baseNorm = k1 * (1.0 - b + (b * docLen) / f.avgLen);

    let rawFieldScore = 0;
    for (const qTok of queryTokens) {
      let tf = tfMap.get(qTok) || 0;

      // Support morphological stem prefix match (>= 4 chars) in title/category/description
      if (tf === 0 && qTok.length >= 4 && f.field !== 'sku') {
        const stem = qTok.slice(0, Math.max(4, qTok.length - 2));
        for (const [docTok, count] of tfMap.entries()) {
          if (docTok.length >= 4 && docTok.startsWith(stem)) {
            tf += count * 0.85;
          }
        }
      }

      if (tf <= 0) continue;

      const idf = idfLookup ? Math.max(0.25, idfLookup(qTok)) : 1.5;
      const tokenBm25 = idf * ((tf * k1Plus1) / (tf + baseNorm));
      rawFieldScore += tokenBm25;

      // Exact full-SKU match bonus in the SKU field
      if (f.field === 'sku' && fieldLower === qTok) {
        rawFieldScore += idf * 1.5;
      }
    }

    if (rawFieldScore > 0) {
      const weighted = rawFieldScore * f.boost;
      const roundedContribution = Math.round(weighted * 10000) / 10000;
      totalScore += weighted;
      contributions.push({
        field: f.field,
        boost: f.boost,
        contribution: roundedContribution,
      });
      if (weighted > maxContribution) {
        maxContribution = weighted;
        dominantField = f.field;
      }
    }
  }

  return {
    totalScore: Math.round(totalScore * 10000) / 10000,
    contributions,
    dominantField,
  };
}
