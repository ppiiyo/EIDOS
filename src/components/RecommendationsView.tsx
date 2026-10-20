import React, { useState, useMemo } from 'react';
import { Sliders, Boxes, Eye } from 'lucide-react';
import {
  CatalogItem,
  CatalogRecommendation,
  MerchandisingRules,
} from '../types';
import { trackEvent } from '../lib/analytics/tracker';
import { computeRankingEvaluationMetrics } from '../utils/recommenderEngine';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { MerchandisingToolbar } from './recommendations/MerchandisingToolbar';
import { RecommendationCard } from './recommendations/RecommendationCard';

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
    trackEvent({ type: 'recommendation', itemId: String(activeSeed.id) });
    return results;
  }, [activeSeed, diversityLambda, topKLimit, activeRules, catalog, onRecommend]);

  const irMetrics = useMemo(
    () => computeRankingEvaluationMetrics(activeSeed, recs, catalog, embeddings),
    [activeSeed, recs, catalog, embeddings]
  );

  const filteredSeedList = useMemo(() => {
    const q = catalogFilter.toLowerCase().trim();
    const list = q
      ? catalog.filter(
          (i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
        )
      : catalog;
    return list.slice(0, 60);
  }, [catalog, catalogFilter]);

  const togglePin = (id: string) =>
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));

  const toggleLike = (item: CatalogItem) => {
    const id = String(item.id);
    setLikedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    trackEvent({ type: 'item_click', itemId: id, category: item.category });
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
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="card px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-sec)]">{t.topKLabel}</span>
            {[4, 6, 8, 12].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTopKLimit(k)}
                className={topKLimit === k ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
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

          <div className="card px-3.5 py-2 flex items-center gap-2.5 min-w-[260px]">
            <Sliders size={14} className="text-[var(--text-sec)]" />
            <span className="text-xs font-semibold text-[var(--text-sec)]">{t.mmrBalance}</span>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={diversityLambda}
              onChange={(e) => setDiversityLambda(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {diversityLambda.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <MerchandisingToolbar
        recsCount={recs.length}
        irMetrics={irMetrics}
        categories={categories}
        pinnedCount={pinnedIds.length}
        excludedCount={excludedIds.length}
        hasActiveRules={hasActiveRules}
        crossCategoryOnly={crossCategoryOnly}
        minRating={minRating}
        boostCategory={boostCategory}
        boostFactor={boostFactor}
        onToggleCrossCategory={setCrossCategoryOnly}
        onChangeMinRating={setMinRating}
        onChangeBoostCategory={setBoostCategory}
        onChangeBoostFactor={setBoostFactor}
        onResetRules={resetMerchandisingRules}
        t={t}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        <div className="card p-3.5">
          <div className="text-[0.8125rem] font-bold mb-2 text-[var(--text)]">
            {t.selectSeedHeader} ({catalog.length})
          </div>
          <input
            className="input mb-2.5"
            placeholder={t.filterPlaceholder}
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value)}
          />
          <div className="max-h-[540px] overflow-y-auto flex flex-col gap-1.5">
            {filteredSeedList.map((item) => {
              const active = activeSeed?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={`text-left px-3 py-2 rounded-md border cursor-pointer ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                      : 'border-[var(--border)] bg-[var(--bg)]'
                  }`}
                >
                  <div className="font-semibold text-[0.8125rem] text-[var(--text)]">
                    {item.icon} {item.title}
                  </div>
                  <div className="text-xs text-[var(--text-sec)] mt-0.5">
                    {item.category} · {item.price || '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {activeSeed && (
          <div data-testid="recommendations-panel">
            <div className="card p-4 mb-4 border-l-4 border-l-[var(--accent)] flex justify-between items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge badge-accent">{t.activeAnchorBadge}</span>
                  <span className="text-xs text-[var(--text-sec)]">{activeSeed.category}</span>
                </div>
                <div className="text-lg font-bold text-[var(--text)]">
                  {activeSeed.icon} {activeSeed.title}
                </div>
                <p className="text-[0.8125rem] text-[var(--text-sec)] mt-1">
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

            <div className="flex flex-col gap-3">
              {recs.map((rec, i) => (
                <RecommendationCard
                  key={rec.item.id}
                  rec={rec}
                  rankIndex={i}
                  diversityLambda={diversityLambda}
                  boostFactor={boostFactor}
                  showXray={showXray}
                  isPinned={Boolean(rec.isPinned || pinnedIds.includes(String(rec.item.id)))}
                  isLiked={likedIds.includes(String(rec.item.id))}
                  onToggleLike={toggleLike}
                  onTogglePin={togglePin}
                  onExclude={excludeSku}
                  onInspectIn3D={onInspectIn3D}
                  onSelectItem={onSelectItem}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
