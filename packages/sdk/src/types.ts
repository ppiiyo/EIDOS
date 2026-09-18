export interface EidosClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface RecommendationRequest {
  itemId: string;
  limit?: number;
  minSimilarity?: number;
  diversityFactor?: number;
  excludeIds?: string[];
  filterCategory?: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  minSimilarity?: number;
  filterCategory?: string;
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
  latencyMs: number;
}

export interface CatalogItemInput {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface IngestResponse {
  success: boolean;
  indexedCount: number;
  durationMs: number;
}
