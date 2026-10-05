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

export interface MultiInterestProfile {
  userId: string;
  history: string[];
  /** Multiple distinct interest cluster vectors (e.g. 2 to 4 capsules) */
  interestEmbeddings: Float32Array[];
  /** Relative weight/importance of each interest cluster (sums to 1.0) */
  interestWeights: number[];
  /** Associated top categories or labels for each interest cluster */
  interestCategories: string[][];
  categoryDistribution: Map<string, number>;
  updatedAt: number;
}

export interface MultiInterestConfig {
  /** Maximum number of interest capsules to form (default: 3) */
  maxInterests: number;
  /** Maximum number of history items considered for clustering */
  maxHistoryLength: number;
  /** Decay factor per positional step away from the newest item (0 < recencyDecay <= 1) */
  recencyDecay: number;
  /** Number of dynamic routing / spherical clustering iterations (default: 3) */
  routingIterations: number;
  /** Temperature factor for routing softmax assignment (default: 0.2) */
  temperature: number;
  /** Vector normalization method */
  normalization: 'l2' | 'none';
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

export interface BanditArmState {
  armId: string;
  pulls: number;
  totalReward: number;
  /** Flattened d x d inverse covariance matrix */
  aInv: Float32Array;
  /** Accumulated context-reward vector in R^d */
  b: Float32Array;
  /** Estimated linear weights theta = A_inv * b */
  theta: Float32Array;
  lastUpdated: number;
}

export interface BanditConfig {
  /** Feature dimension of context vector (e.g. 4 to 32) */
  featureDimension: number;
  /** Exploration coefficient alpha for LinUCB (default: 0.5) */
  alpha: number;
  /** Regularization parameter lambda (default: 1.0) */
  lambda: number;
  /** Bandit algorithm: 'linucb' or 'thompson' */
  strategy: 'linucb' | 'thompson';
  /** Variance scale for Thompson sampling (default: 0.25) */
  varianceScale: number;
}

export interface BanditArmScore {
  armId: string;
  expectedReward: number;
  explorationBonus: number;
  finalScore: number;
}

export interface RecommendationExplanation {
  itemId: string;
  summary: string;
  confidence: number;
  primaryDriver: 'similarity' | 'user_affinity' | 'popularity' | 'freshness' | 'kg_path' | 'context';
  attributions: Array<{ feature: string; percentage: number; scoreContribution: number }>;
  kgPath?: {
    sourceItemId: string;
    relation: string;
    hops: number;
    similarity: number;
  };
}

export interface SteeringModifier {
  vector: Float32Array;
  weight: number;
  type: 'positive' | 'negative';
  label?: string;
}

export interface SteeringConfig {
  /** Base vector weight multiplier (default: 1.0) */
  baseWeight: number;
  /** Maximum allowable angular deviation from base vector (cosine distance clamp, default: 0.75) */
  maxAngularDeviation: number;
  /** Normalization rule for the steered vector */
  normalization: 'l2' | 'none';
}

export interface CrossEncoderCandidate {
  id: string;
  title?: string;
  category?: string;
  tags?: string[];
  embedding: Float32Array;
  baseScore: number;
}

export interface CrossEncoderQuery {
  id?: string;
  title?: string;
  category?: string;
  tags?: string[];
  embedding: Float32Array;
}

export interface CrossEncoderResult {
  id: string;
  crossScore: number;
  baseScore: number;
  blendedScore: number;
  tokenOverlap: number;
}

export interface CrossEncoderConfig {
  /** Weight assigned to the deep cross-interaction score (0.0 to 1.0, default: 0.6) */
  crossWeight: number;
  /** Weight assigned to lexical/tag/attribute alignment (default: 0.2) */
  attributeWeight: number;
  /** Sigmoid temperature scale (default: 1.0) */
  temperature: number;
}



