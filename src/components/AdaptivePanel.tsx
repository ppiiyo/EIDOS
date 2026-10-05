import React, { useState, useMemo, useEffect } from 'react';
import { CatalogItem } from '../types';
import {
  RankingConfig,
  RankingFeatures,
  SMMRConfig,
  ExplainabilityEngine,
  calculateMMRScore,
  cosineSimilarity,
  MultiInterestUserTower,
  MultiInterestProfile,
  BanditExplorer,
  HNSWIndex,
  ScalarQuantizer,
  VectorSteering,
  SteeringModifier,
} from '@eidos/core';
import {
  Sliders,
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  Compass,
  UserCheck,
  Network,
  Info,
  Layers,
  Database,
  Cpu,
  ThumbsUp,
  ShoppingCart,
  ThumbsDown,
  RotateCcw,
  Plus,
} from 'lucide-react';

interface AdaptivePanelProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const AdaptivePanel: React.FC<AdaptivePanelProps> = ({
  catalog,
  embeddings,
  selectedItem,
  onSelectItem,
  onShowToast,
}) => {
  const currentSeed = selectedItem || catalog[0];
  const [activeSubTab, setActiveSubTab] = useState<'ranker' | 'capsules' | 'bandits' | 'hnsw' | 'steering'>('ranker');

  // 1. Ranker Weights
  const [rankingConfig, setRankingConfig] = useState<RankingConfig>({
    alpha: 0.4, // similarity
    beta: 0.15, // popularity
    gamma: 0.15, // freshness
    delta: 0.2, // userAffinity
    epsilon: 0.1, // categoryRepetition
    zeta: 0.1, // contextualRelevance
    eta: 0.1, // kgCentrality
  });

  const [smmrConfig, setSmmrConfig] = useState<SMMRConfig>({
    lambda: 0.65,
    sampleSize: 12,
    temperature: 0.3,
    deterministic: true,
  });

  // 2. Multi-Interest Tower
  const [capsuleHistory, setCapsuleHistory] = useState<number[]>([1, 2, 3, 5, 8]);
  const [capsuleProfile, setCapsuleProfile] = useState<MultiInterestProfile | null>(null);

  const tower = useMemo(() => {
    return new MultiInterestUserTower({
      maxInterests: 3,
      routingIterations: 4,
      temperature: 0.2,
      normalization: 'l2',
    });
  }, []);

  useEffect(() => {
    let active = true;
    tower
      .buildProfile(
        'user_demo',
        capsuleHistory.map(String),
        async (id) => embeddings.get(Number(id)) || new Float32Array(384).fill(0.1),
        (id) => catalog.find((c) => c.id === Number(id))?.category || 'General'
      )
      .then((p) => {
        if (active) setCapsuleProfile(p);
      });

    return () => {
      active = false;
    };
  }, [tower, capsuleHistory, catalog, embeddings]);

  // 3. Bandits Simulator
  const [banditStrategy, setBanditStrategy] = useState<'linucb' | 'thompson'>('linucb');
  const [banditExplorer, setBanditExplorer] = useState(() => {
    return new BanditExplorer({ featureDimension: 4, alpha: 0.8, strategy: 'linucb' });
  });
  const [banditEventCount, setBanditEventCount] = useState(0);

  const handleBanditAction = (itemId: string, eventType: 'click' | 'purchase' | 'like' | 'dislike') => {
    banditExplorer.updateFromFeedback(
      { userId: 'user', itemId, eventType, timestamp: Date.now() },
      new Float32Array([1.0, 0.5, 0.2, 0.8])
    );
    setBanditEventCount((c) => c + 1);
    if (onShowToast) onShowToast(`Bandit event: ${eventType} on item #${itemId}`, 'info');
  };

  // 4. Vector Steering
  const [steeringModifiers, setSteeringModifiers] = useState<
    Array<{ label: string; type: 'positive' | 'negative'; weight: number; vector: Float32Array }>
  >([
    { label: 'Минималистичный премиум', type: 'positive', weight: 0.6, vector: new Float32Array(384).fill(0.08) },
    { label: 'Бюджетный пластик', type: 'negative', weight: 0.5, vector: new Float32Array(384).fill(-0.06) },
  ]);
  const [newSteerLabel, setNewSteerLabel] = useState('');
  const [newSteerType, setNewSteerType] = useState<'positive' | 'negative'>('positive');

  // Compute Live Ranker Output
  const rankedResults = useMemo(() => {
    if (!currentSeed) return [];
    const seedEmb = embeddings.get(currentSeed.id);
    if (!seedEmb) return [];

    const candidates = catalog.filter((c) => c.id !== currentSeed.id);

    const scored = candidates.map((cand) => {
      const candEmb = embeddings.get(cand.id);
      const sim = candEmb ? cosineSimilarity(Array.from(seedEmb), Array.from(candEmb)) : 0.4;
      const popularity = Math.min(1.0, (cand.reviews || 500) / 15000);
      const freshness = ((cand.id * 19) % 100) / 100;
      const userAffinity = sim * 0.9;
      const categoryRepetition = cand.category === currentSeed.category ? 0.3 : 0.0;
      const contextualRelevance = 0.75;
      const kgCentrality = cand.category === currentSeed.category ? 0.8 : 0.3;

      const features: RankingFeatures = {
        similarity: sim,
        popularity,
        freshness,
        userAffinity,
        categoryRepetition,
        contextualRelevance,
        kgCentrality,
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
        String(cand.id),
        features,
        rankingConfig,
        capsuleHistory.map(String),
        [],
        'ru'
      );

      return { item: cand, score, features, explanation };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }, [currentSeed, catalog, embeddings, rankingConfig, capsuleHistory]);

  return (
    <div className="flex flex-col gap-6 bg-[#0a0a14] border border-[#1b1b30] rounded-2xl p-6 shadow-2xl">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1b1b30] flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-[#121222] p-1.5 rounded-xl border border-[#20203a]">
          <button
            onClick={() => setActiveSubTab('ranker')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeSubTab === 'ranker'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Multi-Feature Ranker</span>
          </button>

          <button
            onClick={() => setActiveSubTab('capsules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeSubTab === 'capsules'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm font-semibold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Interest Capsules</span>
          </button>

          <button
            onClick={() => setActiveSubTab('bandits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeSubTab === 'bandits'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Contextual Bandits (LinUCB)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('steering')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              activeSubTab === 'steering'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                : 'text-[#8a8aa3] hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Vector Steering</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>AIL Core Engine Active</span>
        </div>
      </div>

      {/* SUB-VIEW 1: MULTI-FEATURE RANKER */}
      {activeSubTab === 'ranker' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sliders Column */}
          <div className="bg-[#101020] border border-[#1e1e35] p-5 rounded-2xl flex flex-col gap-4">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block">
              Ranker Weight Parameters
            </span>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#a0a0be]">α Semantic Cosine</span>
                <span className="text-cyan-400 font-bold">{rankingConfig.alpha.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingConfig.alpha}
                onChange={(e) => setRankingConfig({ ...rankingConfig, alpha: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1.5 bg-[#18182e] rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#a0a0be]">δ User History Affinity</span>
                <span className="text-purple-400 font-bold">{rankingConfig.delta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingConfig.delta}
                onChange={(e) => setRankingConfig({ ...rankingConfig, delta: parseFloat(e.target.value) })}
                className="w-full accent-purple-400 h-1.5 bg-[#18182e] rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#a0a0be]">β Popularity Score</span>
                <span className="text-emerald-400 font-bold">{rankingConfig.beta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingConfig.beta}
                onChange={(e) => setRankingConfig({ ...rankingConfig, beta: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400 h-1.5 bg-[#18182e] rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#a0a0be]">λ SMMR Diversity Balance</span>
                <span className="text-rose-400 font-bold">{smmrConfig.lambda.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={smmrConfig.lambda}
                onChange={(e) => setSmmrConfig({ ...smmrConfig, lambda: parseFloat(e.target.value) })}
                className="w-full accent-rose-400 h-1.5 bg-[#18182e] rounded-lg"
              />
            </div>
          </div>

          {/* Results Column */}
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

      {/* SUB-VIEW 2: MULTI-INTEREST CAPSULES */}
      {activeSubTab === 'capsules' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#8a8aa3]">
            MIND / ComiRec-DR dynamic routing partitions the user's sequential history into isolated interest vectors instead of blurring them into one single centroid.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capsuleProfile?.interestEmbeddings.map((emb, idx) => {
              const weight = capsuleProfile.interestWeights[idx] || 0;
              const cats = capsuleProfile.interestCategories[idx] || [];

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/15 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-400">CAPSULE #{idx + 1}</span>
                    <span className="text-xs font-mono text-white font-bold">{(weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-[#141424] rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${weight * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cats.map((c) => (
                      <span key={c} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18182e] text-white">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: CONTEXTUAL BANDITS */}
      {activeSubTab === 'bandits' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8a8aa3]">
              LinUCB dynamically explores unpulled items by adding an upper confidence bound bonus (α·σ) to expected reward.
            </p>
            <div className="flex items-center gap-1 bg-[#121222] p-1 rounded-lg border border-[#202036]">
              <button
                onClick={() => setBanditStrategy('linucb')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  banditStrategy === 'linucb' ? 'bg-amber-500/20 text-amber-300' : 'text-[#8a8aa3]'
                }`}
              >
                LinUCB
              </button>
              <button
                onClick={() => setBanditStrategy('thompson')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  banditStrategy === 'thompson' ? 'bg-purple-500/20 text-purple-300' : 'text-[#8a8aa3]'
                }`}
              >
                Thompson
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {catalog.slice(0, 4).map((it) => {
              const score = banditExplorer.predictArm(String(it.id), new Float32Array([1.0, 0.5, 0.2, 0.8]));
              const arm = banditExplorer.getArmState(String(it.id));

              return (
                <div key={it.id} className="p-3.5 rounded-xl bg-[#121222] border border-[#1e1e32] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{it.title.slice(0, 18)}...</span>
                    <span className="text-xs font-mono text-amber-400 font-bold">{score.finalScore.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#8a8aa3]">
                    Expected: {score.expectedReward.toFixed(2)} · Pulls: {arm?.pulls || 0}
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <button
                      onClick={() => handleBanditAction(String(it.id), 'click')}
                      className="py-1 px-1 bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 rounded text-[10px] font-mono"
                    >
                      Click
                    </button>
                    <button
                      onClick={() => handleBanditAction(String(it.id), 'purchase')}
                      className="py-1 px-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-mono"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => handleBanditAction(String(it.id), 'dislike')}
                      className="py-1 px-1 bg-rose-950/40 text-rose-400 border border-rose-800/40 rounded text-[10px] font-mono"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: VECTOR STEERING */}
      {activeSubTab === 'steering' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#8a8aa3]">
            Vector Steering applies directional arithmetic to modify queries with positive and negative concept modifiers while respecting angular safety bounds.
          </p>

          <div className="space-y-2">
            {steeringModifiers.map((mod, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[#121222] border border-[#1e1e32] flex items-center justify-between">
                <span className="text-xs font-mono text-white">
                  {mod.type === 'positive' ? '🟢 + ' : '🔴 - '} {mod.label} (weight: {mod.weight})
                </span>
                <button
                  onClick={() => setSteeringModifiers(steeringModifiers.filter((_, idx) => idx !== i))}
                  className="text-xs text-[#6c6c88] hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
