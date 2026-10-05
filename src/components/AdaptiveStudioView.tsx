import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../types';
import {
  RankingConfig,
  RankingFeatures,
  SMMRConfig,
  ExplainabilityEngine,
  calculateMMRScore,
  cosineSimilarity,
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
  ChevronRight,
} from 'lucide-react';

interface AdaptiveStudioViewProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
  onSelectSeed: (item: CatalogItem) => void;
  seedItem: CatalogItem | null;
}

export const AdaptiveStudioView: React.FC<AdaptiveStudioViewProps> = ({
  catalog,
  embeddings,
  onSelectSeed,
  seedItem,
}) => {
  const currentSeed = seedItem || catalog[0];

  // Ranking weights configuration
  const [config, setConfig] = useState<RankingConfig>({
    alpha: 0.4, // similarity
    beta: 0.15, // popularity
    gamma: 0.15, // freshness
    delta: 0.2, // userAffinity
    epsilon: 0.1, // categoryRepetition
    zeta: 0.1, // contextualRelevance
    eta: 0.1, // kgCentrality
  });

  // Diversity SMMR configuration
  const [smmrConfig, setSmmrConfig] = useState<SMMRConfig>({
    lambda: 0.65,
    sampleSize: 12,
    temperature: 0.3,
    deterministic: true,
  });

  // User simulated interaction history
  const [userHistoryIds, setUserHistoryIds] = useState<number[]>([1, 3, 5]);

  // Request context signals
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [timeContext, setTimeContext] = useState<'day' | 'night'>('day');

  // Compute live ranking and explainability
  const rankedResults = useMemo(() => {
    if (!currentSeed) return [];
    const seedEmb = embeddings.get(currentSeed.id);
    if (!seedEmb) return [];

    const candidates = catalog.filter((c) => c.id !== currentSeed.id);

    // Compute user centroid embedding from history
    const userCentroid = new Float32Array(seedEmb.length);
    let historyCount = 0;
    userHistoryIds.forEach((hId) => {
      const hEmb = embeddings.get(hId);
      if (hEmb) {
        for (let d = 0; d < hEmb.length; d++) {
          userCentroid[d] += hEmb[d];
        }
        historyCount++;
      }
    });
    if (historyCount > 0) {
      for (let d = 0; d < userCentroid.length; d++) {
        userCentroid[d] /= historyCount;
      }
    }

    const scored = candidates.map((cand) => {
      const candEmb = embeddings.get(cand.id);
      const sim = candEmb
        ? cosineSimilarity(Array.from(seedEmb), Array.from(candEmb))
        : 0.4;
      const userAffinity = candEmb && historyCount > 0
        ? cosineSimilarity(Array.from(userCentroid), Array.from(candEmb))
        : 0.5;

      // Simulated feature values
      const popularity = Math.min(1.0, (cand.reviews || 500) / 15000);
      const freshness = ((cand.id * 17) % 100) / 100;
      const contextualRelevance = device === 'mobile' ? 0.8 : 0.6;
      const kgCentrality = cand.category === currentSeed.category ? 0.85 : 0.35;
      const categoryRepetition = cand.category === currentSeed.category ? 0.3 : 0.0;

      const features: RankingFeatures = {
        similarity: sim,
        popularity,
        freshness,
        userAffinity,
        categoryRepetition,
        contextualRelevance,
        kgCentrality,
      };

      // Multi-feature composite score
      const compositeScore =
        config.alpha * features.similarity +
        config.beta * features.popularity +
        config.gamma * features.freshness +
        config.delta * features.userAffinity -
        config.epsilon * features.categoryRepetition +
        config.zeta * features.contextualRelevance +
        config.eta * features.kgCentrality;

      // Generate explainability breakdown
      const explanation = ExplainabilityEngine.explain(
        String(cand.id),
        features,
        config,
        userHistoryIds.map(String),
        [],
        'ru'
      );

      return {
        item: cand,
        score: compositeScore,
        rawSim: sim,
        features,
        explanation,
      };
    });

    // Sort by composite score
    scored.sort((a, b) => b.score - a.score);

    // Apply MMR diversity re-ranking over top 10
    const topCandidates = scored.slice(0, 10);
    const selected: typeof scored = [];

    while (selected.length < 5 && topCandidates.length > 0) {
      if (selected.length === 0) {
        selected.push(topCandidates.shift()!);
      } else {
        let bestIdx = 0;
        let bestMMR = -Infinity;

        for (let i = 0; i < topCandidates.length; i++) {
          const cand = topCandidates[i];
          const candEmb = embeddings.get(cand.item.id);

          let maxSimToSelected = 0;
          for (const s of selected) {
            const sEmb = embeddings.get(s.item.id);
            if (candEmb && sEmb) {
              const pairSim = cosineSimilarity(Array.from(candEmb), Array.from(sEmb));
              if (pairSim > maxSimToSelected) maxSimToSelected = pairSim;
            }
          }

          const mmr = calculateMMRScore(cand.score, maxSimToSelected, smmrConfig.lambda);
          if (mmr > bestMMR) {
            bestMMR = mmr;
            bestIdx = i;
          }
        }

        selected.push(topCandidates.splice(bestIdx, 1)[0]);
      }
    }

    return selected;
  }, [currentSeed, catalog, embeddings, config, smmrConfig, userHistoryIds, device]);

  return (
    <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-[#07070c] text-[#e8e8f0]">
      {/* Left Control Panel: Sliders & Signals */}
      <div className="w-full md:w-96 border-r border-[#1a1a2e] bg-[#0a0a14] p-5 overflow-y-auto flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Multi-Feature Ranker</span>
          </div>
          <p className="text-xs text-[#8a8aa3] leading-relaxed">
            Live composite score tuning in real-time without restarting or re-indexing.
          </p>
        </div>

        {/* Seed Item Picker */}
        <div className="bg-[#101020] border border-[#1e1e35] p-3.5 rounded-xl">
          <span className="text-[11px] font-mono text-[#6c6c88] block mb-2">CURRENT SEED ENTITY</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl p-1.5 rounded-lg bg-[#18182e]">{currentSeed.icon || '🎯'}</span>
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-white truncate">{currentSeed.title}</h5>
                <span className="text-[11px] text-cyan-400 font-mono">{currentSeed.category}</span>
              </div>
            </div>
            <select
              value={currentSeed.id}
              onChange={(e) => {
                const found = catalog.find((c) => c.id === Number(e.target.value));
                if (found) onSelectSeed(found);
              }}
              className="bg-[#18182e] border border-[#2b2b48] text-xs text-white px-2 py-1 rounded-lg outline-none font-mono"
            >
              {catalog.slice(0, 15).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title.slice(0, 20)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feature Sliders */}
        <div className="space-y-4">
          <span className="text-[11px] font-mono text-[#8a8aa3] uppercase tracking-wider block">
            Ranker Feature Weights
          </span>

          {/* Similarity Alpha */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>α Semantic Similarity</span>
              </span>
              <span className="text-cyan-400 font-semibold">{config.alpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.alpha}
              onChange={(e) => setConfig({ ...config, alpha: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 h-1.5 bg-[#1a1a2e] rounded-lg cursor-pointer"
            />
          </div>

          {/* User Affinity Delta */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>δ User History Affinity</span>
              </span>
              <span className="text-purple-400 font-semibold">{config.delta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.delta}
              onChange={(e) => setConfig({ ...config, delta: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 h-1.5 bg-[#1a1a2e] rounded-lg cursor-pointer"
            />
          </div>

          {/* Popularity Beta */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>β Item Popularity</span>
              </span>
              <span className="text-emerald-400 font-semibold">{config.beta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.beta}
              onChange={(e) => setConfig({ ...config, beta: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400 h-1.5 bg-[#1a1a2e] rounded-lg cursor-pointer"
            />
          </div>

          {/* Freshness Gamma */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>γ Catalog Freshness</span>
              </span>
              <span className="text-amber-400 font-semibold">{config.gamma.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.gamma}
              onChange={(e) => setConfig({ ...config, gamma: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-[#1a1a2e] rounded-lg cursor-pointer"
            />
          </div>

          {/* SMMR Lambda (Diversity vs Relevance) */}
          <div className="pt-2 border-t border-[#1a1a2e]">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>λ SMMR Diversity Balance</span>
              </span>
              <span className="text-rose-400 font-semibold">{smmrConfig.lambda.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={smmrConfig.lambda}
              onChange={(e) => setSmmrConfig({ ...smmrConfig, lambda: parseFloat(e.target.value) })}
              className="w-full accent-rose-400 h-1.5 bg-[#1a1a2e] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#555570] font-mono mt-1">
              <span>Higher Diversity</span>
              <span>Pure Relevance</span>
            </div>
          </div>
        </div>

        {/* Context Signals */}
        <div className="bg-[#101020] border border-[#1e1e35] p-3.5 rounded-xl space-y-2.5">
          <span className="text-[11px] font-mono text-[#6c6c88] block">CONTEXTUAL SIGNALS</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDevice(device === 'desktop' ? 'mobile' : 'desktop')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-[#18182e] hover:bg-[#20203a] border border-[#2b2b48] text-xs font-mono text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{device === 'desktop' ? '💻 Desktop' : '📱 Mobile'}</span>
            </button>
            <button
              onClick={() => setTimeContext(timeContext === 'day' ? 'night' : 'day')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-[#18182e] hover:bg-[#20203a] border border-[#2b2b48] text-xs font-mono text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{timeContext === 'day' ? '☀️ Daytime' : '🌙 Evening'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Content Area: Results with Explainability */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#1a1a2e]">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>Adaptive Top Recommendations</span>
              <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-800/40">
                AIL Active
              </span>
            </h3>
            <p className="text-xs text-[#8a8aa3] mt-1">
              Candidates re-ranked via composite multi-feature scoring and SMMR diversity filter.
            </p>
          </div>
        </div>

        {/* Results Cards List */}
        <div className="space-y-3.5">
          {rankedResults.map((res, rankIdx) => (
            <div
              key={res.item.id}
              className="bg-[#0e0e1a] border border-[#1e1e32] hover:border-cyan-500/30 rounded-2xl p-4 transition-all duration-200 shadow-xl flex flex-col gap-3 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl p-2.5 rounded-xl bg-[#141426] border border-[#222238] flex-shrink-0">
                    {res.item.icon || '✨'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">#{rankIdx + 1}</span>
                      <h4 className="text-sm font-semibold text-white truncate">{res.item.title}</h4>
                    </div>
                    <p className="text-xs text-[#8a8aa3] line-clamp-1 mt-0.5">{res.item.description}</p>
                    <div className="flex items-center gap-3 text-xs text-[#555570] font-mono mt-1.5">
                      <span className="text-[#a0a0be]">{res.item.category}</span>
                      <span>·</span>
                      <span className="text-white">{res.item.price}</span>
                      <span>·</span>
                      <span className="text-amber-400">★ {res.item.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono font-bold text-cyan-300">
                    {(res.score * 100).toFixed(1)}
                  </div>
                  <span className="text-[10px] text-[#6c6c88] font-mono">COMPOSITE SCORE</span>
                </div>
              </div>

              {/* Explainability Bar & Natural Language Attribution */}
              <div className="pt-3 border-t border-[#161628] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 text-xs text-[#9d9db8]">
                  <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="text-[11px]">{res.explanation.summary}</span>
                </div>

                {/* Micro-Attribution Breakdown */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {res.explanation.attributions.slice(0, 3).map((attr) => (
                    <span
                      key={attr.feature}
                      className="px-2 py-0.5 rounded-md bg-[#161628] border border-[#25253e] text-[10px] text-[#8a8aa3]"
                    >
                      {attr.feature}: <strong className="text-white">{attr.percentage}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
