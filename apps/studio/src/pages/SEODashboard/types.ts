export interface KPIMetricData {
  value: number;
  trend: number;
  sparkline: number[];
}

export interface TopQueryItem {
  query: string;
  volume: number;
  ctr: number;
  avgPosition: number;
  zeroResult: boolean;
  revenue: number;
  lastSearchedAt?: string;
}

export interface ZeroResultQueryItem {
  query: string;
  volume: number;
  suggestedSynonym?: string;
  resolvedSynonym?: string;
  boostedProductId?: string;
}

export interface TopClickedProductItem {
  id: string;
  title: string;
  category?: string;
  price?: number;
  clicks: number;
  purchases?: number;
  conversionRate: number;
}

export interface XRayExplanation {
  denseComponent: number;
  sparseBm25Component: number;
  rrfScore: number;
  mmrPenalty: number;
  businessBoost: number;
}

export interface XRaySearchResultItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price?: number;
  score: number;
  source?: string;
  explanation: XRayExplanation;
}

export interface XRaySearchResponse {
  query: string;
  mode: 'dense' | 'sparse' | 'hybrid';
  results: XRaySearchResultItem[];
  count: number;
  latencyMs: number;
  cacheHit?: boolean;
}

export interface CatalogStatsSummary {
  itemsIndexed: number;
  totalItems: number;
  vectorDimension: number;
  hnswIndexed: number;
  avgSearchLatencyMs: number;
  categories: Record<string, number>;
}

export interface HealthSummary {
  ok: boolean;
  status: string;
  responseTimeMs: number;
  itemsIndexed: number;
  uptimeSeconds: number;
  model: string;
}

export interface SEOAnalyticsResponse {
  period?: {
    from: string;
    to: string;
    days: number;
  };
  engineStats?: {
    itemsIndexed: number;
    avgSearchLatencyMs: number;
    activeSynonyms: number;
    activeBoosts: number;
  };
  searchUsageRate: KPIMetricData;
  zeroResultRate: KPIMetricData;
  ctr: KPIMetricData;
  revenuePerSearch: KPIMetricData;
  topQueries: TopQueryItem[];
  zeroResultQueries: ZeroResultQueryItem[];
  topClickedProducts: TopClickedProductItem[];
  synonyms?: Record<string, string>;
  boosts?: Record<string, number>;
}

export type SortColumn = 'query' | 'volume' | 'ctr' | 'avgPosition' | 'zeroResult' | 'revenue';
export type SortDirection = 'asc' | 'desc';

export interface DateRangeFilter {
  from: string;
  to: string;
  preset: '7d' | '14d' | '30d' | 'custom';
}

export interface GuidedTourStep {
  id: string;
  targetId: string;
  title: string;
  description: string;
  badge: string;
}
