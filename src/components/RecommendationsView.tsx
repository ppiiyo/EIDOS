import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Boxes,
  ArrowRight,
  Eye,
  Pin,
  EyeOff,
  RotateCcw,
  Award,
  TrendingUp,
  Layers,
  Filter,
  ThumbsUp,
} from 'lucide-react';
import {
  CatalogItem,
  CatalogRecommendation,
  MerchandisingRules,
} from '../types';
import { trackEvent } from '../lib/analytics/tracker';
import { computeRankingEvaluationMetrics } from '../utils/recommenderEngine';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

interface RecommendationsViewProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  onRecommend: (
    itemId: string,
    diversityLambda?: number,
    limit?: number,
    rules?: MerchandisingRules
  ) => CatalogRecommendation[];
  onInspectIn3D: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  catalog,
  embeddings,
  selectedItem,
  onSelectItem,
  onRecommend,
  onInspectIn3D,
  uiLang = 'ru',
}) => {
  const t = UI_TRANSLATIONS[uiLang].recommendations;

  const [diversityLambda, setDiversityLambda] = useState<number>(0.35);
  const [topKLimit, setTopKLimit] = useState<number>(6);
  const [showXray, setShowXray] = useState<boolean>(true);
  const [catalogFilter, setCatalogFilter] = useState<string>('');

  // Enterprise Merchandising & Business Rules State
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [boostCategory, setBoostCategory] = useState<string>('none');
  const [boostFactor, setBoostFactor] = useState<number>(1.35);
  const [crossCategoryOnly, setCrossCategoryOnly] = useState<boolean>(false);
  const [minRating, setMinRating] = useState<number>(0);

  const activeSeed = selectedItem || catalog[0] || null;

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((i) => i.category))).sort(),
    [catalog]
  );

  const activeRules: MerchandisingRules = useMemo(
    () => ({
      pinnedIds,
      excludedIds,
      boostCategory,
      boostFactor,
      crossCategoryOnly,
      minRating,
    }),
    [pinnedIds, excludedIds, boostCategory, boostFactor, crossCategoryOnly, minRating]
  );

  const recs = useMemo(() => {
    if (!activeSeed) return [];
    const results = onRecommend(activeSeed.id, diversityLambda, topKLimit, activeRules);
    trackEvent({
      type: 'recommendation',
      itemId: String(activeSeed.id),
    });
    return results;
  }, [activeSeed, diversityLambda, topKLimit, activeRules, catalog, onRecommend]);

  // Real-time IR Evaluation Metrics (NDCG@K, Recall@K, MRR, Intra-list Diversity)
  const irMetrics = useMemo(
    () => computeRankingEvaluationMetrics(activeSeed, recs, catalog, embeddings),
    [activeSeed, recs, catalog, embeddings]
  );

  const filteredSeedList = useMemo(() => {
    const q = catalogFilter.toLowerCase().trim();
    const list = q
      ? catalog.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        )
      : catalog;
    return list.slice(0, 60);
  }, [catalog, catalogFilter]);

  const togglePin = (id: string) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
    );
  };

  const toggleLike = (item: CatalogItem) => {
    const id = String(item.id);
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    trackEvent({
      type: 'item_click',
      itemId: id,
      category: item.category,
    });
  };

  const excludeSku = (id: string) => {
    setPinnedIds((prev) => prev.filter((x) => x !== id));
    setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const resetMerchandisingRules = () => {
    setPinnedIds([]);
    setExcludedIds([]);
    setBoostCategory('none');
    setBoostFactor(1.35);
    setCrossCategoryOnly(false);
    setMinRating(0);
  };

  const hasActiveRules =
    pinnedIds.length > 0 ||
    excludedIds.length > 0 ||
    boostCategory !== 'none' ||
    crossCategoryOnly ||
    minRating > 0;

  return (
    <div className="page">
      {/* Header & MMR Diversity Slider */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Top-K Limit Selector */}
          <div
            className="card"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
              {t.topKLabel}
            </span>
            {[4, 6, 8, 12].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTopKLimit(k)}
                className="btn btn-sm"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  background: topKLimit === k ? 'var(--accent)' : 'var(--bg-alt)',
                  color: topKLimit === k ? '#FFFFFF' : 'var(--text-sec)',
                  borderColor: 'var(--border)',
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowXray((v) => !v)}
            className={showXray ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Eye size={14} />
            <span>{showXray ? t.xrayOn : t.xrayOff}</span>
          </button>

          <div
            className="card"
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 260,
            }}
          >
            <Sliders size={14} style={{ color: 'var(--text-sec)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sec)' }}>
              {t.mmrBalance}
            </span>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={diversityLambda}
              onChange={(e) => setDiversityLambda(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>
              {diversityLambda.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Live IR Evaluation Metrics Bar (NDCG@K, Recall@K, MRR, Diversity) */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          background: 'var(--bg-alt)',
        }}
      >
        <div title={t.ndcgTooltip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <Award size={13} color="var(--accent)" />
            <span>NDCG@{recs.length} (Ranking Quality)</span>
          </div>
          <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {irMetrics.ndcgAtK.toFixed(3)}
          </div>
        </div>

        <div title={t.recallTooltip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <TrendingUp size={13} color="var(--success)" />
            <span>Cluster Recall@{recs.length}</span>
          </div>
          <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>
            {(irMetrics.recallAtK * 100).toFixed(1)}%
          </div>
        </div>

        <div title={t.mrrTooltip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <Filter size={13} color="var(--accent)" />
            <span>MRR (Reciprocal Rank)</span>
          </div>
          <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {irMetrics.mrr.toFixed(3)}
          </div>
        </div>

        <div title={t.diversityTooltip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-sec)' }}>
            <Layers size={13} color="var(--warning)" />
            <span>Intra-List Diversity (H)</span>
          </div>
          <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {irMetrics.diversityBits.toFixed(2)} bits
          </div>
        </div>
      </div>

      {/* Enterprise Merchandising & Business Rules Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text)' }}>
              {t.merchandisingTitle}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
              {t.merchandisingSubtitle}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
              {t.pinnedCountLabel} <strong>{pinnedIds.length}</strong> · {t.excludedCountLabel}{' '}
              <strong>{excludedIds.length}</strong>
            </span>
            {hasActiveRules && (
              <button
                type="button"
                onClick={resetMerchandisingRules}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={12} />
                <span>{t.resetRulesBtn}</span>
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            fontSize: '0.75rem',
          }}
        >
          {/* Cross-Category Only */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={crossCategoryOnly}
              onChange={(e) => setCrossCategoryOnly(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span>{t.crossCategoryOnly}</span>
          </label>

          {/* Min Rating Guardrail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-sec)', fontWeight: 600 }}>{t.minRatingLabel}</span>
            <select
              className="input"
              style={{ height: 30, padding: '2px 8px', fontSize: '0.75rem', width: 'auto' }}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            >
              <option value={0}>All (★ ≥ 0.0)</option>
              <option value={4.5}>★ ≥ 4.5</option>
              <option value={4.7}>★ ≥ 4.7</option>
              <option value={4.8}>★ ≥ 4.8</option>
              <option value={4.9}>★ ≥ 4.9</option>
            </select>
          </div>

          {/* Category Boost */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-sec)', fontWeight: 600 }}>{t.boostCategoryLabel}</span>
            <select
              className="input"
              style={{ height: 30, padding: '2px 8px', fontSize: '0.75rem', width: 'auto' }}
              value={boostCategory}
              onChange={(e) => setBoostCategory(e.target.value)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-sec)' }}>{t.boostFactorLabel}</span>
              <input
                type="range"
                min={1.1}
                max={2.0}
                step={0.05}
                value={boostFactor}
                onChange={(e) => setBoostFactor(parseFloat(e.target.value))}
                style={{ width: 90, accentColor: 'var(--accent)' }}
              />
              <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {boostFactor.toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Seed Selector & Recommendations List */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Seed Item Selector */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            {t.selectSeedHeader} ({catalog.length})
          </div>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            placeholder={t.filterPlaceholder}
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value)}
          />
          <div style={{ maxHeight: 540, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredSeedList.map((item) => {
              const active = activeSeed?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  style={{
                    textAlign: 'left',
                    padding: '9px 11px',
                    borderRadius: 6,
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-bg)' : 'var(--bg)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                    {item.icon} {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>
                    {item.category} · {item.price || '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Seed Banner & MMR Top-K Recommendations */}
        {activeSeed && (
          <div data-testid="recommendations-panel">
            {/* Active Seed Card */}
            <div
              className="card"
              style={{
                padding: 18,
                marginBottom: 16,
                borderLeft: '4px solid var(--accent)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-accent">{t.activeAnchorBadge}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
                    {activeSeed.category}
                  </span>
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>
                  {activeSeed.icon} {activeSeed.title}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 4 }}>
                  {activeSeed.description}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onInspectIn3D(activeSeed)}
              >
                <Boxes size={14} />
                <span>{t.locate3DBtn}</span>
              </button>
            </div>

            {/* Recommendations Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recs.map((rec, i) => {
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
                const isPinned = Boolean(rec.isPinned || pinnedIds.includes(String(rec.item.id)));
                const isLiked = likedIds.includes(String(rec.item.id));

                return (
                  <div
                    key={rec.item.id}
                    className="card"
                    style={{
                      padding: 16,
                      border: isPinned
                        ? '1.5px solid var(--accent)'
                        : rec.isBoosted
                        ? '1px solid var(--success)'
                        : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-mut)',
                            fontWeight: 700,
                            marginTop: 3,
                          }}
                        >
                          #{i + 1}
                        </span>
                        <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>
                          {rec.item.icon || '📦'}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>
                              {rec.item.title}
                            </span>
                            {isPinned && (
                              <span className="badge badge-accent" style={{ fontSize: '0.6875rem' }}>
                                {t.pinnedBadge}
                              </span>
                            )}
                            {rec.isBoosted && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.6875rem',
                                  background: 'var(--success-bg)',
                                  color: 'var(--success)',
                                }}
                              >
                                {t.boostedBadge} {boostFactor.toFixed(2)}x
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>
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

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--success)' }}>
                          {cosinePct.toFixed(1)}% cosine
                        </div>
                        <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>
                          MMR: {(mmrScoreVal * 100).toFixed(1)} · λ={diversityLambda.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', margin: '8px 0' }}>
                      {rec.item.description}
                    </p>

                    {/* Honest X-Ray Mathematical Score Decomposition */}
                    {showXray && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-alt)',
                          borderRadius: 6,
                          fontSize: '0.6875rem',
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-sec)' }}>{t.cosineLabel}</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{cosinePct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ width: `${cosinePct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-sec)' }}>{t.noveltyLabel}</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{noveltyPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ width: `${noveltyPct}%`, height: '100%', background: 'var(--success)', borderRadius: 2 }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-sec)' }}>{t.mmrScoreLabel}</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{mmrTotalPct.toFixed(1)}</span>
                          </div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ width: `${mmrTotalPct}%`, height: '100%', background: 'var(--text)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-mut)' }}>
                        {rec.whyRecommended}
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          data-testid="like-button"
                          className={isLiked ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                          onClick={() => toggleLike(rec.item)}
                          title="Positive relevance feedback (logs click telemetry)"
                        >
                          <ThumbsUp size={12} />
                          <span>{isLiked ? 'Liked' : 'Like'}</span>
                        </button>
                        <button
                          type="button"
                          className={isPinned ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                          onClick={() => togglePin(String(rec.item.id))}
                          title="Pin or unpin item at the top of recommendation slots"
                        >
                          <Pin size={12} />
                          <span>{isPinned ? t.unpinBtn : t.pinBtn}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => excludeSku(String(rec.item.id))}
                          title="Exclude this item from recommendations"
                        >
                          <EyeOff size={12} />
                          <span>{t.excludeBtn}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onInspectIn3D(rec.item)}
                        >
                          <Boxes size={12} />
                          <span>3D</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onSelectItem(rec.item)}
                        >
                          <span>{t.makeSeedBtn}</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
