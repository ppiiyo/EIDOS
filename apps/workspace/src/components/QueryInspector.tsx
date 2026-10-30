import React, { useState } from 'react';
import { Microscope, Tag, Target, DollarSign, Clock, Copy, Check, Layers } from 'lucide-react';

export interface InspectorExplanation {
  denseComponent?: number;
  sparseBm25Component?: number;
  rrfScore?: number;
  mmrPenalty?: number;
  businessBoost?: number;
  kineticBonus?: number;
  serendipityScore?: number;
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
  priceRange?: { min?: number; max?: number };
  confidence?: number;
  explanation?: string;
}

export interface QueryInspectorProps {
  query?: string;
  results: InspectorResultItem[];
  latencyMs?: number;
  extractedIntent?: InspectorExtractedIntent | null;
  defaultMode?: 'simple' | 'full';
  highlightedResultId?: string | null;
}

const LEGEND_ITEMS = [
  { label: 'Dense 384-d', cls: 'bg-blue-500', tip: 'Dense 384-d: Семантическая близость смысла (HNSW) / Semantic vector similarity' },
  { label: 'Sparse BM25', cls: 'bg-emerald-500', tip: 'Sparse BM25: Точное совпадение ключевых слов / Exact keyword match' },
  { label: 'RRF', cls: 'bg-indigo-500', tip: 'RRF: Reciprocal Rank Fusion (гибридный ранг k=60)' },
  { label: 'Business Boost', cls: 'bg-amber-500', tip: 'Business & Intent Boost: Приоритет за совпадение намерения, бюджета и маржи' },
  { label: 'Kinetic Bonus', cls: 'bg-purple-500', tip: 'Kinetic Bonus: Поведенческий буст на основе микродвижений внимания и сравнения A↔B' },
  { label: 'Serendipity', cls: 'bg-cyan-500', tip: 'Serendipity Score: Ортогональное открытие Грама-Шмидта против эхо-камеры' },
  { label: 'MMR Penalty', cls: 'bg-red-500', tip: 'MMR Penalty: Штраф за дублирование однотипных товаров в топе выдачи' },
];

export const QueryInspector: React.FC<QueryInspectorProps> = ({
  query,
  results = [],
  latencyMs = 0,
  extractedIntent,
  defaultMode = 'full',
  highlightedResultId,
}) => {
  const [xrayMode, setXrayMode] = useState<'simple' | 'full'>(defaultMode);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const safeResults = Array.isArray(results) ? results : [];

  const categoryBadge = extractedIntent?.category || extractedIntent?.categories?.[0];
  const useCaseBadge = extractedIntent?.useCase || extractedIntent?.useCases?.[0];
  const pr = extractedIntent?.priceRange;
  const priceBadgeText = !pr
    ? null
    : pr.min !== undefined && pr.max !== undefined
    ? `${pr.min} – ${pr.max} ₽`
    : pr.max !== undefined
    ? `до ${pr.max} ₽`
    : pr.min !== undefined
    ? `от ${pr.min} ₽`
    : null;

  const handleCopyExplanation = (result: InspectorResultItem, idx: number) => {
    const exp = result?.explanation ?? {};
    const dense = Number(exp?.denseComponent ?? 0).toFixed(3);
    const sparse = Number(exp?.sparseBm25Component ?? 0).toFixed(3);
    const rrf = Number(exp?.rrfScore ?? (result.score || 0) * 0.016).toFixed(4);
    const boost = Number(exp?.businessBoost ?? 0).toFixed(3);
    const kinetic = Number(exp?.kineticBonus ?? 0).toFixed(3);
    const serendipity = Number(exp?.serendipityScore ?? 0).toFixed(3);
    const mmr = Math.abs(Number(exp?.mmrPenalty ?? 0)).toFixed(3);
    const text = `Этот товар «${result.title}» на #${idx + 1} месте (Score ${(Number(result.score || 0) * 100).toFixed(1)}%), потому что: Семантика 384-d = ${dense}, Лексика BM25 = ${sparse}, RRF = ${rrf}, Business/Intent Boost = +${boost}, Kinetic Bonus = +${kinetic}, Serendipity = +${serendipity}, MMR Penalty = -${mmr}.`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const key = String(result.id || idx);
    setCopiedId(key);
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
  };

  return (
    <div className="card p-4 mb-5 border border-[var(--border)] bg-[var(--bg-alt)]" data-testid="query-inspector">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Microscope size={16} className="text-[var(--accent)]" />
          <div>
            <div className="text-sm font-bold text-[var(--text)]">
              X-Ray Query Inspector (Декомпозиция 7 факторов ранжирования)
            </div>
            <div className="text-[0.6875rem] text-[var(--text-sec)]">
              Dense 384-d · Sparse BM25 · RRF · MMR Penalty · Business Boost · Kinetic · Serendipity
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid="xray-mode-toggle"
            onClick={() => setXrayMode((m) => (m === 'full' ? 'simple' : 'full'))}
            className="btn btn-secondary btn-sm text-[0.6875rem]"
          >
            <Layers size={12} />
            <span>{xrayMode === 'full' ? 'Полный X-Ray (7 факторов)' : 'Простой X-Ray (4 фактора)'}</span>
          </button>
          {query && <span className="badge badge-secondary mono text-[0.6875rem]">Q: &laquo;{query}&raquo;</span>}
          <span className="badge badge-success mono text-[0.6875rem] flex items-center gap-1" data-testid="inspector-latency">
            <Clock size={11} />
            <span>{latencyMs} ms</span>
          </span>
        </div>
      </div>

      {extractedIntent && (categoryBadge || useCaseBadge || priceBadgeText) && (
        <div
          className="flex flex-wrap items-center gap-2 p-2.5 mb-3 rounded-md bg-[var(--bg)] border border-[var(--accent)]/40"
          data-testid="extracted-intent-badges"
        >
          <span className="text-xs font-semibold text-[var(--text-sec)]">Распознанное намерение:</span>
          {categoryBadge && (
            <span className="badge badge-accent text-xs flex items-center gap-1" data-testid="intent-badge-category">
              <Tag size={11} />
              <span>Категория: {categoryBadge}</span>
            </span>
          )}
          {useCaseBadge && (
            <span className="badge badge-success text-xs flex items-center gap-1" data-testid="intent-badge-usecase">
              <Target size={11} />
              <span>Сценарий: {useCaseBadge}</span>
            </span>
          )}
          {priceBadgeText && (
            <span className="badge badge-warning text-xs flex items-center gap-1" data-testid="intent-badge-price">
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

      <div className="flex flex-wrap items-center gap-3.5 text-[0.6875rem] text-[var(--text-sec)] mb-3">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5" title={item.tip}>
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${item.cls}`} />
            <span>{item.label}</span>
          </span>
        ))}
      </div>

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
            const exp = result?.explanation ?? undefined;
            const dense = Math.max(0, Number(exp?.denseComponent ?? 0));
            const sparse = Math.max(0, Number(exp?.sparseBm25Component ?? 0));
            const rrf = Math.max(0, Number(exp?.rrfScore ?? (result.score || 0) * 0.016));
            const boost = Math.max(0, Number(exp?.businessBoost ?? 0));
            const kinetic = Math.max(0, Number(exp?.kineticBonus ?? 0));
            const serendipity = Math.max(0, Number(exp?.serendipityScore ?? 0));
            const mmrMagnitude = Math.abs(Number(exp?.mmrPenalty ?? 0));

            const positiveSum = Math.max(0.0001, dense + sparse + boost + kinetic + serendipity);
            const densePct = Math.min(100, Math.round((dense / positiveSum) * 100));
            const sparsePct = Math.min(100 - densePct, Math.round((sparse / positiveSum) * 100));
            const boostPct = boost > 0 ? Math.max(4, Math.min(100 - densePct - sparsePct, Math.round((boost / positiveSum) * 100))) : 0;
            const mmrWidthPct = Math.min(45, Math.round(mmrMagnitude * 100));
            const rowKey = String(result.id || idx);
            const isHighlighted = highlightedResultId === rowKey || (idx === 0 && highlightedResultId === '__first__');

            return (
              <div
                key={rowKey}
                data-testid="inspector-result-row"
                className={`p-3 rounded-md bg-[var(--bg)] border transition-all text-xs ${
                  isHighlighted ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="font-semibold text-[var(--text)] truncate">
                    #{idx + 1} · {result.title}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="copy-xray-explanation"
                      onClick={() => handleCopyExplanation(result, idx)}
                      className="btn btn-secondary btn-sm py-0.5 px-1.5 text-[10px]"
                      title="Скопировать объяснение позиции товара"
                    >
                      {copiedId === rowKey ? <Check size={10} className="text-[var(--success)]" /> : <Copy size={10} />}
                      <span>{copiedId === rowKey ? 'Скопировано' : 'Объяснение'}</span>
                    </button>
                    <span className="mono font-bold text-[var(--success)]">
                      {(Number(result.score || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div
                  className="h-2.5 w-full rounded bg-[var(--bg-alt)] overflow-hidden flex items-center mb-2 border border-[var(--border)]"
                  data-testid="inspector-stacked-bar"
                >
                  {dense > 0 && <div data-testid="bar-dense" className="h-full bg-blue-500 transition-all" style={{ width: `${densePct}%` }} title={`Dense: ${dense.toFixed(4)}`} />}
                  {sparse > 0 && <div data-testid="bar-sparse" className="h-full bg-emerald-500 transition-all" style={{ width: `${sparsePct}%` }} title={`Sparse BM25: ${sparse.toFixed(4)}`} />}
                  {boost > 0 && <div data-testid="bar-boost" className="h-full bg-amber-500 transition-all" style={{ width: `${boostPct}%` }} title={`Business Boost: +${boost.toFixed(4)}`} />}
                  {mmrMagnitude > 0 && <div data-testid="bar-mmr-penalty" className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(4, mmrWidthPct)}%`, marginLeft: 'auto' }} title={`MMR Penalty: -${mmrMagnitude.toFixed(4)}`} />}
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mono text-[0.6875rem]">
                  <span className={dense > 0 ? 'text-blue-400 font-medium' : 'text-[var(--text-mut)]'}>
                    Dense: {dense > 0 ? dense.toFixed(3) : '0.000 (не актив.)'}
                  </span>
                  <span className={sparse > 0 ? 'text-emerald-400 font-medium' : 'text-[var(--text-mut)]'}>
                    BM25: {sparse > 0 ? sparse.toFixed(3) : '0.000 (не актив.)'}
                  </span>
                  <span className={boost > 0 ? 'text-amber-500 font-medium' : 'text-[var(--text-mut)]'}>
                    Boost: {boost > 0 ? `+${boost.toFixed(3)}` : '0.000 (не актив.)'}
                  </span>
                  <span className={mmrMagnitude > 0 ? 'text-red-500 font-medium' : 'text-[var(--text-mut)]'}>
                    MMR: {mmrMagnitude > 0 ? `-${mmrMagnitude.toFixed(3)}` : '0.000 (не актив.)'}
                  </span>
                  {xrayMode === 'full' && (
                    <>
                      <span className={rrf > 0 ? 'text-indigo-400' : 'text-[var(--text-mut)]'}>
                        RRF: {rrf > 0 ? rrf.toFixed(4) : '0.0000'}
                      </span>
                      <span className={kinetic > 0 ? 'text-purple-400 font-medium' : 'text-[var(--text-mut)]'}>
                        Kinetic: {kinetic > 0 ? `+${kinetic.toFixed(3)}` : '0.000 (не актив.)'}
                      </span>
                      <span className={serendipity > 0 ? 'text-cyan-400 font-medium' : 'text-[var(--text-mut)]'}>
                        Serendipity: {serendipity > 0 ? `+${serendipity.toFixed(3)}` : '0.000 (не актив.)'}
                      </span>
                    </>
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
