import { GraphEdge } from '../types';
import { RankingConfig, RankingFeatures, RecommendationExplanation } from './types';

/**
 * ExplainabilityEngine generates transparent attribution scores and human-readable
 * justifications for recommendations produced by the Multi-Feature Ranker and Knowledge Graph.
 */
export class ExplainabilityEngine {
  /**
   * Generates a comprehensive explanation for a recommended item.
   *
   * @param itemId - Unique identifier of the recommended item
   * @param features - Evaluated ranking features for the candidate
   * @param config - Weight configuration applied during ranking
   * @param userHistory - Optional user history item IDs for knowledge graph link traversal
   * @param graphEdges - Optional graph edges from semantic knowledge graph
   * @param locale - Output language ('en' | 'ru', default: 'ru')
   * @returns RecommendationExplanation containing percentage attributions and human summary
   */
  public static explain(
    itemId: string,
    features: RankingFeatures,
    config: RankingConfig,
    userHistory?: string[],
    graphEdges?: GraphEdge[],
    locale: 'en' | 'ru' = 'ru'
  ): RecommendationExplanation {
    // 1. Calculate positive contributions
    const rawAttributions = [
      {
        feature: 'similarity',
        labelRu: 'Семантическое сходство',
        labelEn: 'Semantic Similarity',
        scoreContribution: Math.max(0, config.alpha * features.similarity),
        driver: 'similarity' as const,
      },
      {
        feature: 'userAffinity',
        labelRu: 'Персональные предпочтения',
        labelEn: 'Personal User Affinity',
        scoreContribution: Math.max(0, config.delta * features.userAffinity),
        driver: 'user_affinity' as const,
      },
      {
        feature: 'kgCentrality',
        labelRu: 'Связи в графе знаний',
        labelEn: 'Knowledge Graph Proximity',
        scoreContribution: Math.max(0, config.eta * features.kgCentrality),
        driver: 'kg_path' as const,
      },
      {
        feature: 'freshness',
        labelRu: 'Свежесть и новизна',
        labelEn: 'Catalog Freshness',
        scoreContribution: Math.max(0, config.gamma * features.freshness),
        driver: 'freshness' as const,
      },
      {
        feature: 'popularity',
        labelRu: 'Общая популярность',
        labelEn: 'Popularity Momentum',
        scoreContribution: Math.max(0, config.beta * features.popularity),
        driver: 'popularity' as const,
      },
      {
        feature: 'contextualRelevance',
        labelRu: 'Контекст (время/устройство)',
        labelEn: 'Contextual Signals',
        scoreContribution: Math.max(0, config.zeta * features.contextualRelevance),
        driver: 'context' as const,
      },
    ];

    const totalContribution = rawAttributions.reduce((sum, a) => sum + a.scoreContribution, 0);
    const safeTotal = totalContribution > 1e-6 ? totalContribution : 1.0;

    const attributions = rawAttributions.map((a) => ({
      feature: a.feature,
      percentage: Math.round((a.scoreContribution / safeTotal) * 100),
      scoreContribution: Math.round(a.scoreContribution * 1000) / 1000,
    }));

    // Find primary driver (highest positive score contribution)
    rawAttributions.sort((a, b) => b.scoreContribution - a.scoreContribution);
    const topDriver = rawAttributions[0];

    // 2. Knowledge graph path trace if user history and graph edges exist
    let kgPath: RecommendationExplanation['kgPath'] | undefined;

    if (userHistory && userHistory.length > 0 && graphEdges && graphEdges.length > 0) {
      const historySet = new Set(userHistory);
      // Find direct or reverse edge connecting itemId with an item in user history
      const relevantEdge = graphEdges.find(
        (e) =>
          (e.source === itemId && historySet.has(e.target)) ||
          (e.target === itemId && historySet.has(e.source))
      );

      if (relevantEdge) {
        const sourceItemId = relevantEdge.source === itemId ? relevantEdge.target : relevantEdge.source;
        kgPath = {
          sourceItemId,
          relation: 'semantic_adjacent',
          hops: 1,
          similarity: relevantEdge.weight,
        };
      }
    }

    // 3. Compose localized human-readable summary
    let summary = '';
    const pct = Math.round((topDriver.scoreContribution / safeTotal) * 100);

    if (locale === 'ru') {
      if (kgPath) {
        summary = `Рекомендовано на основе связи с ранее просмотренным объектом «${kgPath.sourceItemId}» (сходство ${Math.round(kgPath.similarity * 100)}%).`;
      } else if (topDriver.driver === 'user_affinity') {
        summary = `Точно соответствует вашему персональному профилю интересов (вклад фактора: ${pct}%).`;
      } else if (topDriver.driver === 'similarity') {
        summary = `Высокое концептуальное соответствие просматриваемому объекту (вклад фактора: ${pct}%).`;
      } else if (topDriver.driver === 'freshness') {
        summary = `Недавнее поступление с высоким рейтингом актуальности (вклад фактора: ${pct}%).`;
      } else if (topDriver.driver === 'popularity') {
        summary = `Популярный хит каталога с высокой активностью пользователей (вклад фактора: ${pct}%).`;
      } else {
        summary = `Оптимально подходит под текущий контекст взаимодействия (вклад фактора: ${pct}%).`;
      }
    } else {
      if (kgPath) {
        summary = `Recommended based on conceptual proximity to «${kgPath.sourceItemId}» from your history (${Math.round(kgPath.similarity * 100)}% match).`;
      } else if (topDriver.driver === 'user_affinity') {
        summary = `Strongly aligns with your long-term taste profile (${pct}% attribution).`;
      } else if (topDriver.driver === 'similarity') {
        summary = `High conceptual affinity with the current item (${pct}% attribution).`;
      } else if (topDriver.driver === 'freshness') {
        summary = `Trending recent addition to the catalog (${pct}% attribution).`;
      } else if (topDriver.driver === 'popularity') {
        summary = `Top catalog item with verified engagement momentum (${pct}% attribution).`;
      } else {
        summary = `Contextually relevant to your current session (${pct}% attribution).`;
      }
    }

    const confidence = Math.min(1.0, Math.max(0.1, totalContribution));

    return {
      itemId,
      summary,
      confidence: Math.round(confidence * 100) / 100,
      primaryDriver: kgPath ? 'kg_path' : topDriver.driver,
      attributions,
      kgPath,
    };
  }
}
