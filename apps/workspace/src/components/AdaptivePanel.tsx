import React, { useState, useMemo, useEffect } from 'react';
import { CatalogItem } from '../types';
import {
  RankingConfig,
  RankingFeatures,
  SMMRConfig,
  ExplainabilityEngine,
  cosineSimilarity,
  MultiInterestUserTower,
  MultiInterestProfile,
  BanditExplorer,
} from '@eidos/core';
import { Sliders, Layers, Zap, Compass } from 'lucide-react';
import { computeTextEmbedding } from '../utils/recommenderEngine';
import {
  CapsulesSubView,
  BanditsSubView,
  SteeringSubView,
} from './adaptive/AdaptiveSubViews';
import { UiLanguage } from '../i18n/uiTranslations';

interface AdaptivePanelProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  uiLang?: UiLanguage;
}

export const AdaptivePanel: React.FC<AdaptivePanelProps> = ({
  catalog,
  embeddings,
  selectedItem,
  onShowToast,
  uiLang = 'ru',
}) => {
  const currentSeed = selectedItem || catalog[0];
  const [activeSubTab, setActiveSubTab] = useState<'ranker' | 'capsules' | 'bandits' | 'steering'>('ranker');

  const [rankingConfig, setRankingConfig] = useState<RankingConfig>({
    alpha: 0.4, beta: 0.15, gamma: 0.15, delta: 0.2, epsilon: 0.1, zeta: 0.1, eta: 0.1,
  });
  const [smmrConfig, setSmmrConfig] = useState<SMMRConfig>({
    lambda: 0.65, sampleSize: 12, temperature: 0.3, deterministic: true,
  });
  const [capsuleHistory] = useState<number[]>([1, 2, 3, 5, 8]);
  const [capsuleProfile, setCapsuleProfile] = useState<MultiInterestProfile | null>(null);

  const tower = useMemo(
    () => new MultiInterestUserTower({ maxInterests: 3, routingIterations: 4, temperature: 0.2, normalization: 'l2' }),
    []
  );

  useEffect(() => {
    let active = true;
    tower
      .buildProfile(
        'user_demo',
        capsuleHistory.map(String),
        async (id) => embeddings.get(id) || new Float32Array(384).fill(0.1),
        (id) => catalog.find((c) => c.id === id)?.category || 'General'
      )
      .then((p) => { if (active) setCapsuleProfile(p); });
    return () => { active = false; };
  }, [tower, capsuleHistory, catalog, embeddings]);

  const [banditStrategy, setBanditStrategy] = useState<'linucb' | 'thompson'>('linucb');
  const [banditEvents, setBanditEvents] = useState<
    Array<{ itemId: string; eventType: 'click' | 'purchase' | 'like' | 'dislike' }>
  >([]);

  const banditExplorer = useMemo(() => {
    const explorer = new BanditExplorer({ featureDimension: 4, alpha: 0.8, strategy: banditStrategy });
    const ctx = new Float32Array([1.0, 0.5, 0.2, 0.8]);
    for (const ev of banditEvents) {
      explorer.updateFromFeedback({ userId: 'user', itemId: ev.itemId, eventType: ev.eventType, timestamp: Date.now() }, ctx);
    }
    return explorer;
  }, [banditStrategy, banditEvents]);

  const handleBanditAction = (itemId: string, eventType: 'click' | 'purchase' | 'like' | 'dislike') => {
    setBanditEvents((prev) => [...prev, { itemId, eventType }]);
    if (onShowToast) onShowToast(`Bandit event: ${eventType} on item #${itemId}`, 'info');
  };

  const [steeringModifiers, setSteeringModifiers] = useState<
    Array<{ label: string; type: 'positive' | 'negative'; weight: number; vector: Float32Array }>
  >(() => [
    { label: 'Минималистичный премиум', type: 'positive', weight: 0.6, vector: computeTextEmbedding('query: минималистичный премиум техника дизайн') },
    { label: 'Бюджетный пластик', type: 'negative', weight: 0.5, vector: computeTextEmbedding('query: дешевый бюджетный пластик') },
  ]);

  const rankedResults = useMemo(() => {
    if (!currentSeed) return [];
    const seedEmb = embeddings.get(currentSeed.id);
    if (!seedEmb) return [];
    const explainLang = uiLang === 'ru' ? 'ru' : 'en';

    return catalog
      .filter((c) => c.id !== currentSeed.id)
      .map((cand) => {
        const candEmb = embeddings.get(cand.id);
        const sim = candEmb ? cosineSimilarity(Array.from(seedEmb), Array.from(candEmb)) : 0.4;
        const popularity = Math.min(1.0, (cand.reviews || 500) / 15000);
        const idNum = parseInt(cand.id.replace(/\D/g, ''), 10) || 1;
        const freshness = ((idNum * 19) % 100) / 100;
        const features: RankingFeatures = {
          similarity: sim,
          popularity,
          freshness,
          userAffinity: sim * 0.9,
          categoryRepetition: cand.category === currentSeed.category ? 0.3 : 0.0,
          contextualRelevance: 0.75,
          kgCentrality: cand.category === currentSeed.category ? 0.8 : 0.3,
        };
        const score =
          rankingConfig.alpha * features.similarity +
          rankingConfig.beta * features.popularity +
          rankingConfig.gamma * features.freshness +
          rankingConfig.delta * features.userAffinity -
          rankingConfig.epsilon * features.categoryRepetition +
          rankingConfig.zeta * features.contextualRelevance +
          rankingConfig.eta * features.kgCentrality;

        const explanation = ExplainabilityEngine.explain(
          String(cand.id), features, rankingConfig, capsuleHistory.map(String), [], explainLang
        );
        return { item: cand, score, features, explanation };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [currentSeed, catalog, embeddings, rankingConfig, capsuleHistory, uiLang]);

  return (
    <div className="page" data-testid="adaptive-intelligence-lab">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">⚙️ Adaptive Intelligence Lab</h1>
          <p className="page-sub">
            Multi-feature composite ranking, MIND/ComiRec interest capsules, LinUCB contextual bandits, and 384-d vector steering
          </p>
        </div>
        <span className="badge badge-success mono">● AIL Core Engine Active</span>
      </div>

      {/* Sub-navigation tabs aligned with studio design system */}
      <div className="card p-2 mb-6 flex flex-wrap items-center gap-1.5">
        {[
          { id: 'ranker' as const, label: 'Multi-Feature Ranker', icon: Sliders },
          { id: 'capsules' as const, label: 'Multi-Interest Capsules', icon: Layers },
          { id: 'bandits' as const, label: 'Contextual Bandits (LinUCB)', icon: Zap },
          { id: 'steering' as const, label: 'Vector Steering', icon: Compass },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSubTab(id)}
            className={`btn btn-sm ${activeSubTab === id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeSubTab === 'ranker' && (
        <div className="playground-layout">
          <div className="controls-panel card">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4">
              Ranker Weight Parameters
            </h3>
            {[
              { label: 'α Semantic Cosine', val: rankingConfig.alpha, key: 'alpha' as const },
              { label: 'δ User History Affinity', val: rankingConfig.delta, key: 'delta' as const },
              { label: 'β Popularity Score', val: rankingConfig.beta, key: 'beta' as const },
            ].map((s) => (
              <div key={s.key} className="slider-group">
                <div className="slider-header">
                  <span>{s.label}</span>
                  <span className="slider-value">{s.val.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.val}
                  onChange={(e) =>
                    setRankingConfig({ ...rankingConfig, [s.key]: parseFloat(e.target.value) })
                  }
                />
              </div>
            ))}
            <div className="slider-group mb-0">
              <div className="slider-header">
                <span>λ SMMR Diversity Balance</span>
                <span className="slider-value">{smmrConfig.lambda.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={smmrConfig.lambda}
                onChange={(e) =>
                  setSmmrConfig({ ...smmrConfig, lambda: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Top Adaptive Recommendations (Composite Scoring)
              </h3>
              {currentSeed && (
                <span className="badge badge-neutral">Anchor: {currentSeed.title}</span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {rankedResults.map((res, idx) => (
                <div key={res.item.id} className="result-card-live mb-0">
                  <div className="result-header mb-2">
                    <span className="rank-badge mono">#{idx + 1}</span>
                    <span className="text-base">{res.item.icon || '📦'}</span>
                    <div className="result-info">
                      <h4>{res.item.title}</h4>
                      <span className="text-xs text-[var(--text-sec)]">{res.item.category}</span>
                    </div>
                    <span className="badge badge-accent mono">
                      {(res.score * 100).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-sec)] pt-2 border-t border-[var(--border)]">
                    <span>{res.explanation.summary}</span>
                    <span className="mono font-semibold text-[var(--text)]">{res.item.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'capsules' && <CapsulesSubView capsuleProfile={capsuleProfile} />}
      {activeSubTab === 'bandits' && (
        <BanditsSubView
          catalog={catalog}
          banditStrategy={banditStrategy}
          banditExplorer={banditExplorer}
          banditEventCount={banditEvents.length}
          onChangeStrategy={setBanditStrategy}
          onBanditAction={handleBanditAction}
        />
      )}
      {activeSubTab === 'steering' && (
        <SteeringSubView
          currentSeed={currentSeed}
          catalog={catalog}
          embeddings={embeddings}
          steeringModifiers={steeringModifiers}
          onAddModifier={(label, type) =>
            setSteeringModifiers((prev) => [
              ...prev,
              { label, type, weight: 0.6, vector: computeTextEmbedding(`query: ${label}`) },
            ])
          }
          onRemoveModifier={(idx) =>
            setSteeringModifiers((prev) => prev.filter((_, i) => i !== idx))
          }
        />
      )}
    </div>
  );
};
