import React from "react";
import { ThumbsUp, Pin, EyeOff, Boxes, ArrowRight } from 'lucide-react';
import { CatalogItem, CatalogRecommendation } from '../../types';

interface RecommendationCardProps {
  rec: CatalogRecommendation;
  rankIndex: number;
  diversityLambda: number;
  boostFactor: number;
  showXray: boolean;
  isPinned: boolean;
  isLiked: boolean;
  onToggleLike: (item: CatalogItem) => void;
  onTogglePin: (id: string) => void;
  onExclude: (id: string) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  onSelectItem: (item: CatalogItem) => void;
  t: Record<string, string>;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  rec,
  rankIndex,
  diversityLambda,
  boostFactor,
  showXray,
  isPinned,
  isLiked,
  onToggleLike,
  onTogglePin,
  onExclude,
  onInspectIn3D,
  onSelectItem,
  t,
}) => {
  const cosinePct = Math.min(100, Math.max(0, rec.sim * 100));
  const noveltyBonusVal =
    rec.noveltyBonus !== undefined
      ? rec.noveltyBonus
      : Math.max(0.05, 1 - rec.sim * 0.7);
  const noveltyPct = Math.min(100, Math.max(0, noveltyBonusVal * 100));
  const mmrScoreVal =
    rec.mmrScore !== undefined
      ? rec.mmrScore
      : (1 - diversityLambda) * rec.sim + diversityLambda * noveltyBonusVal;
  const mmrTotalPct = Math.min(100, Math.max(5, mmrScoreVal * 100));

  return (
    <div
      onClick={() => onSelectItem(rec.item)}
      className={`card p-4 cursor-pointer ${
        isPinned
          ? 'border-[1.5px] border-[var(--accent)]'
          : rec.isBoosted
          ? 'border border-[var(--success)]'
          : ''
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-3">
          <span className="mono text-xs text-[var(--text-mut)] font-bold mt-1">
            #{rankIndex + 1}
          </span>
          <span className="text-xl leading-none">{rec.item.icon || '📦'}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[0.9375rem] text-[var(--text)]">
                {rec.item.title}
              </span>
              {isPinned && (
                <span className="badge badge-accent text-[0.6875rem]">
                  {t.pinnedBadge}
                </span>
              )}
              {rec.isBoosted && (
                <span className="badge badge-success text-[0.6875rem]">
                  {t.boostedBadge} {boostFactor.toFixed(2)}x
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">
              {rec.item.category} · <span className="mono">{rec.item.price || '—'}</span>
              {rec.item.rating && (
                <>
                  {' '}
                  · <span className="mono">★ {rec.item.rating.toFixed(1)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="mono text-[0.9375rem] font-bold text-[var(--success)]">
            {cosinePct.toFixed(1)}% cosine
          </div>
          <div className="mono text-[0.6875rem] text-[var(--text-sec)]">
            MMR: {(mmrScoreVal * 100).toFixed(1)} · λ={diversityLambda.toFixed(2)}
          </div>
        </div>
      </div>

      <p className="text-[0.8125rem] text-[var(--text-sec)] my-2">
        {rec.item.description}
      </p>

      {showXray && (
        <div className="grid grid-cols-3 gap-2.5 px-3 py-2 bg-[var(--bg-alt)] rounded-md text-[0.6875rem] mb-2.5">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[var(--text-sec)]">{t.cosineLabel}</span>
              <span className="mono font-semibold">{cosinePct.toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded">
              <div
                className="h-full bg-[var(--accent)] rounded"
                style={{ width: `${cosinePct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[var(--text-sec)]">{t.noveltyLabel}</span>
              <span className="mono font-semibold">{noveltyPct.toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded">
              <div
                className="h-full bg-[var(--success)] rounded"
                style={{ width: `${noveltyPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[var(--text-sec)]">{t.mmrScoreLabel}</span>
              <span className="mono font-semibold">{mmrTotalPct.toFixed(1)}</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded">
              <div
                className="h-full bg-[var(--text)] rounded"
                style={{ width: `${mmrTotalPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--text-mut)]">{rec.whyRecommended}</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            data-testid="like-button"
            className={isLiked ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(rec.item);
            }}
            title="Positive relevance feedback (logs click telemetry)"
          >
            <ThumbsUp size={12} />
            <span>{isLiked ? 'Liked' : 'Like'}</span>
          </button>
          <button
            type="button"
            className={isPinned ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(String(rec.item.id));
            }}
            title="Pin or unpin item at the top of recommendation slots"
          >
            <Pin size={12} />
            <span>{isPinned ? t.unpinBtn : t.pinBtn}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onExclude(String(rec.item.id));
            }}
            title="Exclude this item from recommendations"
          >
            <EyeOff size={12} />
            <span>{t.excludeBtn}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onInspectIn3D(rec.item);
            }}
          >
            <Boxes size={12} />
            <span>3D</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem(rec.item);
            }}
          >
            <span>{t.makeSeedBtn}</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
