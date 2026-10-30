import React from 'react';
import { Boxes, Lightbulb, AlertCircle } from 'lucide-react';
import { CatalogItem } from '../../types';
import { HybridSearchHit } from '../../utils/recommenderEngine';
import { UiLanguage } from '../../i18n/uiTranslations';
import { ZeroResultsCard } from './ZeroResultsCard';
import { FirstHitHumanExplanation } from './FirstHitHumanExplanation';

interface SearchResultsColumnsProps {
  compareMode: boolean;
  showXray?: boolean;
  hybridHits: HybridSearchHit[];
  keywordHits: Array<{ item: CatalogItem; matchedWords: string[] }>;
  latencyMs: number;
  alpha: number;
  query?: string;
  uiLang?: UiLanguage;
  suggestedQueries?: string[];
  onRetryQuery?: (nextQuery: string, nextAlpha?: number) => void;
  onResetFilters?: () => void;
  t: {
    hybridHitsTitle: string;
    legacyHitsTitle: string;
    legacySubtitle: string;
    legacyZeroTitle: string;
    legacyZeroDesc: string;
  };
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  onCardHoverStart?: (itemId: string) => void;
  onCardHoverEnd?: (itemId: string) => void;
  onPriceHover?: (itemId: string) => void;
}

export const SearchResultsColumns: React.FC<SearchResultsColumnsProps> = React.memo(({
  compareMode,
  showXray = true,
  hybridHits,
  keywordHits,
  latencyMs,
  alpha,
  query = '',
  uiLang = 'ru',
  suggestedQueries = [],
  onRetryQuery = () => {},
  onResetFilters = () => {},
  t,
  onSelectItem,
  onInspectIn3D,
  onCardHoverStart,
  onCardHoverEnd,
  onPriceHover,
}) => {
  return (
    <div className={`grid gap-5 ${compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
      {/* Column 1: Eidos Hybrid Search */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <div className="text-sm font-bold text-[var(--text)]">
            {t.hybridHitsTitle} ({hybridHits.length} hits)
          </div>
          <span className="mono text-xs text-[var(--success)] font-semibold">
            {latencyMs} ms · α={alpha.toFixed(2)}
          </span>
        </div>

        {hybridHits.length === 0 ? (
          <ZeroResultsCard
            query={query}
            alpha={alpha}
            uiLang={uiLang}
            suggestedQueries={suggestedQueries}
            onRetryQuery={onRetryQuery}
            onResetFilters={onResetFilters}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {hybridHits.map((hit, idx) => (
              <div
                key={hit.item.id}
                data-testid="search-result"
                className={`card p-4 cursor-pointer transition-colors ${
                  hit.isSerendipityDiscovery ? 'border-[var(--accent)]' : ''
                }`}
                onClick={() => onSelectItem(hit.item)}
                onMouseEnter={() => onCardHoverStart?.(String(hit.item.id))}
                onMouseLeave={() => onCardHoverEnd?.(String(hit.item.id))}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-2.5">
                    <span className="mono text-xs text-[var(--text-mut)] font-bold mt-0.5">
                      #{idx + 1}
                    </span>
                    <span className="text-xl leading-none">{hit.item.icon || '📦'}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[0.9375rem] text-[var(--text)]">
                          {hit.item.title}
                        </span>
                        {hit.isSerendipityDiscovery && (
                          <span
                            data-testid="serendipity-discovery-badge"
                            className="badge badge-accent text-[0.625rem]"
                            title={hit.discoveryReason}
                          >
                            ✦ Serendipity Ray ({Math.round((hit.serendipityScore ?? 0.65) * 100)}% ⊥)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">
                        <span>{hit.item.category}</span>
                        <span> · </span>
                        <span
                          className="mono px-1 rounded hover:bg-[var(--bg-alt)]"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            onPriceHover?.(String(hit.item.id));
                          }}
                        >
                          {hit.item.price || '—'}
                        </span>
                        <span> · </span>
                        <span className="mono text-[var(--accent)]">{hit.source.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="mono text-[0.9375rem] font-bold text-[var(--success)]">
                      {(hit.fusedScore * 100).toFixed(1)}%
                    </div>
                    <div className="mono text-[0.6875rem] text-[var(--text-sec)]">
                      D:{(hit.denseScore * 100).toFixed(0)}% · B:{(hit.bm25Score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                <p className="text-[0.8125rem] text-[var(--text-sec)] my-2">{hit.item.description}</p>
                {hit.isSerendipityDiscovery && hit.discoveryReason && (
                  <div className="text-[0.6875rem] text-[var(--accent)] mb-2 font-medium">
                    ⚡ {hit.discoveryReason}
                  </div>
                )}

                {idx === 0 && <FirstHitHumanExplanation hit={hit} alpha={alpha} uiLang={uiLang} />}

                {(showXray || idx === 0) && (
                  <div
                    data-testid="search-xray-panel"
                    className="px-3 py-2.5 bg-[var(--bg-alt)] border border-[var(--border)] rounded-md text-[0.6875rem] mb-2.5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--text-sec)]">
                            HNSW 384-d {hit.denseRank ? `(#${hit.denseRank})` : ''}
                          </span>
                          <span className="mono font-semibold">{(hit.denseScore * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent)]"
                            style={{ width: `${Math.min(100, hit.denseScore * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--text-sec)]">
                            BM25 Okapi {hit.sparseRank ? `(#${hit.sparseRank})` : '(0)'}
                          </span>
                          <span className="mono font-semibold">{(hit.bm25Score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
                          <div
                            className="h-full bg-[var(--success)]"
                            style={{ width: `${Math.min(100, hit.bm25Score * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--text-sec)]">RRF (k=60)</span>
                          <span className="mono font-semibold text-[var(--text)]">
                            {((hit.rrfScore ?? hit.fusedScore * 0.016) * 1000).toFixed(2)}‰
                          </span>
                        </div>
                        <div className="h-1 bg-[var(--border)] rounded overflow-hidden flex">
                          <div
                            className="h-full bg-[var(--accent)]"
                            style={{ width: `${Math.min(100, alpha * 100)}%` }}
                          />
                          <div
                            className="h-full bg-[var(--success)]"
                            style={{ width: `${Math.min(100, (1 - alpha) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--border)] text-[var(--text-sec)]">
                      <span className="mono">
                        Fused = {alpha.toFixed(2)}·D({(hit.denseScore * 100).toFixed(0)}%) +{' '}
                        {(1 - alpha).toFixed(2)}·BM25({(hit.bm25Score * 100).toFixed(0)}%) ={' '}
                        <strong className="text-[var(--text)]">{(hit.fusedScore * 100).toFixed(1)}%</strong>
                      </span>
                      {hit.matchedTokens && hit.matchedTokens.length > 0 && (
                        <span className="mono text-[var(--success)]">
                          Tokens: {hit.matchedTokens.join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-mut)]">{hit.whyRecommended}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectIn3D(hit.item);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <Boxes size={12} />
                      <span>3D Node</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(hit.item);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <Lightbulb size={12} />
                      <span>MMR Recs</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column 2: Legacy Exact Keyword Search */}
      {compareMode && (
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <div className="text-sm font-bold text-[var(--text-sec)]">
              {t.legacyHitsTitle} ({keywordHits.length} hits)
            </div>
            <span className="mono text-xs text-[var(--warning)] font-semibold">{t.legacySubtitle}</span>
          </div>

          {keywordHits.length === 0 ? (
            <div className="card p-9 text-center text-[var(--text-sec)]">
              <AlertCircle size={22} className="mx-auto mb-2 text-[var(--warning)]" />
              <div className="font-semibold text-[var(--text)]">{t.legacyZeroTitle}</div>
              <p className="text-[0.8125rem] text-[var(--text-sec)] mt-1.5">{t.legacyZeroDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {keywordHits.slice(0, 8).map(({ item, matchedWords }, idx) => (
                <div key={item.id} className="card p-4 opacity-90">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-[0.9375rem] text-[var(--text)]">
                        #{idx + 1} · {item.icon} {item.title}
                      </div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">
                        {item.category} · {item.price || '—'}
                      </div>
                    </div>
                    <span className="mono text-xs text-[var(--warning)] font-semibold">
                      {matchedWords.length} word match
                    </span>
                  </div>
                  <p className="text-[0.8125rem] text-[var(--text-sec)] mt-2">{item.description}</p>
                  <div className="text-xs text-[var(--text-mut)] mt-1.5">
                    Matched tokens: <span className="mono">{matchedWords.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
