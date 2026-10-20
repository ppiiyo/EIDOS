import React from 'react';
import { Boxes, Lightbulb, AlertCircle } from 'lucide-react';
import { CatalogItem } from '../../types';
import { HybridSearchHit } from '../../utils/recommenderEngine';

interface SearchResultsColumnsProps {
  compareMode: boolean;
  hybridHits: HybridSearchHit[];
  keywordHits: Array<{ item: CatalogItem; matchedWords: string[] }>;
  latencyMs: number;
  alpha: number;
  t: {
    hybridHitsTitle: string;
    legacyHitsTitle: string;
    legacySubtitle: string;
    legacyZeroTitle: string;
    legacyZeroDesc: string;
  };
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
}

export const SearchResultsColumns: React.FC<SearchResultsColumnsProps> = ({
  compareMode,
  hybridHits,
  keywordHits,
  latencyMs,
  alpha,
  t,
  onSelectItem,
  onInspectIn3D,
}) => {
  return (
    <div
      className={`grid gap-5 ${
        compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      }`}
    >
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
          <div className="card p-9 text-center text-[var(--text-sec)]">
            No matches found for this threshold.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {hybridHits.map((hit, idx) => (
              <div
                key={hit.item.id}
                data-testid="search-result"
                className="card p-4 cursor-pointer"
                onClick={() => onSelectItem(hit.item)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-2.5">
                    <span className="mono text-xs text-[var(--text-mut)] font-bold mt-0.5">
                      #{idx + 1}
                    </span>
                    <span className="text-xl leading-none">{hit.item.icon || '📦'}</span>
                    <div>
                      <div className="font-semibold text-[0.9375rem] text-[var(--text)]">
                        {hit.item.title}
                      </div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">
                        <span>{hit.item.category}</span>
                        <span> · </span>
                        <span className="mono">{hit.item.price || '—'}</span>
                        <span> · </span>
                        <span className="mono text-[var(--accent)]">
                          {hit.source.toUpperCase()}
                        </span>
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

                <p className="text-[0.8125rem] text-[var(--text-sec)] my-2">
                  {hit.item.description}
                </p>

                <div className="grid grid-cols-2 gap-2.5 px-2.5 py-2 bg-[var(--bg-alt)] rounded-md text-[0.6875rem] mb-2.5">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--text-sec)]">Dense 384-d Cosine</span>
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
                      <span className="text-[var(--text-sec)]">BM25 Lexical Match (CJK + Unicode)</span>
                      <span className="mono font-semibold">{(hit.bm25Score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
                      <div
                        className="h-full bg-[var(--success)]"
                        style={{ width: `${Math.min(100, hit.bm25Score * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

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
            <span className="mono text-xs text-[var(--warning)] font-semibold">
              {t.legacySubtitle}
            </span>
          </div>

          {keywordHits.length === 0 ? (
            <div className="card p-9 text-center text-[var(--text-sec)]">
              <AlertCircle size={22} className="mx-auto mb-2 text-[var(--warning)]" />
              <div className="font-semibold text-[var(--text)]">{t.legacyZeroTitle}</div>
              <p className="text-[0.8125rem] text-[var(--text-sec)] mt-1.5">
                {t.legacyZeroDesc}
              </p>
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
                  <p className="text-[0.8125rem] text-[var(--text-sec)] mt-2">
                    {item.description}
                  </p>
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
};
