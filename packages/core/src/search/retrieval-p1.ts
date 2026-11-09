/**
 * EIDOS Retrieval Product Layer v1 & Engine P1 Controls
 *
 * Implements native EIDOS retrieval stages:
 * 1. ingest_query
 * 2. normalize_query (layout / typo / synonyms)
 * 3. classify_query_shape (sku_like | short | natural)
 * 4. category_gate_intent (simpleCategoryGate: hard | soft | off)
 * 5. apply_catalog_constraints (CatalogConstraints — boolean eligibility, filter != score)
 * 6. retrieve_lexical_candidates (Multi-field BM25 with FieldImportance)
 * 7. retrieve_dense_candidates (HNSW 384-d + exact cosine)
 * 8. truncate_channel_windows (ChannelWindows: lexical, dense)
 * 9. fuse_channels (Weighted RRF or Linear min-max fusion)
 * 10. apply_business_signals (optional merch rules)
 * 11. limit_sort_stable_tiebreak (score desc, id asc)
 * 12. attach_xray_highlights_facets (X-Ray, XSS-safe <em> highlights, side-channel facet counts)
 * 13. respond
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

export type FieldImportance = FieldBoosts;

export const DEFAULT_FIELD_BOOSTS: Required<FieldBoosts> = Object.freeze({
  title: 3,
  sku: 5,
  brand: 2,
  category: 1.5,
  description: 1,
});

export const DEFAULT_FIELD_IMPORTANCE: Required<FieldImportance> = DEFAULT_FIELD_BOOSTS;

export const EIDOS_RETRIEVAL_PIPELINE_STAGES = Object.freeze([
  '1. ingest_query',
  '2. normalize_query',
  '3. classify_query_shape',
  '4. category_gate_intent',
  '5. apply_catalog_constraints',
  '6. retrieve_lexical_candidates',
  '7. retrieve_dense_candidates',
  '8. truncate_channel_windows',
  '9. fuse_channels',
  '10. apply_business_signals',
  '11. limit_sort_stable_tiebreak',
  '12. attach_xray_highlights_facets',
  '13. respond',
] as const);

export interface LexicalFieldContribution {
  field: FieldBoostField;
  boost: number;
  importance: number;
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

export type CatalogConstraints = SearchFilters;

export interface RankWindow {
  lexical?: number; // default 50, max 200
  dense?: number;   // default 50, max 200
}

export type ChannelWindows = RankWindow;

export const DEFAULT_RANK_WINDOW: Required<RankWindow> = Object.freeze({
  lexical: 50,
  dense: 50,
});

export const DEFAULT_CHANNEL_WINDOWS: Required<ChannelWindows> = DEFAULT_RANK_WINDOW;

export const MAX_RANK_WINDOW = 200;
export const DEFAULT_RANK_CONSTANT = 60;

export type FusionMode = 'rrf' | 'linear';
export type QueryShape = 'sku_like' | 'short' | 'natural';
export type FacetField = 'brand' | 'category';

export interface FacetBucket {
  value: string;
  count: number;
}

export type FacetCounts = Partial<Record<FacetField, FacetBucket[]>>;

export interface HitHighlights {
  title?: string;
  sku?: string;
}

export interface RrfChannelWeights {
  semantic?: number;
  lexical?: number;
  dense?: number;
  sparse?: number;
}

export interface RrfBreakdown {
  mode?: FusionMode;
  k: number;
  lexicalRank: number | null;
  denseRank: number | null;
  lexicalWeight: number;
  denseWeight: number;
  lexicalContribution: number;
  denseContribution: number;
  fusedScore: number;
}

export type FusionBreakdown = RrfBreakdown;

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
 * Validates and resolves FieldImportance / FieldBoosts against defaults.
 */
export function validateAndResolveFieldBoosts(
  input?: FieldBoosts | Record<string, unknown>,
  defaults: Required<FieldBoosts> = DEFAULT_FIELD_BOOSTS,
  errorCode: 'INVALID_FIELD_BOOSTS' | 'INVALID_FIELD_IMPORTANCE' = 'INVALID_FIELD_BOOSTS'
): RetrievalValidationResult<Required<FieldBoosts>> {
  const resolved: Required<FieldBoosts> = { ...defaults };
  if (input === undefined || input === null) {
    return { valid: true, value: resolved };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      value: resolved,
      code: errorCode,
      message: 'fieldImportance must be an object mapping field names to non-negative numbers',
    };
  }

  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (rawVal === undefined) continue;
    if (!VALID_FIELD_BOOST_KEYS.includes(rawKey as FieldBoostField)) {
      return {
        valid: false,
        value: resolved,
        code: errorCode,
        message: `${rawKey}: unknown field (allowed: title, sku, brand, category, description)`,
      };
    }
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal < 0) {
      return {
        valid: false,
        value: resolved,
        code: errorCode,
        message: `${rawKey}: must be a non-negative finite number (>= 0)`,
      };
    }
    resolved[rawKey as FieldBoostField] = rawVal;
  }

  return { valid: true, value: resolved };
}

export function validateAndResolveFieldImportance(
  input?: FieldImportance | Record<string, unknown>,
  defaults: Required<FieldImportance> = DEFAULT_FIELD_IMPORTANCE
): RetrievalValidationResult<Required<FieldImportance>> {
  return validateAndResolveFieldBoosts(input, defaults, 'INVALID_FIELD_IMPORTANCE');
}

/**
 * Validates and resolves ChannelWindows / RankWindow against defaults (min 1, max 200).
 */
export function validateAndResolveRankWindow(
  input?: RankWindow | Record<string, unknown>,
  defaults: Required<RankWindow> = DEFAULT_RANK_WINDOW,
  errorCode: 'INVALID_RANK_WINDOW' | 'INVALID_CHANNEL_WINDOWS' = 'INVALID_RANK_WINDOW'
): RetrievalValidationResult<Required<RankWindow>> {
  const resolved: Required<RankWindow> = { ...defaults };
  if (input === undefined || input === null) {
    return { valid: true, value: resolved };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      value: resolved,
      code: errorCode,
      message: 'channelWindows must be an object with lexical and/or dense window sizes',
    };
  }

  for (const rawKey of Object.keys(input)) {
    if (rawKey !== 'lexical' && rawKey !== 'dense') {
      return {
        valid: false,
        value: resolved,
        code: errorCode,
        message: `channelWindows.${rawKey}: unknown channel (allowed: lexical, dense)`,
      };
    }
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
        code: errorCode,
        message: `${key}: must be an integer between 1 and ${MAX_RANK_WINDOW}`,
      };
    }
    resolved[key] = val;
  }

  return { valid: true, value: resolved };
}

export function validateAndResolveChannelWindows(
  input?: ChannelWindows | Record<string, unknown>,
  defaults: Required<ChannelWindows> = DEFAULT_CHANNEL_WINDOWS
): RetrievalValidationResult<Required<ChannelWindows>> {
  return validateAndResolveRankWindow(input, defaults, 'INVALID_CHANNEL_WINDOWS');
}

export function validateAndResolveFusionMode(
  input?: unknown,
  defaultMode: FusionMode = 'rrf'
): RetrievalValidationResult<FusionMode> {
  if (input === undefined || input === null) {
    return { valid: true, value: defaultMode };
  }
  if (input !== 'rrf' && input !== 'linear') {
    return {
      valid: false,
      value: defaultMode,
      code: 'INVALID_FUSION_MODE',
      message: 'fusionMode: must be "rrf" or "linear"',
    };
  }
  return { valid: true, value: input };
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

  if (
    weights &&
    (weights.semantic !== undefined ||
      weights.dense !== undefined ||
      weights.lexical !== undefined ||
      weights.sparse !== undefined)
  ) {
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
    mode: 'rrf',
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

/**
 * Computes Linear Fusion score and honest X-Ray breakdown for a single candidate document
 * using min-max normalized scores over the candidate pool:
 *   fused(d) = w_lexical * norm(lexScore(d)) + w_dense * norm(denseScore(d))
 */
export function computeLinearFusionBreakdown(params: {
  k?: number;
  lexicalRank: number | null;
  denseRank: number | null;
  lexicalNormalized?: number;
  denseNormalized?: number;
  normalizedLexicalScore?: number;
  normalizedDenseScore?: number;
  lexicalWeight: number;
  denseWeight: number;
}): FusionBreakdown {
  const {
    k = DEFAULT_RANK_CONSTANT,
    lexicalRank,
    denseRank,
    lexicalNormalized,
    denseNormalized,
    normalizedLexicalScore,
    normalizedDenseScore,
    lexicalWeight,
    denseWeight,
  } = params;
  const safeK = k > 0 ? k : DEFAULT_RANK_CONSTANT;
  const lexNorm = lexicalNormalized ?? normalizedLexicalScore ?? 0;
  const denseNorm = denseNormalized ?? normalizedDenseScore ?? 0;

  const lexicalContribution =
    lexicalRank !== null && lexicalWeight > 0
      ? lexicalWeight * Math.max(0, Math.min(1, lexNorm))
      : 0;
  const denseContribution =
    denseRank !== null && denseWeight > 0
      ? denseWeight * Math.max(0, Math.min(1, denseNorm))
      : 0;
  const fusedScore = lexicalContribution + denseContribution;

  return {
    mode: 'linear',
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
          const inTitle = allowedBrands.some((b) => titleLower.split(/[\s,()/-]+/).includes(b));
          if (!inTitle) return false;
        } else {
          return true;
        }
      } else {
        const matched = allowedBrands.some(
          (b) => itemBrand === b || itemBrand.split(/[\s/]+/).includes(b)
        );
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
 * and multiplies its BM25 score by the corresponding field boost / importance.
 */
interface CachedFieldData {
  field: FieldBoostField;
  avgLen: number;
  fieldLower: string;
  tfMap: Map<string, number>;
  stemList: Array<{ tok: string; count: number }>;
  baseNorm: number;
}

interface CachedDocEntry {
  sig: string;
  fields: Record<FieldBoostField, CachedFieldData | null>;
}

const DOC_FIELD_TOKEN_CACHE = new WeakMap<object, CachedDocEntry>();

export function tokenizeMultiFieldQuery(query: string): string[] {
  const rawQueryTokens = BM25Index.tokenize(query);
  const rawCodeTokens = query
    .toLowerCase()
    .split(/[\s,;()[\]"«»]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[a-zа-яё0-9]+-[a-zа-яё0-9]+/i.test(t));
  return Array.from(new Set([...rawQueryTokens, ...rawCodeTokens]));
}

function getOrBuildDocFieldCache(item: FilterableCatalogItem): Record<FieldBoostField, CachedFieldData | null> {
  const skuText = item.sku ? String(item.sku) : '';
  const titleText = item.title || '';
  const brandText = item.brand || '';
  const catText = `${item.category || ''} ${(item.tags || []).join(' ')}`.trim();
  const descText = item.description || '';
  const sig = `${skuText}\u0001${titleText}\u0001${brandText}\u0001${catText}\u0001${descText.length}`;

  if (typeof item === 'object' && item !== null) {
    const cached = DOC_FIELD_TOKEN_CACHE.get(item);
    if (cached && cached.sig === sig) {
      return cached.fields;
    }
  }

  const rawDefs: Array<{ field: FieldBoostField; text: string; avgLen: number }> = [
    { field: 'sku', text: skuText, avgLen: 2 },
    { field: 'title', text: titleText, avgLen: 8 },
    { field: 'brand', text: brandText, avgLen: 2 },
    { field: 'category', text: catText, avgLen: 6 },
    { field: 'description', text: descText, avgLen: 24 },
  ];

  const k1 = 1.5;
  const b = 0.75;
  const built: Record<FieldBoostField, CachedFieldData | null> = {
    sku: null,
    title: null,
    brand: null,
    category: null,
    description: null,
  };

  for (const def of rawDefs) {
    if (!def.text) continue;
    const fieldLower = def.text.toLowerCase().trim();
    const fieldTokens = BM25Index.tokenize(def.text);
    if (fieldTokens.length === 0 && !fieldLower) continue;

    const tfMap = new Map<string, number>();
    for (const ft of fieldTokens) {
      tfMap.set(ft, (tfMap.get(ft) || 0) + 1);
    }

    if (def.field === 'sku' || def.field === 'brand' || def.field === 'title') {
      const codeParts = fieldLower.split(/[\s,;()[\]"«»]+/).filter(Boolean);
      for (const cp of codeParts) {
        if (!tfMap.has(cp)) {
          tfMap.set(cp, 1);
        }
      }
    }

    const stemList: Array<{ tok: string; count: number }> = [];
    for (const [docTok, count] of tfMap.entries()) {
      if (docTok.length >= 4) {
        stemList.push({ tok: docTok, count });
      }
    }

    const docLen = Math.max(1, fieldTokens.length);
    const baseNorm = k1 * (1.0 - b + (b * docLen) / def.avgLen);

    built[def.field] = {
      field: def.field,
      avgLen: def.avgLen,
      fieldLower,
      tfMap,
      stemList,
      baseNorm,
    };
  }

  if (typeof item === 'object' && item !== null) {
    DOC_FIELD_TOKEN_CACHE.set(item, { sig, fields: built });
  }

  return built;
}

export function scoreMultiFieldLexicalDocument(params: {
  query: string;
  item: FilterableCatalogItem;
  fieldBoosts: Required<FieldBoosts>;
  idfLookup?: (token: string) => number;
  precomputedQueryTokens?: string[];
}): {
  totalScore: number;
  contributions: LexicalFieldContribution[];
  dominantField: FieldBoostField | null;
} {
  const { query, item, fieldBoosts, idfLookup, precomputedQueryTokens } = params;
  const queryTokens = precomputedQueryTokens ?? tokenizeMultiFieldQuery(query);
  if (queryTokens.length === 0) {
    return { totalScore: 0, contributions: [], dominantField: null };
  }

  const cachedFields = getOrBuildDocFieldCache(item);
  const fieldOrder: FieldBoostField[] = ['sku', 'title', 'brand', 'category', 'description'];
  const k1Plus1 = 2.5;

  const contributions: LexicalFieldContribution[] = [];
  let totalScore = 0;
  let dominantField: FieldBoostField | null = null;
  let maxContribution = 0;

  for (const fieldName of fieldOrder) {
    const boost = fieldBoosts[fieldName];
    if (boost <= 0) continue;
    const f = cachedFields[fieldName];
    if (!f) continue;

    let rawFieldScore = 0;
    for (const qTok of queryTokens) {
      let tf = f.tfMap.get(qTok) || 0;

      if (tf === 0 && qTok.length >= 4 && f.field !== 'sku') {
        const stem = qTok.slice(0, Math.max(4, qTok.length - 2));
        for (let i = 0; i < f.stemList.length; i++) {
          const entry = f.stemList[i];
          if (entry.tok.startsWith(stem)) {
            tf += entry.count * 0.85;
          }
        }
      }

      if (tf <= 0) continue;

      const idf = idfLookup ? Math.max(0.25, idfLookup(qTok)) : 1.5;
      const tokenBm25 = idf * ((tf * k1Plus1) / (tf + f.baseNorm));
      rawFieldScore += tokenBm25;

      if (f.field === 'sku' && f.fieldLower === qTok) {
        rawFieldScore += idf * 1.5;
      }
    }

    if (rawFieldScore > 0) {
      const weighted = rawFieldScore * boost;
      const roundedContribution = Math.round(weighted * 10000) / 10000;
      totalScore += weighted;
      contributions.push({
        field: f.field,
        boost,
        importance: boost,
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

const ALLOWED_CONSTRAINT_KEYS = new Set([
  'category',
  'brand',
  'priceMin',
  'priceMax',
  'inStock',
  'ids',
  'excludeIds',
  'min_price',
  'max_price',
]);

/**
 * Validates and normalizes `constraints` (and/or legacy `filters` + `filterCategory`).
 * Returns INVALID_CONSTRAINTS if `constraints` is malformed, contains negative/NaN prices,
 * or has `priceMin > priceMax`.
 */
export function validateAndNormalizeConstraints(
  rawConstraints?: unknown,
  rawFiltersOrCategory?: SearchFilters | string,
  topLevelCategory?: string
): RetrievalValidationResult<CatalogConstraints | null> {
  const rawFilters =
    typeof rawFiltersOrCategory === 'object' && rawFiltersOrCategory !== null
      ? rawFiltersOrCategory
      : undefined;
  const resolvedCategory =
    typeof rawFiltersOrCategory === 'string' ? rawFiltersOrCategory : topLevelCategory;

  if (rawConstraints !== undefined && rawConstraints !== null) {
    if (typeof rawConstraints !== 'object' || Array.isArray(rawConstraints)) {
      return {
        valid: false,
        value: null,
        code: 'INVALID_CONSTRAINTS',
        message: 'constraints: must be an object',
      };
    }
    const cObj = rawConstraints as Record<string, unknown>;
    for (const k of Object.keys(cObj)) {
      if (!ALLOWED_CONSTRAINT_KEYS.has(k)) {
        return {
          valid: false,
          value: null,
          code: 'INVALID_CONSTRAINTS',
          message: `constraints.${k}: unknown constraint key`,
        };
      }
    }
    if (
      cObj.priceMin !== undefined &&
      (typeof cObj.priceMin !== 'number' || !Number.isFinite(cObj.priceMin) || cObj.priceMin < 0)
    ) {
      return {
        valid: false,
        value: null,
        code: 'INVALID_CONSTRAINTS',
        message: 'constraints.priceMin: must be a non-negative number',
      };
    }
    if (
      cObj.priceMax !== undefined &&
      (typeof cObj.priceMax !== 'number' || !Number.isFinite(cObj.priceMax) || cObj.priceMax < 0)
    ) {
      return {
        valid: false,
        value: null,
        code: 'INVALID_CONSTRAINTS',
        message: 'constraints.priceMax: must be a non-negative number',
      };
    }
    if (
      typeof cObj.priceMin === 'number' &&
      typeof cObj.priceMax === 'number' &&
      cObj.priceMin > cObj.priceMax
    ) {
      return {
        valid: false,
        value: null,
        code: 'INVALID_CONSTRAINTS',
        message: 'constraints.priceMin cannot be greater than constraints.priceMax',
      };
    }
    if (cObj.inStock !== undefined && typeof cObj.inStock !== 'boolean') {
      return {
        valid: false,
        value: null,
        code: 'INVALID_CONSTRAINTS',
        message: 'constraints.inStock: must be a boolean',
      };
    }
  }

  const merged: SearchFilters = {
    ...(rawFilters || {}),
    ...((rawConstraints as SearchFilters) || {}),
  };
  return {
    valid: true,
    value: normalizeSearchFilters(merged, resolvedCategory),
  };
}

export const QUERY_SHAPE_BIAS_MULTIPLIERS: Readonly<
  Record<QueryShape, { lexical: number; semantic: number }>
> = Object.freeze({
  sku_like: { lexical: 1.25, semantic: 0.85 },
  short: { lexical: 1.1, semantic: 0.92 },
  natural: { lexical: 0.95, semantic: 1.05 },
});

/**
 * Deterministic rule-based classifier for query shape:
 * - `sku_like`: 1–2 tokens with digits/hyphens/codes resembling a SKU, part number, or viscosity/model code (e.g. "BOS-1001", "5W-40", "SKU-0012")
 * - `short`: 1–2 natural language tokens after normalization
 * - `natural`: >= 3 tokens (multi-word phrase / natural language intent)
 */
export function classifyQueryShape(normalizedQuery: string, rawQuery?: string): QueryShape {
  const source = (rawQuery || normalizedQuery || '').trim();
  const norm = (normalizedQuery || source).trim();
  const rawTokens = source
    .split(/[\s,;()[\]"«»]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const normTokens = norm
    .split(/[\s,;()[\]"«»]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (normTokens.length === 0) {
    return 'short';
  }

  if (rawTokens.length <= 2 && normTokens.length <= 2) {
    const looksLikeSku = rawTokens.some((tok) => {
      const hasDigit = /\d/.test(tok);
      const hasLetter = /[a-zа-яё]/i.test(tok);
      const hasCodeSeparator = /[-_/]/.test(tok);
      const isPureDigitsCode = /^\d{3,}$/.test(tok);
      return (hasDigit && (hasLetter || hasCodeSeparator)) || isPureDigitsCode;
    });
    if (looksLikeSku) {
      return 'sku_like';
    }
    return 'short';
  }

  return 'natural';
}

/**
 * Applies deterministic query-shape bias to channel weights before fusion.
 * Multiplies (w_lexical, w_dense) by QUERY_SHAPE_BIAS_MULTIPLIERS[queryShape],
 * renormalizes to sum=1, and clamps into [0.15, 0.85] (unless a channel weight is explicitly 0).
 */
export function applyQueryShapeBias(
  paramsOrWeights: {
    lexical?: number;
    semantic?: number;
    lexicalWeight?: number;
    denseWeight?: number;
    queryShape?: QueryShape;
    enabled?: boolean;
  },
  queryShapeArg?: QueryShape
): {
  lexical: number;
  semantic: number;
  lexicalWeight: number;
  denseWeight: number;
  effectiveAlpha: number;
  weightsEffective: { lexical: number; semantic: number };
} {
  const lexicalWeight = paramsOrWeights.lexicalWeight ?? paramsOrWeights.lexical ?? 0.5;
  const denseWeight = paramsOrWeights.denseWeight ?? paramsOrWeights.semantic ?? 0.5;
  const queryShape: QueryShape =
    queryShapeArg ?? paramsOrWeights.queryShape ?? 'short';
  const enabled = paramsOrWeights.enabled ?? true;

  if (lexicalWeight <= 0 || denseWeight <= 0) {
    const isLexOnly = lexicalWeight > 0 && denseWeight <= 0;
    const isDenseOnly = denseWeight > 0 && lexicalWeight <= 0;
    const lexEff = isLexOnly ? 1 : isDenseOnly ? 0 : 0.5;
    const semEff = isDenseOnly ? 1 : isLexOnly ? 0 : 0.5;
    return {
      lexical: lexEff,
      semantic: semEff,
      lexicalWeight,
      denseWeight,
      effectiveAlpha: semEff,
      weightsEffective: { lexical: lexEff, semantic: semEff },
    };
  }

  const mult = QUERY_SHAPE_BIAS_MULTIPLIERS[queryShape] || QUERY_SHAPE_BIAS_MULTIPLIERS.short;
  const biasedLex = lexicalWeight * mult.lexical;
  const biasedSem = denseWeight * mult.semantic;
  const sum = biasedLex + biasedSem;
  let normLex = sum > 0 ? biasedLex / sum : 0.5;
  normLex = Math.min(0.85, Math.max(0.15, normLex));
  const normSem = Number((1 - normLex).toFixed(4));
  const roundedLex = Number(normLex.toFixed(4));

  const weightsEffective = {
    lexical: roundedLex,
    semantic: normSem,
  };

  if (!enabled) {
    const baseSum = lexicalWeight + denseWeight;
    const baseSem = baseSum > 0 ? Number((denseWeight / baseSum).toFixed(4)) : 0.5;
    const baseLex = Number((1 - baseSem).toFixed(4));
    return {
      lexical: baseLex,
      semantic: baseSem,
      lexicalWeight,
      denseWeight,
      effectiveAlpha: baseSem,
      weightsEffective: { lexical: baseLex, semantic: baseSem },
    };
  }

  return {
    lexical: roundedLex,
    semantic: normSem,
    lexicalWeight: roundedLex,
    denseWeight: normSem,
    effectiveAlpha: normSem,
    weightsEffective,
  };
}

function escapeHtmlSafe(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates XSS-safe HTML highlights (`<em>...</em>`) for `title` and `sku`
 * using only matched terms/stems from the normalized query.
 */
export function buildHitHighlights(params: {
  normalizedQuery: string;
  rawQuery?: string;
  title?: string;
  sku?: string;
}): HitHighlights {
  const { normalizedQuery, rawQuery, title, sku } = params;
  const baseTokens = BM25Index.tokenize(normalizedQuery || '');
  const rawCodeTokens = `${normalizedQuery || ''} ${rawQuery || ''}`
    .toLowerCase()
    .split(/[\s,;()[\]"«»]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /[a-zа-яё0-9]+-[a-zа-яё0-9]+/i.test(t));

  const candidatePatterns = new Set<string>();
  for (const tok of [...rawCodeTokens, ...baseTokens]) {
    const clean = tok.trim().toLowerCase();
    if (clean.length < 2) continue;
    candidatePatterns.add(clean);
    if (clean.length >= 5 && !/\d/.test(clean)) {
      candidatePatterns.add(clean.slice(0, clean.length - 1));
      candidatePatterns.add(clean.slice(0, clean.length - 2));
    }
  }

  const sortedTerms = Array.from(candidatePatterns).sort((a, b) => b.length - a.length);
  if (sortedTerms.length === 0) {
    return {
      ...(title ? { title: escapeHtmlSafe(title) } : {}),
      ...(sku ? { sku: escapeHtmlSafe(sku) } : {}),
    };
  }

  const highlightField = (rawText: string | undefined): string | undefined => {
    if (!rawText) return undefined;
    const escaped = escapeHtmlSafe(rawText);
    const regexParts = sortedTerms.map(
      (term) => `${escapeRegExp(escapeHtmlSafe(term))}[a-zA-Zа-яА-ЯёЁ0-9-]*`
    );
    const re = new RegExp(`(${regexParts.join('|')})`, 'giu');
    return escaped.replace(re, '<em>$1</em>');
  };

  return {
    ...(title ? { title: highlightField(title) } : {}),
    ...(sku ? { sku: highlightField(sku) } : {}),
  };
}

const VALID_FACET_FIELDS: ReadonlyArray<FacetField> = ['brand', 'category'];

/**
 * Validates optional `facets` array in search request (`Array<"brand" | "category">`, max 3).
 */
export function validateFacetsRequest(
  rawFacets: unknown
): RetrievalValidationResult<FacetField[] | null> {
  if (rawFacets === undefined || rawFacets === null) {
    return { valid: true, value: null };
  }
  if (!Array.isArray(rawFacets) || rawFacets.length > 3) {
    return {
      valid: false,
      value: null,
      code: 'INVALID_FACETS',
      message: 'facets: must be an array of up to 3 facet fields ("brand", "category")',
    };
  }
  const fields: FacetField[] = [];
  for (const item of rawFacets) {
    if (typeof item !== 'string' || !VALID_FACET_FIELDS.includes(item as FacetField)) {
      return {
        valid: false,
        value: null,
        code: 'INVALID_FACETS',
        message: `facets: unsupported facet field "${String(item)}" (allowed: brand, category)`,
      };
    }
    if (!fields.includes(item as FacetField)) {
      fields.push(item as FacetField);
    }
  }
  return { valid: true, value: fields.length > 0 ? fields : null };
}

/**
 * Computes facet bucket counts over the eligible candidate set (after constraints + category gate, before final limit).
 */
export function computeFacetCounts(
  items: FilterableCatalogItem[],
  facetFields: FacetField[] | null | undefined,
  topN: number = 25
): FacetCounts | undefined {
  if (!facetFields || facetFields.length === 0) return undefined;

  const result: FacetCounts = {};
  for (const field of facetFields) {
    const counts = new Map<string, number>();
    for (const item of items) {
      const rawVal = field === 'brand' ? item.brand : item.category;
      const val = rawVal ? String(rawVal).trim() : '';
      if (!val) continue;
      counts.set(val, (counts.get(val) || 0) + 1);
    }
    const buckets: FacetBucket[] = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      })
      .slice(0, topN);
    result[field] = buckets;
  }

  return result;
}
