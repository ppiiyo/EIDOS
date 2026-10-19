import React, { useState } from 'react';
import { Lightbulb, ArrowRight, Layers, Sliders } from 'lucide-react';
import { CatalogItem, CatalogRecommendation } from '../types';
import { trackEvent } from '../lib/analytics/tracker';

interface RecommendationsViewProps {
  catalog: CatalogItem[];
  onGetRecommendations: (item: CatalogItem, diversity: number) => Promise<CatalogRecommendation[]>;
  onSelectItem?: (item: CatalogItem) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  catalog,
  onGetRecommendations,
  onSelectItem,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(String(catalog[0]?.id || '1'));
  const [diversity, setDiversity] = useState<number>(0.3);
  const [recs, setRecs] = useState<CatalogRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const selectedItem = catalog.find((c) => c.id === selectedItemId) || catalog[0];

  const handleCompute = async () => {
    if (!selectedItem) return;
    setIsLoading(true);
    setHasRun(true);
    trackEvent({ type: 'recommendation', itemId: selectedItem.id, category: selectedItem.category });

    try {
      const res = await onGetRecommendations(selectedItem, diversity);
      setRecs(res);
      res.forEach(r => {
        trackEvent({ type: 'item_view', itemId: r.item.id, category: r.item.category });
      });
    } catch {
      setRecs([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Recommendations Engine</h1>
        <p className="page-sub">
          Vector affinity recommendations with Maximal Marginal Relevance (MMR) diversity balancing
        </p>
      </div>

      {/* Control panel */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Seed Item (Target Anchor)
            </label>
            <select
              data-testid="item-select"
              className="input"
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setHasRun(false);
              }}
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.category}) — {item.price}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                MMR Diversity Factor:
              </label>
              <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
                {(diversity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={diversity}
              onChange={(e) => setDiversity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCompute}
            disabled={isLoading || !selectedItem}
            style={{ height: 38 }}
          >
            {isLoading ? 'Computing...' : 'Get Recommendations'}
          </button>
        </div>
      </div>

      {/* Recommendations Results */}
      {selectedItem && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Seed Card */}
          <div className="card" style={{ padding: 20, height: 'fit-content' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-sec)', letterSpacing: '.05em' }}>
              Reference Anchor
            </span>
            <div style={{ fontSize: '2rem', marginTop: 12, marginBottom: 8 }}>{selectedItem.icon || '📦'}</div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>{selectedItem.title}</h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', margin: '4px 0 12px' }}>{selectedItem.category}</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', lineHeight: 1.5 }}>
              {selectedItem.description}
            </p>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: '1rem' }}>
              {selectedItem.price}
            </div>
          </div>

          {/* Results List */}
          <div>
            {!hasRun && (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)' }}>
                <Lightbulb size={24} style={{ margin: '0 auto 8px', color: 'var(--text-mut)' }} />
                <p style={{ fontWeight: 500 }}>Select a product and click "Get Recommendations"</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-mut)', marginTop: 4 }}>
                  The engine will calculate pairwise cosine affinity and MMR diversity re-ranking.
                </p>
              </div>
            )}

            {hasRun && recs.length === 0 && !isLoading && (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)' }}>
                No recommendations found for this item with the current diversity threshold.
              </div>
            )}

            {recs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
                  Top {recs.length} recommended items ranked by semantic affinity:
                </div>
                {recs.map(({ item, sim, whyRecommended }, idx) => (
                  <div
                    key={item.id}
                    data-testid="recommendation-card"
                    className="card"
                    onClick={() => {
                      trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                      onSelectItem?.(item);
                    }}
                    style={{
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#F3F4F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-sec)',
                      }}>
                        {idx + 1}
                      </span>
                      <div style={{ fontSize: '1.5rem' }}>{item.icon || '📦'}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{item.category}</div>
                        {whyRecommended && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-mut)', marginTop: 4 }}>
                            {whyRecommended}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--success)',
                        background: 'var(--success-bg)',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}>
                        {(sim * 100).toFixed(0)}% affinity
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: 4 }}>
                        {item.price}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
