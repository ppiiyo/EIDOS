import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Microscope,
  Search,
  Sparkles,
  Zap,
  MousePointerClick,
  ThumbsDown,
  Clock,
  Layers,
} from 'lucide-react';
import { XRaySearchResponse } from '../types';

export interface QueryInspectorProps {
  id?: string;
  query: string;
  mode: 'hybrid' | 'dense' | 'sparse';
  alpha: number;
  xrayData: XRaySearchResponse | null;
  isLoading: boolean;
  onChangeQuery: (q: string) => void;
  onChangeMode: (m: 'hybrid' | 'dense' | 'sparse') => void;
  onChangeAlpha: (a: number) => void;
  onExecuteSearch: (q: string, mode?: 'hybrid' | 'dense' | 'sparse', alpha?: number) => void;
  onBoostItem?: (itemId: string, boostWeight: number, query: string) => void;
  onSendFeedback?: (itemId: string, eventType: 'click' | 'purchase' | 'dislike', query: string) => void;
}

const QUICK_INSPECT_QUERIES = [
  'кроссовки nike',
  'quantum spatial audio headphones',
  'беспроводные наушники anc',
  'механическая клавиатура rgb',
];

export const QueryInspector: React.FC<QueryInspectorProps> = ({
  id,
  query,
  mode,
  alpha,
  xrayData,
  isLoading,
  onChangeQuery,
  onChangeMode,
  onChangeAlpha,
  onExecuteSearch,
  onBoostItem,
  onSendFeedback,
}) => {
  const [selectedRankIdx, setSelectedRankIdx] = useState<number>(0);

  const results = (xrayData?.results || []).slice(0, 5);
  const activeItem = results[selectedRankIdx] || results[0] || null;

  // Normalize Sparse BM25 onto a visual scale [0..1] for the Stacked Bar Chart while preserving raw numbers in tooltips & labels
  const maxSparse = Math.max(
    1,
    ...results.map((r) => r.explanation?.sparseBm25Component || 0)
  );

  const chartData = results.map((item, idx) => {
    const exp = item.explanation || {
      denseComponent: 0,
      sparseBm25Component: 0,
      rrfScore: 0,
      mmrPenalty: 0,
      businessBoost: 0,
    };
    const shortTitle =
      item.title.length > 26 ? `#${idx + 1} ${item.title.slice(0, 26)}…` : `#${idx + 1} ${item.title}`;

    return {
      rank: idx + 1,
      id: item.id,
      name: shortTitle,
      fullTitle: item.title,
      denseVisual: Number(exp.denseComponent.toFixed(3)),
      sparseVisual: Number(((exp.sparseBm25Component / maxSparse) * 0.85).toFixed(3)),
      mmrVisual: Number(Math.abs(exp.mmrPenalty).toFixed(3)),
      boostVisual: Number(exp.businessBoost.toFixed(3)),
      rawDense: exp.denseComponent,
      rawSparse: exp.sparseBm25Component,
      rawMmr: exp.mmrPenalty,
      rawBoost: exp.businessBoost,
      rrfScore: exp.rrfScore,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedRankIdx(0);
    onExecuteSearch(query, mode, alpha);
  };

  return (
    <div
      id={id}
      className="rounded-lg bg-[#1e293b] border border-slate-700/80 p-4 flex flex-col gap-4"
    >
      {/* Header & Live Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-700/80">
        <div>
          <div className="flex items-center gap-2">
            <Microscope size={16} className="text-[#3b82f6]" />
            <h2 className="text-sm font-semibold text-[#f1f5f9] uppercase tracking-wider">
              Explainable X-Ray: Query Inspector (POST /v1/search)
            </h2>
            {xrayData && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-slate-800 text-slate-300 border border-slate-700">
                <Clock size={11} className="text-[#22c55e]" />
                {xrayData.latencyMs.toFixed(2)} ms · {xrayData.mode.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Декомпозиция формулы ранжирования Топ-5 товаров: Dense (смысл) + Sparse BM25 (точное совпадение) + MMR Penalty + Business Boost
          </p>
        </div>

        {/* Quick Query Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Примеры:</span>
          {QUICK_INSPECT_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onChangeQuery(q);
                setSelectedRankIdx(0);
                onExecuteSearch(q, mode, alpha);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                query === q
                  ? 'bg-[#3b82f6] text-white font-semibold'
                  : 'bg-[#0f172a] text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input + Mode & Alpha Controls */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
        <div className="lg:col-span-6 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Введите поисковый запрос для X-Ray диагностики..."
            className="w-full pl-9 pr-3 py-2 rounded bg-[#0f172a] border border-slate-700 text-[13px] text-[#f1f5f9] placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="lg:col-span-2 flex items-center gap-1 bg-[#0f172a] p-1 rounded border border-slate-700">
          {(['hybrid', 'dense', 'sparse'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onChangeMode(m);
                onExecuteSearch(query, m, alpha);
              }}
              className={`flex-1 py-1 rounded text-[11px] font-mono uppercase cursor-pointer ${
                mode === m
                  ? 'bg-[#3b82f6] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 flex items-center gap-2 bg-[#0f172a] px-2.5 py-1.5 rounded border border-slate-700">
          <span className="text-[11px] font-mono text-slate-400 shrink-0">
            α={alpha.toFixed(2)}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={alpha}
            onChange={(e) => {
              const nextAlpha = Number(e.target.value);
              onChangeAlpha(nextAlpha);
            }}
            onMouseUp={() => onExecuteSearch(query, mode, alpha)}
            className="w-full accent-[#3b82f6] cursor-pointer"
            title="Баланс Dense (1.0) vs Sparse BM25 (0.0)"
          />
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-3 rounded bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-semibold text-[12px] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Layers size={13} />
            <span>{isLoading ? 'Инспекция...' : 'Проверить Топ-5'}</span>
          </button>
        </div>
      </form>

      {/* SEO Specialist Diagnostic Callout Box */}
      {activeItem ? (
        <div className="p-3 rounded-lg bg-[#0f172a] border border-[#3b82f6]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <Sparkles size={16} className="text-[#22c55e] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                SEO X-Ray Инсайт для позиции #{selectedRankIdx + 1} ({activeItem.title}):
              </div>
              <p className="text-[13px] font-medium text-[#f1f5f9] mt-0.5">
                «Этот товар на {selectedRankIdx + 1}-м месте, потому что{' '}
                <span className="font-mono font-bold text-[#3b82f6]">
                  Dense Score {activeItem.explanation.denseComponent.toFixed(2)}
                </span>{' '}
                (смысл) +{' '}
                <span className="font-mono font-bold text-[#22c55e]">
                  Sparse Score {activeItem.explanation.sparseBm25Component.toFixed(1)}
                </span>{' '}
                (точное совпадение)
                {activeItem.explanation.businessBoost > 0 && (
                  <>
                    {' '}
                    +{' '}
                    <span className="font-mono font-bold text-amber-400">
                      Business Boost +{activeItem.explanation.businessBoost.toFixed(2)}
                    </span>
                  </>
                )}
                {activeItem.explanation.mmrPenalty > 0 && (
                  <>
                    {' '}
                    −{' '}
                    <span className="font-mono font-bold text-[#ef4444]">
                      MMR Penalty {activeItem.explanation.mmrPenalty.toFixed(2)}
                    </span>{' '}
                    (диверсификация)
                  </>
                )}
                »
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onBoostItem && (
              <button
                type="button"
                onClick={() => onBoostItem(activeItem.id, 0.35, query)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/25 border border-[#22c55e]/40 cursor-pointer"
              >
                <Zap size={12} />
                <span>Boost #{selectedRankIdx + 1}</span>
              </button>
            )}
            {onSendFeedback && (
              <>
                <button
                  type="button"
                  onClick={() => onSendFeedback(activeItem.id, 'click', query)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                  title="Отправить тестовый клик в POST /v1/feedback"
                >
                  <MousePointerClick size={12} />
                  <span>+Click</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendFeedback(activeItem.id, 'dislike', query)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-800 text-slate-400 hover:text-[#ef4444] border border-slate-700 cursor-pointer"
                  title="Понизить популярность через POST /v1/feedback (dislike)"
                >
                  <ThumbsDown size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded bg-[#0f172a] border border-[#ef4444]/40 text-[13px] text-[#ef4444]">
          По запросу «{query}» найдено 0 результатов. Добавьте синоним в блоке Zero-Result Queries!
        </div>
      )}

      {/* Main Split Grid: Left = Recharts Stacked Bar Chart, Right = Top-5 Interactive Breakdown Rows */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Stacked Bar Chart */}
          <div className="lg:col-span-7 rounded bg-[#0f172a] p-3 border border-slate-800 flex flex-col justify-between min-h-[260px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-300 uppercase tracking-wider">
                Stacked Score Decomposition (Top-5)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Dense (384-d) · Sparse (BM25) · Boost · MMR
              </span>
            </div>

            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={165}
                    stroke="#64748b"
                    tick={{ fill: '#f1f5f9', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    formatter={(val: any, name: any, props: any) => {
                      const p = props?.payload;
                      if (name === 'Dense Component (смысл)') {
                        return [`${p?.rawDense?.toFixed(4)}`, name];
                      }
                      if (name === 'Sparse Component (BM25)') {
                        return [`${p?.rawSparse?.toFixed(2)} (norm: ${val})`, name];
                      }
                      if (name === 'Business Boost') {
                        return [`+${p?.rawBoost?.toFixed(2)}`, name];
                      }
                      if (name === 'MMR Penalty') {
                        return [`-${p?.rawMmr?.toFixed(3)}`, name];
                      }
                      return [val, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                  />
                  <Bar
                    dataKey="denseVisual"
                    name="Dense Component (смысл)"
                    stackId="score"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="sparseVisual"
                    name="Sparse Component (BM25)"
                    stackId="score"
                    fill="#22c55e"
                  />
                  <Bar
                    dataKey="boostVisual"
                    name="Business Boost"
                    stackId="score"
                    fill="#f59e0b"
                  />
                  <Bar
                    dataKey="mmrVisual"
                    name="MMR Penalty"
                    stackId="score"
                    fill="#ef4444"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Top-5 Product Score Cards */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            {results.map((item, idx) => {
              const isSelected = idx === selectedRankIdx;
              const exp = item.explanation;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRankIdx(idx)}
                  className={`p-2.5 rounded border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0f172a] border-[#3b82f6] ring-1 ring-[#3b82f6]/40'
                      : 'bg-[#0f172a]/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${
                          idx === 0
                            ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-[#f1f5f9] truncate">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                      RRF: <strong className="text-[#f1f5f9]">{exp.rrfScore.toFixed(4)}</strong>
                    </span>
                  </div>

                  {/* Numeric Pill Bar */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2 text-[11px] font-mono tabular-nums">
                    <div className="px-1.5 py-0.5 rounded bg-[#3b82f6]/15 text-[#3b82f6]">
                      Dense: {exp.denseComponent.toFixed(2)}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-[#22c55e]/15 text-[#22c55e]">
                      BM25: {exp.sparseBm25Component.toFixed(1)}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      Boost: +{exp.businessBoost.toFixed(2)}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444]">
                      MMR: -{exp.mmrPenalty.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
