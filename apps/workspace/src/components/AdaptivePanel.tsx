import React, { useState, useMemo, useEffect } from "react";
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

interface AdaptivePanelProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const AdaptivePanel: React.FC<AdaptivePanelProps> = ({
  catalog,
  embeddings,
  selectedItem,
  onShowToast,
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
          String(cand.id), features, rankingConfig, capsuleHistory.map(String), [], 'ru'
        );
        return { item: cand, score, features, explanation };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [currentSeed, catalog, embeddings, rankingConfig, capsuleHistory]);

  return (
    <div className="flex flex-col gap-6 bg-[#0E0E12] border border-[#222228] rounded-xl p-6 shadow-xs text-[#F5F5F5]">
      <div className="flex items-center justify-between pb-4 border-b border-[#222228] flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-[#141418] p-1 rounded-lg border border-[#26262B]">
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === id ? 'bg-[#2563EB] text-white' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#10B981]">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>AIL Core Engine Active</span>
        </div>
      </div>

      {activeSubTab === 'ranker' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#101020] border border-[#1e1e35] p-5 rounded-2xl flex flex-col gap-4">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block">
              Ranker Weight Parameters
            </span>
            {[
              { label: 'α Semantic Cosine', val: rankingConfig.alpha, key: 'alpha' as const, color: 'text-cyan-400' },
              { label: 'δ User History Affinity', val: rankingConfig.delta, key: 'delta' as const, color: 'text-purple-400' },
              { label: 'β Popularity Score', val: rankingConfig.beta, key: 'beta' as const, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.key}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-[#a0a0be]">{s.label}</span>
                  <span className={`${s.color} font-bold`}>{s.val.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05" value={s.val}
                  onChange={(e) => setRankingConfig({ ...rankingConfig, [s.key]: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 h-1.5 bg-[#18182e] rounded-lg"
                />
              </div>
            ))}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#a0a0be]">λ SMMR Diversity Balance</span>
                <span className="text-rose-400 font-bold">{smmrConfig.lambda.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.1" max="0.95" step="0.05" value={smmrConfig.lambda}
                onChange={(e) => setSmmrConfig({ ...smmrConfig, lambda: parseFloat(e.target.value) })}
                className="w-full accent-rose-400 h-1.5 bg-[#18182e] rounded-lg"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-3">
            <span className="text-xs font-mono text-[#8a8aa3] uppercase tracking-wider block mb-1">
              Top Adaptive Recommendations (Composite Scoring)
            </span>
            {rankedResults.map((res, idx) => (
              <div
                key={res.item.id}
                className="p-3.5 rounded-xl bg-[#121222] border border-[#1e1e32] hover:border-cyan-500/40 transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-cyan-400">#{idx + 1}</span>
                    <span className="text-base">{res.item.icon || '💎'}</span>
                    <h5 className="text-xs font-semibold text-white">{res.item.title}</h5>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {(res.score * 100).toFixed(1)} score
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#8a8aa3] pt-2 border-t border-[#18182a]">
                  <span className="text-[#9e9ec0]">{res.explanation.summary}</span>
                  <span className="text-cyan-400">{res.item.price}</span>
                </div>
              </div>
            ))}
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
