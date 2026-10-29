import React from 'react';
import { Microscope, Tag, Target, DollarSign, Clock } from 'lucide-react';

export interface InspectorExplanation {
  denseComponent?: number;
  sparseBm25Component?: number;
  rrfScore?: number;
  mmrPenalty?: number;
  businessBoost?: number;
}

export interface InspectorResultItem {
  id: string;
  title: string;
  category?: string;
  price?: number | string;
  score: number;
  explanation?: InspectorExplanation | null;
}

export interface InspectorExtractedIntent {
  category?: string;
  categories?: string[];
  useCase?: string;
  useCases?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  confidence?: number;
  explanation?: string;
}

export interface QueryInspectorProps {
  query?: string;
  results: InspectorResultItem[];
  latencyMs?: number;
  extractedIntent?: InspectorExtractedIntent | null;
}

export const QueryInspector: React.FC<QueryInspectorProps> = ({
  query,
  results = [],
  latencyMs = 0,
  extractedIntent,
}) => {
  const safeResults = Array.isArray(results) ? results : [];

  const categoryBadge =
    extractedIntent?.category ||
    (extractedIntent?.categories && extractedIntent.categories[0]) ||
    undefined;
  const useCaseBadge =
    extractedIntent?.useCase ||
    (extractedIntent?.useCases && extractedIntent.useCases[0]) ||
    undefined;
  const priceRange = extractedIntent?.priceRange;

  const formatPriceRange = (range?: { min?: number; max?: number }): string | null => {
    if (!range) return null;
    if (range.min !== undefined && range.max !== undefined) {
      return `${range.min} – ${range.max} ₽`;
    }
    if (range.max !== undefined) {
      return `до ${range.max} ₽`;
    }
    if (range.min !== undefined) {
      return `от ${range.min} ₽`;
    }
    return null;
  };

  const priceBadgeText = formatPriceRange(priceRange);

  return (
    <div
      className="card p-4 mb-5 border border-[var(--border)] bg-[var(--bg-alt)]"
      data-testid="query-inspector"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Microscope size={16} className="text-[var(--accent)]" />
          <div>
            <div className="text-sm font-bold text-[var(--text)]">
              X-Ray Query Inspector (Декомпозиция скоринга и намерения)
            </div>
            <div className="text-[0.6875rem] text-[var(--text-sec)]">
              Покомпонентный вклад Dense 384-d, Sparse BM25, Business Boost и MMR Penalty
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {query && (
            <span className="badge badge-secondary mono text-[0.6875rem]">
              Q: &laquo;{query}&raquo;
            </span>
          )}
          <span
            className="badge badge-success mono text-[0.6875rem] flex items-center gap-1"
            data-testid="inspector-latency"
          >
            <Clock size={11} />
            <span>{latencyMs} ms</span>
          </span>
        </div>
      </div>

      {/* Extracted Intent Badges */}
      {extractedIntent && (categoryBadge || useCaseBadge || priceBadgeText) && (
        <div
          className="flex flex-wrap items-center gap-2 p-2.5 mb-3 rounded-md bg-[var(--bg)] border border-[var(--border)]"
          data-testid="extracted-intent-badges"
        >
          <span className="text-xs font-semibold text-[var(--text-sec)]">
            Распознанное намерение:
          </span>

          {categoryBadge && (
            <span
              className="badge badge-accent text-xs flex items-center gap-1"
              data-testid="intent-badge-category"
            >
              <Tag size={11} />
              <span>Категория: {categoryBadge}</span>
            </span>
          )}

          {useCaseBadge && (
            <span
              className="badge badge-success text-xs flex items-center gap-1"
              data-testid="intent-badge-usecase"
            >
              <Target size={11} />
              <span>Сценарий: {useCaseBadge}</span>
            </span>
          )}

          {priceBadgeText && (
            <span
              className="badge badge-warning text-xs flex items-center gap-1"
              data-testid="intent-badge-price"
            >
              <DollarSign size={11} />
              <span>Бюджет: {priceBadgeText}</span>
            </span>
          )}

          {typeof extractedIntent.confidence === 'number' && (
            <span className="mono text-[0.6875rem] text-[var(--text-sec)] ml-auto">
              Confidence: {Math.round(extractedIntent.confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[0.6875rem] text-[var(--text-sec)] mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span>Dense 384-d (Синий)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span>Sparse BM25 (Зелёный)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span>Business Boost (Оранжевый)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span>MMR Penalty (Красный, влево)</span>
        </span>
      </div>

      {/* Empty State */}
      {safeResults.length === 0 ? (
        <div
          className="p-6 text-center rounded-md bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text-sec)]"
          data-testid="inspector-empty-state"
        >
          Нет результатов для отображения
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {safeResults.slice(0, 6).map((result, idx) => {
            // Safe access to result.explanation to prevent TypeError
            const exp = result?.explanation ?? undefined;
            const dense = Math.max(0, Number(exp?.denseComponent ?? 0));
            const sparse = Math.max(0, Number(exp?.sparseBm25Component ?? 0));
            const boost = Math.max(0, Number(exp?.businessBoost ?? 0));
            const rawMmr = Number(exp?.mmrPenalty ?? 0);
            const mmrMagnitude = Math.abs(rawMmr);

            const positiveSum = Math.max(0.0001, dense + sparse + boost);
            const densePct = Math.min(100, Math.round((dense / positiveSum) * 100));
            const sparsePct = Math.min(100 - densePct, Math.round((sparse / positiveSum) * 100));
            const boostPct =
              boost > 0 ? Math.max(4, Math.min(100 - densePct - sparsePct, Math.round((boost / positiveSum) * 100))) : 0;
            const mmrWidthPct = Math.min(45, Math.round(mmrMagnitude * 100));

            return (
              <div
                key={result.id || idx}
                data-testid="inspector-result-row"
                className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)] text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="font-semibold text-[var(--text)] truncate">
                    #{idx + 1} · {result.title}
                  </div>
                  <span className="mono font-bold text-[var(--success)] shrink-0">
                    {(Number(result.score || 0) * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Stacked Bar Visualization */}
                <div
                  className="h-2.5 w-full rounded bg-[var(--bg-alt)] overflow-hidden flex items-center mb-1.5 border border-[var(--border)]"
                  data-testid="inspector-stacked-bar"
                >
                  {dense > 0 && (
                    <div
                      data-testid="bar-dense"
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${densePct}%` }}
                      title={`Dense: ${dense.toFixed(4)}`}
                    />
                  )}
                  {sparse > 0 && (
                    <div
                      data-testid="bar-sparse"
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${sparsePct}%` }}
                      title={`Sparse BM25: ${sparse.toFixed(4)}`}
                    />
                  )}
                  {boost > 0 && (
                    <div
                      data-testid="bar-boost"
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${boostPct}%` }}
                      title={`Business Boost: +${boost.toFixed(4)}`}
                    />
                  )}
                  {mmrMagnitude > 0 && (
                    <div
                      data-testid="bar-mmr-penalty"
                      className="h-full bg-red-500 transition-all"
                      style={{
                        width: `${Math.max(4, mmrWidthPct)}%`,
                        marginLeft: 'auto',
                      }}
                      title={`MMR Penalty: -${mmrMagnitude.toFixed(4)}`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mono text-[0.6875rem] text-[var(--text-sec)]">
                  <span>Dense: {dense.toFixed(3)}</span>
                  <span>BM25: {sparse.toFixed(3)}</span>
                  {boost > 0 && <span className="text-amber-500">Boost: +{boost.toFixed(3)}</span>}
                  {mmrMagnitude > 0 && (
                    <span className="text-red-500">MMR: -{mmrMagnitude.toFixed(3)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QueryInspector;
