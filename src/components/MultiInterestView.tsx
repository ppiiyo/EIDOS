import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../types';
import { MultiInterestUserTower, MultiInterestProfile } from '@eidos/core';
import { Layers, Compass, ArrowRight, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';

interface MultiInterestViewProps {
  catalog: CatalogItem[];
  embeddings: Map<number, Float32Array>;
}

export const MultiInterestView: React.FC<MultiInterestViewProps> = ({
  catalog,
  embeddings,
}) => {
  // Configured user multi-topic history
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<number[]>([1, 2, 3, 4, 5, 8]);
  const [candidateQueryId, setCandidateQueryId] = useState<number>(6);

  // Tower instance
  const tower = useMemo(() => {
    return new MultiInterestUserTower({
      maxInterests: 3,
      routingIterations: 4,
      temperature: 0.2,
      normalization: 'l2',
    });
  }, []);

  // Compute multi-interest profile
  const [profile, setProfile] = useState<MultiInterestProfile | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    tower
      .buildProfile(
        'demo_user',
        selectedHistoryIds.map(String),
        async (id) => embeddings.get(Number(id)) || new Float32Array(384).fill(0.1),
        (id) => catalog.find((c) => c.id === Number(id))?.category || 'Unknown'
      )
      .then((p) => {
        if (isMounted) setProfile(p);
      });

    return () => {
      isMounted = false;
    };
  }, [tower, selectedHistoryIds, catalog, embeddings]);

  // Test candidate routing
  const candidateRouting = useMemo(() => {
    if (!profile || !candidateQueryId) return null;
    const candEmb = embeddings.get(candidateQueryId);
    if (!candEmb) return null;
    return tower.getTopInterestForCandidate('demo_user', candEmb);
  }, [tower, profile, candidateQueryId, embeddings]);

  const candidateItem = catalog.find((c) => c.id === candidateQueryId);

  const toggleHistoryItem = (id: number) => {
    if (selectedHistoryIds.includes(id)) {
      if (selectedHistoryIds.length > 2) {
        setSelectedHistoryIds(selectedHistoryIds.filter((x) => x !== id));
      }
    } else {
      setSelectedHistoryIds([...selectedHistoryIds, id]);
    }
  };

  const CAPSULE_PALETTES = [
    { name: 'Capsule 01', border: 'border-cyan-500/40', bg: 'bg-cyan-950/20', text: 'text-cyan-400', accent: '#00f0ff' },
    { name: 'Capsule 02', border: 'border-purple-500/40', bg: 'bg-purple-950/20', text: 'text-purple-400', accent: '#a855f7' },
    { name: 'Capsule 03', border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', text: 'text-emerald-400', accent: '#10b981' },
  ];

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto bg-[#07070c] text-[#e8e8f0] gap-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1a1a2e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Multi-Interest Capsule Architecture (MIND / ComiRec-DR)</span>
          </h3>
          <p className="text-xs text-[#8a8aa3] mt-1">
            Dynamic routing partitions sequential user history into isolated interest vectors instead of blurring them into one single centroid.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-400 px-3 py-1 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
            EM Dynamic Routing Active
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: User Interaction History Selection */}
        <div className="bg-[#0b0b14] border border-[#1a1a2c] rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
              User Interaction History ({selectedHistoryIds.length})
            </span>
            <span className="text-[11px] text-[#555570] font-mono">Click to toggle</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[480px] pr-1">
            {catalog.map((item) => {
              const isSelected = selectedHistoryIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleHistoryItem(item.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#151528] border-cyan-500/40 text-white'
                      : 'bg-[#0f0f1b] border-[#1c1c2e] text-[#8a8aa3] hover:border-[#2a2a44]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="text-lg">{item.icon || '📦'}</span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-medium truncate">{item.title}</h5>
                      <span className="text-[10px] text-[#6c6c88] font-mono">{item.category}</span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Extracted Interest Capsules */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <span className="text-xs font-mono text-purple-400 uppercase tracking-wider">
            Dynamically Partitioned Capsules ({profile?.interestEmbeddings.length || 0})
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile?.interestEmbeddings.map((emb, idx) => {
              const pal = CAPSULE_PALETTES[idx % CAPSULE_PALETTES.length];
              const weight = profile.interestWeights[idx] || 0;
              const cats = profile.interestCategories[idx] || [];

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${pal.border} ${pal.bg} backdrop-blur-md flex flex-col justify-between gap-3 shadow-xl`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-mono font-bold ${pal.text}`}>
                        CAPSULE #{idx + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {(weight * 100).toFixed(1)}% weight
                      </span>
                    </div>
                    <div className="w-full bg-[#121220] rounded-full h-1.5 mb-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${weight * 100}%`, backgroundColor: pal.accent }}
                      />
                    </div>
                    <span className="text-[10px] text-[#6c6c88] font-mono block mb-1">
                      DOMINANT CATEGORIES:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cats.length > 0 ? (
                        cats.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#16162a] border border-[#2b2b48] text-white"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[#555570] font-mono">Mixed Affinity</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1a1a33] text-[10px] font-mono text-[#6c6c88]">
                    <span>Vector: [{emb[0].toFixed(3)}, {emb[1].toFixed(3)}, {emb[2].toFixed(3)}...]</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Candidate Routing Inspector */}
          <div className="mt-2 bg-[#0c0c16] border border-[#1d1d32] rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono text-white font-semibold">
                  Test Item Routing (MIPS across Capsules)
                </span>
              </div>
              <select
                value={candidateQueryId}
                onChange={(e) => setCandidateQueryId(Number(e.target.value))}
                className="bg-[#16162a] border border-[#2a2a46] text-xs text-cyan-300 font-mono px-3 py-1.5 rounded-xl outline-none"
              >
                {catalog.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.icon} {it.title} ({it.category})
                  </option>
                ))}
              </select>
            </div>

            {candidateItem && candidateRouting && (
              <div className="p-4 rounded-xl bg-[#121224] border border-[#20203a] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 rounded-xl bg-[#181830]">{candidateItem.icon}</span>
                  <div>
                    <h5 className="text-sm font-semibold text-white">{candidateItem.title}</h5>
                    <span className="text-xs text-[#8a8aa3] font-mono">{candidateItem.category} · {candidateItem.price}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <ArrowRight className="w-5 h-5 text-cyan-400 hidden md:block" />
                  <div className="bg-[#181832] px-4 py-2.5 rounded-xl border border-cyan-500/40 text-right">
                    <span className="text-[10px] text-cyan-400 font-mono block">ROUTED TO</span>
                    <span className="text-sm font-mono font-bold text-white">
                      CAPSULE #{candidateRouting.interestIndex + 1}
                    </span>
                    <span className="text-xs text-[#8a8aa3] font-mono block mt-0.5">
                      Affinity: <strong className="text-cyan-300">{(candidateRouting.affinity * 100).toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
