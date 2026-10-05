import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../types';
import { BanditExplorer, BanditArmScore } from '@eidos/core';
import { Zap, ShieldCheck, TrendingUp, ThumbsUp, ShoppingCart, ThumbsDown, EyeOff, RotateCcw } from 'lucide-react';

interface BanditsViewProps {
  catalog: CatalogItem[];
}

export const BanditsView: React.FC<BanditsViewProps> = ({ catalog }) => {
  const [strategy, setStrategy] = useState<'linucb' | 'thompson'>('linucb');
  const [alpha, setAlpha] = useState(0.8);
  const [activeContext, setActiveContext] = useState<Float32Array>(new Float32Array([1.0, 0.5, 0.2, 0.8]));

  // Explorer instance
  const [explorer, setExplorer] = useState(() => {
    return new BanditExplorer({
      featureDimension: 4,
      alpha,
      strategy,
    });
  });

  // Re-instantiate or update on strategy change
  const handleStrategyChange = (newStrategy: 'linucb' | 'thompson') => {
    setStrategy(newStrategy);
    setExplorer(
      new BanditExplorer({
        featureDimension: 4,
        alpha,
        strategy: newStrategy,
      })
    );
  };

  // Tracking state to trigger re-renders on update
  const [eventCount, setEventCount] = useState(0);

  // Scored arms
  const candidateIds = useMemo(() => {
    return catalog.slice(0, 8).map((c) => String(c.id));
  }, [catalog]);

  const scores: BanditArmScore[] = useMemo(() => {
    return explorer.scoreCandidates(candidateIds, activeContext);
  }, [explorer, candidateIds, activeContext, eventCount]);

  const handleAction = (itemId: string, eventType: 'click' | 'purchase' | 'like' | 'dislike' | 'ignore') => {
    explorer.updateFromFeedback(
      {
        userId: 'live_user',
        itemId,
        eventType,
        timestamp: Date.now(),
      },
      activeContext
    );
    setEventCount((prev) => prev + 1);
  };

  const handleReset = () => {
    explorer.clear();
    setEventCount((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto bg-[#07070c] text-[#e8e8f0] gap-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1a1a2e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Contextual Bandits: Exploration & Exploitation (LinUCB)</span>
          </h3>
          <p className="text-xs text-[#8a8aa3] mt-1">
            Resolves item starvation by granting unpulled or high-uncertainty items an exploration bonus based on confidence bounds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#101020] border border-[#1e1e35] rounded-xl">
            <button
              onClick={() => handleStrategyChange('linucb')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                strategy === 'linucb' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-[#8a8aa3]'
              }`}
            >
              LinUCB
            </button>
            <button
              onClick={() => handleStrategyChange('thompson')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                strategy === 'thompson' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-[#8a8aa3]'
              }`}
            >
              Thompson Sampling
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-[#141424] hover:bg-[#1a1a2e] text-[#8a8aa3] hover:text-white border border-[#202038] transition-colors"
            title="Reset Bandit Weights"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Candidate Arms Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scores.map((score, rankIdx) => {
          const item = catalog.find((c) => String(c.id) === score.armId);
          if (!item) return null;

          const armState = explorer.getArmState(score.armId);
          const pulls = armState?.pulls || 0;
          const isLeader = rankIdx === 0;

          return (
            <div
              key={score.armId}
              className={`p-4 rounded-2xl border backdrop-blur-md flex flex-col justify-between gap-3 shadow-xl transition-all ${
                isLeader
                  ? 'bg-gradient-to-b from-[#141426] to-[#0c0c16] border-cyan-500/40 shadow-cyan-950/20'
                  : 'bg-[#0d0d17] border-[#1c1c30]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl p-1.5 rounded-lg bg-[#141426]">{item.icon || '📦'}</span>
                    <div>
                      <h4 className="text-xs font-semibold text-white leading-tight">{item.title}</h4>
                      <span className="text-[10px] text-cyan-400 font-mono">{item.category}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    #{rankIdx + 1}
                  </span>
                </div>

                {/* Score Decomposition Bar */}
                <div className="space-y-1.5 my-3 bg-[#111122] p-2.5 rounded-xl border border-[#1d1d33]">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-[#8a8aa3]">Final UCB Score:</span>
                    <strong className="text-cyan-300">{score.finalScore.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#6c6c88]">
                    <span>Expected Payoff:</span>
                    <span className="text-white">{score.expectedReward.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#6c6c88]">
                    <span>Exploration Bonus (α·σ):</span>
                    <span className="text-amber-400">+{score.explorationBonus.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#6c6c88]">
                    <span>Pulls (Total Impressions):</span>
                    <span className="text-purple-300 font-semibold">{pulls}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Simulate User Feedback */}
              <div>
                <span className="text-[10px] font-mono text-[#555570] block mb-1.5">
                  SIMULATE REWARD FEEDBACK:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => handleAction(score.armId, 'click')}
                    title="Click (+0.4)"
                    className="py-1 px-1 rounded-lg bg-[#18182e] hover:bg-cyan-900/40 text-cyan-400 border border-cyan-800/30 text-[10px] font-mono flex items-center justify-center transition-colors"
                  >
                    Click
                  </button>
                  <button
                    onClick={() => handleAction(score.armId, 'purchase')}
                    title="Purchase (+1.0)"
                    className="py-1 px-1 rounded-lg bg-[#18182e] hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/30 text-[10px] font-mono flex items-center justify-center transition-colors"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => handleAction(score.armId, 'dislike')}
                    title="Dislike (-0.8)"
                    className="py-1 px-1 rounded-lg bg-[#18182e] hover:bg-rose-900/40 text-rose-400 border border-rose-800/30 text-[10px] font-mono flex items-center justify-center transition-colors"
                  >
                    Dislike
                  </button>
                  <button
                    onClick={() => handleAction(score.armId, 'ignore')}
                    title="Ignore (-0.1)"
                    className="py-1 px-1 rounded-lg bg-[#18182e] hover:bg-[#20203a] text-[#8a8aa3] border border-[#2b2b48] text-[10px] font-mono flex items-center justify-center transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
