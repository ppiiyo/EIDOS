import {
  UserTower,
  MetadataStore,
  Ranker,
  SMMR,
  KGEnricher,
  ContextSignals,
  FeedbackLoop,
  CandidateFusion,
} from '@eidos/core';

export class AILManager {
  private static instance: AILManager | null = null;

  public readonly userTower: UserTower;
  public readonly metadataStore: MetadataStore;
  public readonly ranker: Ranker;
  public readonly smmr: SMMR;
  public readonly kgEnricher: KGEnricher;
  public readonly contextSignals: ContextSignals;
  public readonly feedbackLoop: FeedbackLoop;
  public readonly candidateFusion: CandidateFusion;

  private constructor() {
    this.userTower = new UserTower({
      maxHistoryLength: parseInt(process.env.AIL_USER_HISTORY_MAX || '50', 10),
      recencyDecay: parseFloat(process.env.AIL_USER_RECENCY_DECAY || '0.95'),
    });

    this.metadataStore = new MetadataStore();

    this.ranker = new Ranker({
      alpha: parseFloat(process.env.AIL_ALPHA || '0.45'),
      beta: parseFloat(process.env.AIL_BETA || '0.15'),
      gamma: parseFloat(process.env.AIL_GAMMA || '0.10'),
      delta: parseFloat(process.env.AIL_DELTA || '0.20'),
      epsilon: parseFloat(process.env.AIL_EPSILON || '0.05'),
      zeta: parseFloat(process.env.AIL_ZETA || '0.03'),
      eta: parseFloat(process.env.AIL_ETA || '0.02'),
    });

    this.smmr = new SMMR({
      lambda: parseFloat(process.env.AIL_SMMR_LAMBDA || '0.7'),
      sampleSize: parseInt(process.env.AIL_SMMR_SAMPLE_SIZE || '10', 10),
      temperature: parseFloat(process.env.AIL_SMMR_TEMPERATURE || '0.5'),
    });

    // In-memory knowledge graph representation
    const kg = new Map<string, { connections: Map<string, number> }>();
    this.kgEnricher = new KGEnricher(kg);

    this.contextSignals = new ContextSignals();

    this.feedbackLoop = new FeedbackLoop({
      learningRate: parseFloat(process.env.AIL_FEEDBACK_LEARNING_RATE || '0.01'),
    });

    this.candidateFusion = new CandidateFusion();
  }

  public static getInstance(): AILManager {
    if (!AILManager.instance) {
      AILManager.instance = new AILManager();
    }
    return AILManager.instance;
  }

  public static isEnabled(): boolean {
    return process.env.AIL_ENABLED === 'true';
  }
}
