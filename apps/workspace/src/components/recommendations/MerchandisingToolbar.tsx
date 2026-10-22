import React from "react";
import { Award, TrendingUp, Filter, Layers, RotateCcw } from 'lucide-react';

interface MerchandisingToolbarProps {
  recsCount: number;
  irMetrics: {
    ndcgAtK: number;
    recallAtK: number;
    mrr: number;
    diversityBits: number;
  };
  categories: string[];
  pinnedCount: number;
  excludedCount: number;
  hasActiveRules: boolean;
  crossCategoryOnly: boolean;
  minRating: number;
  boostCategory: string;
  boostFactor: number;
  semanticWeight?: number;
  popularityWeight?: number;
  freshnessWeight?: number;
  marginWeight?: number;
  onChangeSemanticWeight?: (val: number) => void;
  onChangePopularityWeight?: (val: number) => void;
  onChangeFreshnessWeight?: (val: number) => void;
  onChangeMarginWeight?: (val: number) => void;
  onApplyObjectivePreset?: (
    sem: number,
    pop: number,
    fresh: number,
    margin: number,
    diversity: number
  ) => void;
  onToggleCrossCategory: (val: boolean) => void;
  onChangeMinRating: (val: number) => void;
  onChangeBoostCategory: (cat: string) => void;
  onChangeBoostFactor: (factor: number) => void;
  onResetRules: () => void;
  t: Record<string, string>;
}

const SLIDER_DEFS = [
  { key: 'sem', label: 'α Semantic Similarity', min: 0.05, color: 'var(--accent)' },
  { key: 'pop', label: 'β Popularity & Reviews', min: 0.0, color: 'var(--success)' },
  { key: 'fresh', label: 'γ Release Freshness', min: 0.0, color: 'var(--warning)' },
  { key: 'margin', label: 'δ Margin & Price Tier', min: 0.0, color: 'var(--text)' },
] as const;

export const MerchandisingToolbar: React.FC<MerchandisingToolbarProps> = ({
  recsCount,
  irMetrics,
  categories,
  pinnedCount,
  excludedCount,
  hasActiveRules,
  crossCategoryOnly,
  minRating,
  boostCategory,
  boostFactor,
  semanticWeight = 0.55,
  popularityWeight = 0.2,
  freshnessWeight = 0.15,
  marginWeight = 0.1,
  onChangeSemanticWeight,
  onChangePopularityWeight,
  onChangeFreshnessWeight,
  onChangeMarginWeight,
  onApplyObjectivePreset,
  onToggleCrossCategory,
  onChangeMinRating,
  onChangeBoostCategory,
  onChangeBoostFactor,
  onResetRules,
  t,
}) => {
  const sliderValues = {
    sem: semanticWeight,
    pop: popularityWeight,
    fresh: freshnessWeight,
    margin: marginWeight,
  };
  const sliderHandlers = {
    sem: onChangeSemanticWeight,
    pop: onChangePopularityWeight,
    fresh: onChangeFreshnessWeight,
    margin: onChangeMarginWeight,
  };

  return (
    <>
      <div className="card px-4 py-3 mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3.5 bg-[var(--bg-alt)]">
        <div title={t.ndcgTooltip}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-sec)]">
            <Award size={13} color="var(--accent)" />
            <span>NDCG@{recsCount} (Ranking Quality)</span>
          </div>
          <div className="mono text-lg font-bold text-[var(--text)] mt-0.5">
            {irMetrics.ndcgAtK.toFixed(3)}
          </div>
        </div>
        <div title={t.recallTooltip}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-sec)]">
            <TrendingUp size={13} color="var(--success)" />
            <span>Cluster Recall@{recsCount}</span>
          </div>
          <div className="mono text-lg font-bold text-[var(--success)] mt-0.5">
            {(irMetrics.recallAtK * 100).toFixed(1)}%
          </div>
        </div>
        <div title={t.mrrTooltip}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-sec)]">
            <Filter size={13} color="var(--accent)" />
            <span>MRR (Reciprocal Rank)</span>
          </div>
          <div className="mono text-lg font-bold text-[var(--text)] mt-0.5">
            {irMetrics.mrr.toFixed(3)}
          </div>
        </div>
        <div title={t.diversityTooltip}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-sec)]">
            <Layers size={13} color="var(--warning)" />
            <span>Intra-List Diversity (H)</span>
          </div>
          <div className="mono text-lg font-bold text-[var(--text)] mt-0.5">
            {irMetrics.diversityBits.toFixed(2)} bits
          </div>
        </div>
      </div>

      <div className="card px-4 py-3.5 mb-5" data-testid="multi-objective-toolbar">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div>
            <div className="text-[0.8125rem] font-bold text-[var(--text)]">
              {t.merchandisingTitle} · Multi-Objective Business Reranker
            </div>
            <div className="text-xs text-[var(--text-sec)]">{t.merchandisingSubtitle}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onApplyObjectivePreset && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onApplyObjectivePreset(0.55, 0.2, 0.15, 0.1, 0.35)}
                  className="btn btn-secondary btn-sm"
                >
                  Balanced E-Commerce
                </button>
                <button
                  type="button"
                  onClick={() => onApplyObjectivePreset(0.35, 0.15, 0.1, 0.4, 0.25)}
                  className="btn btn-secondary btn-sm"
                >
                  High-Margin GMV
                </button>
                <button
                  type="button"
                  onClick={() => onApplyObjectivePreset(0.4, 0.1, 0.4, 0.1, 0.6)}
                  className="btn btn-secondary btn-sm"
                >
                  Viral Discovery
                </button>
                <button
                  type="button"
                  onClick={() => onApplyObjectivePreset(1.0, 0.0, 0.0, 0.0, 0.15)}
                  className="btn btn-secondary btn-sm"
                >
                  Pure 384-d Semantic
                </button>
              </div>
            )}
            <span className="mono text-xs text-[var(--text-sec)]">
              {t.pinnedCountLabel} <strong>{pinnedCount}</strong> · {t.excludedCountLabel}{' '}
              <strong>{excludedCount}</strong>
            </span>
            {hasActiveRules && (
              <button type="button" onClick={onResetRules} className="btn btn-secondary btn-sm">
                <RotateCcw size={12} />
                <span>{t.resetRulesBtn}</span>
              </button>
            )}
          </div>
        </div>

        {onChangeSemanticWeight && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2.5 border-t border-[var(--border)] text-xs">
            {SLIDER_DEFS.map((s) => (
              <div
                key={s.key}
                className="px-2.5 py-2 rounded bg-[var(--bg-alt)] border border-[var(--border)]"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-[var(--text)]">{s.label}</span>
                  <span className="mono font-bold" style={{ color: s.color }}>
                    {sliderValues[s.key].toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={1.0}
                  step={0.05}
                  value={sliderValues[s.key]}
                  onChange={(e) => sliderHandlers[s.key]?.(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3.5 pt-2.5 border-t border-[var(--border)] text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={crossCategoryOnly}
              onChange={(e) => onToggleCrossCategory(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span>{t.crossCategoryOnly}</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-sec)] font-semibold">{t.minRatingLabel}</span>
            <select
              className="input h-[30px] py-0.5 px-2 text-xs w-auto"
              value={minRating}
              onChange={(e) => onChangeMinRating(Number(e.target.value))}
            >
              <option value={0}>All (★ ≥ 0.0)</option>
              <option value={4.5}>★ ≥ 4.5</option>
              <option value={4.7}>★ ≥ 4.7</option>
              <option value={4.8}>★ ≥ 4.8</option>
              <option value={4.9}>★ ≥ 4.9</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-sec)] font-semibold">{t.boostCategoryLabel}</span>
            <select
              className="input h-[30px] py-0.5 px-2 text-xs w-auto"
              value={boostCategory}
              onChange={(e) => onChangeBoostCategory(e.target.value)}
            >
              <option value="none">{t.boostNone}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {boostCategory !== 'none' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-sec)]">{t.boostFactorLabel}</span>
              <input
                type="range"
                min={1.1}
                max={2.0}
                step={0.05}
                value={boostFactor}
                onChange={(e) => onChangeBoostFactor(parseFloat(e.target.value))}
                className="w-[90px] accent-[var(--accent)]"
              />
              <span className="mono font-bold text-[var(--accent)]">
                {boostFactor.toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
