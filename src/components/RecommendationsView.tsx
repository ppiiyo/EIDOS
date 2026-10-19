import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Boxes, Sliders, Layers } from 'lucide-react';
import { CatalogItem, CatalogRecommendation } from '../types';
import { computeCategoryEntropy } from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';

interface RecommendationsViewProps {
  catalog: CatalogItem[];
  selectedItem: CatalogItem | null;
  onSelectSeedItem: (item: CatalogItem) => void;
  onGetRecommendations: (item: CatalogItem, diversity: number, limit?: number) => Promise<CatalogRecommendation[]>;
  onInspectIn3D: (item: CatalogItem) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  catalog,
  selectedItem,
  onSelectSeedItem,
  onGetRecommendations,
  onInspectIn3D,
}) => {
  const activeSeed = selectedItem || catalog[0];
  const [diversity, setDiversity] = useState<number>(0.35);
  const [limit, setLimit] = useState<number>(6);
  const [recs, setRecs] = useState<CatalogRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const computeRecs = async (target: CatalogItem, div: number, lim: number) => {
    if (!target) return;
    setIsLoading(true);
    trackEvent({ type: 'recommendation', itemId: target.id, category: target.category });

    try {
      const res = await onGetRecommendations(target, div, lim);
      setRecs(res);
      res.forEach((r) => {
        trackEvent({ type: 'item_view', itemId: r.item.id, category: r.item.category });
      });
    } catch {
      setRecs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically recompute whenever activeSeed, diversity, or limit changes
  useEffect(() => {
    if (activeSeed) {
      computeRecs(activeSeed, diversity, limit);
    }
  }, [activeSeed?.id, diversity, limit, catalog.length]);

  const entropyStats = useMemo(() => {
    return computeCategoryEntropy(recs.map((r) => r.item));
  }, [recs]);

  return (
    <div className="page">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 className="page-title">MMR Recommendations & Explainable X-Ray</h1>
          <p className="page-sub">
            Maximal Marginal Relevance diversity re-ranking with Shannon Category Entropy verification
          </p>
        </div>

        {/* Live Shannon Entropy Verification Indicator */}
        <div
          className="card"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: '0.75rem',
          }}
        >
          <Layers size={15} color="var(--success)" />
          <div>
            <span style={{ color: 'var(--text-sec)' }}>Shannon Diversity Entropy: </span>
            <strong className="mono" style={{ color: 'var(--success)' }}>
              H = {entropyStats.entropyBits.toFixed(2)} bits
            </strong>
            <span style={{ color: 'var(--text-mut)', marginLeft: 8 }}>
              ({entropyStats.uniqueCategories} categories across {recs.length} items)
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="card" style={{ padding: 20, marginBottom: 22 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
            alignItems: 'flex-end',
          }}
        >
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Target Seed Anchor Item
            </label>
            <select
              className="input"
              value={String(activeSeed?.id || '')}
              onChange={(e) => {
                const found = catalog.find((c) => String(c.id) === e.target.value);
                if (found) onSelectSeedItem(found);
              }}
            >
              {catalog.slice(0, 200).map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.title} ({item.category}) — {item.price}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                MMR Diversity Factor (λ):
              </label>
              <span className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>
                λ = {diversity.toFixed(2)} ({(diversity * 100).toFixed(0)}% novelty)
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={diversity}
              onChange={(e) => setDiversity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => activeSeed && onInspectIn3D(activeSeed)}
              style={{ height: 38, flex: 1 }}
            >
              <Boxes size={14} />
              <span>View Anchor in 3D Space</span>
            </button>
          </div>
        </div>
      </div>

      {/* Split Layout: Reference Anchor Card + X-Ray Recommendations */}
      {activeSeed && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            alignItems: 'flex-start',
          }}
        >
          {/* Left: Reference Anchor Card */}
          <div className="card" style={{ padding: 20, maxWidth: 380 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
              Active Seed Anchor · ID #{activeSeed.id}
            </div>
            <div style={{ fontSize: '2.25rem', marginTop: 10, marginBottom: 8 }}>{activeSeed.icon || '📦'}</div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>{activeSeed.title}</h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', margin: '4px 0 12px' }}>
              {activeSeed.category} · <span className="mono">{activeSeed.price || '—'}</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', lineHeight: 1.55 }}>
              {activeSeed.description}
            </p>
            {activeSeed.tags && activeSeed.tags.length > 0 && (
              <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-mut)' }}>
                Tags: <span className="mono">{activeSeed.tags.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Right: Recommended Items with Factor Decomposition X-Ray */}
          <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recs.map(({ item, sim, whyRecommended }, idx) => {
                const isCrossCategory = item.category !== activeSeed.category;
                const noveltyScore = isCrossCategory ? Math.min(1, 0.65 + diversity * 0.35) : Math.max(0.2, 1 - diversity);
                const mmrComposite = (1 - diversity) * sim + diversity * noveltyScore;

                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span
                          className="mono"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: 'var(--bg-alt)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-sec)',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.icon || '📦'}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>
                            <span>{item.category}</span>
                            <span> · </span>
                            <span className="mono">{item.price || '—'}</span>
                            {isCrossCategory && (
                              <>
                                <span> · </span>
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Cross-Category Discovery</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--success)' }}>
                          {(sim * 100).toFixed(1)}% cosine
                        </div>
                        <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>
                          MMR score: {(mmrComposite * 100).toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {whyRecommended && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 8 }}>
                        {whyRecommended}
                      </div>
                    )}

                    {/* X-Ray Score Breakdown Bars */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        padding: '8px 12px',
                        background: 'var(--bg-alt)',
                        borderRadius: 6,
                        marginTop: 10,
                        fontSize: '0.6875rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-sec)' }}>384-d Semantic Affinity</span>
                          <span className="mono" style={{ fontWeight: 600 }}>{(sim * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, sim * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-sec)' }}>MMR Diversity & Novelty Contribution</span>
                          <span className="mono" style={{ fontWeight: 600 }}>{(noveltyScore * 100).toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, noveltyScore * 100)}%`, height: '100%', background: 'var(--success)' }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onInspectIn3D(item)}
                      >
                        <Boxes size={12} />
                        <span>Locate in 3D Space</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                          onSelectSeedItem(item);
                        }}
                      >
                        <Lightbulb size={12} />
                        <span>Use as Seed Anchor</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
