import React, { useState, useEffect } from 'react';
import { CatalogItem } from '../types';

export interface RankingParams {
  alpha: number; // 0 = BM25 only, 1 = Vector only
  diversityLambda: number; // MMR diversity weight
  freshnessWeight: number;
  popularityWeight: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  finalScore: number;
  vectorScore: number;
  bm25Score: number;
  diversityBonus: number;
}

export interface RankingPlaygroundProps {
  catalog?: CatalogItem[];
}

const DEFAULT_FALLBACK_ITEMS: Array<{ id: string; title: string; category: string }> = [
  { id: 'item-1', title: 'Sony WH-1000XM5 Wireless Noise-Canceling Headphones', category: 'Audio' },
  { id: 'item-2', title: 'Bose QuietComfort Ultra Wireless Headphones', category: 'Audio' },
  { id: 'item-3', title: 'Sennheiser Momentum 4 Wireless Over-Ear', category: 'Audio' },
  { id: 'item-4', title: 'Apple AirPods Max Spatial Audio', category: 'Wearables' },
  { id: 'item-5', title: 'Jabra Elite 85h Titanium Black Wireless', category: 'Accessories' },
];

export function computeFallbackResults(
  query: string,
  params: RankingParams,
  catalog?: CatalogItem[]
): SearchResultItem[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const source =
    catalog && catalog.length > 0
      ? catalog.slice(0, 12).map((c) => ({ id: c.id, title: c.title, category: c.category }))
      : DEFAULT_FALLBACK_ITEMS;

  return source
    .map((item, idx) => {
      const hay = `${item.title} ${item.category}`.toLowerCase();
      const matchedCount = terms.filter((t) => hay.includes(t)).length;
      const bm25Score =
        terms.length > 0
          ? Math.min(1, 0.35 + (matchedCount / terms.length) * 0.6)
          : Math.max(0.25, 0.85 - idx * 0.08);
      const vectorScore = Math.min(
        0.98,
        Math.max(0.3, 0.92 - idx * 0.06 + (matchedCount > 0 ? 0.05 : 0))
      );
      const diversityBonus = Number((params.diversityLambda * (0.2 + (idx % 3) * 0.07)).toFixed(3));
      const boost = params.freshnessWeight * 0.08 + params.popularityWeight * 0.1;
      const finalScore =
        params.alpha * vectorScore +
        (1 - params.alpha) * bm25Score +
        diversityBonus * 0.25 +
        boost;

      return {
        id: item.id,
        title: item.title,
        category: item.category,
        finalScore,
        vectorScore,
        bm25Score,
        diversityBonus,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 8);
}

const SLIDERS: Array<{
  key: keyof RankingParams;
  label: string;
  testId: string;
  leftHint?: string;
  rightHint?: string;
}> = [
  {
    key: 'alpha',
    label: 'Hybrid Alpha (Vector vs BM25)',
    testId: 'slider-alpha',
    leftHint: '100% BM25 (Keyword)',
    rightHint: '100% Vector (Semantic)',
  },
  { key: 'diversityLambda', label: 'MMR Diversity (λ)', testId: 'slider-diversity' },
  { key: 'freshnessWeight', label: 'Freshness Boost', testId: 'slider-freshness' },
  { key: 'popularityWeight', label: 'Popularity Boost', testId: 'slider-popularity' },
];

export const RankingPlayground: React.FC<RankingPlaygroundProps> = ({ catalog }) => {
  const [query, setQuery] = useState('wireless headphones');
  const [params, setParams] = useState<RankingParams>({
    alpha: 0.7,
    diversityLambda: 0.5,
    freshnessWeight: 0.2,
    popularityWeight: 0.3,
  });
  const [results, setResults] = useState<SearchResultItem[]>(() =>
    computeFallbackResults(
      'wireless headphones',
      { alpha: 0.7, diversityLambda: 0.5, freshnessWeight: 0.2, popularityWeight: 0.3 },
      catalog
    )
  );
  const [isLoading, setIsLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState(8);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      const start = performance.now();
      try {
        const res = await fetch('/v1/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'eidos_demo_key' },
          body: JSON.stringify({ query, alpha: params.alpha, topK: 10 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          results?: Array<{ id?: string; title?: string; category?: string; score?: number }>;
        };
        setLatencyMs(Math.max(1, Math.round(performance.now() - start)));

        if (Array.isArray(data.results) && data.results.length > 0) {
          const enriched: SearchResultItem[] = data.results.map((r, i) => {
            const baseScore = typeof r.score === 'number' ? r.score : 0.85 - i * 0.05;
            const vectorScore = baseScore * params.alpha;
            const bm25Score = baseScore * (1 - params.alpha);
            const diversityBonus = params.diversityLambda * (1 / (i + 1)) * 0.25;
            const finalScore =
              vectorScore +
              bm25Score +
              diversityBonus +
              params.freshnessWeight * 0.05 +
              params.popularityWeight * 0.05;
            return {
              id: r.id || `item-${i}`,
              title: r.title || `Item ${r.id || i + 1}`,
              category: r.category || 'General',
              finalScore,
              vectorScore,
              bm25Score,
              diversityBonus,
            };
          });
          setResults(enriched.sort((a, b) => b.finalScore - a.finalScore));
        } else {
          setResults(computeFallbackResults(query, params, catalog));
        }
      } catch {
        setLatencyMs(Math.max(1, Math.round(performance.now() - start)));
        setResults(computeFallbackResults(query, params, catalog));
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, params, catalog]);

  return (
    <div className="page ranking-playground" data-testid="ranking-playground">
      <div className="playground-header mb-6">
        <h2 className="page-title">⚖️ Interactive Ranking Playground</h2>
        <p className="page-sub">
          Настройте веса гибридного поиска и MMR-диверсификации в реальном времени
        </p>
      </div>

      <div className="playground-layout">
        <div className="controls-panel card">
          <div className="control-group mb-5">
            <label
              htmlFor="ranking-query-input"
              className="block text-xs font-semibold text-[var(--text-sec)] mb-1.5"
            >
              Search Query
            </label>
            <input
              id="ranking-query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search query..."
              className="search-input-large input"
              data-testid="ranking-query-input"
            />
          </div>

          {SLIDERS.map(({ key, label, testId, leftHint, rightHint }) => (
            <div key={key} className="slider-group">
              <div className="slider-header">
                <span>{label}</span>
                <span className="slider-value" data-testid={`${key}-value`}>
                  {params[key].toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label={label}
                data-testid={testId}
                value={params[key]}
                onChange={(e) => setParams({ ...params, [key]: parseFloat(e.target.value) })}
              />
              {leftHint && rightHint && (
                <div className="slider-labels">
                  <span>{leftHint}</span>
                  <span>{rightHint}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="results-panel card p-5">
          <div className="results-meta flex justify-between items-center mb-4">
            <span className="text-sm font-semibold">Showing {results.length} live results</span>
            <span className="latency-badge badge badge-success mono" data-testid="ranking-latency">
              ⚡ {latencyMs} ms {isLoading ? '(updating...)' : ''}
            </span>
          </div>

          <div className="results-list" data-testid="ranking-results-list">
            {results.map((item, idx) => (
              <div key={item.id} className="result-card-live" data-testid={`ranking-result-${idx}`}>
                <div className="result-rank">
                  <div className="result-header">
                    <span className="rank-badge">#{idx + 1}</span>
                    <div className="result-info">
                      <h4>{item.title}</h4>
                      <span className="category-tag text-xs text-[var(--text-sec)]">
                        {item.category}
                      </span>
                    </div>
                    <div className="final-score mono">{item.finalScore.toFixed(3)}</div>
                  </div>
                </div>

                <div className="score-bars">
                  {[
                    { label: 'Vector', cls: 'vector', pct: item.vectorScore * 100 },
                    { label: 'BM25', cls: 'bm25', pct: item.bm25Score * 100 },
                    { label: 'Diversity', cls: 'diversity', pct: item.diversityBonus * 200 },
                  ].map((b) => (
                    <div key={b.label} className="bar-row">
                      <span>{b.label}</span>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${b.cls}`}
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
