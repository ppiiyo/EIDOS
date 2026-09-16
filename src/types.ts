export interface Concept {
  id: string;
  name: string;
  category?: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  concepts: Concept[];
  updatedAt: number;
  simThreshold?: number;
}

export interface Edge {
  from: string;
  to: string;
  sim: number;
}

export interface Cluster {
  id: string;
  name: string;
  color: string;
  concepts: string[];
  cohesion: number;
}

export interface GraphMetrics {
  density: number;
  avgSim: number;
  maxSim: number;
  minSim: number;
  entropy: number;
  normalizedEntropy: number;
  diameter: number;
  clustering: number;
  deg: Map<string, number>;
  bc: Map<string, number>;
}

export type InsightType =
  | 'connection'
  | 'cluster'
  | 'bridge'
  | 'outlier'
  | 'contrast'
  | 'density';

export interface Insight {
  id: string;
  type: InsightType;
  priority: number;
  title: string;
  text: string;
  concepts: string[];
  metric: number;
  metricLabel: string;
}

export interface PresetDomain {
  name: string;
  icon: string;
  concepts: string[];
  description?: string;
}

export type ActiveTab = 'landing' | 'integration' | 'recommender' | 'analyze' | 'graph' | 'insights' | 'export';
export type StatusKind = 'ready' | 'busy' | 'error' | 'loading';

export interface CatalogItem {
  id: number;
  title: string;
  description: string;
  category: string;
  price?: string;
  rating?: number;
  reviews?: number;
  badge?: string;
  tags?: string[];
  icon?: string;
  custom?: boolean;
}

export interface CatalogRecommendation {
  item: CatalogItem;
  sim: number;
  whyRecommended?: string;
}

export interface CatalogEdge {
  fromId: number;
  toId: number;
  from: string;
  to: string;
  fromCat: string;
  toCat: string;
  sim: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
}

export interface ForceNode {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ForceEdge {
  from: string;
  to: string;
  sim: number;
  a: number;
  b: number;
}

export type PresentationMode = 'product' | 'pitch' | 'api' | 'whitelabel' | 'roi';

export interface WhiteLabelBrand {
  id: string;
  name: string;
  tagline: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  niche: string;
}
