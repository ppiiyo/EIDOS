export interface ItemMetadata {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  metadata?: ItemMetadata;
  embedding?: number[];
}

export interface SimilarityResult {
  item: CatalogItem;
  score: number;
  sharedClusters?: string[];
}

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  cluster: number;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface SemanticGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  density: number;
}

export interface RecommendationOptions {
  limit?: number;
  minSimilarity?: number;
  diversityFactor?: number;
  excludeIds?: string[];
  filterCategory?: string;
}

export interface QuantizedVector {
  id?: string;
  data: Int8Array;
  scale: number;
  norm: number;
}

export interface HNSWConfig {
  /** Maximum number of outgoing edges per node per level (default: 16) */
  M: number;
  /** Maximum outgoing edges on ground layer 0 (default: 32) */
  M0: number;
  /** Size of dynamic candidate list during construction (default: 64) */
  efConstruction: number;
  /** Size of dynamic candidate list during query search (default: 32) */
  efSearch: number;
  /** Enable INT8 scalar quantization for memory reduction and integer dot products */
  useQuantization?: boolean;
}

export interface HNSWSearchResult {
  id: string;
  score: number;
  distance: number;
}

