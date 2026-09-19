/**
 * Core types for the Adaptive Intelligence Layer (AIL).
 * Defines representations for user profiles, ranking features,
 * metadata store, knowledge graph enrichment, context signals,
 * feedback events, and candidate fusion.
 */

export interface UserProfile {
  userId: string;
  history: string[];
  embedding: Float32Array;
  categoryDistribution: Map<string, number>;
  updatedAt: number;
}

export interface UserTowerConfig {
  /** Maximum number of history items considered for embedding aggregation */
  maxHistoryLength: number;
  /** Decay factor per positional step away from the newest item (0 < recencyDecay <= 1) */
  recencyDecay: number;
  /** Penalty applied to repetitive categories to prevent topical starvation */
  categoryDiversityWeight: number;
  /** Vector normalization method */
  normalization: 'l2' | 'none';
}

export interface RankingFeatures {
  /** Cosine similarity with candidate/query (0.0 to 1.0) */
  similarity: number;
  /** Normalized item popularity score (0.0 to 1.0) */
  popularity: number;
  /** Freshness score based on publication/creation timestamp (0.0 to 1.0) */
  freshness: number;
  /** Cosine affinity with personalized user embedding (0.0 to 1.0) */
  userAffinity: number;
  /** Penalty score for repetitive categories already encountered (0.0 to 1.0) */
  categoryRepetition: number;
  /** Relevance to temporal/device contextual signals (0.0 to 1.0) */
  contextualRelevance: number;
  /** Graph topological centrality or bridge status (0.0 to 1.0) */
  kgCentrality: number;
}

export interface RankingConfig {
  /** Weight for similarity */
  alpha: number;
  /** Weight for popularity */
  beta: number;
  /** Weight for freshness */
  gamma: number;
  /** Weight for user affinity */
  delta: number;
  /** Weight for category repetition penalty */
  epsilon: number;
  /** Weight for contextual relevance */
  zeta: number;
  /** Weight for knowledge graph centrality */
  eta: number;
}

export interface SMMRConfig {
  /** Balance trade-off between relevance and diversity (0 to 1) */
  lambda: number;
  /** Size of the sample pool for diversity selection */
  sampleSize: number;
  /** Softmax temperature for stochastic sampling */
  temperature: number;
  /** If true, falls back to deterministic argmax selection (equivalent to temp -> 0) */
  deterministic: boolean;
}

export interface ItemMetadata {
  id: string;
  category: string;
  createdAt: number;
  popularity: number;
  attributes: Record<string, string | number>;
}

export interface KGEnricherConfig {
  maxPathLength: number;
  pathWeight: number;
  minPathScore: number;
}

export interface RequestContext {
  timestamp: number;
  device?: 'mobile' | 'desktop' | 'tablet';
  sessionId?: string;
  hourOfDay?: number;
  dayOfWeek?: number;
  language?: string;
}

export interface FeedbackEvent {
  userId: string;
  itemId: string;
  eventType: 'click' | 'like' | 'purchase' | 'ignore' | 'dislike';
  timestamp: number;
  context?: RequestContext;
}

export interface Candidate {
  id: string;
  source: 'similarity' | 'user_affinity' | 'popularity' | 'freshness' | 'kg';
  rawScore: number;
  embedding: Float32Array;
}
