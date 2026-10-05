import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../types';
import { VectorSteering, SteeringModifier, cosineSimilarity } from '@eidos/core';
import { Compass, Plus, Minus, RotateCcw, ArrowRight, Sparkles } from 'lucide-react';

interface SteeringViewProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
}

export const SteeringView: React.FC<SteeringViewProps> = ({ catalog, embeddings }) => {
  const [baseItemId, setBaseItemId] = useState<number>(1);
  const [maxDeviation, setMaxDeviation] = useState<number>(0.75);

  // Active modifiers list
  const [modifiers, setModifiers] = useState<
    Array<{ label: string; type: 'positive' | 'negative'; weight: number; vector: Float32Array }>
  >([
    {
      label: 'Минималистичный дизайн',
      type: 'positive',
      weight: 0.6,
      vector: new Float32Array(384).fill(0.08),
    },
    {
      label: 'Громоздкий / Геймерский стиль',
      type: 'negative',
      weight: 0.5,
      vector: new Float32Array(384).fill(-0.06),
    },
  ]);

  const [newModLabel, setNewModLabel] = useState('');
  const [newModType, setNewModType] = useState<'positive' | 'negative'>('positive');

  const baseItem = catalog.find((c) => c.id === baseItemId) || catalog[0];

  // Steered vector calculation
  const steeredVector = useMemo(() => {
    const baseEmb = embeddings.get(baseItem.id);
    if (!baseEmb) return new Float32Array(384);

    const steeringMods: SteeringModifier[] = modifiers.map((m) => ({
      vector: m.vector,
      weight: m.weight,
      type: m.type,
      label: m.label,
    }));

    return VectorSteering.steer(baseEmb, steeringMods, {
      baseWeight: 1.0,
      maxAngularDeviation: maxDeviation,
      normalization: 'l2',
    });
  }, [baseItem, embeddings, modifiers, maxDeviation]);

  // Ranked results against steered vector
  const steeredResults = useMemo(() => {
    if (!steeredVector) return [];

    const scored = catalog.map((item) => {
      const emb = embeddings.get(item.id);
      const sim = emb ? cosineSimilarity(Array.from(steeredVector), Array.from(emb)) : 0;
      return { item, sim };
    });

    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, 6);
  }, [catalog, embeddings, steeredVector]);

  const handleAddModifier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModLabel.trim()) return;

    // Generate pseudo-deterministic direction for demonstration
    const modVec = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      modVec[i] = Math.sin(i * 0.3 + newModLabel.length) * 0.1;
    }

    setModifiers([
      ...modifiers,
      {
        label: newModLabel.trim(),
        type: newModType,
        weight: 0.5,
        vector: modVec,
      },
    ]);
    setNewModLabel('');
  };

  const removeModifier = (index: number) => {
    setModifiers(modifiers.filter((_, idx) => idx !== index));
  };

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto bg-[#07070c] text-[#e8e8f0] gap-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1a1a2e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>Conversational Vector Steering Playground</span>
          </h3>
          <p className="text-xs text-[#8a8aa3] mt-1">
            Perform latent vector arithmetic (+ concepts / - concepts) with mathematical angular boundary protection.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Base Entity & Modifiers Control */}
        <div className="bg-[#0b0b14] border border-[#1b1b2c] p-5 rounded-2xl flex flex-col gap-5">
          <div>
            <span className="text-[11px] font-mono text-[#8a8aa3] uppercase tracking-wider block mb-2">
              BASE REFERENCE ENTITY
            </span>
            <select
              value={baseItem.id}
              onChange={(e) => setBaseItemId(Number(e.target.value))}
              className="w-full bg-[#121224] border border-[#22223a] text-xs text-white p-2.5 rounded-xl font-mono outline-none"
            >
              {catalog.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.icon} {it.title} ({it.category})
                </option>
              ))}
            </select>
          </div>

          {/* Angular Boundary Slider */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#a0a0be]">Max Angular Deviation Barrier</span>
              <span className="text-cyan-400">{maxDeviation.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={maxDeviation}
              onChange={(e) => setMaxDeviation(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-[#18182e] rounded-lg cursor-pointer"
            />
          </div>

          {/* Add Modifier Form */}
          <form onSubmit={handleAddModifier} className="space-y-2 pt-3 border-t border-[#18182e]">
            <span className="text-[11px] font-mono text-[#8a8aa3] uppercase tracking-wider block">
              ADD VECTOR MODIFIER
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={newModLabel}
                onChange={(e) => setNewModLabel(e.target.value)}
                placeholder="e.g. Ретро эстетика..."
                className="flex-1 bg-[#121224] border border-[#22223a] px-3 py-1.5 rounded-xl text-xs text-white outline-none focus:border-cyan-500/50"
              />
              <select
                value={newModType}
                onChange={(e) => setNewModType(e.target.value as 'positive' | 'negative')}
                className="bg-[#121224] border border-[#22223a] px-2 py-1.5 rounded-xl text-xs font-mono text-cyan-400 outline-none"
              >
                <option value="positive">+ Add</option>
                <option value="negative">- Remove</option>
              </select>
              <button
                type="submit"
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Active Modifiers List */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-mono text-[#6c6c88] block">ACTIVE MODIFIERS:</span>
            {modifiers.map((mod, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-[#121222] border border-[#1e1e32] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {mod.type === 'positive' ? (
                    <span className="text-xs font-mono font-bold text-emerald-400">+</span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-rose-400">-</span>
                  )}
                  <span className="text-xs text-white">{mod.label}</span>
                </div>
                <button
                  onClick={() => removeModifier(idx)}
                  className="text-xs text-[#555570] hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Steered Latent Results */}
        <div className="lg:col-span-2 bg-[#0b0b14] border border-[#1b1b2c] p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#18182e]">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Steered Affinity Results</span>
            </span>
            <span className="text-[11px] text-[#8a8aa3] font-mono">
              Live Latent Space Projection
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {steeredResults.map((res, rankIdx) => (
              <div
                key={res.item.id}
                className="p-3.5 rounded-xl bg-[#101020] border border-[#1e1e35] hover:border-cyan-500/40 transition-all flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-xl p-1.5 rounded-lg bg-[#181830] flex-shrink-0">
                    {res.item.icon || '📦'}
                  </span>
                  <div className="min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate">{res.item.title}</h5>
                    <p className="text-[11px] text-[#8a8aa3] line-clamp-1">{res.item.description}</p>
                    <span className="text-[10px] text-cyan-400 font-mono mt-1 block">
                      {res.item.category} · {res.item.price}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {(res.sim * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[#555570] font-mono block">MATCH</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
