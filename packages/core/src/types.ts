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
