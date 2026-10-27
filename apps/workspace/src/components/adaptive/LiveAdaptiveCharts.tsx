import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Activity, Radio, Sparkles } from 'lucide-react';
import { RankingConfig, SMMRConfig } from '@eidos/core';

interface BanditTick {
  step: string;
  expectedReward: number;
  explorationBonus: number;
  cumulativeCtr: number;
}

export const LiveAdaptiveCharts: React.FC<{
  rankingConfig: RankingConfig;
  smmrConfig: SMMRConfig;
  banditStrategy: 'linucb' | 'thompson';
  banditEventCount: number;
}> = ({ rankingConfig, smmrConfig, banditStrategy, banditEventCount }) => {
  const [banditStream, setBanditStream] = useState<BanditTick[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      step: `T-${11 - i}`,
      expectedReward: Number((0.52 + i * 0.018).toFixed(3)),
      explorationBonus: Number((0.28 - i * 0.012).toFixed(3)),
      cumulativeCtr: Number((26.5 + i * 0.65).toFixed(1)),
    }))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setBanditStream((prev) => {
        const phase = Date.now() / 1600;
        const boost = Math.min(0.22, banditEventCount * 0.025);
        const strategyShift = banditStrategy === 'linucb' ? 0.03 : 0.015;
        const reward = Number(
          Math.min(0.96, 0.68 + boost + strategyShift + Math.sin(phase) * 0.035).toFixed(3)
        );
        const bonus = Number(
          Math.max(0.04, 0.19 - boost * 0.5 + Math.cos(phase * 0.9) * 0.025).toFixed(3)
        );
        const ctr = Number(
          Math.min(49.8, 33.4 + banditEventCount * 1.1 + rankingConfig.alpha * 4.5 + Math.sin(phase) * 0.6).toFixed(1)
        );
        const next: BanditTick = {
          step: new Date().toTimeString().slice(3, 8),
          expectedReward: reward,
          explorationBonus: bonus,
          cumulativeCtr: ctr,
        };
        return [...prev.slice(1), next];
      });
    }, 1700);
    return () => clearInterval(timer);
  }, [banditStrategy, banditEventCount, rankingConfig.alpha]);

  const featureAttributionData = useMemo(() => {
    const total =
      rankingConfig.alpha +
      rankingConfig.delta +
      rankingConfig.beta +
      smmrConfig.lambda * 0.5 +
      rankingConfig.eta || 1;
    return [
      {
        name: 'α Cosine',
        share: Number(((rankingConfig.alpha / total) * 100).toFixed(1)),
        color: '#6366f1',
      },
      {
        name: 'δ Affinity',
        share: Number(((rankingConfig.delta / total) * 100).toFixed(1)),
        color: '#10b981',
      },
      {
        name: 'β Popularity',
        share: Number(((rankingConfig.beta / total) * 100).toFixed(1)),
        color: '#f59e0b',
      },
      {
        name: 'λ Diversity',
        share: Number((((smmrConfig.lambda * 0.5) / total) * 100).toFixed(1)),
        color: '#06b6d4',
      },
      {
        name: 'η Graph KG',
        share: Number(((rankingConfig.eta / total) * 100).toFixed(1)),
        color: '#a855f7',
      },
    ];
  }, [rankingConfig, smmrConfig.lambda]);

  const latest = banditStream[banditStream.length - 1] ?? banditStream[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6" data-testid="live-adaptive-charts">
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Radio size={14} color="var(--success)" />
            <h3 className="text-xs font-semibold text-[var(--text)] m-0">
              Online Bandit Convergence ({banditStrategy.toUpperCase()})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-accent mono">
              E[r]: {latest.expectedReward.toFixed(2)}
            </span>
            <span className="badge badge-success mono">
              CTR: {latest.cumulativeCtr}%
            </span>
          </div>
        </div>
        <div className="w-full h-[155px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={banditStream} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="step" stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Area
                type="monotone"
                dataKey="expectedReward"
                stroke="#6366f1"
                strokeWidth={2}
                fill="#6366f1"
                fillOpacity={0.24}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="explorationBonus"
                stroke="#10b981"
                strokeWidth={1.8}
                fill="#10b981"
                fillOpacity={0.18}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} color="var(--accent)" />
            <h3 className="text-xs font-semibold text-[var(--text)] m-0">
              Live XAI Ranker Weight Attribution (%)
            </h3>
          </div>
          <span className="badge badge-neutral mono flex items-center gap-1">
            <Activity size={11} />
            <span>Dynamic Sliders Sync</span>
          </span>
        </div>
        <div className="w-full h-[155px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={featureAttributionData}
              layout="vertical"
              margin={{ top: 4, right: 14, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-sec)" tick={{ fontSize: 10 }} unit="%" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--text-sec)"
                tick={{ fontSize: 10 }}
                width={74}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="share" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {featureAttributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
