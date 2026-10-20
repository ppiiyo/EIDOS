import React from "react";
import {
  MultiInterestProfile,
  BanditExplorer,
  VectorSteering,
  cosineSimilarity,
} from '@eidos/core';
import { CatalogItem } from '../../types';
import { computeTextEmbedding } from '../../utils/recommenderEngine';

export const CapsulesSubView: React.FC<{
  capsuleProfile: MultiInterestProfile | null;
}> = ({ capsuleProfile }) => (
  <div className="flex flex-col gap-4">
    <p className="text-xs text-[#8a8aa3]">
      MIND / ComiRec-DR dynamic routing partitions the user&apos;s sequential history into isolated interest vectors instead of blurring them into one single centroid.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {capsuleProfile?.interestEmbeddings.map((_, idx) => {
        const weight = capsuleProfile.interestWeights[idx] || 0;
        const cats = capsuleProfile.interestCategories[idx] || [];

        return (
          <div
            key={idx}
            className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/15 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-purple-400">
                CAPSULE #{idx + 1}
              </span>
              <span className="text-xs font-mono text-white font-bold">
                {(weight * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[#141424] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-purple-400 rounded-full"
                style={{ width: `${weight * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {cats.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18182e] text-white"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const BanditsSubView: React.FC<{
  catalog: CatalogItem[];
  banditStrategy: 'linucb' | 'thompson';
  banditExplorer: BanditExplorer;
  banditEventCount: number;
  onChangeStrategy: (strategy: 'linucb' | 'thompson') => void;
  onBanditAction: (itemId: string, eventType: 'click' | 'purchase' | 'like' | 'dislike') => void;
}> = ({
  catalog,
  banditStrategy,
  banditExplorer,
  onChangeStrategy,
  onBanditAction,
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-xs text-[#8a8aa3]">
        LinUCB & Thompson Sampling dynamically explore unpulled items by adding an exploration bonus (α·σ) to expected reward.
      </p>
      <div className="flex items-center gap-1 bg-[#121222] p-1 rounded-lg border border-[#202036]">
        <button
          type="button"
          onClick={() => onChangeStrategy('linucb')}
          className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer ${
            banditStrategy === 'linucb'
              ? 'bg-amber-500/20 text-amber-300 font-bold'
              : 'text-[#8a8aa3]'
          }`}
        >
          LinUCB
        </button>
        <button
          type="button"
          onClick={() => onChangeStrategy('thompson')}
          className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer ${
            banditStrategy === 'thompson'
              ? 'bg-purple-500/20 text-purple-300 font-bold'
              : 'text-[#8a8aa3]'
          }`}
        >
          Thompson
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {catalog.slice(0, 4).map((it) => {
        const score = banditExplorer.predictArm(
          String(it.id),
          new Float32Array([1.0, 0.5, 0.2, 0.8])
        );
        const arm = banditExplorer.getArmState(String(it.id));

        return (
          <div
            key={it.id}
            className="p-3.5 rounded-xl bg-[#121222] border border-[#1e1e32] flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {it.title.slice(0, 18)}...
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {score.finalScore.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#8a8aa3]">
              Expected: {score.expectedReward.toFixed(2)} · Bonus: +{score.explorationBonus.toFixed(2)} · Pulls: {arm?.pulls || 0}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2">
              <button
                type="button"
                onClick={() => onBanditAction(String(it.id), 'click')}
                className="py-1 px-1 bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 rounded text-[10px] font-mono cursor-pointer"
              >
                Click
              </button>
              <button
                type="button"
                onClick={() => onBanditAction(String(it.id), 'purchase')}
                className="py-1 px-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-mono cursor-pointer"
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => onBanditAction(String(it.id), 'dislike')}
                className="py-1 px-1 bg-rose-950/40 text-rose-400 border border-rose-800/40 rounded text-[10px] font-mono cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const SteeringSubView: React.FC<{
  currentSeed: CatalogItem | undefined;
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  steeringModifiers: Array<{
    label: string;
    type: 'positive' | 'negative';
    weight: number;
    vector: Float32Array;
  }>;
  onAddModifier: (label: string, type: 'positive' | 'negative') => void;
  onRemoveModifier: (index: number) => void;
}> = ({
  currentSeed,
  catalog,
  embeddings,
  steeringModifiers,
  onAddModifier,
  onRemoveModifier,
}) => {
  const [newLabel, setNewLabel] = React.useState('');
  const [newType, setNewType] = React.useState<'positive' | 'negative'>('positive');

  const steeredTopItems = React.useMemo(() => {
    if (!currentSeed) return [];
    const baseVec =
      embeddings.get(String(currentSeed.id)) ||
      computeTextEmbedding(`passage: ${currentSeed.title} ${currentSeed.description}`);
    const steeredVec =
      steeringModifiers.length > 0
        ? VectorSteering.steer(baseVec, steeringModifiers, {
            maxAngularDeviation: 0.75,
            normalization: 'l2',
          })
        : baseVec;

    return catalog
      .filter((c) => c.id !== currentSeed.id)
      .map((item) => {
        const v = embeddings.get(String(item.id));
        const sim = v ? cosineSimilarity(Array.from(steeredVec), Array.from(v)) : 0;
        return { item, sim };
      })
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 4);
  }, [currentSeed, catalog, embeddings, steeringModifiers]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[#8a8aa3]">
        Vector Steering applies real 384-d directional arithmetic (<code>VectorSteering.steer</code>) to shift the anchor vector while enforcing angular deviation bounds.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add concept modifier (e.g. киберпанк неон, компактный)..."
          className="input flex-1 min-w-[220px]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as 'positive' | 'negative')}
          className="input w-auto"
        >
          <option value="positive">+ Positive Attract</option>
          <option value="negative">- Negative Repel</option>
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (!newLabel.trim()) return;
            onAddModifier(newLabel.trim(), newType);
            setNewLabel('');
          }}
        >
          Add 384-d Modifier
        </button>
      </div>

      <div className="space-y-2">
        {steeringModifiers.map((mod, i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl bg-[#121222] border border-[#1e1e32] flex items-center justify-between"
          >
            <span className="text-xs font-mono text-white">
              {mod.type === 'positive' ? '🟢 + ' : '🔴 - '} {mod.label} (weight: {mod.weight})
            </span>
            <button
              type="button"
              onClick={() => onRemoveModifier(i)}
              className="text-xs text-[#6c6c88] hover:text-rose-400 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        {steeredTopItems.map(({ item, sim }, idx) => (
          <div
            key={item.id}
            className="p-3 rounded-xl bg-[#121222] border border-[#1e1e32] flex flex-col justify-between"
          >
            <div className="text-xs font-semibold text-white">
              #{idx + 1} · {item.icon} {item.title}
            </div>
            <div className="text-[11px] font-mono text-cyan-400 mt-2">
              Steered Cosine: {(sim * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
