export interface EidosClientConfig {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
  tenantId?: string;
  indexName?: string;
}

export interface RecommendationRequest {
  itemId?: string;
  item_id?: string;
  userId?: string;
  user_id?: string;
  history?: string[];
  strategy?: 'simple' | 'adaptive' | 'user';
  limit?: number;
  minSimilarity?: number;
  diversityFactor?: number;
  excludeIds?: string[];
  filterCategory?: string;
  tenantId?: string;
  indexName?: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  topK?: number;
  offset?: number;
  page?: number;
  mode?: 'dense' | 'sparse' | 'hybrid' | 'semantic';
  alpha?: number;
  rerank?: boolean;
  minSimilarity?: number;
  filterCategory?: string;
  simpleCategoryGate?: 'off' | 'soft' | 'hard';
  tenantId?: string;
  indexName?: string;
}

export interface SuggestRequest {
  query: string;
  limit?: number;
  tenantId?: string;
  indexName?: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  score: number;
}

export interface RecommendationResponse {
  sourceItemId: string;
  recommendations: RecommendationItem[];
  latencyMs: number;
  entropy: number;
}

export interface SearchResponse {
  query: string;
  results: RecommendationItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  latencyMs: number;
}

export interface SuggestResponse {
  query: string;
  suggestions?: string[];
  results: RecommendationItem[];
  total?: number;
  latencyMs?: number;
}

export interface ReadyResponse {
  ready: boolean;
  status: string;
  itemsIndexed?: number;
}

export interface CatalogItemInput {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  price?: number;
  inStock?: boolean;
  vector?: number[];
  embedding?: number[];
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface IngestResponse {
  success: boolean;
  indexedCount: number;
  upserted?: number;
  durationMs: number;
}
